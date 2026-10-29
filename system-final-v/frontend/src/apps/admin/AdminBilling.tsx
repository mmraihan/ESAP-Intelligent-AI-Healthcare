/**
 * 11.4.11 — Billing. Plan, usage this cycle, invoices.
 *
 * The meter is beds plus assessments, so the screen has to show both and show
 * where the overage is coming from. A usage-metered clinical product that
 * surprises a hospital with an overage bill stops being used, which is worse
 * for everyone than a visible meter.
 */
import { useState } from "react";
import { INVOICES, PLANS } from "@/mock/db";
import { useSession, tenantFor } from "@/lib/session";
import { dateLabel, num, pct, usd } from "@/lib/format";
import { Sparkline } from "@/components/ui/charts";
import { Badge, Banner, Button, Card, Field, Meter, PageHeader, StatTile, Tabs, TextArea } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { ModeTag, StatusPill } from "@/components/ui/domain";
import { AlertIcon, BedIcon, ChartIcon, CreditCardIcon, DownloadIcon, FileIcon } from "@/components/ui/icons";
import { act, requestExport } from "@/api/actions";
import { ApiError, api } from "@/api/client";
import { openBillingPortal, startCheckout } from "@/api/billing";
import type { PlanDefinition } from "@/mock/types";

const INCLUDED_ASSESSMENTS = 17_000;

export function AdminBilling() {
  const { tenantId, role } = useSession();
  // Polar checkout and the payment portal are for the people who pay the bill.
  const mayPay = role === "tenant_owner" || role === "billing_admin";
  const tenant = tenantFor(tenantId);
  const [tab, setTab] = useState<"usage" | "invoices" | "plan">("usage");
  const [openInvoice, setOpenInvoice] = useState<(typeof INVOICES)[number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [comparing, setComparing] = useState<PlanDefinition[] | null>(null);

  function sendContact() {
    const detail = (contact ?? "").trim();
    setContact(null);
    void act(
      () => api.post("/api/v1/requests", { kind: "account_team_contact", detail, ref: `plan:${tenant.plan}` }),
      () => "Sent — your account team will reply to the contact on file",
    ).then(setToast);
  }

  function pay(go: () => Promise<void>) {
    go().catch((err) => setToast(err instanceof ApiError ? err.message : "Could not reach the payment provider."));
  }

  function compare() {
    void act(
      () => api.get<{ plans: PlanDefinition[] }>("/api/v1/admin/billing"),
      (r) => { setComparing(r.plans); return `${r.plans.length} plans loaded`; },
    ).then((m) => { if (!m.endsWith("plans loaded")) setToast(m); });
  }

  const used = tenant.assessments30d;
  const overage = Math.max(0, used - INCLUDED_ASSESSMENTS);
  const current = INVOICES[0] as (typeof INVOICES)[number] | undefined;
  const plan = PLANS.find((p) => p.tier === tenant.plan);

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Billing"
        lede="Your plan, what you have used this cycle, and where the number comes from. No line item on an ESAP invoice should ever be a surprise."
        meta={
          <>
            <Badge tone="accent">{plan?.name ?? tenant.plan}</Badge>
            <ModeTag mode={tenant.mode} />
            <StatusPill status={tenant.status} />
          </>
        }
        actions={<Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("billing_statement").then(setToast)}>Download statement</Button>}
      />

      {overage > 0 && (
        <Banner tone="warning" icon={<AlertIcon size={16} />} title={`You are ${num(overage)} assessments over the included allowance`}>
          At {usd(2)} each, that is {usd(overage * 2)} on this cycle&rsquo;s invoice. If this is your new
          normal rather than a one-off, moving the allowance up is cheaper than paying overage —
          your account team can adjust it mid-term.
        </Banner>
      )}

      <div className="grid grid-4">
        <StatTile
          label="Assessments this cycle"
          value={num(used)}
          unit={`/ ${num(INCLUDED_ASSESSMENTS)}`}
          tone={overage > 0 ? "warning" : "neutral"}
          icon={<ChartIcon size={15} />}
        />
        <StatTile label="Licensed beds" value={num(tenant.beds)} icon={<BedIcon size={15} />} hint={`${usd(48)} per bed per month`} />
        <StatTile label="Seats in use" value={num(tenant.seatsUsed)} unit={`/ ${num(tenant.seats)}`} hint="Seats are not metered on Enterprise" />
        <StatTile
          label="This cycle"
          value={current ? usd(current.amountUsd) : "—"}
          tone={current?.status === "overdue" ? "critical" : "neutral"}
          icon={<CreditCardIcon size={15} />}
          hint={current ? `Due ${dateLabel(current.issuedAt)}` : "No invoice issued yet"}
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "usage", label: "Usage this cycle" },
          { value: "invoices", label: "Invoices", count: INVOICES.length },
          { value: "plan", label: "Plan & terms" },
        ]}
      />

      {tab === "usage" && (
        <div className="split">
          <Card
            title="Assessment allowance"
            subtitle={`${num(used)} of ${num(INCLUDED_ASSESSMENTS)} included`}
            footnote="An assessment is one /assess call that produced at least one model result. Re-runs on the same encounter after new labs arrive each count — that is usually where an unexpected overage comes from."
          >
            <Meter value={Math.min(1, used / INCLUDED_ASSESSMENTS)} height={10} color={overage > 0 ? "var(--status-warning)" : "var(--seq-500)"} label="Assessment allowance" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted tnum" style={{ fontSize: 12 }}>{pct(used / INCLUDED_ASSESSMENTS, 0)} used</span>
              <span className="muted" style={{ fontSize: 12 }}>cycle resets in 8 days</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
              <Sparkline points={[3200, 3900, 4100, 4400, 4700, 5100, 4900]} ariaLabel="Weekly assessment volume" width={170} />
              <span className="muted" style={{ fontSize: 11 }}>weekly volume</span>
            </div>
          </Card>

          <Card title="This cycle, itemised" subtitle={current?.period ?? "No invoice issued yet"}>
            <ul className="invoice-lines">
              {(current?.lines ?? []).map((l) => (
                <li key={l.label}>
                  <div className="cell-stack">
                    <span>{l.label}</span>
                    <span className="muted">{l.qty}</span>
                  </div>
                  <span className="tnum">{usd(l.amountUsd)}</span>
                </li>
              ))}
            </ul>
            <div className="invoice-total">
              <span>Total</span>
              <span className="tnum">{current ? usd(current.amountUsd) : "—"}</span>
            </div>
          </Card>
        </div>
      )}

      {tab === "invoices" && (
        <Card title="Invoices" padded={false}>
          <div className="scroll-x">
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Period</th><th>Issued</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {INVOICES.map((inv) => (
                  <tr key={inv.id} className="is-clickable" onClick={() => setOpenInvoice(inv)}>
                    <td className="mono"><strong>{inv.id}</strong></td>
                    <td>{inv.period}</td>
                    <td className="muted">{dateLabel(inv.issuedAt)}</td>
                    <td style={{ textAlign: "right" }} className="tnum">{usd(inv.amountUsd)}</td>
                    <td>
                      <span className={`pill pill-${inv.status === "paid" ? "good" : inv.status === "overdue" ? "critical" : "warning"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Button size="sm" variant="ghost" icon={<FileIcon size={13} />} onClick={(e) => { e.stopPropagation(); void requestExport("invoice", undefined, { invoice_id: inv.id }).then(setToast); }}>PDF</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "plan" && (
        <div className="split">
          <Card title={plan?.name ?? "Your plan"} subtitle={plan?.forWho}>
            <p className="plan-price">{plan?.priceLabel} <span className="plan-unit">{plan?.unit}</span></p>
            <ul className="plan-features">
              {plan?.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <div className="plan-limits">
              {plan?.limits.map((l) => <div key={l.label}><span>{l.label}</span><strong>{l.value}</strong></div>)}
            </div>
          </Card>

          <div className="stack" style={{ gap: 16 }}>
            <Card title="Contract" subtitle="Current term">
              <dl className="kv">
                <dt>Term</dt><dd>36 months, annual invoicing</dd>
                <dt>Started</dt><dd>{dateLabel(tenant.goLive)}</dd>
                <dt>Renewal</dt><dd>1 June 2028</dd>
                <dt>Bed licence</dt><dd className="tnum">{num(tenant.beds)} beds at {usd(48)}/month</dd>
                <dt>Uplift cap</dt><dd>4% per annum</dd>
                <dt>BAA</dt><dd>Executed 12 May 2025</dd>
              </dl>
            </Card>

            <Card title="Data on termination" subtitle="Worth knowing before you need it">
              <p className="prose" style={{ margin: 0 }}>
                On termination your data is retained for 90 days so you can export it, then deleted on a
                documented schedule with a certificate of destruction. A suspension for non-payment
                disables access but does <strong>not</strong> start the deletion clock — no hospital
                loses a record over an invoice dispute.
              </p>
            </Card>

            <Card title="Change your plan">
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Adding beds or raising the assessment allowance can be done mid-term and is pro-rated.
                Moving down a tier takes effect at renewal.
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => setContact("")}>Talk to your account team</Button>
                <Button variant="ghost" onClick={compare}>Compare plans</Button>
              </div>
              {mayPay && tenant.plan !== "enterprise" && (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {tenant.plan !== "essential" && (
                    <Button onClick={() => pay(() => startCheckout("essential", tenant.beds))}>Subscribe to Essential · {num(tenant.beds)} beds</Button>
                  )}
                  {tenant.plan !== "professional" && (
                    <Button onClick={() => pay(() => startCheckout("professional", tenant.beds))}>Subscribe to Professional · {num(tenant.beds)} beds</Button>
                  )}
                  <Button variant="ghost" icon={<CreditCardIcon size={15} />} onClick={() => pay(openBillingPortal)}>Manage payments</Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={openInvoice !== null}
        onClose={() => setOpenInvoice(null)}
        title={openInvoice?.id ?? ""}
        subtitle={openInvoice?.period}
        footer={<Button variant="primary" onClick={() => { const inv = openInvoice; setOpenInvoice(null); if (inv) void requestExport("invoice", undefined, { invoice_id: inv.id }).then(setToast); }}>Download PDF</Button>}
      >
        {openInvoice && (
          <>
            <ul className="invoice-lines">
              {openInvoice.lines.map((l) => (
                <li key={l.label}>
                  <div className="cell-stack"><span>{l.label}</span><span className="muted">{l.qty}</span></div>
                  <span className="tnum">{usd(l.amountUsd)}</span>
                </li>
              ))}
            </ul>
            <div className="invoice-total"><span>Total</span><span className="tnum">{usd(openInvoice.amountUsd)}</span></div>
          </>
        )}
      </Modal>

      <Modal
        open={contact !== null}
        onClose={() => setContact(null)}
        title="Talk to your account team"
        subtitle="Recorded as a request and answered by email"
        footer={
          <>
            <Button onClick={() => setContact(null)}>Cancel</Button>
            <Button variant="primary" disabled={!(contact ?? "").trim()} onClick={sendContact}>Send</Button>
          </>
        }
      >
        <Field label="What would you like to change?" required hint="Beds, assessment allowance, a tier change — anything about your contract.">
          <TextArea rows={4} value={contact ?? ""} onChange={(e) => setContact(e.currentTarget.value)} />
        </Field>
      </Modal>

      <Modal
        open={comparing !== null}
        onClose={() => setComparing(null)}
        title="Compare plans"
        subtitle="From the current plan catalogue"
        size="lg"
      >
        <div className="scroll-x">
          <table className="data-table">
            <thead><tr><th>Plan</th><th>Price</th><th>For</th><th>Includes</th></tr></thead>
            <tbody>
              {(comparing ?? []).map((p) => (
                <tr key={p.tier}>
                  <td><strong>{p.name}</strong>{p.tier === tenant.plan && <> <Badge tone="accent">your plan</Badge></>}</td>
                  <td className="tnum">{p.priceLabel} <span className="muted">{p.unit}</span></td>
                  <td className="muted">{p.forWho}</td>
                  <td className="muted">{p.features.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
