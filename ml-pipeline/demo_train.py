"""
DEMO trainer — fast, small, end-to-end. NOT the final model.

Trains a compact leakage-safe differential model on a ~100k-admission sample so we
can stand up an interactive demo today. Inputs a clinician can actually type:
  age, sex, BMI, systolic BP, prior conditions (CCSR), home medications.
Target: top-K most frequent DISEASE CCSR categories (FAC*/SYM* excluded).

One sparse LogisticRegression per condition (fast, CPU, and its coefficients give a
simple, honest "why"). Saves everything the demo app needs to demo_model.pkl.
"""
import pickle, numpy as np, pandas as pd
from scipy.sparse import csr_matrix, hstack
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from db import connect

K_LABELS   = 40     # conditions to predict
N_PRIORDX  = 80     # prior-condition features (top CCSR)
N_MEDS     = 80     # home-med features (top drugs)
SAMPLE     = {"train": 70000, "val": 15000, "test": 15000}


def ccsr_titles(conn):
    """Representative human label per CCSR = most frequent member code's long_title."""
    q = """
    SELECT ccsr, long_title FROM (
      SELECT x.ccsr, d.long_title,
             row_number() OVER (PARTITION BY x.ccsr ORDER BY c.cnt DESC) rn
      FROM (SELECT icd_code, icd_version, count(*) cnt
            FROM mimic_hosp.diagnoses_icd GROUP BY 1,2) c
      JOIN ml.icd_to_ccsr x ON x.icd_code=c.icd_code AND x.icd_version=c.icd_version
      JOIN mimic_hosp.d_icd_diagnoses d
        ON d.icd_code=c.icd_code AND d.icd_version=c.icd_version
    ) t WHERE rn=1;"""
    return dict(pd.read_sql(q, conn).itertuples(index=False, name=None))


def build_cohort(conn):
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS ml.demo_cohort")
    cur.execute("CREATE TABLE ml.demo_cohort (hadm_id int primary key, split text)")
    for sp, n in SAMPLE.items():
        cur.execute("""INSERT INTO ml.demo_cohort
            SELECT hadm_id, split FROM ml.split WHERE split=%s
            ORDER BY md5(hadm_id::text) LIMIT %s""", (sp, n))
    conn.commit()


def main():
    with connect() as conn:
        titles = ccsr_titles(conn)
        build_cohort(conn)
        # Use array_agg to pull one row per admission instead of millions of long-form rows.
        # 2.5M meds rows → 55k rows; 2M pdx rows → 100k rows. ~20x less data over the network.
        cur = conn.cursor()
        print("fetching spine...", flush=True)
        spine = pd.read_sql("""SELECT s.hadm_id, s.admission_age, s.gender,
                 dc.split, v.bmi, v.bp_sys
                 FROM ml.demo_cohort dc
                 JOIN ml.cohort_spine s USING (hadm_id)
                 LEFT JOIN ml.feat_vitals v USING (hadm_id)""", conn)
        print(f"  spine: {len(spine)} rows", flush=True)

        print("fetching pdx (array_agg)...", flush=True)
        cur.execute("""SELECT p.hadm_id, array_agg(p.ccsr) AS ccsrs
                       FROM ml.feat_prior_dx p
                       JOIN ml.demo_cohort dc USING (hadm_id)
                       GROUP BY p.hadm_id""")
        pdx_raw = cur.fetchall()
        pdx = pd.DataFrame(
            [(h, c) for h, ccsrs in pdx_raw for c in ccsrs],
            columns=["hadm_id", "ccsr"])
        print(f"  pdx: {len(pdx_raw)} admissions → {len(pdx)} rows", flush=True)

        print("fetching meds (array_agg)...", flush=True)
        cur.execute("""SELECT m.hadm_id, array_agg(m.drug_norm) AS drugs
                       FROM ml.feat_meds m
                       JOIN ml.demo_cohort dc USING (hadm_id)
                       GROUP BY m.hadm_id""")
        meds_raw = cur.fetchall()
        meds = pd.DataFrame(
            [(h, d) for h, drugs in meds_raw for d in drugs],
            columns=["hadm_id", "drug_norm"])
        print(f"  meds: {len(meds_raw)} admissions → {len(meds)} rows", flush=True)

        print("fetching labels (array_agg)...", flush=True)
        cur.execute("""SELECT l.hadm_id, array_agg(l.ccsr) AS ccsrs
                       FROM ml.labels l
                       JOIN ml.demo_cohort dc USING (hadm_id)
                       WHERE left(l.ccsr,3) NOT IN ('FAC','SYM')
                       GROUP BY l.hadm_id""")
        lab_raw = cur.fetchall()
        lab = pd.DataFrame(
            [(h, c) for h, ccsrs in lab_raw for c in ccsrs],
            columns=["hadm_id", "ccsr"])
        print(f"  labels: {len(lab_raw)} admissions → {len(lab)} rows", flush=True)

    order = spine["hadm_id"].tolist()
    pos = {h: i for i, h in enumerate(order)}
    split = spine["split"].to_numpy()
    tr, va = split == "train", split == "val"
    train_hadm = set(spine.loc[tr, "hadm_id"])

    # vocabularies (by TRAIN frequency)
    pdx_vocab = pdx[pdx.hadm_id.isin(train_hadm)]["ccsr"].value_counts().head(N_PRIORDX).index.tolist()
    med_vocab = meds[meds.hadm_id.isin(train_hadm)]["drug_norm"].value_counts().head(N_MEDS).index.tolist()
    labels    = lab[lab.hadm_id.isin(train_hadm)]["ccsr"].value_counts().head(K_LABELS).index.tolist()

    def multihot(df, col, vocab):
        ix = {c: i for i, c in enumerate(vocab)}
        d = df[df[col].isin(ix)]
        r = d["hadm_id"].map(pos).to_numpy(); c = d[col].map(ix).to_numpy()
        return csr_matrix((np.ones(len(d), np.float32), (r, c)), shape=(len(order), len(vocab)))

    # dense block
    dense = pd.DataFrame(index=range(len(order)))
    dense["age"] = spine["admission_age"].fillna(spine["admission_age"].median())
    dense["is_female"] = (spine["gender"] == "F").astype(int)
    dense["bmi"] = spine["bmi"].fillna(spine["bmi"].median())
    dense["bp_sys"] = spine["bp_sys"].fillna(spine["bp_sys"].median())
    dense_cols = list(dense.columns)
    Xd = csr_matrix(dense.to_numpy(np.float32))
    Xp = multihot(pdx, "ccsr", pdx_vocab)
    Xm = multihot(meds, "drug_norm", med_vocab)
    X = hstack([Xd, Xp, Xm]).tocsr()
    feat_names = dense_cols + [f"prior:{c}" for c in pdx_vocab] + [f"med:{c}" for c in med_vocab]

    Y = multihot(lab, "ccsr", labels).toarray().astype(np.int8)

    # one model per condition — trained in parallel across all CPU cores
    from joblib import Parallel, delayed
    import os
    n_jobs = min(len(labels), os.cpu_count() or 4)

    def fit_one(j):
        m = LogisticRegression(solver="liblinear", C=1.0, max_iter=100)
        m.fit(X[tr], Y[tr, j])
        p = m.predict_proba(X)[:, 1].astype(np.float32)
        return j, (m.coef_[0].astype(np.float32), float(m.intercept_[0])), p

    results = Parallel(n_jobs=n_jobs, prefer="threads")(
        delayed(fit_one)(j) for j in range(len(labels))
    )
    models = {}
    proba = np.zeros((len(order), len(labels)), np.float32)
    for j, coef_int, p in results:
        models[labels[j]] = coef_int
        proba[:, j] = p

    # quick honest val metric
    def recall_at_k(Yt, P, k):
        idx = np.argsort(-P, axis=1)[:, :k]
        hit = np.take_along_axis(Yt, idx, axis=1).sum(1)
        return float(np.mean(hit / np.clip(Yt.sum(1), 1, None)))
    r10, r20 = recall_at_k(Y[va], proba[va], 10), recall_at_k(Y[va], proba[va], 20)
    auprc = average_precision_score(Y[va][:, Y[va].sum(0) > 0], proba[va][:, Y[va].sum(0) > 0], average="micro")
    print(f"DEMO val: Recall@10={r10:.3f}  Recall@20={r20:.3f}  micro-AUPRC={auprc:.3f}")

    artifact = {
        "feat_names": feat_names, "dense_cols": dense_cols,
        "pdx_vocab": pdx_vocab, "med_vocab": med_vocab,
        "labels": labels, "models": models, "titles": titles,
        "dense_median": {"age": float(dense["age"].median()), "bmi": float(dense["bmi"].median()),
                         "bp_sys": float(dense["bp_sys"].median())},
        "metrics": {"recall@10": round(r10, 3), "recall@20": round(r20, 3),
                    "micro_auprc": round(float(auprc), 3)},
    }
    with open("demo_model.pkl", "wb") as f:
        pickle.dump(artifact, f)
    print(f"saved demo_model.pkl  ({len(labels)} conditions, {len(feat_names)} features)")


if __name__ == "__main__":
    main()
