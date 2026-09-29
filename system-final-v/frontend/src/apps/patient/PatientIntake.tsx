/**
 * Screen P3 — Guided self-intake, plain language (§13.3).
 *
 * A patient describing symptoms in their own words. What the screen must never
 * do is answer the question it is implicitly being asked ("what do I have?").
 * It collects, it organises, it hands the result to a clinician — and it says
 * so at the point where a user would expect a diagnosis instead.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { t, tr } from "@/i18n";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, TextArea, TextInput, Toggle, cx } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import {
  AlertIcon, ArrowRight, CheckIcon, ClockIcon, HeartPulseIcon, PillIcon, SparkIcon, StethoscopeIcon,
} from "@/components/ui/icons";
import { act } from "@/api/actions";
import { api } from "@/api/client";

type StepKey = "main" | "when" | "other" | "meds" | "questions" | "done";

const STEPS: { key: StepKey; title: string }[] = [
  { key: "main", title: "What is bothering you" },
  { key: "when", title: "When it started" },
  { key: "other", title: "Anything else" },
  { key: "meds", title: "What you are taking" },
  { key: "questions", title: "What you want to ask" },
  { key: "done", title: "Ready" },
];

/** Stored in English (the summary goes to the care team); displayed translated. */
const COMMON = [
  "Short of breath", "Chest pain", "Tired all the time", "Dizzy", "Feeling sick",
  "Pain in my tummy", "Cough", "Swollen legs", "Trouble sleeping", "Confused or forgetful",
];

const OFTEN_ASKED = [
  "What would need to change for me to go home?",
  "Which of my medicines is for which problem?",
  "Who do I call if this gets worse after I go home?",
  "Is there anything I should stop doing?",
];

export function PatientIntake() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [story, setStory] = useState("");
  const [when, setWhen] = useState("days");
  const [worse, setWorse] = useState(true);
  const [meds, setMeds] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [missedDoses, setMissedDoses] = useState(false);
  const [otherChanges, setOtherChanges] = useState("");
  const [modifiers, setModifiers] = useState("");
  const [hadBefore, setHadBefore] = useState("yes");

  /** Everything the patient told us, in their own words — never scored. */
  function submit() {
    const before = hadBefore === "no" ? "This is new" : hadBefore === "yes" ? "I have had something like this before" : "Not sure if I have had this before";
    const describe = [
      story.trim(),
      selected.length ? `Bothering me: ${selected.join(", ")}` : "",
      otherChanges.trim() ? `Other changes: ${otherChanges.trim()}` : "",
      modifiers.trim() ? `Better or worse with: ${modifiers.trim()}` : "",
      before,
    ].filter(Boolean).join("\n");
    void act(
      () => api.post("/api/v1/patient/intake", {
        describe,
        since: when,
        severity: null,
        getting_worse: worse,
        missed_doses: missedDoses,
        concerns: selected,
        medications: meds.trim() || null,
        questions: questions.map((q) => q.trim()).filter(Boolean),
      }),
      () => t("Sent to your care team"),
    ).then(setToast);
  }

  const key = STEPS[step].key;
  const urgent = selected.includes("Chest pain") || selected.includes("Short of breath");

  function toggleSymptom(s: string) {
    setSelected((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  }

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("In your own words")}
        title={t("Tell us how you are feeling")}
        lede={t("There are no wrong answers, and you can skip anything. We turn what you say into a summary for your care team — we do not tell you what is wrong, because that is their job.")}
      />

      <ul className="step-list">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <span className={cx("step", i === step && "is-active", i < step && "is-done")}>
              <span className="step-num">{i < step ? <CheckIcon size={11} /> : i + 1}</span>
              {t(s.title)}
            </span>
          </li>
        ))}
      </ul>

      {urgent && (
        <Banner tone="critical" icon={<AlertIcon size={18} />} title={t("If this is happening right now, do not wait for this form")}>
          {tr("Chest pain or trouble breathing that is happening **right now** needs someone to look at you straight away. Press your call bell, or if you are at home, call emergency services. You can come back to this afterwards.")}
        </Banner>
      )}

      {key === "main" && (
        <Card title={t("What is bothering you most?")} subtitle={t("Tap anything that fits, then add anything we have missed")}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {COMMON.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                style={{
                  fontSize: 15,
                  padding: "8px 14px",
                  background: selected.includes(s) ? "var(--accent-weak)" : undefined,
                  color: selected.includes(s) ? "var(--accent-ink)" : undefined,
                  borderColor: selected.includes(s) ? "var(--accent)" : undefined,
                }}
                onClick={() => toggleSymptom(s)}
                aria-pressed={selected.includes(s)}
              >
                {selected.includes(s) && <CheckIcon size={13} />} {t(s)}
              </button>
            ))}
          </div>
          <Field label={t("Tell us in your own words")} hint={t("Whatever you would say to a friend. It does not need to sound medical.")}>
            <TextArea
              rows={4}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder={t("I have been getting out of breath just walking to the kitchen. It started a few days ago and it is worse at night.")}
              style={{ fontSize: 16 }}
            />
          </Field>
        </Card>
      )}

      {key === "when" && (
        <Card title={<span className="row" style={{ gap: 8 }}><ClockIcon size={18} /> {t("When did it start?")}</span>}>
          <Field label={t("Roughly how long has this been going on?")}>
            <Select value={when} onChange={(e) => setWhen(e.target.value)} style={{ fontSize: 16 }}>
              <option value="today">{t("Today")}</option>
              <option value="days">{t("A few days")}</option>
              <option value="weeks">{t("A few weeks")}</option>
              <option value="months">{t("Months")}</option>
              <option value="longer">{t("Longer than that")}</option>
            </Select>
          </Field>
          <Toggle checked={worse} onChange={setWorse} label={t("It has been getting worse")} hint={t("Whether something is getting worse matters more than exactly when it started.")} />
          <Field label={t("Is there anything that makes it better or worse?")}>
            <TextArea rows={3} placeholder={t("Worse when I lie flat. A bit better if I sit up with pillows.")} style={{ fontSize: 16 }} value={modifiers} onChange={(e) => setModifiers(e.currentTarget.value)} />
          </Field>
        </Card>
      )}

      {key === "other" && (
        <Card title={t("Anything else you have noticed?")} subtitle={t("Things that seem unrelated are often the useful ones")}>
          <Field label={t("Other changes")}>
            <TextArea rows={4} placeholder={t("My ankles have been puffy. I have not been eating much.")} style={{ fontSize: 16 }} value={otherChanges} onChange={(e) => setOtherChanges(e.currentTarget.value)} />
          </Field>
          <Field label={t("Have you had this before?")}>
            <Select value={hadBefore} onChange={(e) => setHadBefore(e.currentTarget.value)} style={{ fontSize: 16 }}>
              <option value="no">{t("No, this is new")}</option>
              <option value="yes">{t("Yes, something like this before")}</option>
              <option value="unsure">{t("I am not sure")}</option>
            </Select>
          </Field>
        </Card>
      )}

      {key === "meds" && (
        <Card title={<span className="row" style={{ gap: 8 }}><PillIcon size={18} /> {t("What are you taking?")}</span>} subtitle={t("Including anything you buy without a prescription")}>
          <Field label={t("Your medicines")} hint={t("One per line is fine. If you do not know the name, describe it — 'small white one for my heart' is genuinely useful.")}>
            <TextArea
              rows={5}
              value={meds}
              onChange={(e) => setMeds(e.target.value)}
              placeholder={t("Furosemide, one in the morning\nRamipril\nSomething small and white for my heart\nParacetamol when I need it")}
              style={{ fontSize: 16 }}
            />
          </Field>
          <Toggle checked={missedDoses} onChange={setMissedDoses} label={t("I have missed some doses recently")} hint={t("Nobody is checking up on you. It genuinely changes what your team should do next.")} />
        </Card>
      )}

      {key === "questions" && (
        <Card title={t("What do you want to ask?")} subtitle={t("These go on your summary so you do not forget them in the moment")}>
          {questions.map((q, i) => (
            <Field key={i} label={i === 0 ? t("Your questions") : ""}>
              <TextInput
                value={q}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={i === 0 ? t("Will I be able to manage the stairs at home?") : t("Another question")}
                style={{ fontSize: 16 }}
              />
            </Field>
          ))}
          <Button onClick={() => setQuestions([...questions, ""])}>{t("Add another question")}</Button>
          <Banner tone="accent" icon={<SparkIcon size={18} />} title={t("Questions other people often ask")}>
            <ul style={{ margin: "6px 0 0", paddingInlineStart: 20, lineHeight: 1.7 }}>
              {OFTEN_ASKED.map((q) => <li key={q}>{t(q)}</li>)}
            </ul>
          </Banner>
        </Card>
      )}

      {key === "done" && (
        <>
          <Card
            title={<span className="row" style={{ gap: 8 }}><CheckIcon size={18} /> {t("That is everything")}</span>}
            subtitle={t("Here is what happens next")}
            actions={<Badge tone="good">{t("Saved")}</Badge>}
          >
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>
              {t("Your answers have been organised into a summary. Your care team will see it before they next talk to you, and you can print it or show it on your phone.")}
            </p>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={() => nav("/patient/previsit")}>{t("See my summary")} <ArrowRight size={14} /></Button>
              <Button onClick={() => nav("/patient/home")}>{t("Back to my health")}</Button>
            </div>
          </Card>

          <Banner tone="warning" icon={<StethoscopeIcon size={18} />} title={t("We have not told you what is wrong — and we will not")}>
            {t("You may have expected this to come back with an answer. It does not, deliberately. Working out what is causing your symptoms needs someone who can examine you and knows your history. What this does is make sure they have the full picture when they do.")}
          </Banner>
        </>
      )}

      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
        <Button disabled={step === 0} onClick={() => setStep(step - 1)}>{t("Back")}</Button>
        {key !== "done" ? (
          <Button
            variant="primary"
            onClick={() => {
              // The last step is what actually reaches the care team. It goes
              // as the patient's own words — never scored, never turned into a
              // condition on their record.
              if (step === STEPS.length - 2 && (story.trim() || selected.length || otherChanges.trim())) submit();
              setStep(step + 1);
            }}
          >
            {step === STEPS.length - 2 ? t("Finish") : t("Next")}
          </Button>
        ) : (
          <Button onClick={() => {
            setStep(0); setSelected([]); setStory(""); setWorse(true); setMeds(""); setQuestions([""]); setMissedDoses(false);
            setOtherChanges(""); setHadBefore("yes"); setModifiers("");
            setToast(t("Started again"));
          }}>{t("Start again")}</Button>
        )}
      </div>

      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, maxWidth: "60ch" }}>
        <HeartPulseIcon size={13} /> {t("You can stop at any point and come back — nothing is lost.")}
      </p>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
