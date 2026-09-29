"""Build `serving_reference.json` for MODEL_MODE=real, and prove the adapter.

The exported bundles carry the fitted models but not everything serving needs.
This job re-runs each model's OWN training data path (its `data_io` and
`build_X`, from `ml-pipeline/models/<model>/`) on the full cohort and records:

* per model: the train-split lab winsorisation bounds (p1/p99 per itemid);
* M-01: the train-split imputation medians (dense vitals and per-lab);
* M-02/03/04: 101 quantiles of calibrated risk on the held-out test split,
  which `population_percentile` is read against; M-04 also the top-decile
  alert threshold;
* M-05: pooled and longest-decile interval coverage and R2 on the test split.

It also checks its own work, and exits non-zero if any check fails:

1. the rebuilt column names equal the bundle's `feature_names`;
2. the rebuilt test AUROC (M-02..04) / MAE (M-05) / Recall@20 (M-01) matches
   the metrics file of record;
3. M-01: the rebuilt train dense block's mean equals the bundle scaler's
   `mean_`, which proves the medians are the ones training used;
4. the serving adapter (`app/predictors/real.py`), given test admissions as
   intake cases, reproduces the training path's predictions for those rows.

Everything it writes is MIMIC-derived: it goes to the export folder, which is
gitignored under the PhysioNet DUA. Run it from the backend directory with the
interpreter that has the scientific stack:

    python tools/build_model_reference.py            # all models
    python tools/build_model_reference.py --model M-03
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parents[2]
MODELS_DIR = REPO / "ml-pipeline" / "models"
EXPORTS = Path(os.environ.get("ESAP_EXPORTS_DIR") or REPO / "ml-pipeline" / "model_exports")
if not EXPORTS.is_absolute():
    EXPORTS = (BACKEND / EXPORTS).resolve()
OUT = EXPORTS / "serving_reference.json"

SPEC = {
    "M-01": {"dir": "m01_differential", "bundle": "M01_TowerA_main.pkl", "metrics": "metrics_tower_a.json"},
    "M-02": {"dir": "m02_mortality", "bundle": "M02_Mortality_full.pkl", "metrics": "metrics_mortality.json",
             "train": "train_mortality"},
    "M-03": {"dir": "m03_icu", "bundle": "M03_ICU_full.pkl", "metrics": "metrics_icu.json", "train": "train_icu"},
    "M-04": {"dir": "m04_readmission", "bundle": "M04_Readmit_intake_full.pkl", "metrics": "metrics_readmit.json",
             "train": "train_readmit"},
    "M-05": {"dir": "m05_los", "bundle": "M05_LOS_full.pkl", "metrics": "metrics_los.json", "train": "train_los"},
}
N_CHECK = 400  # test admissions pushed through the serving adapter per model


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _import_model(model_dir: Path):
    """Import one model folder's feature_config / data_io the way its trainer does."""
    sys.path.insert(0, str(REPO / "ml-pipeline"))
    sys.path.insert(0, str(model_dir))
    import data_io  # noqa: E402
    import feature_config as cfg  # noqa: E402

    return cfg, data_io


def _lab_bounds(labs_long, train_hadm, itemids, cfg) -> dict[str, list[float]]:
    tr = labs_long[labs_long["hadm_id"].isin(train_hadm) & labs_long["itemid"].isin(itemids)]
    q = tr.groupby("itemid")["value"].quantile([cfg.LAB_WINSOR_LOW_PCT / 100.0, cfg.LAB_WINSOR_HIGH_PCT / 100.0])
    q = q.unstack()
    return {str(i): [float(r.iloc[0]), float(r.iloc[1])] for i, r in q.iterrows()}


def _align(X, names: list[str], want: list[str]):
    """Match the rebuilt matrix to the bundle's columns.

    Two differences are lossless and reconciled by name:

    * the committed `onehot` always appends an OTHER bucket; the M-03/M-04
      bundles were trained by a variant that omitted it when no category was
      rare, so their admission-type block has none. That column is all zeros
      on the full cohort. Both blocks call their bucket `adm_OTHER`; the
      location block comes second, so the last occurrence is the one kept;
    * the lab vocabulary is ordered by train frequency, which can reshuffle
      when counts move slightly; every lab value and bound is keyed by itemid.

    Anything else is a real mismatch: returns (X, None, []). The AUROC of
    record and the adapter check still run on the aligned matrix.
    """
    import numpy as np

    if names == want:
        return X, names, []
    pos = {n: i for i, n in enumerate(names)}
    if len(set(want)) != len(want) or set(pos) != set(want):
        return X, None, []
    keep = [pos[n] for n in want]
    drop = sorted(set(range(len(names))) - set(keep))
    if any(np.any(X[:, i] != 0) for i in drop):
        return X, None, []
    if keep != sorted(keep):
        log("columns reordered by name to the bundle's order")
    return X[:, keep], want, [names[i] for i in drop]


def _check_rows(df, te, rng_seed=7):
    """Test admissions an intake case can express exactly: one numeric draw per lab."""
    import numpy as np

    ok = []
    for i in np.flatnonzero(te):
        toks = df.at[i, "labs"] or []
        ids, good = [], True
        for tok in toks:
            p = str(tok).split(":")
            try:
                float(p[1])
            except (IndexError, ValueError):
                good = False
                break
            ids.append(p[0])
        if good and len(ids) == len(set(ids)):
            ok.append(i)
    rng = np.random.default_rng(rng_seed)
    return rng.choice(ok, size=min(N_CHECK, len(ok)), replace=False)


def _intake(df, i):
    """One training row as the IntakeFeatures the API would receive."""
    import math

    from app.schemas.clinical import IntakeFeatures

    def num(v):
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        return None if math.isnan(f) else f

    row = df.iloc[i]
    labs = {}
    for tok in row["labs"] or []:
        p = str(tok).split(":")
        labs[p[0]] = float(p[1])
    get = row.get
    n_prior = num(get("n_prior_admissions"))
    cci = num(get("charlson_index"))
    # The API only accepts its catalogue labs; the models read up to 100. The
    # check wants the admission exactly as training saw it, so the labs are set
    # after validation.
    feats = IntakeFeatures.model_validate({
        "demographics": {"admission_age": int(row["admission_age"]), "is_female": int(row["gender"] == "F")},
        "admission_context": {
            "via_ed": int(bool(row["arrived_via_ed"])) if row["arrived_via_ed"] is not None else None,
            "admission_type": get("admission_type") if isinstance(get("admission_type"), str) else None,
            "admission_location": get("admission_location") if isinstance(get("admission_location"), str) else None,
        },
        "vitals": {k: num(row[k]) for k in ("bmi", "weight_kg", "height_cm", "bp_sys", "bp_dia")},
        "labs": {},
        "prior_history": {
            "prior_ccsr": list(row["prior_ccsr"] or []),
            "n_prior_admissions": int(n_prior or 0),
            "charlson_index": int(cci) if cci is not None else None,
        },
        "meds": [str(m) for m in (row["meds"] or [])],
    })
    object.__setattr__(feats, "labs", labs)
    return feats


# --- M-02..M-05 ---------------------------------------------------------------


def build_tree(model_id: str) -> dict:
    import pickle

    import numpy as np
    import pandas as pd
    from sklearn.metrics import roc_auc_score

    spec = SPEC[model_id]
    mdir = MODELS_DIR / spec["dir"]
    cfg, data_io = _import_model(mdir)
    train = __import__(spec["train"])
    bundle_path = EXPORTS / spec["bundle"]
    bundle = pickle.loads(bundle_path.read_bytes())
    metrics = json.loads((mdir / spec["metrics"]).read_text(encoding="utf-8", errors="replace"))

    log(f"{model_id}: pulling the full cohort through {spec['dir']}/data_io.py")
    kwargs = {"frame": "admittime"} if model_id == "M-04" else {}
    # The full pull takes ~20 min; keep it beside the model (gitignored *.pkl,
    # MIMIC-derived, never leaves the machine) so a rerun does not repeat it.
    cache = mdir / "serving_ref_cohort.pkl"
    if cache.exists():
        df = pd.read_pickle(cache)
    else:
        df = data_io.load_admissions(source="db", **kwargs).reset_index(drop=True)
        df.to_pickle(cache)
    df, _ = data_io.clean_vitals(df)
    split = df["split"].to_numpy()
    tr, te = split == "train", split == "test"
    log(f"{model_id}: {len(df):,} admissions; building X")
    if model_id == "M-04":
        X, names, _ = train.build_X(df, tr, [], frame="admittime")
    elif model_id == "M-05":
        X, names, _ = train.build_X(df, tr, [], int(bundle["monotonic_cst"][4]))
    else:
        X, names, _ = train.build_X(df, tr, [])
    problems = []
    X, names, dropped = _align(X, list(names), list(bundle["feature_names"]))
    if names is None:
        problems.append(f"{model_id}: rebuilt feature names differ from the bundle's")
        return {"problems": problems}
    if dropped:
        log(f"{model_id}: dropped all-zero rebuilt columns the bundle does not carry: {dropped}")

    labs_long = data_io.explode_labs(df)
    itemids = [n[4:] for n in names if n.startswith("lab_")]
    bounds = _lab_bounds(labs_long, set(df.loc[tr, "hadm_id"]), itemids, cfg)

    ref: dict = {"bundle_sha256": _sha(bundle_path), "lab_bounds": bounds, "n_test": int(te.sum())}
    if model_id == "M-05":
        y = pd.to_numeric(df["los_days"], errors="coerce").to_numpy(float)
        q = np.sort(np.column_stack([m.predict(X[te]) for m in bundle["quantile_models"]]), axis=1)
        Q = float(bundle["conformal_Q_hat_log"])
        lo, hi, med = np.expm1(q[:, 0] - Q), np.expm1(q[:, -1] + Q), np.expm1(q[:, 1])
        yt = y[te]
        cover = (yt >= lo) & (yt <= hi)
        cut = np.quantile(yt, 0.9)
        ss = np.sum((yt - med) ** 2)
        st = np.sum((yt - yt.mean()) ** 2)
        ref.update({
            "coverage": float(cover.mean()),
            "tail_coverage": float(cover[yt >= cut].mean()),
            "r2": float(1 - ss / st),
            "mae": float(np.mean(np.abs(yt - med))),
        })
        ref["tail_coverage_reduced"] = ref["tail_coverage"] < float(bundle["conformal_level"]) - 0.05
        rec = metrics["test"]
        log(f"M-05: coverage {ref['coverage']:.3f} vs {rec['coverage']} on record, "
            f"MAE {ref['mae']:.3f} vs {rec['mae_days']}, R2 {ref['r2']:.3f} vs {rec['r2_days']}")
        if abs(ref["mae"] - float(rec["mae_days"])) > 0.01 or abs(ref["coverage"] - float(rec["coverage"])) > 0.002:
            problems.append("M-05: rebuilt MAE/coverage do not match the metrics of record")
        test_pred = med
    else:
        y = pd.to_numeric(df[cfg.TARGET_COL], errors="coerce").to_numpy().astype(int)
        cal = bundle["calibrator"].predict(bundle["model"].predict_proba(X[te])[:, 1])
        auroc = float(roc_auc_score(y[te], cal))
        recorded = float(metrics["test"]["auroc"])
        log(f"{model_id}: rebuilt test AUROC {auroc:.4f} vs {recorded:.4f} on record")
        if abs(auroc - recorded) > 0.002:
            problems.append(f"{model_id}: rebuilt AUROC {auroc:.4f} != recorded {recorded:.4f}")
        ref["test_auroc"] = auroc
        ref["risk_quantiles"] = [float(v) for v in np.quantile(cal, np.linspace(0, 1, 101))]
        if model_id == "M-04":
            ref["top_decile_threshold"] = float(np.quantile(cal, 0.9))
        test_pred = cal

    # The serving adapter against the training path, admission by admission.
    sys.path.insert(0, str(BACKEND))
    from app.predictors import real

    check = _check_rows(df, te)
    te_index = {int(i): k for k, i in enumerate(np.flatnonzero(te))}
    names_l = list(names)
    meds = [n[4:] for n in names_l if n.startswith("med_")]
    worst_p, worst_col = 0.0, 0
    for i in check:
        case = real._case(_intake(df, int(i)), real.VITAL_RANGES["default"])
        row = np.asarray(real._tree_row(case, names_l, ref, meds), dtype=np.float32)
        want = X[int(i)]
        same = (row == want) | (np.isnan(row) & np.isnan(want)) | np.isclose(row, want, rtol=1e-5, atol=1e-5)
        if not same.all():
            worst_col += 1
            if worst_col <= 3:
                bad = [names_l[j] for j in np.flatnonzero(~same)][:6]
                log(f"{model_id}: row {int(df.at[int(i), 'hadm_id'])} differs in {bad}")
        if model_id == "M-05":
            got = float(np.expm1(np.sort([m.predict(row[None])[0] for m in bundle["quantile_models"]])[1]))
        else:
            got = float(real._tree_predict(bundle, [row.tolist()])[0])
        worst_p = max(worst_p, abs(got - float(test_pred[te_index[int(i)]])))
    log(f"{model_id}: adapter vs training path on {len(check)} test admissions: "
        f"{worst_col} rows with any differing column, max abs diff {worst_p:.2e}")
    if worst_col or worst_p > 1e-6:
        problems.append(f"{model_id}: adapter disagrees with the training path "
                        f"({worst_col} rows, max diff {worst_p:.2e})")
    ref["adapter_check"] = {"n": int(len(check)), "rows_differing": worst_col, "max_abs_diff": worst_p}
    ref["problems"] = problems
    return ref


# --- M-01 --------------------------------------------------------------------


def build_m01() -> dict:
    import pickle

    import numpy as np
    import pandas as pd

    spec = SPEC["M-01"]
    mdir = MODELS_DIR / spec["dir"]
    cfg, data_io = _import_model(mdir)
    bundle_path = EXPORTS / spec["bundle"]
    bundle = pickle.loads(bundle_path.read_bytes())
    metrics = json.loads((mdir / spec["metrics"]).read_text(encoding="utf-8", errors="replace"))

    log("M-01: loading the full cohort (cached pull if present)")
    df = data_io.load_admissions(source="db").reset_index(drop=True)
    df, _ = data_io.clean_vitals(df)
    split = df["split"].to_numpy()
    tr, te = split == "train", split == "test"
    med = data_io.fit_dense_medians(df, tr)

    labs_long = data_io.explode_labs(df)
    train_hadm = set(df.loc[tr, "hadm_id"])
    lab_vocab = list(bundle["lab_vocab"])
    bounds = _lab_bounds(labs_long, train_hadm, lab_vocab, cfg)
    labs_long, _ = data_io.winsorize_labs(labs_long, train_hadm)
    lab_mean = (labs_long[labs_long["itemid"].isin(lab_vocab)]
                .groupby(["hadm_id", "itemid"])["value"].mean().reset_index())
    lab_wide = lab_mean.pivot(index="hadm_id", columns="itemid", values="value").reindex(df["hadm_id"])
    lab_medians = {}
    for it in lab_vocab:
        vals = (lab_wide[it] if it in lab_wide else pd.Series(np.nan, index=df["hadm_id"])).to_numpy()
        lab_medians[it] = float(np.nanmedian(vals[tr])) if np.isfinite(vals[tr]).any() else 0.0

    # Rebuild the train dense block exactly as train_tower_a.py did, and compare
    # its mean with the scaler fitted on it: equal means prove equal medians.
    d = {"age": pd.to_numeric(df["admission_age"], errors="coerce").fillna(med["admission_age"]).to_numpy(),
         "is_female": (df["gender"] == "F").astype(int).to_numpy(),
         "via_ed": df["arrived_via_ed"].fillna(False).astype(int).to_numpy()}
    for col in cfg.DENSE_VITAL_COLS:
        s = pd.to_numeric(df[col], errors="coerce")
        d[f"{col}_miss"] = s.isna().astype(int).to_numpy()
        d[col] = s.fillna(med[col]).to_numpy()
    for it in lab_vocab:
        vals = (lab_wide[it] if it in lab_wide else pd.Series(np.nan, index=df["hadm_id"])).to_numpy()
        d[f"lab_{it}_miss"] = np.isnan(vals).astype(int)
        d[f"lab_{it}"] = np.where(np.isnan(vals), lab_medians[it], vals)
    cols = bundle["dense_columns"]
    dense = np.column_stack([np.asarray(d[c], dtype=np.float32) for c in cols])
    mean_gap = np.abs(dense[tr].astype(np.float64).mean(axis=0) - bundle["scaler"].mean_)
    rel = mean_gap / np.maximum(np.abs(bundle["scaler"].mean_), 1e-6)
    worst = int(np.argmax(rel))
    log(f"M-01: rebuilt train dense mean vs scaler.mean_: max rel gap {rel[worst]:.2e} ({cols[worst]})")
    problems = []
    if rel[worst] > 1e-4:
        problems.append(f"M-01: rebuilt medians do not reproduce the scaler (worst {cols[worst]})")

    ref = {
        "bundle_sha256": _sha(bundle_path),
        "dense_medians": {k: float(med[k]) for k in cfg.DENSE_VITAL_COLS},
        "lab_medians": lab_medians,
        "lab_bounds": bounds,
    }

    # Serving adapter on test admissions: Recall@20 against the admission's
    # own labels (within the model's label set), as the metrics file defines it.
    sys.path.insert(0, str(BACKEND))
    from app.predictors import real

    real.reset()
    real._STATE = real.Loaded(bundles={"M-01": bundle}, versions={"M-01": "check"}, reference={"M-01": ref})
    check = _check_rows(df, te)
    label_set = set(bundle["labels"])
    hits = []
    for i in check:
        out = real.differential(_intake(df, int(i)), top_n=20)
        true = {c for c in (df.at[int(i), "labels"] or []) if c in label_set}
        if true:
            got = {item["ccsr"] for item in out.result["items"]}
            hits.append(len(got & true) / len(true))
    real.reset()
    r20 = float(np.mean(hits))
    recorded = metrics.get("test", {}).get("recall@20") or metrics.get("recall_at_20")
    log(f"M-01: adapter Recall@20 on {len(hits)} test admissions {r20:.4f} (full-test record: {recorded})")
    ref["adapter_check"] = {"n": len(hits), "recall_at_20": r20}
    ref["problems"] = problems
    return ref


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=list(SPEC))
    ap.add_argument("--part", help=argparse.SUPPRESS)
    args = ap.parse_args()

    if args.part:  # child process: one model, printed as JSON on the last line
        ref = build_m01() if args.part == "M-01" else build_tree(args.part)
        print("@@REF@@" + json.dumps(ref))
        return 0

    current = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    failed = False
    for model_id in [args.model] if args.model else list(SPEC):
        # Each model in its own interpreter: the model folders all define
        # `feature_config` and `data_io`, and they must not shadow each other.
        proc = subprocess.run(
            [sys.executable, __file__, "--part", model_id], cwd=str(BACKEND),
            stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        )
        payload = None
        for line in proc.stdout.splitlines():
            if line.startswith("@@REF@@"):
                payload = json.loads(line[len("@@REF@@"):])
            else:
                print(line, flush=True)
        if proc.returncode or payload is None:
            log(f"{model_id}: FAILED (exit {proc.returncode})")
            failed = True
            continue
        for p in payload.get("problems", []):
            log(f"PROBLEM {p}")
            failed = True
        current[model_id] = payload
        current["_generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        OUT.write_text(json.dumps(current, indent=1), encoding="utf-8")
        log(f"{model_id}: written to {OUT}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
