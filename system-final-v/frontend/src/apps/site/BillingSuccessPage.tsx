/**
 * Where Polar sends the browser after checkout (`/billing/success?checkout_id=`).
 *
 * Landing here proves only that the redirect happened. The plan changes when
 * Polar's signed webhook reaches the server, usually within seconds, so the
 * page polls the server's view and says "activating" until it agrees — it
 * never tells someone they are on Pro because a URL said so.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/rbac";
import { billingStatus, checkoutStatus } from "@/api/billing";
import { ApiError } from "@/api/client";
import { Banner, Card } from "@/components/ui/primitives";
import { SiteLayout } from "./SiteLayout";

const POLL_MS = 2500;
const GIVE_UP_AFTER = 24; // ~1 minute

type View =
  | { kind: "checking" }
  | { kind: "active"; plan: string }
  | { kind: "slow" }
  | { kind: "failed"; message: string };

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const checkoutId = params.get("checkout_id");
  const { authenticated, role } = useSession();
  const [view, setView] = useState<View>({ kind: "checking" });

  useEffect(() => {
    if (!authenticated || !checkoutId) return;
    let tries = 0;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      tries += 1;
      try {
        const checkout = await checkoutStatus(checkoutId!);
        if (checkout.status === "failed" || checkout.status === "expired") {
          setView({ kind: "failed", message: "The payment did not go through. You have not been charged." });
          return;
        }
        const status = await billingStatus();
        if (checkout.tier && status.plan === checkout.tier) {
          setView({ kind: "active", plan: checkout.tier });
          return;
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setView({ kind: "failed", message: "That checkout does not belong to this account." });
          return;
        }
        // Anything else is transient; keep polling.
      }
      if (stop) return;
      if (tries >= GIVE_UP_AFTER) setView({ kind: "slow" });
      else timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [authenticated, checkoutId]);

  const home = authenticated ? ROLES[role].home : "/login";

  return (
    <SiteLayout>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="hero-copy">
          <span className="hero-eyebrow">Billing</span>
          <h1>{view.kind === "active" ? "You're all set." : "Thank you — confirming your payment."}</h1>
        </div>
      </section>
      <section>
        <Card>
          {!checkoutId && <Banner tone="warning">This page needs a checkout reference. If you just paid, check your email for Polar's receipt.</Banner>}
          {checkoutId && !authenticated && (
            <Banner tone="info" title="Sign in to see your plan">
              Your payment is handled by Polar. <Link to="/login">Sign in</Link> with the account you bought it for and your plan will be on it.
            </Banner>
          )}
          {checkoutId && authenticated && view.kind === "checking" && (
            <Banner tone="info" title="Activating your plan">
              Waiting for confirmation from our payment provider. This usually takes a few seconds — you can leave this page open.
            </Banner>
          )}
          {view.kind === "active" && (
            <Banner tone="good" title={`Your ${view.plan} plan is active`}>
              A receipt is on its way from Polar. <Link to={home}>Go to your workspace</Link>.
            </Banner>
          )}
          {view.kind === "slow" && (
            <Banner tone="warning" title="Still waiting on confirmation">
              Your payment may still be processing. Your plan will switch over as soon as it is confirmed — check back
              shortly, or <Link to="/support">contact support</Link> if it has not changed within the hour.
            </Banner>
          )}
          {view.kind === "failed" && <Banner tone="critical" title="Payment not completed">{view.message} <Link to="/pricing">Back to pricing</Link>.</Banner>}
        </Card>
      </section>
    </SiteLayout>
  );
}
