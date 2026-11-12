/**
 * Pricing (§17).
 *
 * The packaging rule that shapes the page: nothing that tells a clinician how
 * much to trust a number is ever a paid feature. Calibration, the Why panel,
 * the degraded label and the stratified evidence are on every tier including
 * the free one, and the page says so explicitly.
 *
 * English and Arabic (QA issue 14): strings are English keys translated with
 * t() at render, including the plan records that come from the server.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PLANS } from "@/mock/db";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/rbac";
import { startCheckout, type PaidTier } from "@/api/billing";
import { ApiError, NetworkError } from "@/api/client";
import { planCopy } from "@/lib/planCopy";
import { Badge, Banner, Button, Card, SegmentedControl, cx } from "@/components/ui/primitives";
import { t, tl } from "@/i18n";
import { SiteLayout } from "./SiteLayout";
import { PricingArt } from "./SiteArt";
import { CheckIcon, LockIcon, ScaleIcon, ShieldIcon } from "@/components/ui/icons";

const NEVER_GATED = [
  "Calibration, and the badge that discloses its state",
  "The Why panel on every single estimate",
  "The degraded-model label",
  "Stratified performance figures on the model basis page",
  "The standing “decision support, not diagnosis” line",
  "The leakage alarm and its negative control",
];

/** English keys; FaqPage reuses them, and both translate with t() at render. */
export const PRICING_FAQ = [
  {
    q: "What counts as an assessment?",
    a: "One call that produced at least one model result. Re-running an encounter after new labs arrive counts again — that is usually where an unexpected overage comes from, so the admin console shows the meter prominently rather than burying it in a report.",
  },
  {
    q: "Do you charge per clinician?",
    a: "Not on hospital plans. Seats are unmetered; you pay per bed and per assessment. Charging per seat pushes hospitals to ration logins, which means a nurse shares an account, which destroys the audit trail.",
  },
  {
    q: "What happens if we stop paying?",
    a: "Access is suspended and your data is retained for 90 days so you can export it. Suspension does not start a deletion clock. No hospital loses a record over an invoice dispute.",
  },
  {
    q: "Can we run this on our own infrastructure?",
    a: "Not yet. On-premises delivery is planned for Enterprise and is not available in this build.",
  },
  {
    q: "Is there a discount for a pilot?",
    a: "The pilot is its own SKU rather than a discount — fixed 90 days, up to 25 seats, one unit or service line, with a fairness and calibration report at exit whether or not you continue.",
  },
];

/** Who may buy a hospital plan online: the hospital's owner or billing admin. */
const HOSPITAL_BUYERS = ["tenant_owner", "billing_admin"];
const INDIVIDUAL_TENANT = "t_solo";

const TERMS = [
  ["Typical term", "36 months"],
  ["Annual uplift cap", "4%"],
  ["Mid-term bed additions", "Pro-rated"],
  ["Data on termination", "90-day export window"],
  ["Data processing agreement", "Signed before any real patient data"],
  ["Outcome-based option", "Available on Enterprise"],
] as const;

export function PricingPage() {
  const nav = useNavigate();
  const { authenticated, role, tenantId } = useSession();
  const individual = authenticated && tenantId === INDIVIDUAL_TENANT && role !== "patient";
  // Individual clinicians can only buy Pro, so open on their tab.
  const [audience, setAudience] = useState<"hospital" | "individual">(individual ? "individual" : "hospital");
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const hospitalBuyer = authenticated && tenantId !== INDIVIDUAL_TENANT && HOSPITAL_BUYERS.includes(role);

  /** Paid plans go to Polar checkout when the signed-in account can buy them;
   *  everyone else is sent to the step that comes first for them. */
  async function choose(tier: string) {
    const paid = (tier === "pro" && individual) || (["pilot", "essential", "professional"].includes(tier) && hospitalBuyer);
    if (!paid) {
      if (tier === "free" || tier === "pro") nav(authenticated ? ROLES[role].home : tier === "pro" ? "/signup?plan=pro" : "/signup");
      else nav("/waitlist");
      return;
    }
    setBusyTier(tier);
    setCheckoutError(null);
    try {
      await startCheckout(tier as PaidTier);
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : err instanceof NetworkError ? err.message : "Could not start checkout.");
      setBusyTier(null);
    }
  }
  const shown = PLANS.filter((p) =>
    audience === "individual" ? ["free", "pro"].includes(p.tier) : !["free", "pro"].includes(p.tier),
  );

  return (
    <SiteLayout>
      <section className="hero hero-split" style={{ paddingBottom: 0 }}>
        <div className="hero-copy">
        <span className="hero-eyebrow">{t("Pricing")}</span>
        <h1>{t("Priced on beds and use, not on how many people you let log in.")}</h1>
        <p className="hero-lede">
          {t("Every tier includes the things that tell a clinician how far to trust a number. Those are not premium features, and they never will be.")}
        </p>
        <SegmentedControl
          ariaLabel={t("Audience")}
          value={audience}
          onChange={setAudience}
          options={[
            { value: "hospital", label: t("For hospitals") },
            { value: "individual", label: t("For individual clinicians") },
          ]}
        />
        </div>
        <PricingArt />
      </section>

      {checkoutError && (
        <section>
          <Banner tone="critical" title="Checkout did not open">{checkoutError}</Banner>
        </section>
      )}

      {shown.length === 0 && (
        <p className="pub-empty">
          {t("Plan details are not available from this server right now. Every tier keeps calibration, the Why panel and the evidence pages free — see below, or try again in a moment.")}
        </p>
      )}
      <section className="plan-grid" hidden={shown.length === 0}>
        {shown.map((p) => (
          <div key={p.tier} className={cx("plan", p.highlighted && "is-featured")}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t(p.name)}</h3>
              {p.highlighted && <Badge tone="accent">{t("most chosen")}</Badge>}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{t(planCopy(p.forWho))}</p>
            <p className="plan-price" style={{ margin: 0 }}>
              <bdi>{t(p.priceLabel)}</bdi> <span className="plan-unit">{t(p.unit)}</span>
            </p>
            <Button
              variant={p.highlighted ? "primary" : "default"}
              disabled={busyTier !== null}
              onClick={() => void choose(p.tier)}
            >
              {busyTier === p.tier ? t("Opening checkout…")
                : p.tier === "free" ? t("Start free")
                : p.tier === "pro" ? (individual ? t("Upgrade to Pro") : t("Get Pro"))
                : p.tier === "enterprise" ? t("Talk to us")
                : hospitalBuyer ? (p.tier === "pilot" ? t("Buy the pilot") : t("Subscribe")) : t("Start a pilot")}
            </Button>
            <ul className="plan-features">
              {p.features.map((f) => <li key={f}><CheckIcon size={14} /> {t(planCopy(f))}</li>)}
            </ul>
            <div className="plan-limits">
              {p.limits.map((l) => <div key={l.label}><span>{t(l.label)}</span><strong>{t(planCopy(l.value))}</strong></div>)}
            </div>
          </div>
        ))}
      </section>

      <section>
        <Card
          title={<span className="row" style={{ gap: 8 }}><LockIcon size={18} /> {t("What is never behind a paywall")}</span>}
          subtitle={t("A safety feature behind a paywall is not a safety feature")}
        >
          <ul className="caveat-list">
            {NEVER_GATED.map((g) => <li key={g}><CheckIcon size={14} /> {t(g)}</li>)}
          </ul>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {t("These render identically on a free individual account and on a thousand-bed enterprise contract. If a competitor charges extra for explainability or for their subgroup performance figures, that is worth asking them about.")}
          </p>
        </Card>
      </section>

      <section className="grid grid-2">
        <Card title={<span className="row" style={{ gap: 8 }}><ScaleIcon size={18} /> {t("The ROI question, answered honestly")}</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            {t("We can model the value of a shorter mean length of stay or a lower unplanned-escalation rate, and we will build that model with you. What we will not do is claim those outcomes are caused by the software on the strength of a before/after comparison. There is no controlled outcome study yet; when there is one, it will be pre-registered.")}
          </p>
        </Card>
        <Card title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> {t("Contract terms")}</span>}>
          <div className="plan-limits" style={{ borderTop: "none", paddingTop: 0 }}>
            {TERMS.map(([k, v]) => <div key={k}><span>{t(k)}</span><strong>{t(v)}</strong></div>)}
          </div>
        </Card>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>{t("Questions people actually ask")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {tl("More on accuracy, privacy and the patient portal in the {faq}.", { faq: <Link to="/faq">{t("full FAQ")}</Link> })}
        </p>
        {PRICING_FAQ.map((f) => (
          <Card key={f.q} title={t(f.q)}>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{t(f.a)}</p>
          </Card>
        ))}
      </section>

      <section>
        <Banner tone="accent" title={t("Not sure which tier?")}>
          {t("Start on the free individual account and run it against cases you already know the outcome of. It costs nothing, it takes an afternoon, and it will tell you more than any deck.")}
        </Banner>
      </section>
    </SiteLayout>
  );
}
