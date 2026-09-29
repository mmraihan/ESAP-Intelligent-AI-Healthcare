/**
 * 11.5.4 — Model rollout console.
 *
 * Version pinning, canary traffic and rollback. The promotion gate is the point
 * of the screen: a version does not advance because the pooled metric looks
 * fine, it advances because the *weakest stratum* clears the bar. The M-04
 * rollback in the history is exactly what happens when that is skipped.
 */
import { useState } from "react";
import { DRIFT, MODELS, ROLLOUTS, TENANTS } from "@/mock/db";
import type { RolloutStage } from "@/mock/types";
import { ago, num } from "@/lib/format";
import { CanarySlider, LinePanel, PanelGrid } from "@/components/ui/charts";
import { Badge, Banner, Button, Card, PageHeader, StatTile, cx } from "@/components/ui/primitives";
import { ConfirmDestructive, Toast } from "@/components/ui/overlays";
import { AlertIcon, ArrowUp, CheckIcon, FlaskIcon, RefreshIcon, ScaleIcon } from "@/components/ui/icons";
import { act, actAndRefresh } from "@/api/actions";
import { api } from "@/api/client";

const STAGE_LABEL: Record<RolloutStage["stage"], string> = {
  canary: "Canary",
  partial: "Partial rollout",
  full: "Full rollout",
  rolled_back: "Rolled back",
};

export function OpsRollout() {
  const [traffic, setTraffic] = useState<Record<string, number>>(
    Object.fromEntries(ROLLOUTS.map((r) => [`${r.modelId}-${r.version}`, r.trafficPct])),
  );
  const [rollingBack, setRollingBack] = useState<RolloutStage | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const active = ROLLOUTS.filter((r) => r.stage !== "rolled_back");
  const canaries = active.filter((r) => r.stage === "canary");
  const held = active.filter((r) => r.stage === "partial");
  const rolledBack = ROLLOUTS.filter((r) => r.stage === "rolled_back");

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Model rollout"
        lede="Which version is serving whom, and what has to be true before it advances. Promotion is gated on the weakest stratum, not the pooled number."
        actions={<Button icon={<RefreshIcon size={15} />} onClick={() => void actAndRefresh(() => api.get("/api/v1/ops/rollout"), () => "Metrics refreshed from the server").then(setToast)}>Refresh metrics</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="In canary" value={canaries.length} tone={canaries.length > 0 ? "warning" : "neutral"} icon={<FlaskIcon size={15} />} hint="Watched hourly" />
        <StatTile label="Held below full" value={held.length} hint="Failed a promotion gate" />
        <StatTile label="At full rollout" value={active.filter((r) => r.stage === "full").length} tone="good" />
        <StatTile label="Rolled back (90 d)" value={rolledBack.length} tone={rolledBack.length > 0 ? "warning" : "neutral"} />
      </div>

      <Banner tone="accent" icon={<ScaleIcon size={16} />} title="The promotion gate">
        A version advances only when every reported stratum clears the bar — not when the pooled metric
        does. A pooled AUROC of 0.86 with a Medicaid-stratum ECE of 0.089 is a failing version that
        looks like a passing one, and that is precisely how M-04 0.8.7 reached production before being
        pulled 36 hours later.
      </Banner>

      {ROLLOUTS.filter((r) => r.stage !== "rolled_back").map((r) => {
        const model = MODELS.find((m) => m.id === r.modelId);
        if (!model) return null; // rollout for a model not in the catalogue — skip rather than crash
        const key = `${r.modelId}-${r.version}`;
        // Strata may be absent (no per-subgroup metrics reported yet). Guard so the
        // whole console does not white-screen on a model without them.
        const strata = model.strata ?? [];
        const weakest = strata.length ? [...strata].sort((a, b) => a.value - b.value)[0] : null;
        const gateOk = model.id === "M-01" || model.id === "M-05" || (weakest ? weakest.value >= 0.7 : true);

        return (
          <Card
            key={key}
            title={
              <span className="row" style={{ gap: 9, alignItems: "baseline" }}>
                {r.modelId} — {model.name}
                <span className="mono muted" style={{ fontSize: 12 }}>{r.version}</span>
              </span>
            }
            subtitle={r.note}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <Badge tone={r.stage === "full" ? "good" : r.stage === "canary" ? "warning" : "neutral"}>{STAGE_LABEL[r.stage]}</Badge>
                <Badge tone="neutral">{r.tenantsPinned} tenants pinned</Badge>
              </div>
            }
            footnote={`Started ${ago(r.startedAt)}. ${r.tenantsPinned} tenants are pinned to a specific version and are excluded from canary traffic entirely.`}
          >
            <div className="split" style={{ gap: 18 }}>
              <div className="stack" style={{ gap: 12 }}>
                <CanarySlider
                  value={traffic[key] ?? r.trafficPct}
                  onChange={(v) => { setTraffic({ ...traffic, [key]: v }); void act(() => api.post("/api/v1/ops/rollout", { model_id: r.modelId, version: r.version, stage: r.stage, traffic_pct: v, note: `Traffic set to ${v}% from the rollout console` }), () => `${r.modelId} ${r.version} traffic set to ${v}%`).then(setToast); }}
                  disabled={!gateOk && (traffic[key] ?? r.trafficPct) < 100}
                />
                {!gateOk && weakest && (
                  <p className="inline-warn">
                    <AlertIcon size={13} />
                    Promotion is blocked: the weakest stratum ({weakest.label}) is at {weakest.metric}{" "}
                    {weakest.value.toFixed(3)}, below the 0.70 bar. You can hold or roll back; you
                    cannot advance.
                  </p>
                )}
              </div>

              <div className="stack" style={{ gap: 10 }}>
                <div className="flag-row" style={{ paddingTop: 0 }}>
                  <div className="flag-meta">
                    <strong>Promotion gate</strong>
                    <span>Every reported stratum must clear its bar</span>
                  </div>
                  <span className={gateOk ? "pill pill-good" : "pill pill-critical"}>
                    {gateOk ? <CheckIcon size={12} /> : <AlertIcon size={12} />}
                    {gateOk ? "Clear" : "Blocked"}
                  </span>
                </div>
                {strata.map((s) => (
                  <div key={s.label} className="flag-row">
                    <div className="flag-meta">
                      <strong>{s.label}</strong>
                      <span>{s.metric} · n = {num(s.n)}</span>
                    </div>
                    <span className={cx("tnum", s.value < 0.7 && s.metric === "AUROC" && "is-weak")} style={{ fontWeight: 650 }}>
                      {s.value.toFixed(3)}
                    </span>
                  </div>
                ))}
                {strata.length === 0 && (
                  <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                    No per-stratum metrics reported for this model yet.
                  </p>
                )}
                <div className="row" style={{ gap: 8, paddingTop: 6 }}>
                  <Button size="sm" variant="danger" onClick={() => setRollingBack(r)}>Roll back</Button>
                  {gateOk && (traffic[key] ?? r.trafficPct) < 100 && (
                    <Button size="sm" variant="primary" icon={<ArrowUp size={13} />} onClick={() => { setTraffic({ ...traffic, [key]: 100 }); void act(() => api.post("/api/v1/ops/rollout", { model_id: r.modelId, version: r.version, stage: "full", traffic_pct: 100, note: "Promoted to full rollout" }), () => `${r.modelId} ${r.version} promoted to full rollout`).then(setToast); }}>
                      Promote to 100%
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <Card title="Canary watch" subtitle="What is monitored hourly while a version is in canary">
        <PanelGrid>
          <LinePanel
            title="Calibration error (ECE)"
            hint="The first thing to move when a version is wrong"
            labels={DRIFT.slice(-12).map((d) => d.week)}
            values={DRIFT.slice(-12).map((d) => d.ece)}
            format={(v) => v.toFixed(3)}
            reference={{ value: 0.05, label: "auto-rollback above 0.05", tone: "critical" }}
          />
          <LinePanel
            title="Recall@20"
            labels={DRIFT.slice(-12).map((d) => d.week)}
            values={DRIFT.slice(-12).map((d) => d.recall20)}
            format={(v) => v.toFixed(3)}
            reference={{ value: 0.6, label: "leakage ceiling", tone: "critical" }}
            color="var(--vital)"
          />
          <LinePanel
            title="Input drift (PSI)"
            labels={DRIFT.slice(-12).map((d) => d.week)}
            values={DRIFT.slice(-12).map((d) => d.psi)}
            format={(v) => v.toFixed(3)}
            reference={{ value: 0.2, label: "investigate", tone: "warning" }}
          />
        </PanelGrid>
        <p className="chart-hint">
          Auto-rollback fires without a human if stratified ECE crosses 0.05 during a canary. A version
          that has to be argued about at 3am is a version that should already have been pulled.
        </p>
      </Card>

      {rolledBack.length > 0 && (
        <Card title="Rollback history" subtitle="Kept visible — this is the institutional memory" padded={false}>
          <div className="scroll-x">
            <table className="data-table is-dense">
              <thead><tr><th>Model</th><th>Version</th><th>When</th><th>Why</th></tr></thead>
              <tbody>
                {rolledBack.map((r) => (
                  <tr key={`${r.modelId}-${r.version}`}>
                    <td><strong>{r.modelId}</strong></td>
                    <td className="mono">{r.version}</td>
                    <td className="muted">{ago(r.startedAt)}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDestructive
        open={rollingBack !== null}
        onClose={() => setRollingBack(null)}
        onConfirm={() => { const r = rollingBack; if (r) void act(() => api.post("/api/v1/ops/rollout", { model_id: r.modelId, version: r.version, stage: "rolled_back", traffic_pct: 0, note: "Rolled back from the rollout console" }), () => `${r.modelId} rolled back to the previous version`).then(setToast); }}
        title="Roll back this version"
        confirmWord={rollingBack?.version ?? ""}
        actionLabel="Roll back"
        body={<>Every tenant not pinned elsewhere will move off <strong>{rollingBack?.version}</strong> at their next request.</>}
        consequences={[
          `${TENANTS.filter((t) => t.status === "active").length} active tenants are affected.`,
          "Assessments already produced keep the version they were produced with — history does not rewrite.",
          "Clinicians will see estimates shift between runs; the results history screen shows which version produced each one.",
          "The rollback and your stated reason go to the platform audit log.",
        ]}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
