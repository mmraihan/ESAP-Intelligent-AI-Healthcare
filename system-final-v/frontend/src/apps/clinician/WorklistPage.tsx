/**
 * D1 — Worklist (§12.3.1).
 *
 * The physician's home. Ranked by the thing that actually drives triage, with
 * every number printed. Sorting by risk is offered but is never the default:
 * the default order is the clinical one (unit, then admission time), so the
 * tool does not silently reorder a clinician's day around a model score.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ENCOUNTERS } from "@/mock/db";
import { ALL_UNITS } from "@/mock/db";
import type { Encounter } from "@/mock/types";
import { ago, pct } from "@/lib/format";
import { useSession } from "@/lib/session";
import { ROLES, can } from "@/lib/rbac";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button, PageHeader, SegmentedControl, Select, StatTile, cx } from "@/components/ui/primitives";
import { CalibratedBadge } from "@/components/ui/domain";
import { AssistiveLine } from "@/components/ui/domain";
import { LosCell, RiskCell } from "@/components/clinical";
import { ConnectionRequestsCard } from "@/components/clinical/ConnectFeature";
import { BedIcon, ClipboardIcon, ListIcon, PlusIcon, StethoscopeIcon } from "@/components/ui/icons";

type SortMode = "clinical" | "risk";

const STATE_LABEL: Record<Encounter["state"], string> = {
  intake_in_progress: "Intake in progress",
  awaiting_assessment: "Awaiting assessment",
  assessed: "Assessed",
  acknowledged: "Reviewed",
  awaiting_cosign: "Awaiting co-sign",
  closed: "Closed",
};

export function WorklistPage() {
  const nav = useNavigate();
  const { role } = useSession();
  const [unit, setUnit] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("clinical");
  const [scope, setScope] = useState<"mine" | "unit">("mine");

  const rows = useMemo(() => {
    let list = ENCOUNTERS.filter((e) => e.state !== "closed");
    if (unit !== "all") list = list.filter((e) => e.unitId === unit);
    if (scope === "mine") list = list.filter((_, i) => i % 3 !== 2);
    return [...list].sort((a, b) =>
      sortMode === "risk"
        ? (b.risks.mortality ?? -1) - (a.risks.mortality ?? -1)
        : a.unitName.localeCompare(b.unitName) || a.admittedAt.localeCompare(b.admittedAt),
    );
  }, [unit, sortMode, scope]);

  const needsReview = rows.filter((e) => e.state === "assessed").length;
  const awaitingAssessment = rows.filter((e) => e.state === "awaiting_assessment" || e.state === "intake_in_progress").length;
  const cosign = rows.filter((e) => e.state === "awaiting_cosign").length;

  const columns: Column<Encounter>[] = [
    {
      key: "patient",
      header: "Patient",
      width: "22%",
      sortBy: (e) => e.patient.name,
      render: (e) => (
        <div className="cell-stack">
          <span className="row" style={{ gap: 6 }}>
            <strong>{e.patient.name}</strong>
            {!!e.escalations?.length && <span className="pill pill-critical">escalated</span>}
          </span>
          <span className="muted mono">{e.patient.mrn} · {e.patient.age}{e.patient.sex}</span>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      secondary: true,
      sortBy: (e) => e.unitName,
      render: (e) => (
        <div className="cell-stack">
          <span>{e.unitName}</span>
          <span className="muted">{e.bed} · admitted {ago(e.admittedAt)}</span>
        </div>
      ),
    },
    {
      key: "differential",
      header: "Top condition (M-01)",
      width: "20%",
      render: (e) =>
        e.topDifferential.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          <div className="cell-stack">
            <span>{e.topDifferential[0].name}</span>
            <span className="muted tnum">
              {pct(e.topDifferential[0].probability, 0)} · {e.topDifferential.length - 1} more
            </span>
          </div>
        ),
    },
    { key: "mortality", header: "Mortality", align: "right", sortBy: (e) => e.risks.mortality ?? -1, render: (e) => <RiskCell value={e.risks.mortality} label="In-hospital mortality" /> },
    { key: "icu", header: "ICU", align: "right", sortBy: (e) => e.risks.icu ?? -1, render: (e) => <RiskCell value={e.risks.icu} label="ICU admission" /> },
    { key: "readmit", header: "Readmit", align: "right", secondary: true, sortBy: (e) => e.risks.readmission ?? -1, render: (e) => <RiskCell value={e.risks.readmission} label="30-day readmission" /> },
    { key: "los", header: "LOS", align: "right", secondary: true, sortBy: (e) => e.risks.losLow ?? -1, render: (e) => <LosCell low={e.risks.losLow} high={e.risks.losHigh} /> },
    {
      key: "state",
      header: "Status",
      sortBy: (e) => e.state,
      render: (e) => (
        <div className="cell-stack">
          <span className={cx("state-tag", `state-${e.state}`)}>{STATE_LABEL[e.state]}</span>
          <CalibratedBadge calibrated={e.calibrated} validity={e.calibrationValidity} estimated={e.risks.mortality !== null} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={ROLES[role].label}
        title="Worklist"
        lede="Your patients, with the admission-time estimates alongside. Every figure is a population-level probability from intake data only — read the number, not the colour."
        actions={
          <>
            {/* Admitting needs patient:write — the nav-rail link is already gated
                to prescribers, but this header button is a second, separate
                entry point to the same 403 and was missed. */}
            {can(role, "patient:write") && (
              <Button icon={<PlusIcon size={15} />} onClick={() => nav("/doctor/encounters/new")}>New encounter</Button>
            )}
            <Button variant="primary" icon={<StethoscopeIcon size={15} />} onClick={() => rows[0] && nav(`/doctor/encounters/${rows[0].id}/results`)}>
              Open next unreviewed
            </Button>
          </>
        }
      />

      <div className="grid grid-4">
        <StatTile label="On your list" value={rows.length} icon={<BedIcon size={15} />} hint="Open encounters assigned to you" />
        <StatTile label="Assessed, not yet reviewed" value={needsReview} tone={needsReview > 4 ? "warning" : "neutral"} icon={<ListIcon size={15} />} hint="Waiting for your acknowledgement" />
        <StatTile label="Awaiting assessment" value={awaitingAssessment} icon={<ClipboardIcon size={15} />} hint="Intake still incomplete" />
        <StatTile label="Awaiting co-sign" value={cosign} tone={cosign > 0 ? "warning" : "neutral"} hint="Resident acknowledgements routed to you" />
      </div>

      {can(role, "patient:write") && <ConnectionRequestsCard />}

      <AssistiveLine />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(e) => e.id}
        searchable
        searchPlaceholder="Search name or MRN"
        searchFields={(e) => `${e.patient.name} ${e.patient.mrn} ${e.unitName} ${e.chiefComplaint}`}
        onRowClick={(e) => nav(`/doctor/encounters/${e.id}/results`)}
        pageSize={12}
        caption="Worklist of open encounters with intake-time risk estimates"
        empty={{
          title: "No open encounters",
          message: "Nothing is assigned to you in this scope. Widen it to the whole unit, or admit a patient to start an encounter.",
          icon: <BedIcon size={20} />,
          action: <Button variant="primary" onClick={() => setScope("unit")}>Show the whole unit</Button>,
        }}
        toolbar={
          <>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Filter by unit">
              <option value="all">All units</option>
              {ALL_UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            <SegmentedControl
              size="sm"
              ariaLabel="Scope"
              value={scope}
              onChange={setScope}
              options={[{ value: "mine", label: "My patients" }, { value: "unit", label: "Whole unit" }]}
            />
            <SegmentedControl
              size="sm"
              ariaLabel="Sort order"
              value={sortMode}
              onChange={setSortMode}
              options={[
                { value: "clinical", label: "Unit & time" },
                { value: "risk", label: "By mortality estimate" },
              ]}
            />
          </>
        }
      />

      <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.6, margin: 0, maxWidth: "76ch" }}>
        The default order is clinical — unit, then admission time. Sorting by an estimate is available
        but deliberately not the default: a worklist that re-ranks itself around a model score turns
        decision support into triage-by-software.
      </p>
    </>
  );
}
