/**
 * Screen P8 — Care team (§13.3).
 *
 * Who is looking after you, what each of them actually does, and who to ask
 * about what. The "who to ask" framing is the point: patients routinely save a
 * question for the consultant that the nurse could answer in ten seconds.
 */
import { useState } from "react";
import { CARE_TEAM } from "@/mock/db";
import { dateLabel, initials } from "@/lib/format";
import { t } from "@/i18n";
import { Badge, Banner, Button, Card, PageHeader } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { BuildingIcon, ClockIcon, SendIcon, StethoscopeIcon, UsersIcon } from "@/components/ui/icons";
import { RequestDialog, type RequestSpec } from "./RequestDialog";
import { PatientConnectCard } from "@/components/clinical/ConnectFeature";
import { PatientRequestsCard } from "./PatientRequestsCard";

const ASK_GUIDE = [
  { who: "Your nurse", about: "Pain, sleep, food, when something is due, how to use equipment, anything that is worrying you right now.", note: "They are on the ward. Ask straight away rather than saving it up." },
  { who: "Your consultant or the ward doctors", about: "What is causing this, what the plan is, whether treatment is working, when you might go home.", note: "Usually on the ward round each morning — have your questions ready." },
  { who: "Your case manager", about: "Getting home safely, equipment, care at home, follow-up appointments, transport.", note: "Start this conversation early. Discharge arrangements take days, not hours." },
  { who: "The pharmacist", about: "What each medicine is for, side effects, interactions, what to do if you miss a dose.", note: "You can ask to speak to them even if nobody has offered." },
];

export function PatientCareTeam() {
  const [toast, setToast] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestSpec | null>(null);

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("Care team")}
        title={t("Who is looking after you")}
        lede={t("The people currently involved in your care, and what each of them is the right person to ask about.")}
      />

      <PatientConnectCard />

      <PatientRequestsCard />

      <div className="grid grid-2">
        {CARE_TEAM.map((m) => (
          <Card
            key={m.id}
            title={
              <span className="row" style={{ gap: 12 }}>
                <span className="avatar" style={{ width: 40, height: 40, fontSize: 14 }} aria-hidden="true">{initials(m.name)}</span>
                <span>
                  {m.name}
                  {m.primary && <> <Badge tone="accent">{t("leading your care")}</Badge></>}
                </span>
              </span>
            }
            subtitle={t(m.role)}
          >
            <p className="muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65 }}>
              <span className="row" style={{ gap: 7 }}><BuildingIcon size={15} /> {t(m.facility)}</span>
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
              <span className="row" style={{ gap: 7 }}><ClockIcon size={15} /> {t("Involved in your care since {date}", { date: dateLabel(m.since) })}</span>
            </p>
            <Button size="sm" icon={<SendIcon size={14} />} onClick={() => setRequest({
              kind: "care_team_message", ref: m.name,
              title: t("Message {name}", { name: m.name }),
              label: t("Your message"),
              hint: t("For anything urgent, tell the nurse on the ward rather than writing here."),
              done: t("Your message has been sent to {name}", { name: m.name }),
            })}>
              {t("Send a message")}
            </Button>
          </Card>
        ))}
      </div>

      <Card title={<span className="row" style={{ gap: 8 }}><StethoscopeIcon size={18} /> {t("Who to ask about what")}</span>}>
        <div className="stack" style={{ gap: 14 }}>
          {ASK_GUIDE.map((a) => (
            <div key={a.who} style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <strong style={{ fontSize: 15.5 }}>{t(a.who)}</strong>
              <p style={{ margin: "4px 0 0", fontSize: 15, lineHeight: 1.7 }}>{t(a.about)}</p>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>{t(a.note)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Banner tone="accent" icon={<UsersIcon size={18} />} title={t("Nobody minds being asked twice")}>
        {t("Hospital conversations happen fast, often when you are tired or in pain. If you did not follow something, or you have forgotten what was said, ask again. It is not a nuisance — an unasked question is a much bigger problem than a repeated one.")}
      </Banner>

      <Card title={t("If you are not happy with something")}>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75 }}>
          {t("You can ask for a second opinion, ask to speak to someone more senior, or raise a concern formally — and none of that affects how you are treated. Every hospital has a patient liaison service for exactly this, and your nurse can put you in touch with them.")}
        </p>
        <Button onClick={() => setRequest({
          kind: "liaison_contact",
          title: t("Ask the patient liaison service to contact me"),
          label: t("What would you like to talk about?"),
          hint: t("A sentence is enough. They will contact you to hear the rest."),
          done: t("The patient liaison service has been asked to contact you"),
        })}>
          {t("Ask the patient liaison service to contact me")}
        </Button>
      </Card>

      <RequestDialog spec={request} onClose={() => setRequest(null)} onResult={setToast} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
