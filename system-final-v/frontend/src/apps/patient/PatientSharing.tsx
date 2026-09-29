/**
 * Screen P7 — Share & Consent Center (§13.3, §7.4).
 *
 * The patient-facing face of the consent model. Two design decisions carry the
 * screen: revoking is always one click and never buried, and the history of who
 * actually looked is shown — a consent list without an access list tells the
 * patient what they permitted, not what happened.
 */
import { useEffect, useState } from "react";
import { CONSENTS } from "@/mock/db";
import type { ConsentGrant } from "@/mock/types";
import { ago, dateLabel } from "@/lib/format";
import { t, tr } from "@/i18n";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui/primitives";
import { ConfirmDestructive, Modal, Toast } from "@/components/ui/overlays";
import {
  AlertIcon, BuildingIcon, CheckIcon, ClockIcon, EyeIcon, GlobeIcon, PlusIcon, ShieldIcon,
  StethoscopeIcon, UsersIcon, XIcon,
} from "@/components/ui/icons";
import { act, actAndRefresh, isLive } from "@/api/actions";
import { useSession } from "@/lib/session";
import { api } from "@/api/client";

const TYPE_ICON: Record<ConsentGrant["granteeType"], JSX.Element> = {
  hospital: <BuildingIcon size={20} />,
  clinician: <StethoscopeIcon size={20} />,
  caregiver: <UsersIcon size={20} />,
  app: <GlobeIcon size={20} />,
};

/** Grantees that are a person are shown as written; organisations and descriptions translate. */
function granteeLabel(c: ConsentGrant): string {
  return c.granteeType === "clinician" ? c.grantee : t(c.grantee);
}

type AccessEvent = { id: string; at: string; actor: string; actorRole: string; action: string; target: string };

const ACTION_LABEL: Record<string, string> = {
  "patient.read": "Opened your record",
  "patient.submit": "Sent information to your care team",
  "consent.grant": "Gave someone access",
  "consent.revoke": "Stopped sharing",
  "export.phi": "Downloaded part of your record",
  "request.create": "Sent a request",
  "request.urgent": "Flagged something as urgent",
  "login.success": "Signed in",
  "user.password_change": "Changed the password",
};

export function PatientSharing() {
  const [revoking, setRevoking] = useState<ConsentGrant | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { email } = useSession();
  const [history, setHistory] = useState<AccessEvent[] | null>(null);
  const [grant, setGrant] = useState({ who: "", type: "caregiver", level: "summaries", until: "none" });

  function giveAccess() {
    const g = grant;
    setAdding(false);
    setGrant({ who: "", type: "caregiver", level: "summaries", until: "none" });
    const scope = g.level === "everything" ? ["Full record"]
      : g.level === "summaries_meds" ? ["Visit summaries", "Medications"] : ["Visit summaries"];
    const expires = g.until === "none" ? null : new Date(Date.now() + Number(g.until) * 86_400_000).toISOString();
    void actAndRefresh(
      () => api.post("/api/v1/patient/sharing", {
        grantee: g.who.trim(), grantee_type: g.type,
        purpose: g.type === "caregiver" ? "Caregiver access" : g.type === "app" ? "Health app" : "Treatment",
        scope, expires_at: expires,
      }),
      () => t("Access granted"),
    ).then(setToast);
  }
  const [fullOpen, setFullOpen] = useState(false);

  // Recent access comes from the server's audit trail, not a sample list.
  useEffect(() => {
    if (!isLive()) return;
    api.get<{ events: AccessEvent[] }>("/api/v1/patient/access-log").then((r) => setHistory(r.events)).catch(() => undefined);
  }, []);

  const who = (a: AccessEvent) => (a.actor === email ? t("You") : a.actor);
  const what = (a: AccessEvent) => t(ACTION_LABEL[a.action] ?? a.action);

  function openFull() {
    void act(
      () => api.get<{ events: AccessEvent[] }>("/api/v1/patient/access-log"),
      (r) => { setHistory(r.events); setFullOpen(true); return ""; },
    ).then((m) => { if (m) setToast(m); });
  }

  const active = CONSENTS.filter((c) => c.status === "active");
  const past = CONSENTS.filter((c) => c.status !== "active");

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("Share & consent")}
        title={t("Who can see your record")}
        lede={t("You decide. Anything you allow here you can take back at any time, and taking it back is immediate.")}
        actions={<Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => setAdding(true)}>{t("Give someone access")}</Button>}
      />

      <Banner tone="accent" icon={<ShieldIcon size={18} />} title={t("One thing you cannot switch off")}>
        {t("The people directly treating you right now can see your record while you are in their care. That is how hospitals are allowed to work, and turning it off would mean the nurse at your bedside could not see your medicines. Everything else on this page is your choice.")}
      </Banner>

      <Card title={t("Who has access now")} subtitle={t("{n} people and organisations", { n: active.length })}>
        {active.map((c) => (
          <div key={c.id} className="consent-row">
            <div className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
              <span className="big-choice-icon" style={{ width: 40, height: 40 }}>{TYPE_ICON[c.granteeType]}</span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 15.5 }}>{granteeLabel(c)}</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13.5 }}>
                  {t(c.purpose)} · {t("since {date}", { date: dateLabel(c.grantedAt) })}
                  {" · "}
                  {c.expiresAt ? t("ends {date}", { date: dateLabel(c.expiresAt) }) : t("no end date")}
                </p>
                <div className="consent-scope">
                  {c.scope.map((s) => <span key={s} className="chip" style={{ fontSize: 12.5 }}>{t(s)}</span>)}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {c.expiresAt && <Badge tone="neutral" icon={<ClockIcon size={11} />}>{t("ends {when}", { when: ago(c.expiresAt) })}</Badge>}
              <Button size="sm" variant="ghost" icon={<XIcon size={14} />} onClick={() => setRevoking(c)}>
                {t("Stop sharing")}
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card
        title={<span className="row" style={{ gap: 8 }}><EyeIcon size={18} /> {t("Who actually looked")}</span>}
        subtitle={t("The last few times someone opened your record")}
        footnote={t("A list of who you gave permission to is not the same as a list of who actually looked. This is the second one — and it is complete, including anyone at the hospital.")}
      >
        <ul className="qa-list">
          {history === null ? (
            <li><span className="muted">{t("Loading…")}</span></li>
          ) : history.length === 0 ? (
            <li><span className="muted">{t("Nobody has looked at your record yet.")}</span></li>
          ) : (
            history.slice(0, 5).map((a) => (
              <li key={a.id}>
                <EyeIcon size={16} />
                <span>
                  <strong>{who(a)}</strong> — {what(a)}
                  <br />
                  <span className="muted" style={{ fontSize: 13.5 }}>{ago(a.at)}</span>
                </span>
              </li>
            ))
          )}
        </ul>
        <Button onClick={openFull}>{t("See the full history")}</Button>
      </Card>

      {past.length > 0 && (
        <Card title={t("Access you have stopped")} subtitle={t("Kept here so you have a record of it")}>
          {past.map((c) => (
            <div key={c.id} className="consent-row" style={{ opacity: 0.72 }}>
              <div className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
                <span className="big-choice-icon" style={{ width: 36, height: 36 }}>{TYPE_ICON[c.granteeType]}</span>
                <div>
                  <strong>{granteeLabel(c)}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 13.5 }}>
                    {t(c.purpose)} · {c.status === "revoked" ? t("you stopped this") : t("expired")}{" "}
                    {c.expiresAt ? ago(c.expiresAt) : ""}
                  </p>
                </div>
              </div>
              <Badge tone="neutral">{c.status === "revoked" ? t("revoked") : t("expired")}</Badge>
            </div>
          ))}
        </Card>
      )}

      <Card title={t("What stopping access does — and does not do")}>
        <ul className="qa-list">
          <li>
            <CheckIcon size={16} />
            <span>{tr("**It works straight away.** The next time they try to open your record, they cannot.")}</span>
          </li>
          <li>
            <AlertIcon size={16} />
            <span>{tr("**It does not unsend what was already sent.** If a hospital received a copy of your record last month, that copy is theirs to keep under their own rules. Ask them directly if you want it deleted.")}</span>
          </li>
          <li>
            <CheckIcon size={16} />
            <span>{tr("**Nobody is told off.** Stopping access is normal and expected. You do not owe anyone a reason.")}</span>
          </li>
        </ul>
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t("Give someone access")}
        subtitle={t("You can set an end date, and you can stop it any time before that")}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>{t("Cancel")}</Button>
            <Button variant="primary" disabled={grant.who.trim().length < 2} onClick={giveAccess}>{t("Give access")}</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label={t("Who?")} required hint={t("An email address, or search for a hospital or clinic.")}>
            <TextInput placeholder="their.name@example.com" style={{ fontSize: 16 }} value={grant.who} onChange={(e) => setGrant({ ...grant, who: e.currentTarget.value })} />
          </Field>
          <Field label={t("What kind of access?")} required>
            <Select value={grant.type} onChange={(e) => setGrant({ ...grant, type: e.currentTarget.value })} style={{ fontSize: 16 }}>
              <option value="caregiver">{t("A family member or carer")}</option>
              <option value="clinician">{t("A doctor or nurse somewhere else")}</option>
              <option value="hospital">{t("Another hospital or clinic")}</option>
              <option value="app">{t("A health app")}</option>
            </Select>
          </Field>
          <Field label={t("How much can they see?")} required>
            <Select value={grant.level} onChange={(e) => setGrant({ ...grant, level: e.currentTarget.value })} style={{ fontSize: 16 }}>
              <option value="summaries">{t("Visit summaries only")}</option>
              <option value="summaries_meds">{t("Visit summaries and medicines")}</option>
              <option value="everything">{t("Everything on my record")}</option>
            </Select>
          </Field>
          <Field label={t("Until when?")} hint={t("Leaving this open is fine — you can stop it whenever you like.")}>
            <Select value={grant.until} onChange={(e) => setGrant({ ...grant, until: e.currentTarget.value })} style={{ fontSize: 16 }}>
              <option value="none">{t("No end date")}</option>
              <option value="30">{t("30 days")}</option>
              <option value="90">{t("90 days")}</option>
              <option value="365">{t("A year")}</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDestructive
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => { const c = revoking; if (c) void actAndRefresh(
          () => api.del(`/api/v1/patient/sharing/${c.id}`),
          () => t("{name} can no longer see your record", { name: granteeLabel(c) }),
        ).then(setToast); }}
        title={t("Stop sharing your record")}
        confirmWord={t("STOP")}
        actionLabel={t("Stop sharing")}
        body={tr("**{name}** will no longer be able to open your record.", { name: revoking ? granteeLabel(revoking) : "" })}
        consequences={[
          t("This takes effect immediately."),
          t("Anything already sent to them stays with them — ask them directly if you want it deleted."),
          t("You can give access again later if you change your mind."),
        ]}
      />

      <Modal open={fullOpen} onClose={() => setFullOpen(false)} title={t("Everyone who has looked at your record")} size="lg">
        {history && history.length > 0 ? (
          <ul className="qa-list">
            {history.map((a) => (
              <li key={a.id}>
                <EyeIcon size={16} />
                <span>
                  <strong>{who(a)}</strong> — {what(a)}
                  <br />
                  <span className="muted" style={{ fontSize: 13.5 }}>{dateLabel(a.at)} · {ago(a.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{t("Nobody has looked at your record yet.")}</p>
        )}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
