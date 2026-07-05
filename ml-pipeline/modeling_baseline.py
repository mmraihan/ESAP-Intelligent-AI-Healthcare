"""
Phase 2 — Multi-label baseline (the number to beat). MEMORY-LIGHT version.

Frame: concurrent comorbidity inference. Predict the CCSR condition categories of
the index admission from leakage-safe inputs:
  dense   : admission_age, gender, arrived_via_ed, bmi/weight/height/bp (+missing flags)
  sparse  : prior-admission CCSR history (multi-hot), current-admission meds (multi-hot)
Target   : top-K most frequent DISEASE CCSR categories (FAC*/SYM* excluded).

Keeps the feature matrix SPARSE (no dense blow-up) and uses sparse-native
one-vs-rest LogisticRegression, so peak RAM stays ~300 MB rather than several GB.
This is the FLOOR; heavier models (GBM/GNN/LLM) only adopted if they beat it.

Run:  python3 modeling_baseline.py [K]      (default K=50)
"""
import os, sys, json, gc
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "4")
import numpy as np, pandas as pd
from scipy.sparse import csr_matrix, hstack
from sklearn.metrics import average_precision_score
from sklearn.linear_model import LogisticRegression
from db import connect

K = int(sys.argv[1]) if len(sys.argv) > 1 else 50


def load():
    with connect() as c:
        spine = pd.read_sql("""SELECT s.hadm_id, s.admission_age, s.gender,
                  s.arrived_via_ed, sp.split
                  FROM ml.cohort_spine s JOIN ml.split sp USING (hadm_id)""", c)
        vit   = pd.read_sql("SELECT * FROM ml.feat_vitals", c)
        pdx   = pd.read_sql("SELECT hadm_id, ccsr FROM ml.feat_prior_dx", c)
        meds  = pd.read_sql("SELECT hadm_id, drug_norm FROM ml.feat_meds", c)
        lab   = pd.read_sql("""SELECT hadm_id, ccsr FROM ml.labels
                  WHERE left(ccsr,3) NOT IN ('FAC','SYM')""", c)
    return spine, vit, pdx, meds, lab


def multihot(df, key_col, cat_col, row_pos, vocab=None):
    """Build a CSR multi-hot matrix aligned to row_pos over cat vocabulary."""
    if vocab is None:
        vocab = sorted(df[cat_col].unique())
    cat_ix = {c: i for i, c in enumerate(vocab)}
    d = df[df[key_col].isin(row_pos)]
    rows = d[key_col].map(row_pos).to_numpy()
    cols = d[cat_col].map(cat_ix).to_numpy()
    M = csr_matrix((np.ones(len(d), dtype=np.float32), (rows, cols)),
                   shape=(len(row_pos), len(vocab)))
    return M, vocab


def main():
    spine, vit, pdx, meds, lab = load()
    spine = spine.merge(vit, on="hadm_id", how="left")
    order = spine["hadm_id"].tolist()
    row_pos = {h: i for i, h in enumerate(order)}

    # ---- dense block (small) ----
    dense = pd.DataFrame(index=range(len(spine)))
    dense["age"] = spine["admission_age"].fillna(spine["admission_age"].median())
    dense["is_female"] = (spine["gender"] == "F").astype(int)
    dense["via_ed"] = spine["arrived_via_ed"].astype(int)
    for col in ["bmi", "weight_kg", "height_cm", "bp_sys", "bp_dia"]:
        dense[f"{col}_missing"] = spine[col].isna().astype(int)
        dense[col] = spine[col].fillna(spine[col].median())
    Xd = csr_matrix(dense.to_numpy(dtype=np.float32))

    # ---- sparse blocks ----
    Xp, _ = multihot(pdx,  "hadm_id", "ccsr",      row_pos)
    Xm, _ = multihot(meds, "hadm_id", "drug_norm", row_pos)

    # labels: top-K disease CCSR by TRAIN frequency
    split = spine["split"].to_numpy()
    tr, va, te = split == "train", split == "val", split == "test"
    train_hadm = set(spine.loc[tr, "hadm_id"])
    topk = (lab[lab.hadm_id.isin(train_hadm)]["ccsr"]
            .value_counts().head(K).index.tolist())
    Y, _ = multihot(lab, "hadm_id", "ccsr", row_pos, vocab=topk)
    Y = Y.toarray().astype(np.int8)

    has_hist = np.asarray((Xp.sum(axis=1) > 0)).ravel()
    del pdx, meds, lab, vit, dense; gc.collect()      # free the row-level frames

    X = hstack([Xd, Xp, Xm]).tocsr()                  # stays SPARSE
    print(f"rows: {len(order):,} | train {tr.sum():,} val {va.sum():,} test {te.sum():,}", flush=True)
    print(f"features (sparse): dense {Xd.shape[1]} + prior_dx {Xp.shape[1]} + meds {Xm.shape[1]} "
          f"= {X.shape[1]} | labels K={K}", flush=True)
    print(f"cold-start (no prior history) in test: {(~has_hist & te).sum():,}", flush=True)

    # ---- one-vs-rest sparse logistic regression ----
    Xtr = X[tr]
    proba = np.zeros((len(order), K), dtype=np.float32)
    for j in range(K):
        m = LogisticRegression(solver="liblinear", C=1.0, max_iter=200)
        m.fit(Xtr, Y[tr, j])
        proba[:, j] = m.predict_proba(X)[:, 1]
        if (j + 1) % 10 == 0:
            print(f"  trained {j+1}/{K} label models", flush=True)

    def recall_at_k(Yt, P, k):
        idx = np.argsort(-P, axis=1)[:, :k]
        hit = np.take_along_axis(Yt, idx, axis=1).sum(axis=1)
        denom = np.clip(Yt.sum(axis=1), 1, None)
        return float(np.mean(hit / denom))

    def report(mask):
        yt, p = Y[mask], proba[mask]
        keep = yt.sum(axis=0) > 0
        return {
            "n": int(mask.sum()),
            "micro_auprc": round(float(average_precision_score(yt[:, keep], p[:, keep], average="micro")), 4),
            "macro_auprc": round(float(average_precision_score(yt[:, keep], p[:, keep], average="macro")), 4),
            "recall@10": round(recall_at_k(yt, p, 10), 4),
            "recall@20": round(recall_at_k(yt, p, 20), 4),
        }

    results = {
        "model": "LogisticRegression (sparse, one-vs-rest)",
        "K": K, "n_features": int(X.shape[1]),
        "val": report(va), "test": report(te),
        "test_history": report(te & has_hist),
        "test_coldstart": report(te & ~has_hist),
        "top_labels": topk,
    }
    print(json.dumps({k: v for k, v in results.items() if k != "top_labels"}, indent=2))
    with open("baseline_metrics.json", "w") as f:
        json.dump(results, f, indent=2)
    print("saved -> baseline_metrics.json")


if __name__ == "__main__":
    main()
