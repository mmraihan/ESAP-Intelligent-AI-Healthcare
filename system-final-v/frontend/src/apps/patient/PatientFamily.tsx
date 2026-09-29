/**
 * Screen P9 — Family and caregiver access (§13.3).
 *
 * This screen exists because the alternative is a patient handing their
 * password to a relative, which destroys the audit trail and makes abuse
 * invisible. Proper proxy access keeps every view attributable to a named
 * person, which protects the patient and the carer both.
 */
import { useState } from "react";
import { CONSENTS } from "@/mock/db";
import type { ConsentGrant } from "@/mock/types";
import { ago, initials } from "@/lib/format";
import { t, tr } from "@/i18n";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, TextInput, Toggle } from "@/components/ui/primitives";
import { ConfirmDestructive, Modal, Toast } from "@/components/ui/overlays";
import {
  AlertIcon, CheckIcon, EyeIcon, PlusIcon, ShieldIcon, UserIcon, UsersIcon, XIcon,
} from "@/components/ui/icons";
import { act, actAndRefresh } from "@/api/actions";
import { api } from "@/api/client";
import { hydrateFromApi } from "@/api/bootstrap";

/** The last caregiver link created this session, kept outside the component so a
 *  hydrate-triggered remount does not wipe the "share this link" banner. */
let lastCaregiverLink: { name: string; url: string } | null = null;

type Proxy = {
  id: string;
  name: string;
  relation: string;
  email: string;
  level: "view_summaries" | "view_all" | "act_on_behalf";
  since: string;
  lastViewed: string;
};

const LEVEL_LABEL: Record<Proxy["level"], { label: string; what: string }> = {
  view_summaries: { label: "Can see summaries", what: "Visit summaries and appointments. Not your full record, not your test results." },
  view_all: { label: "Can see everything", what: "Your whole record, the same as you see it." },
  act_on_behalf: { label: "Can act for you", what: "Everything above, plus they can request records and manage appointments on your behalf." },
};

const RELATIONS = ["Spouse or partner", "Son or daughter", "Parent", "Sibling", "Friend", "Paid carer", "Other"];

const LEVEL_SCOPE: Record<Proxy["level"], string[]> = {
  view_summaries: ["Visit summaries", "Appointments"],
  view_all: ["Full record"],
  act_on_behalf: ["Full record", "Requests on my behalf"],
};

/** A caregiver consent, as the server holds it, in the shape this screen shows. */
function toProxy(c: ConsentGrant): Proxy {
  const extra = c as ConsentGrant & { proxyName?: string; relationship?: string; inviteEmail?: string; level?: Proxy["level"] };
  const match = /^(.*?)\s*\((.+)\)$/.exec(c.grantee);
  return {
    id: c.id,
    name: extra.proxyName ?? (match ? match[1] : c.grantee),
    relation: extra.relationship ?? (match ? match[2] : "Carer"),
    email: extra.inviteEmail ?? "—",
    level: extra.level ?? "view_summaries",
    since: ago(c.grantedAt),
    lastViewed: "not yet recorded",
  };
}

type NewProxy = { name: string; email: string; relation: string; level: Proxy["level"]; notify: boolean };
const BLANK: NewProxy = { name: "", email: "", relation: "Son or daughter", level: "view_summaries", notify: true };

export function PatientFamily() {
  // Caregiver access is a consent on the patient's record; the store holds the
  // server's copy, refreshed after every change below.
  const proxies = CONSENTS.filter((c) => c.granteeType === "caregiver" && c.status === "active").map(toProxy);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<NewProxy>(BLANK);
  const [removing, setRemoving] = useState<Proxy | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [link, setLink] = useState(lastCaregiverLink);

  async function invite() {
    const d = draft;
    setAdding(false);
    setDraft(BLANK);
    // Set the shareable link BEFORE hydrating: hydrateFromApi() remounts this
    // screen, and a remount re-reads `lastCaregiverLink`.
    const msg = await act(
      () => api.post<{ acceptToken: string; acceptPath: string }>("/api/v1/patient/family", {
        name: d.name.trim(), email: d.email.trim(), relationship: d.relation,
        scope: LEVEL_SCOPE[d.level], level: d.level, notify_on_view: d.notify,
      }),
      (r) => {
        lastCaregiverLink = { name: d.name.trim(), url: `${window.location.origin}${r.acceptPath}` };
        setLink(lastCaregiverLink);
        return t("Invitation created for {name}", { name: d.name.trim() });
      },
    );
    setToast(msg);
    await hydrateFromApi().catch(() => undefined);
  }

  function remove(p: Proxy) {
    void actAndRefresh(
      () => api.del(`/api/v1/patient/sharing/${p.id}`),
      () => t("{name} no longer has access", { name: p.name }),
    ).then(setToast);
  }

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("Family access")}
        title={t("Letting someone help you")}
        lede={t("If a family member or carer helps with your care, give them their own access rather than sharing your password. It is safer for both of you.")}
        actions={<Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => setAdding(true)}>{t("Add someone")}</Button>}
      />

      <Banner tone="warning" icon={<AlertIcon size={18} />} title={t("Please do not share your password")}>
        {t("It sounds easier, and it causes real problems. With a shared password, nobody can tell which of you looked at what — so if something ever goes wrong, there is no way to show what you did and what someone else did. Proper access takes two minutes and keeps that record straight.")}
      </Banner>

      {link && (
        <Banner tone="accent" icon={<CheckIcon size={18} />} title={t("Send {name} this link to set up their access", { name: link.name })}>
          {t("There is no email service in this demo, so pass this link to them yourself. They open it, choose a password, and can then see what you shared.")}
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <a className="mono" href={link.url} style={{ fontSize: 13, wordBreak: "break-all" }}>{link.url}</a>
            <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(link.url); setToast(t("Link copied")); }}>{t("Copy link")}</Button>
          </div>
        </Banner>
      )}

      <Card title={t("People who can help with your record")} subtitle={t("{n} at the moment", { n: proxies.length })}>
        {proxies.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            {t("Nobody else has access. That is completely fine — plenty of people manage on their own.")}
          </p>
        ) : (
          proxies.map((p) => (
            <div key={p.id} className="consent-row">
              <div className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
                <span className="avatar" style={{ width: 40, height: 40, fontSize: 14 }} aria-hidden="true">{initials(p.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 15.5 }}>{p.name}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 13.5 }}>
                    {t(p.relation)} · <span className="mono">{p.email}</span>
                  </p>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 13.5 }}>
                    <span className="row" style={{ gap: 6 }}>
                      <EyeIcon size={13} /> {t("Last looked {when} · access since {since}", { when: t(p.lastViewed), since: t(p.since) })}
                    </span>
                  </p>
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Badge tone="accent">{t(LEVEL_LABEL[p.level].label)}</Badge>
                <Button size="sm" variant="ghost" icon={<XIcon size={14} />} onClick={() => setRemoving(p)}>{t("Remove")}</Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card title={t("The three levels of access")} subtitle={t("You choose, and you can change it later")}>
        <div className="stack" style={{ gap: 12 }}>
          {(Object.keys(LEVEL_LABEL) as Proxy["level"][]).map((k) => (
            <div key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="big-choice-icon" style={{ width: 38, height: 38, flex: "none" }}>
                {k === "view_summaries" ? <EyeIcon size={18} /> : k === "view_all" ? <UserIcon size={18} /> : <UsersIcon size={18} />}
              </span>
              <div>
                <strong style={{ fontSize: 15 }}>{t(LEVEL_LABEL[k].label)}</strong>
                <p style={{ margin: "3px 0 0", fontSize: 14.5, lineHeight: 1.65 }}>{t(LEVEL_LABEL[k].what)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> {t("Things worth knowing")}</span>}>
        <ul className="qa-list">
          <li><CheckIcon size={16} /> <span>{t("You can see exactly when they looked, on the Share & consent page.")}</span></li>
          <li><CheckIcon size={16} /> <span>{t("You can remove their access at any time, immediately, and they are not told why.")}</span></li>
          <li><CheckIcon size={16} /> <span>{t("They sign in with their own account. They never see your password and you never see theirs.")}</span></li>
          <li>
            <AlertIcon size={16} />
            <span>{t("If someone is pressuring you to give them access, you do not have to. Tell a nurse privately — they deal with this more often than you would think, and they will not make it awkward.")}</span>
          </li>
        </ul>
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t("Give a family member or carer access")}
        subtitle={t("They will get an email asking them to set up their own account")}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>{t("Cancel")}</Button>
            <Button
              variant="primary"
              disabled={!draft.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())}
              onClick={invite}
            >
              {t("Send invitation")}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label={t("Their name")} required>
            <TextInput placeholder="Marek Salib" style={{ fontSize: 16 }} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
          </Field>
          <Field label={t("Their email")} required hint={t("They will use this to set up their own account.")}>
            <TextInput type="email" placeholder="marek.salib@example.com" style={{ fontSize: 16 }} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })} />
          </Field>
          <Field label={t("How are they related to you?")}>
            <Select value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.currentTarget.value })} style={{ fontSize: 16 }}>
              {RELATIONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </Select>
          </Field>
          <Field label={t("What should they be able to see?")} required>
            <Select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.currentTarget.value as Proxy["level"] })} style={{ fontSize: 16 }}>
              {(Object.keys(LEVEL_LABEL) as Proxy["level"][]).map((k) => (
                <option key={k} value={k}>{t(LEVEL_LABEL[k].label)}</option>
              ))}
            </Select>
          </Field>
          <Toggle checked={draft.notify} onChange={(v) => setDraft({ ...draft, notify: v })} label={t("Tell me when they look at my record")} hint={t("You get a notification each time. Most people leave this on to begin with.")} />
        </div>
      </Modal>

      <ConfirmDestructive
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) remove(removing); }}
        title={t("Remove their access")}
        confirmWord={t("REMOVE")}
        actionLabel={t("Remove access")}
        body={tr("**{name}** will no longer be able to see your record.", { name: removing?.name ?? "" })}
        consequences={[
          t("This happens immediately."),
          t("They are not told the reason, only that access has ended."),
          t("You can give them access again later if you want to."),
        ]}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
