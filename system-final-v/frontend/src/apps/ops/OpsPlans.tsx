/**
 * 11.5.9 — Plan catalog (§17).
 *
 * The global plan definitions an admin assigns at provisioning. Editing a plan
 * here does not silently reprice existing contracts — that distinction is the
 * main thing the screen has to make obvious.
 */
import { useState } from "react";
import { PLANS, TENANTS } from "@/mock/db";
import type { PlanDefinition } from "@/mock/types";
import { num, usd } from "@/lib/format";
import { Badge, Banner, Button, Card, Field, PageHeader, SegmentedControl, StatTile, TextInput, cx } from "@/components/ui/primitives";
import { Drawer, Modal, Toast } from "@/components/ui/overlays";
import { CheckIcon, CreditCardIcon, LockIcon, PlusIcon } from "@/components/ui/icons";
import { actAndRefresh } from "@/api/actions";
import { api } from "@/api/client";

export function OpsPlans() {
  const [audience, setAudience] = useState<"hospital" | "individual">("hospital");
  const [editing, setEditing] = useState<PlanDefinition | null>(null);
  const [form, setForm] = useState({ priceLabel: "", unit: "", forWho: "" });
  const [creating, setCreating] = useState<{ tier: string; name: string; priceLabel: string; unit: string; forWho: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function edit(p: PlanDefinition) {
    setForm({ priceLabel: p.priceLabel, unit: p.unit, forWho: p.forWho });
    setEditing(p);
  }

  function savePlan() {
    const plan = editing;
    setEditing(null);
    if (!plan) return;
    void actAndRefresh(
      () => api.post("/api/v1/ops/plans", {
        tier: plan.tier,
        patch: { priceLabel: form.priceLabel.trim(), unit: form.unit.trim(), forWho: form.forWho.trim() },
        reason: "Plan definition edited from the plan catalogue",
      }),
      () => `${plan.name} saved — existing tenants are unaffected`,
    ).then(setToast);
  }

  function createPlan() {
    const c = creating;
    setCreating(null);
    if (!c) return;
    const tier = c.tier.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    void actAndRefresh(
      () => api.post("/api/v1/ops/plans", {
        tier,
        patch: { name: c.name.trim(), priceLabel: c.priceLabel.trim(), unit: c.unit.trim(), forWho: c.forWho.trim(), audience },
        reason: "New plan created from the plan catalogue",
      }),
      () => `${c.name.trim()} created — it applies to new contracts only`,
    ).then(setToast);
  }

  const shown = PLANS.filter((p) =>
    audience === "individual" ? ["free", "pro"].includes(p.tier) : !["free", "pro"].includes(p.tier),
  );

  const tenantsOn = (tier: string) => TENANTS.filter((t) => t.plan === tier);
  const mrr = TENANTS.filter((t) => t.status === "active").reduce((a, t) => a + t.beds * 48 + 12000, 0);

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Plan catalog"
        lede="The global plan definitions. Changing one defines what future contracts get — it never reprices an existing tenant."
        actions={<Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => setCreating({ tier: "", name: "", priceLabel: "", unit: "per month", forWho: "" })}>New plan</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Plans defined" value={PLANS.length} icon={<CreditCardIcon size={15} />} />
        <StatTile label="Tenants on a hospital plan" value={TENANTS.filter((t) => !["free", "pro"].includes(t.plan)).length} />
        <StatTile label="Self-serve seats" value={num(TENANTS.find((t) => t.mode === "individual")?.seats ?? 0)} />
        <StatTile label="Approx. monthly recurring" value={usd(mrr)} hint="Active hospital tenants, bed licence plus platform fee" />
      </div>

      <Banner tone="accent" icon={<LockIcon size={16} />} title="Editing a plan does not reprice anyone">
        Existing tenants hold the plan terms they signed. A change here applies to new contracts and to
        renewals — an in-term tenant keeps their pricing until their renewal date, and moving them
        earlier is a contract amendment, not a config change.
      </Banner>

      <SegmentedControl
        ariaLabel="Audience"
        value={audience}
        onChange={setAudience}
        options={[{ value: "hospital", label: "Hospital plans" }, { value: "individual", label: "Individual / self-serve" }]}
      />

      <div className="plan-grid">
        {shown.map((p) => (
          <div key={p.tier} className={cx("plan", p.highlighted && "is-featured")}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{p.name}</h3>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>{p.forWho}</p>
              </div>
              {p.highlighted && <Badge tone="accent">most common</Badge>}
            </div>

            <p className="plan-price" style={{ margin: 0 }}>
              {p.priceLabel} <span className="plan-unit">{p.unit}</span>
            </p>

            <ul className="plan-features">
              {p.features.map((f) => <li key={f}><CheckIcon size={13} /> {f}</li>)}
            </ul>

            <div className="plan-limits">
              {p.limits.map((l) => <div key={l.label}><span>{l.label}</span><strong>{l.value}</strong></div>)}
            </div>

            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {tenantsOn(p.tier).length} tenant{tenantsOn(p.tier).length === 1 ? "" : "s"}
              </span>
              <Button size="sm" onClick={() => edit(p)}>Edit</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="split">
        <Card title="What each plan actually gates" subtitle="§17.3" padded={false}>
          <div className="scroll-x">
            <table className="data-table is-dense">
              <thead>
                <tr>
                  <th>Capability</th>
                  {PLANS.filter((p) => !["free", "pro"].includes(p.tier)).map((p) => <th key={p.tier} style={{ textAlign: "center" }}>{p.tier}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { cap: "All five models", by: ["pilot", "essential", "professional", "enterprise"] },
                  { cap: "Admin console + SSO", by: ["essential", "professional", "enterprise"] },
                  { cap: "Audit log + fairness panel", by: ["essential", "professional", "enterprise"] },
                  { cap: "SMART on FHIR launch", by: ["professional", "enterprise"] },
                  { cap: "TEFCA / cross-hospital transfer", by: ["professional", "enterprise"] },
                  { cap: "SCIM provisioning", by: ["professional", "enterprise"] },
                  { cap: "Per-unit model policy", by: ["professional", "enterprise"] },
                  { cap: "On-prem / private cloud", by: ["enterprise"] },
                  { cap: "Model version pinning", by: ["enterprise"] },
                  { cap: "Dedicated isolation tier", by: ["enterprise"] },
                ].map((r) => (
                  <tr key={r.cap}>
                    <td>{r.cap}</td>
                    {PLANS.filter((p) => !["free", "pro"].includes(p.tier)).map((p) => (
                      <td key={p.tier} style={{ textAlign: "center" }}>
                        {r.by.includes(p.tier) ? <span className="grade grade-full">●</span> : <span className="grade grade-none">○</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="What is never gated" subtitle="A safety feature behind a paywall is not a safety feature">
          <ul className="caveat-list">
            <li><CheckIcon size={13} /> Calibration, and the badge that discloses its state.</li>
            <li><CheckIcon size={13} /> The Why panel on every estimate.</li>
            <li><CheckIcon size={13} /> The degraded-model label.</li>
            <li><CheckIcon size={13} /> The &ldquo;decision support, not diagnosis&rdquo; line.</li>
            <li><CheckIcon size={13} /> The stratified performance figures on the model basis page.</li>
          </ul>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            These appear on the free tier and the enterprise tier identically. Anything that tells a
            clinician how much to trust a number is not a premium feature.
          </p>
        </Card>
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        subtitle="Applies to new contracts and renewals only"
        width={520}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" disabled={!form.priceLabel.trim() || !form.unit.trim()} onClick={savePlan}>Save plan</Button>
          </>
        }
      >
        {editing && (
          <div className="stack" style={{ gap: 16 }}>
            <Card title="Pricing">
              <Field label="Display price" required><TextInput value={form.priceLabel} onChange={(e) => setForm({ ...form, priceLabel: e.currentTarget.value })} /></Field>
              <Field label="Unit" required><TextInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.currentTarget.value })} /></Field>
              <Field label="Who it is for" hint="Shown on the pricing page and in the provisioning wizard.">
                <TextInput value={form.forWho} onChange={(e) => setForm({ ...form, forWho: e.currentTarget.value })} />
              </Field>
            </Card>

            <Card title="Impact" subtitle="Who is on this plan today">
              {tenantsOn(editing.tier).length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>No tenant is on this plan.</p>
              ) : (
                <ul className="watch-list">
                  {tenantsOn(editing.tier).map((t) => (
                    <li key={t.id}>
                      <div style={{ flex: 1 }}>
                        <strong>{t.name}</strong>
                        <p className="muted" style={{ margin: "2px 0 0", fontSize: 11.5 }}>
                          {num(t.beds)} beds · keeps existing terms until renewal
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Drawer>

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title="New plan"
        subtitle="Added to the catalogue for new contracts. Safety features are identical on every plan."
        footer={
          <>
            <Button onClick={() => setCreating(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!creating || creating.tier.trim().length < 2 || !creating.name.trim() || !creating.priceLabel.trim()}
              onClick={createPlan}
            >
              Create plan
            </Button>
          </>
        }
      >
        {creating && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Plan code" required hint="Lower-case, used in contracts and on invoices. It cannot be changed later.">
              <TextInput className="mono" placeholder="research" value={creating.tier} onChange={(e) => setCreating({ ...creating, tier: e.currentTarget.value })} />
            </Field>
            <Field label="Display name" required><TextInput placeholder="Research" value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.currentTarget.value })} /></Field>
            <Field label="Display price" required><TextInput placeholder="$4,000" value={creating.priceLabel} onChange={(e) => setCreating({ ...creating, priceLabel: e.currentTarget.value })} /></Field>
            <Field label="Unit" required><TextInput value={creating.unit} onChange={(e) => setCreating({ ...creating, unit: e.currentTarget.value })} /></Field>
            <Field label="Who it is for"><TextInput value={creating.forWho} onChange={(e) => setCreating({ ...creating, forWho: e.currentTarget.value })} /></Field>
          </div>
        )}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
