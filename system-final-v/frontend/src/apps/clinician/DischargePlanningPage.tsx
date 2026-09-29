/**
 * D1a — Discharge-planning view (§12.3.1a, §3.12).
 *
 * The case manager's default. Same encounters, different question: not "who is
 * sick" but "who is going to be hard to send home, and when". M-04 and M-05
 * lead; mortality and ICU are deliberately not shown — they are not this role's
 * decision and showing them invites use outside the role's scope.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ENCOUNTERS, MODELS } from "@/mock/db";
import type { Encounter } from "@/mock/types";
import { ago, pct } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, Button, Card, PageHeader, SegmentedControl, StatTile } from "@/components/ui/primitives";
import { AssistiveLine } from "@/components/ui/domain";
import { LosCell, RiskCell } from "@/components/clinical";
import { BarRows } from "@/components/ui/charts";
import { ClockIcon, HandoffIcon, ScaleIcon } from "@/components/ui/icons";
import { Toast } from "@/components/ui/overlays";
import { closeEncounter, requestExport } from "@/api/actions";
import { useSettings } from "@/hooks/useSettings";
import { useSession } from "@/lib/session";
import { can } from "@/lib/rbac";

export function DischargePlanningPage() {
  const nav = useNavigate();
  const { role } = useSession();
  // Discharging closes the assessment lifecycle — a clinical sign-off — so it
  // needs assess:run. A case manager owns this screen but does not hold that
  // capability; the button used to render for them anyway and 403 on click.
  const canDischarge = can(role, "assess:run");
  const [horizon, setHorizon] = useState<"today" | "48h" | "all">("48h");
  const [toast, setToast] = useState<string | null>(null);
  // The readmission alert threshold is a per-tenant policy (Settings → Model
  // display), consulted here as on the Results screen rather than hard-coded.
  const { settings: display } = useSettings("model_display", { readmissionAlertThreshold: 0.28 });
  const alertAt = Number(display.readmissionAlertThreshold) || 0.28;

  const rows = useMemo(() => {
    const open = ENCOUNTERS.filter((e) => e.risks.losLow !== null && e.state !== "closed");
    if (horizon === "all") return open;
    const cap = horizon === "today" ? 2 : 4;
    return open.filter((e) => (e.risks.losLow ?? 99) <= cap);
  }, [horizon]);

  const highReadmit = rows.filter((e) => (e.risks.readmission ?? 0) > alertAt);
  const longStay = ENCOUNTERS.filter((e) => (e.risks.losHigh ?? 0) > 10);

  const columns: Column<Encounter>[] = [
    {
      key: "patient", header: "Patient", width: "24%", sortBy: (e) => e.patient.name,
      render: (e) => (
        <div className="cell-stack">
          <strong>{e.patient.name}</strong>
          <span className="muted mono">{e.patient.mrn} · {e.unitName}</span>
        </div>
      ),
    },
    { key: "admitted", header: "Admitted", secondary: true, sortBy: (e) => e.admittedAt, render: (e) => <span className="muted">{ago(e.admittedAt)}</span> },
    { key: "los", header: "Expected stay", align: "right", sortBy: (e) => e.risks.losLow ?? 99, render: (e) => <LosCell low={e.risks.losLow} high={e.risks.losHigh} /> },
    { key: "readmit", header: "30-day readmission", align: "right", sortBy: (e) => e.risks.readmission ?? -1, render: (e) => <RiskCell value={e.risks.readmission} label="30-day readmission" /> },
    {
      key: "flags", header: "Planning flags", render: (e) => (
        <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
          {(e.risks.readmission ?? 0) > alertAt && <span className="pill pill-warning">top decile readmission</span>}
          {(e.risks.losHigh ?? 0) > 10 && <span className="pill pill-neutral">long stay possible</span>}
          {!e.hasPriorHistory && <span className="pill pill-neutral">no prior record</span>}
          {e.calibrationValidity === "reduced" && <span className="cal-badge">calibration reduced</span>}
        </div>
      ),
    },
    {
      key: "action", header: "", align: "right", width: "12%",
      render: (e) =>
        canDischarge ? (
          // Stop the click bubbling to the row's navigate-to-results handler.
          <span onClick={(ev) => ev.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void closeEncounter(e.id).then(setToast)}
            >
              Discharge
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Care coordination"
        title="Discharge planning"
        lede={
          canDischarge
            ? "Your caseload ordered by when people are likely to leave and how likely they are to come back. Mortality and ICU estimates are not shown here — they are not this role's decision."
            : "Your caseload ordered by when people are likely to leave and how likely they are to come back. Mortality and ICU estimates are not shown here — they are not this role's decision. Discharging itself is the prescriber's action; coordinate here, and they close the encounter from the results screen."
        }
        actions={
          can(role, "export:phi") && (
            <Button
              icon={<HandoffIcon size={15} />}
              disabled={rows.length === 0}
              onClick={() => void requestExport(
                "discharge_packet",
                `Discharge planning packet — ${rows.length} patients, ${horizon === "all" ? "whole caseload" : horizon === "today" ? "leaving today" : "leaving within 48 h"}`,
                { encounter_ids: rows.map((e) => e.id) },
              ).then(setToast)}
            >
              Export discharge packet
            </Button>
          )
        }
      />

      <div className="grid grid-4">
        <StatTile label="Likely to leave within 48 h" value={rows.length} icon={<ClockIcon size={15} />} hint="Based on the lower bound of the M-05 interval" />
        <StatTile label="Top-decile readmission risk" value={highReadmit.length} tone={highReadmit.length > 2 ? "warning" : "neutral"} hint="Above the alert-budget threshold of 28%" />
        <StatTile label="Possible long stays" value={longStay.length} hint="Upper bound beyond 10 days" />
        <StatTile label="Caseload" value={ENCOUNTERS.filter((e) => e.state !== "closed").length} hint="All open encounters assigned to you" />
      </div>

      <Banner tone="warning" title="M-04 is serving degraded — read it as a weak signal">
        On patients with no prior admission its AUROC is {MODELS.find((m) => m.id === "M-04")?.strata.find((s) => /cold/i.test(s.label))?.value.toFixed(3) ?? "—"}, close to chance. It is still useful for
        ranking people who <em>do</em> have a prior admission history; it should not on its own justify
        a care-management referral for someone without one.
      </Banner>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(e) => e.id}
        searchable
        searchPlaceholder="Search caseload"
        searchFields={(e) => `${e.patient.name} ${e.patient.mrn} ${e.unitName}`}
        onRowClick={(e) => nav(`/doctor/encounters/${e.id}/results`)}
        caption="Discharge-planning view ordered by expected length of stay"
        empty={{ title: "Nobody in this window", message: "No one on your caseload is expected to leave in this horizon. Widen it to see the whole list." }}
        toolbar={
          <SegmentedControl
            size="sm"
            ariaLabel="Discharge horizon"
            value={horizon}
            onChange={setHorizon}
            options={[
              { value: "today", label: "Today" },
              { value: "48h", label: "Next 48 h" },
              { value: "all", label: "All" },
            ]}
          />
        }
      />

      <div className="split">
        <Card
          title="Where the readmission risk sits"
          subtitle="Your caseload, ranked"
          footnote="Ranking is reliable even where the absolute calibration is not. Use it to order your day, not to quote a number to a patient."
        >
          <BarRows
            rows={rows.slice(0, 8).map((e) => ({
              key: e.id,
              label: e.patient.name,
              value: e.risks.readmission ?? 0,
              meta: `${e.unitName} · expected stay ${e.risks.losLow}–${e.risks.losHigh} d`,
            }))}
            max={0.5}
            format={(v) => pct(v, 0)}
          />
        </Card>

        <Card title={<span className="row" style={{ gap: 7 }}><ScaleIcon size={16} /> A note on equity</span>} subtitle="Why this matters for your referrals">
          <p className="prose" style={{ margin: 0 }}>
            Readmission models are the ones most prone to encoding access-to-care differences as clinical
            risk. The fairness panel reports M-04 separately by insurance class precisely because that is
            where a difference would show up first. If you are using this list to allocate a scarce
            care-management resource, the audit trail of that allocation matters — the privacy officer
            can see who was flagged and who was actually referred.
          </p>
        </Card>
      </div>

      <AssistiveLine />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
