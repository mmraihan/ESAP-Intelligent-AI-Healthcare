/**
 * Public evidence page (§16.12, §18).
 *
 * The page a sceptical CMIO is sent to. It leads with the weakest number rather
 * than the strongest, because that is the one they will find anyway, and a
 * vendor who volunteered it is a vendor worth a second meeting.
 *
 * English and Arabic (QA issue 14). Model records from the server (names,
 * outcomes, strata, negative controls) are translated with t() at render; a
 * record with no Arabic entry falls back to its English text.
 */
import { MODELS, SUBGROUP_FAIRNESS } from "@/mock/db";
import { formatEce, isEvaluated } from "@/lib/evidence";
import { num } from "@/lib/format";
import { BarRows } from "@/components/ui/charts";
import { Badge, Banner, Card } from "@/components/ui/primitives";
import { t, tr } from "@/i18n";
import { SiteLayout } from "./SiteLayout";
import { EvidenceArt } from "./SiteArt";
import { AlertIcon, CheckIcon, FlaskIcon, ScaleIcon, XIcon } from "@/components/ui/icons";

const STATUS: Record<string, string> = {
  live: "live", degraded: "degraded", not_ready: "not evaluated", shadow: "shadow", retired: "retired",
};

export function ModelEvidencePage() {
  const m01 = MODELS.find((m) => m.id === "M-01");
  const m02 = MODELS.find((m) => m.id === "M-02");
  const m01Recall = Number(m01?.headline[0]?.value) || 0;
  const cold = m01?.strata.find((x) => /cold/i.test(x.label));
  const m01Ready = m01 ? isEvaluated(m01) : false;
  const withEce = MODELS.filter((m) => m.id !== "M-05" && isEvaluated(m));
  const coldShare = m01 && cold ? cold.n / Math.max(1, m01.strata.reduce((a, x) => a + x.n, 0)) : null;
  if (!m01) {
    return (
      <SiteLayout>
        <section className="hero"><h1>{t("Evidence")}</h1><p className="hero-lede">{t("The model evaluation is not available from this server.")}</p></section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="hero hero-split" style={{ paddingBottom: 0 }}>
        <div className="hero-copy">
          <span className="hero-eyebrow"><FlaskIcon size={14} /> {t("Evidence")}</span>
          <h1>{t("The weakest number first.")}</h1>
          <p className="hero-lede">
            {t("Every vendor leads with their best metric. Here is ours going the other way, because you will find it in the pilot anyway and it is better that you hear it now.")}
          </p>
        </div>
        <EvidenceArt />
      </section>

      {!MODELS.some(isEvaluated) && (
        <section>
          <Banner tone="warning" icon={<AlertIcon size={18} />} title={t("No model evaluation is published on this server")}>
            {t("The evaluation files are not on this server, so no performance figures are shown. Estimates in the hosted demo come from placeholder models and are not validated.")}
          </Banner>
        </section>
      )}

      <section className="grid grid-2">
        {!m01Ready ? (
          <Card title={t("M-01 differential — pooled vs. stratified")} subtitle={t("Not evaluated on this server")}>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t("No results are available to show.")}</p>
          </Card>
        ) : (
        <Card
          title={t("M-01 differential — pooled vs. stratified")}
          subtitle={t("Recall@20 · {n} CCSR categories scored", { n: m01.headline.find((h) => /labels/i.test(h.label))?.value ?? "—" })}
          footnote={t("Cohort n = {n}. The pooled figure is the one that would go on a slide; the split is the one that determines whether it helps with your patient.", { n: num(m01.cohortN) })}
        >
          <BarRows
            rows={[
              { key: "pooled", label: t("Pooled"), value: m01Recall, meta: t("all admissions") },
              ...m01.strata.map((s) => ({ key: s.label, label: t(s.label), value: s.value, meta: `n = ${num(s.n)}` })),
            ]}
            max={Math.max(0.6, m01Recall, ...m01.strata.map((x) => x.value))}
            format={(v) => v.toFixed(3)}
          />
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {coldShare !== null
              ? t("A cold-start patient — no coded history on file — gets materially worse performance. {pct}% of the held-out admissions are in that group, and the product labels them rather than averaging them away.", { pct: Math.round(coldShare * 100) })
              : t("A cold-start patient — no coded history on file — gets materially worse performance, and the product labels them rather than averaging them away.")}
          </p>
        </Card>
        )}

        <Card title={t("Calibration")} subtitle={t("Expected calibration error on the held-out test set")}>
          {withEce.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t("No calibration has been measured on this server.")}</p>
          ) : (
            <>
              <BarRows
                rows={withEce.map((m) => ({ key: m.id, label: `${m.id} ${t(m.name)}`, value: m.ece, meta: t(m.calibrationMethod) }))}
                max={0.05}
                format={(v) => v.toFixed(4)}
              />
              <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                {t("Lower is better; 0.05 is the action threshold.")}{" "}
                {m02 && isEvaluated(m02) ? t("M-02 is {v}.", { v: m02.ece.toFixed(4) }) + " " : ""}
                {t("The per-bin reliability curves are not stored with the evaluation, so they are not drawn here.")}
              </p>
            </>
          )}
        </Card>
      </section>

      <section>
        <Card
          title={<span className="row" style={{ gap: 8 }}><ScaleIcon size={18} /> {t("Performance by subgroup")}</span>}
          subtitle={t("Published, not asserted")}
          footnote={t("Race and insurance are recorded solely so this table can exist. They are never model inputs, and they never appear on a clinical screen.")}
          padded={false}
        >
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Subgroup")}</th>
                  <th style={{ textAlign: "end" }}>{t("n")}</th>
                  <th style={{ textAlign: "end" }} lang="en">AUROC</th>
                  <th style={{ textAlign: "end" }} lang="en">ECE</th>
                  <th>{t("Assessment")}</th>
                </tr>
              </thead>
              <tbody>
                {SUBGROUP_FAIRNESS.length === 0 && (
                  <tr><td colSpan={5} className="muted">
                    {t("No subgroup evaluation has been run on these models yet. When it has, every group and every metric will be published here — including the ones that look bad.")}
                  </td></tr>
                )}
                {SUBGROUP_FAIRNESS.map((s) => {
                  const weak = s.auroc < 0.84 || s.ece > 0.03;
                  return (
                    <tr key={s.subgroup}>
                      <td><strong>{t(s.subgroup)}</strong></td>
                      <td style={{ textAlign: "end" }} className="tnum">{num(s.n)}</td>
                      <td style={{ textAlign: "end" }} className="tnum">{s.auroc.toFixed(3)}</td>
                      <td style={{ textAlign: "end" }} className="tnum">{s.ece.toFixed(3)}</td>
                      <td>
                        <span className={weak ? "pill pill-warning" : "pill pill-good"}>
                          {weak ? <AlertIcon size={12} /> : <CheckIcon size={12} />}
                          {weak ? t("Investigate") : t("Within tolerance")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="grid grid-2">
        <Card title={t("How we handled class imbalance")} subtitle={t("And what we deliberately did not do")}>
          <ul className="caveat-list">
            <li><XIcon size={14} /> <span>{tr("**No SMOTE, no oversampling.** Synthetic minority sampling improves a confusion matrix and wrecks calibration — and calibration is what makes a probability mean anything to a clinician.")}</span></li>
            <li><CheckIcon size={14} /> {t("Class weights during training.")}</li>
            <li><CheckIcon size={14} /> {t("Ranking metrics and reliability curves for evaluation, not accuracy.")}</li>
            <li><CheckIcon size={14} /> {t("Per-label isotonic calibration fitted on a held-out split; conformal intervals for length of stay.")}</li>
          </ul>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {t("If you are comparing vendors, ask each of them this question and ask to see the reliability curve. A model balanced into a good-looking AUROC has one it will not want to show you.")}
          </p>
        </Card>

        <Card title={t("How we know it is not cheating")} subtitle={t("The leakage alarm and its negative control")}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            {t("An intake-only model that scores too well is almost always a model that saw something from during the stay. So there is a hard ceiling: if pooled Recall@20 goes above 0.60, an alarm fires and the number is not trusted until a negative control has been run and recorded.")}
          </p>
          <div className="note-block">
            <strong>{t("M-01 negative control:")}</strong> {t(m01.negativeControl)}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {t("The alarm cannot be silenced from any screen in the product. It can be explained and resolved; it cannot be dismissed.")}
          </p>
        </Card>
      </section>

      <section>
        <Card title={t("Every model, every headline number")} padded={false}>
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Model")}</th><th>{t("Outcome")}</th><th>{t("Status")}</th>
                  <th style={{ textAlign: "end" }}>{t("Headline")}</th>
                  <th style={{ textAlign: "end" }} lang="en">ECE</th>
                  <th>{t("Weakest stratum")}</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => {
                  const weakest = [...m.strata].sort((a, b) => a.value - b.value)[0] ?? { label: "—", metric: "", value: 0 };
                  return (
                    <tr key={m.id}>
                      <td><strong>{m.id}</strong></td>
                      <td>
                        <div className="cell-stack">
                          <span>{t(m.name)}</span>
                          <span className="muted">{t(m.outcome)}</span>
                        </div>
                      </td>
                      <td><Badge tone={m.status === "live" ? "good" : "warning"}>{t(STATUS[m.status] ?? m.status)}</Badge></td>
                      <td style={{ textAlign: "end" }} className="tnum">
                        {isEvaluated(m) ? <>{m.headline[0]?.value ?? "—"} <span className="muted">{t(m.headline[0]?.label ?? "")}</span></> : "—"}
                      </td>
                      <td style={{ textAlign: "end" }} className="tnum">{m.id === "M-05" || !isEvaluated(m) ? "—" : formatEce(m.ece)}</td>
                      <td>
                        <div className="cell-stack">
                          <span>{t(weakest.label)}</span>
                          {m.strata.length > 0 && <span className="muted tnum">{t(weakest.metric)} {weakest.value.toFixed(3)}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <Banner tone="accent" title={t("What we do not have")}>
          {t("No controlled outcome study. No published peer-reviewed trial of this system. No claim that using ESAP reduces mortality, length of stay or readmission. When those exist, they will be pre-registered and they will be linked here whichever way they come out.")}
        </Banner>
      </section>
    </SiteLayout>
  );
}
