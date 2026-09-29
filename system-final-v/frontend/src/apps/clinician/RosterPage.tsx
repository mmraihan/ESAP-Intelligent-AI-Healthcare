/**
 * N1 — Unit Risk Roster (§12.4.1). The charge nurse's home.
 *
 * This is the one screen in the product where ranking by a model score IS the
 * job: the charge nurse allocates staffing across a whole unit and needs the
 * unit ordered. The card view is the default because a bed grid is how a charge
 * nurse already holds the unit in their head.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_UNITS, ENCOUNTERS } from "@/mock/db";
import type { Encounter } from "@/mock/types";
import { ago, pct, percentilePhrase, seqToken } from "@/lib/format";
import { myUnitId } from "@/lib/scope";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, Button, Card, Meter, PageHeader, SegmentedControl, Select, StatTile, cx } from "@/components/ui/primitives";
import { AssistiveLine, CalibratedBadge } from "@/components/ui/domain";
import { LosCell, RiskCell } from "@/components/clinical";
import { BedIcon, GridIcon, HandoffIcon, ListIcon } from "@/components/ui/icons";

export function RosterPage() {
  const nav = useNavigate();
  const [unitId, setUnitId] = useState(() => myUnitId() ?? ALL_UNITS[0]?.id ?? "");
  const [view, setView] = useState<"cards" | "table">("cards");

  const unit = ALL_UNITS.find((u) => u.id === unitId);
  const rows = useMemo(
    () =>
      ENCOUNTERS.filter((e) => e.unitId === unitId && e.state !== "closed")
        .sort((a, b) => (b.risks.icu ?? -1) - (a.risks.icu ?? -1)),
    [unitId],
  );

  // An account with no units (an individual, self-serve seat) has no roster.
  if (!unit) {
    return (
      <>
        <PageHeader eyebrow="Charge nurse" title="Unit risk roster" />
        <Card title="No units in this account">
          <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
            This view works on a hospital unit, and your account has none. It appears once you are
            part of a hospital with wards set up.
          </p>
        </Card>
      </>
    );
  }

  const watch = rows.filter((e) => (e.risks.icu ?? 0) > 0.4);
  const unassessed = rows.filter((e) => e.risks.mortality === null);

  const columns: Column<Encounter>[] = [
    { key: "bed", header: "Bed", width: "9%", sortBy: (e) => e.bed, render: (e) => <strong className="mono">{e.bed}</strong> },
    {
      key: "patient", header: "Patient", sortBy: (e) => e.patient.name,
      render: (e) => (
        <div className="cell-stack">
          <strong>{e.patient.name}</strong>
          <span className="muted">{e.patient.age}{e.patient.sex} · admitted {ago(e.admittedAt)}</span>
        </div>
      ),
    },
    { key: "icu", header: "ICU", align: "right", sortBy: (e) => e.risks.icu ?? -1, render: (e) => <RiskCell value={e.risks.icu} label="ICU admission" /> },
    { key: "mortality", header: "Mortality", align: "right", sortBy: (e) => e.risks.mortality ?? -1, render: (e) => <RiskCell value={e.risks.mortality} label="In-hospital mortality" /> },
    { key: "los", header: "Stay", align: "right", secondary: true, render: (e) => <LosCell low={e.risks.losLow} high={e.risks.losHigh} /> },
    { key: "nurse", header: "Assigned", secondary: true, sortBy: (e) => e.nurse, render: (e) => <span className="muted">{e.nurse}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Charge nurse"
        title={`Unit risk roster — ${unit.name}`}
        lede="Every patient on the unit, ranked by the estimate most relevant to staffing. Use it to decide where to put your people; it does not decide anything about a patient."
        actions={<Button variant="primary" icon={<HandoffIcon size={15} />} onClick={() => nav("/nurse/handoff")}>Build handoff</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Occupied beds" value={`${rows.length}`} unit={`/ ${unit.beds}`} icon={<BedIcon size={15} />} hint={`${unit.serviceLine} · ${unit.name}`} />
        <StatTile label="Watch list" value={watch.length} tone={watch.length > 3 ? "warning" : "neutral"} hint="ICU estimate above 40%" />
        <StatTile label="Not yet assessed" value={unassessed.length} hint="Intake incomplete — no estimate exists" />
        <StatTile label="Mean expected stay" value={(rows.reduce((a, e) => a + (e.risks.losLow ?? 0), 0) / Math.max(1, rows.length)).toFixed(1)} unit="d" hint="Lower bound of the M-05 intervals" />
      </div>

      <Banner tone="accent" title="How to use this ranking">
        This order reflects a population-level estimate made at admission. A patient low on this list can
        still deteriorate, and a patient high on it can be perfectly stable. It tells you where to look
        first, not who is sick.
      </Banner>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Unit">
          {ALL_UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <SegmentedControl
          size="sm"
          ariaLabel="View"
          value={view}
          onChange={setView}
          options={[
            { value: "cards", label: "Bed grid", icon: <GridIcon size={13} /> },
            { value: "table", label: "Table", icon: <ListIcon size={13} /> },
          ]}
        />
      </div>

      {view === "cards" ? (
        rows.length === 0 ? (
          <Card title="No open encounters on this unit"><p className="muted" style={{ margin: 0 }}>Every bed here is either empty or closed out.</p></Card>
        ) : (
          <div className="bed-grid">
            {rows.map((e) => (
              <button
                key={e.id}
                type="button"
                className={cx("bed-card", (e.risks.icu ?? 0) > 0.4 && "is-watch")}
                onClick={() => nav(`/nurse/encounters/${e.id}/results`)}
              >
                <div className="bed-card-head">
                  <span className="mono bed-num">{e.bed}</span>
                  {(e.risks.icu ?? 0) > 0.4 && <span className="pill pill-warning">watch</span>}
                </div>
                <strong className="bed-name">{e.patient.name}</strong>
                <span className="muted" style={{ fontSize: 11.5 }}>{e.patient.age}{e.patient.sex} · {ago(e.admittedAt)}</span>
                <p className="bed-complaint">{e.chiefComplaint}</p>
                <div className="bed-metrics">
                  <div>
                    <span className="bed-metric-label">ICU</span>
                    <span className="tnum bed-metric-value">{pct(e.risks.icu, 0)}</span>
                    <Meter value={e.risks.icu ?? 0} color={seqToken(e.risks.icu)} height={4} label="ICU admission" />
                  </div>
                  <div>
                    <span className="bed-metric-label">Mortality</span>
                    <span className="tnum bed-metric-value">{pct(e.risks.mortality, 0)}</span>
                    <Meter value={e.risks.mortality ?? 0} color={seqToken(e.risks.mortality)} height={4} label="Mortality" />
                  </div>
                </div>
                <span className="bed-phrase">{percentilePhrase(e.risks.icu)}</span>
                <div className="bed-foot">
                  <CalibratedBadge calibrated={e.calibrated} validity={e.calibrationValidity} />
                  <span className="muted" style={{ fontSize: 11 }}>{e.nurse}</span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(e) => e.id}
          searchable
          searchPlaceholder="Search the unit"
          searchFields={(e) => `${e.patient.name} ${e.bed} ${e.nurse}`}
          onRowClick={(e) => nav(`/nurse/encounters/${e.id}/results`)}
          caption={`Risk roster for ${unit.name}`}
          empty={{ title: "No open encounters", message: "This unit has no active encounters right now." }}
        />
      )}

      <AssistiveLine />
    </>
  );
}
