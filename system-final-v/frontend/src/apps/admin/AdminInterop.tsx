/**
 * 11.4.9 — Interop & Record Transfer (§7).
 *
 * The transfer queue plus MPI match review. The central decision on this screen
 * is the 0.92 threshold: above it a match is accepted automatically, below it a
 * human confirms. Getting that wrong in either direction is a patient-safety
 * event — a wrong match merges two people's records.
 */
import { useMemo, useState } from "react";
import { TRANSFERS } from "@/mock/db";
import type { TransferRequest } from "@/mock/types";
import { ago, dateTimeLabel } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, Tabs, TextArea, TextInput, cx } from "@/components/ui/primitives";
import { Drawer, Modal, Toast } from "@/components/ui/overlays";
import { TransferStateTag } from "@/components/ui/domain";
import { AlertIcon, ArrowDown, ArrowUp, CheckIcon, GlobeIcon, ShieldIcon, XIcon } from "@/components/ui/icons";
import { actAndRefresh } from "@/api/actions";
import { api } from "@/api/client";

const MPI_THRESHOLD = 0.92;

const PATH_LABEL: Record<TransferRequest["path"], string> = {
  esap_fast: "ESAP-to-ESAP",
  tefca: "TEFCA / QHIN",
  manual: "Direct / patient request",
};

const CONSENT_LABEL: Record<TransferRequest["consentBasis"], string> = {
  treatment: "Treatment (permitted purpose)",
  patient_mediated: "Patient-mediated request",
  explicit_authorization: "Explicit written authorisation",
};

export function AdminInterop() {
  const [tab, setTab] = useState<"queue" | "all">("queue");
  const [selected, setSelected] = useState<TransferRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [decision, setDecision] = useState({ reason: "", scope: "all" });
  const [outbound, setOutbound] = useState<{ mrn: string; patient: string; counterparty: string; note: string } | null>(null);

  function decide(t: TransferRequest, verdict: "approve" | "reject") {
    const reason = decision.reason.trim();
    setSelected(null);
    setDecision({ reason: "", scope: "all" });
    void actAndRefresh(
      () => verdict === "approve"
        ? api.post(`/api/v1/admin/interop/${t.id}/approve`, { reason: reason || null, accept_scope: decision.scope })
        : api.post(`/api/v1/admin/interop/${t.id}/reject`, { reason }),
      () => verdict === "approve" ? "Transfer approved and linked" : "Transfer rejected — the reason is in the audit log",
    ).then(setToast);
  }

  function sendOutbound() {
    const o = outbound;
    setOutbound(null);
    if (!o) return;
    void actAndRefresh(
      () => api.post("/api/v1/admin/interop", {
        mrn: o.mrn.trim(), patient_display: o.patient.trim(), counterparty: o.counterparty.trim(), note: o.note.trim() || null,
      }),
      () => `Record requested from ${o.counterparty.trim()} — it appears in the queue as requested`,
    ).then(setToast);
  }

  const queue = useMemo(
    () => TRANSFERS.filter((t) => ["requested", "consent_pending", "mpi_review"].includes(t.state)),
    [],
  );
  const rows = tab === "queue" ? queue : TRANSFERS;
  const needsMpi = TRANSFERS.filter((t) => t.state === "mpi_review");

  const columns: Column<TransferRequest>[] = [
    {
      key: "dir", header: "", width: "3%",
      render: (t) => (
        <span className={cx("dir-icon", t.direction === "inbound" ? "is-in" : "is-out")} title={t.direction}>
          {t.direction === "inbound" ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
        </span>
      ),
    },
    {
      key: "patient", header: "Patient", width: "22%", sortBy: (t) => t.patientDisplay,
      render: (t) => (
        <div className="cell-stack">
          <strong>{t.patientDisplay}</strong>
          <span className="muted mono">{t.mrn}</span>
        </div>
      ),
    },
    {
      key: "party", header: "Counterparty", sortBy: (t) => t.counterparty,
      render: (t) => (
        <div className="cell-stack">
          <span>{t.counterparty}</span>
          <span className="muted">{PATH_LABEL[t.path]}</span>
        </div>
      ),
    },
    {
      key: "mpi", header: "MPI match", align: "right", sortBy: (t) => t.mpiScore,
      render: (t) => (
        <div className="cell-stack" style={{ alignItems: "flex-end" }}>
          <span className={cx("tnum", t.mpiScore < MPI_THRESHOLD && "is-weak")}>{t.mpiScore.toFixed(2)}</span>
          <span className="muted" style={{ fontSize: 10.5 }}>
            {t.mpiScore >= MPI_THRESHOLD ? "auto-accept" : "human review"}
          </span>
        </div>
      ),
    },
    { key: "consent", header: "Consent basis", secondary: true, render: (t) => <span className="muted">{CONSENT_LABEL[t.consentBasis]}</span> },
    { key: "when", header: "Requested", secondary: true, sortBy: (t) => t.requestedAt, render: (t) => <span className="muted">{ago(t.requestedAt)}</span> },
    { key: "state", header: "State", sortBy: (t) => t.state, render: (t) => <TransferStateTag state={t.state} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Interop & record transfer"
        lede="Records moving in and out of this hospital. Every one carries a consent basis and a patient-match score, and neither is optional."
        actions={<Button icon={<GlobeIcon size={15} />} onClick={() => setOutbound({ mrn: "", patient: "", counterparty: "", note: "" })}>Request a record</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Awaiting a decision" value={queue.length} tone={queue.length > 0 ? "warning" : "neutral"} icon={<AlertIcon size={15} />} />
        <StatTile label="Below the match threshold" value={needsMpi.length} tone={needsMpi.length > 0 ? "warning" : "neutral"} hint={`MPI score under ${MPI_THRESHOLD}`} />
        <StatTile label="Delivered this month" value={TRANSFERS.filter((t) => t.state === "delivered").length} tone="good" />
        <StatTile label="Rejected" value={TRANSFERS.filter((t) => t.state === "rejected").length} hint="Failed identity or organisation verification" />
      </div>

      <Banner tone="accent" icon={<ShieldIcon size={16} />} title={`The match threshold is ${MPI_THRESHOLD}`}>
        Above it, an inbound record is linked automatically. Below it, a human confirms. Setting it too
        low merges two people&rsquo;s records — the worst outcome this system can produce. Setting it
        too high buries your HIM team in manual reviews and they start rubber-stamping, which produces
        the same failure more slowly.
      </Banner>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[{ value: "queue", label: "Needs a decision", count: queue.length }, { value: "all", label: "All transfers", count: TRANSFERS.length }]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(t) => t.id}
        searchable
        searchPlaceholder="Search patient, MRN or counterparty"
        searchFields={(t) => `${t.patientDisplay} ${t.mrn} ${t.counterparty}`}
        onRowClick={setSelected}
        caption="Cross-organisation record transfers"
        empty={{
          title: "Nothing waiting",
          message: "No transfer needs a decision. Requests that match above the threshold complete without you.",
          icon: <CheckIcon size={20} />,
        }}
      />

      <div className="split">
        <Card title="The two paths" subtitle="§7.1">
          <div className="flag-row">
            <div className="flag-meta">
              <strong>ESAP-to-ESAP fast path</strong>
              <span>
                Both hospitals run ESAP. The record moves as a structured bundle with the coded history
                already mapped to CCSR, so it is immediately usable by the models rather than needing
                re-coding. Typical round trip: under two seconds.
              </span>
            </div>
            <Badge tone="good">enabled</Badge>
          </div>
          <div className="flag-row">
            <div className="flag-meta">
              <strong>TEFCA / external EHR</strong>
              <span>
                The other side runs something else. ESAP queries through a QHIN using standard FHIR and
                takes what comes back, which is usually narrative documents rather than coded data.
                Slower, lossier, and the only option most of the time.
              </span>
            </div>
            <Badge tone="good">enabled</Badge>
          </div>
        </Card>

        <Card title="What a transfer never does" subtitle="Boundaries">
          <ul className="caveat-list">
            <li><XIcon size={13} /> Move a record without a recorded consent basis. Treatment is a permitted purpose; it is still recorded as the basis.</li>
            <li><XIcon size={13} /> Link two patients on a name-and-date-of-birth match alone.</li>
            <li><XIcon size={13} /> Re-open the t₀ cut. A record that arrives after admission is visible on the timeline and excluded from the estimates.</li>
            <li><XIcon size={13} /> Give the sending hospital any view of what you do with it afterwards.</li>
          </ul>
        </Card>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.patientDisplay ?? ""}
        subtitle={selected ? `${PATH_LABEL[selected.path]} · ${selected.counterparty}` : ""}
        width={560}
        footer={
          selected && ["requested", "mpi_review", "consent_pending"].includes(selected.state) ? (
            <>
              <Button variant="danger" onClick={() => { if (selected) decide(selected, "reject"); }} disabled={decision.reason.trim().length < 5} title="A rejection needs a written reason">Reject</Button>
              <Button variant="primary" onClick={() => { if (selected) decide(selected, "approve"); }}>Confirm match & accept</Button>
            </>
          ) : null
        }
      >
        {selected && (
          <div className="stack" style={{ gap: 18 }}>
            <Card title="Identity match" subtitle={`Score ${selected.mpiScore.toFixed(2)} against a threshold of ${MPI_THRESHOLD}`}>
              <div className="meter" style={{ height: 8 }}>
                <div
                  className="meter-fill"
                  style={{
                    width: `${selected.mpiScore * 100}%`,
                    background: selected.mpiScore >= MPI_THRESHOLD ? "var(--status-good)" : "var(--status-warning)",
                  }}
                />
              </div>
              <table className="data-table is-dense">
                <thead><tr><th>Field</th><th>Yours</th><th>Theirs</th><th></th></tr></thead>
                <tbody>
                  <tr><td>Name</td><td>{selected.patientDisplay.split(",")[0]}</td><td>{selected.patientDisplay.split(",")[0]}</td><td><CheckIcon size={13} /></td></tr>
                  <tr><td>Date of birth</td><td className="tnum">1955-04-11</td><td className="tnum">1955-04-11</td><td><CheckIcon size={13} /></td></tr>
                  <tr><td>Sex</td><td>F</td><td>F</td><td><CheckIcon size={13} /></td></tr>
                  <tr><td>Address</td><td>14 Harbour St</td><td>221 Mill Lane</td><td><AlertIcon size={13} /></td></tr>
                  <tr><td>Last 4 SSN</td><td className="tnum">••••</td><td className="tnum">not supplied</td><td><AlertIcon size={13} /></td></tr>
                </tbody>
              </table>
              {selected.note && <p className="inline-warn"><AlertIcon size={13} /> {selected.note}</p>}
            </Card>

            <Card title="What would be received" subtitle={`${selected.bundleItems.length} categories`}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {selected.bundleItems.map((b) => <span key={b} className="chip">{b}</span>)}
              </div>
              <dl className="kv">
                <dt>Consent basis</dt><dd>{CONSENT_LABEL[selected.consentBasis]}</dd>
                <dt>Requested by</dt><dd>{selected.requestedBy}</dd>
                <dt>Requested at</dt><dd>{dateTimeLabel(selected.requestedAt)}</dd>
                <dt>Direction</dt><dd>{selected.direction}</dd>
                <dt>Transport</dt><dd>{PATH_LABEL[selected.path]}</dd>
              </dl>
            </Card>

            {["requested", "mpi_review"].includes(selected.state) && (
              <Card title="Your decision" subtitle="Recorded with your name in the audit log">
                <Field label="Reason" hint="Required. It is the record of why two identities were judged to be the same person.">
                  <TextArea
                    rows={3}
                    placeholder="Confirmed against the patient's photo ID at the bedside; the address differs because they moved in June."
                    value={decision.reason}
                    onChange={(e) => setDecision({ ...decision, reason: e.currentTarget.value })}
                  />
                </Field>
                <Field label="Accept scope">
                  <Select value={decision.scope} onChange={(e) => setDecision({ ...decision, scope: e.currentTarget.value })}>
                    <option value="all">Everything offered</option>
                    <option value="coded">Coded history and medications only</option>
                    <option value="docs">Narrative documents only</option>
                  </Select>
                </Field>
              </Card>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={outbound !== null}
        onClose={() => setOutbound(null)}
        title="Request a record from another organisation"
        subtitle="Nothing is received until they answer and someone here confirms the identity match"
        footer={
          <>
            <Button onClick={() => setOutbound(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!outbound || !outbound.mrn.trim() || !outbound.patient.trim() || outbound.counterparty.trim().length < 2}
              onClick={sendOutbound}
            >
              Send request
            </Button>
          </>
        }
      >
        {outbound && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Patient" required hint="Name, age and sex as your record has them.">
              <TextInput placeholder="Mira Duarte, 71F" value={outbound.patient} onChange={(e) => setOutbound({ ...outbound, patient: e.currentTarget.value })} />
            </Field>
            <Field label="Your MRN" required>
              <TextInput className="mono" placeholder="MRN-400118" value={outbound.mrn} onChange={(e) => setOutbound({ ...outbound, mrn: e.currentTarget.value })} />
            </Field>
            <Field label="Organisation holding the record" required>
              <TextInput placeholder="Northgate Health System" value={outbound.counterparty} onChange={(e) => setOutbound({ ...outbound, counterparty: e.currentTarget.value })} />
            </Field>
            <Field label="Note for the other organisation">
              <TextArea rows={2} value={outbound.note} onChange={(e) => setOutbound({ ...outbound, note: e.currentTarget.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
