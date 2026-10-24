/**
 * N3 — My Patients (§12.4.2). The bedside nurse's home, assignment-scoped.
 *
 * A staff nurse sees a summary, not the full Why panel, and escalates rather
 * than acknowledges — the acknowledgement is the physician's signature. The
 * screen leads with the task list, because that is what this role's shift is.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ENCOUNTERS } from "@/mock/db";
import { ago, pct, seqToken } from "@/lib/format";
import { Banner, Button, Card, Meter, PageHeader, StatTile, cx } from "@/components/ui/primitives";
import { AssistiveLine, CalibratedBadge } from "@/components/ui/domain";
import { Toast } from "@/components/ui/overlays";
import { ActivityIcon, AlertIcon, BedIcon, CheckIcon, ClipboardIcon, FlaskIcon, PlusIcon } from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";
import { useSession } from "@/lib/session";
import { can } from "@/lib/rbac";

type Kind = "vitals" | "labs" | "intake" | "escalate";
/** A task on screen: stored on the server (`serverId`) or suggested from the chart and not yet ticked. */
type Task = { key: string; serverId?: string; label: string; due: string; kind: Kind; done: boolean; doneBy?: string | null };
type ServerTask = { id: string; encounterId: string | null; label: string; done: boolean; doneBy: string | null };

function kindOf(label: string): Kind {
  if (/vital|obs/i.test(label)) return "vitals";
  if (/lab|blood/i.test(label)) return "labs";
  if (/escalat|flag|icu/i.test(label)) return "escalate";
  return "intake";
}

export function MyPatientsPage() {
  const nav = useNavigate();
  const { role } = useSession();
  // Vitals, admitting and completing an intake are all patient:write — the
  // bedside (staff) nurse has it, a charge nurse does not (§4.6). Offering the
  // button to a role that will 403 is the bug; gate it here instead.
  const canWrite = can(role, "patient:write");
  const [toast, setToast] = useState<string | null>(null);
  const [stored, setStored] = useState<ServerTask[]>([]);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const mine = useMemo(() => ENCOUNTERS.filter((e) => e.state !== "closed").slice(0, 6), []);

  // The task list is the server's. Ticks, and who ticked them, survive a reload
  // and a shift change; a list held in the browser would not.
  useEffect(() => {
    if (!isLive()) return;
    api.get<{ tasks: ServerTask[] }>("/api/v1/tasks").then((r) => setStored(r.tasks)).catch(() => undefined);
  }, []);

  const tasks: Record<string, Task[]> = useMemo(() => {
    const out: Record<string, Task[]> = {};
    mine.forEach((e) => {
      const own = stored.filter((t) => t.encounterId === e.id);
      const list: Task[] = own.map((t) => ({
        key: t.id, serverId: t.id, label: t.label, due: "this shift", kind: kindOf(t.label), done: t.done, doneBy: t.doneBy,
      }));
      // Suggested from what the chart says now. Each becomes a stored task the
      // first time it is ticked, so it is matched by its wording afterwards.
      const suggested: { label: string; due: string; kind: Kind; when: boolean }[] = [
        { label: "Prior history missing — ask on the ward round", due: "this shift", kind: "intake", when: !e.hasPriorHistory },
        { label: "Intake incomplete — no estimate yet", due: "now", kind: "intake", when: e.state === "intake_in_progress" },
        { label: "High ICU estimate — flag on handoff", due: "this shift", kind: "escalate", when: (e.risks.icu ?? 0) > 0.5 },
      ];
      suggested.filter((s) => s.when && !own.some((t) => t.label === s.label))
        .forEach((s) => list.push({ key: `${e.id}:${s.label}`, label: s.label, due: s.due, kind: s.kind, done: false }));
      out[e.id] = list;
    });
    return out;
  }, [mine, stored]);

  const allTasks = Object.values(tasks).flat();
  const openTasks = allTasks.filter((t) => !t.done);

  async function toggle(encounterId: string, task: Task) {
    setBusy(task.key);
    const message = await act(async () => {
      let id = task.serverId;
      if (!id) {
        const created = await api.post<ServerTask>("/api/v1/tasks", { label: task.label, encounter_id: encounterId });
        id = created.id;
      }
      const updated = await api.post<ServerTask>(`/api/v1/tasks/${id}/done?done=${!task.done}`);
      setStored((s) => [...s.filter((t) => t.id !== updated.id), updated]);
      return updated;
    }, (t) => `${t.label} — ${t.done ? "marked done" : "reopened"}`);
    setBusy(null);
    setToast(message);
  }

  async function addTask(encounterId: string) {
    const label = (adding[encounterId] ?? "").trim();
    if (!label) return;
    const message = await act(async () => {
      const created = await api.post<ServerTask>("/api/v1/tasks", { label, encounter_id: encounterId });
      setStored((s) => [...s, created]);
      setAdding((a) => ({ ...a, [encounterId]: "" }));
      return created;
    }, (t) => `Task added — ${t.label}`);
    setToast(message);
  }

  return (
    <>
      <PageHeader
        eyebrow="Bedside nurse"
        title="My patients"
        lede="The patients assigned to you this shift, with what each one still needs. Risk summaries are shown so you know who to watch — the full reasoning and the sign-off belong to the attending."
        actions={canWrite && <Button variant="primary" icon={<ClipboardIcon size={15} />} onClick={() => nav("/nurse/encounters/new")}>Admit a patient</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Assigned to you" value={mine.length} icon={<BedIcon size={15} />} />
        <StatTile label="Open tasks" value={openTasks.length} tone={openTasks.length > 5 ? "warning" : "neutral"} icon={<ClipboardIcon size={15} />} />
        <StatTile label="Needs watching" value={mine.filter((e) => (e.risks.icu ?? 0) > 0.4).length} tone="warning" hint="ICU estimate above 40%" />
        <StatTile label="Intake incomplete" value={mine.filter((e) => e.state === "intake_in_progress").length} hint="No estimate can run until these are finished" />
      </div>

      <Banner tone="accent" title="What you can do here">
        {canWrite
          ? "You can record vitals and labs, complete an intake, and escalate. You cannot acknowledge a result — that is the attending’s signature and the audit trail depends on it being theirs."
          : "You can add and complete tasks, and escalate. Recording vitals, completing an intake and acknowledging a result belong to the bedside nurse and the attending."}
      </Banner>

      <div className="patient-cards">
        {mine.map((e) => {
          const t = tasks[e.id] ?? [];
          return (
            <Card
              key={e.id}
              className="patient-card"
              title={
                <span className="row" style={{ gap: 8, alignItems: "baseline" }}>
                  {e.patient.name}
                  <span className="mono muted" style={{ fontSize: 11.5 }}>{e.bed}</span>
                </span>
              }
              subtitle={`${e.patient.age}${e.patient.sex} · ${e.unitName} · admitted ${ago(e.admittedAt)}`}
              actions={
                canWrite && (
                  <Button size="sm" onClick={() => nav(`/nurse/encounters/${e.id}/vitals`)} icon={<ActivityIcon size={13} />}>
                    Vitals
                  </Button>
                )
              }
            >
              <p className="bed-complaint" style={{ margin: 0 }}>{e.chiefComplaint}</p>

              {e.risks.mortality === null ? (
                <div className="inline-warn">
                  <AlertIcon size={13} />
                  No estimate yet — the intake is still incomplete.{" "}
                  {canWrite
                    ? <button type="button" className="link-btn" onClick={() => nav(`/nurse/encounters/${e.id}/intake`)}>Finish it</button>
                    : "Flag it to whoever admitted them, or on handoff."}
                </div>
              ) : (
                <div className="nurse-metrics">
                  {[
                    { label: "ICU", v: e.risks.icu },
                    { label: "Mortality", v: e.risks.mortality },
                    { label: "Readmission", v: e.risks.readmission },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="bed-metric-label">{m.label}</span>
                        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 650 }}>{pct(m.v, 0)}</span>
                      </div>
                      <Meter value={m.v ?? 0} color={seqToken(m.v)} height={4} label={m.label} />
                    </div>
                  ))}
                </div>
              )}

              {t.length > 0 && (
                <ul className="task-list">
                  {t.map((task) => (
                    <li key={task.key} className={cx(task.done && "is-done")}>
                      <button
                        type="button"
                        className="task-check"
                        aria-label={task.done ? "Mark not done" : "Mark done"}
                        disabled={busy === task.key}
                        onClick={() => void toggle(e.id, task)}
                      >
                        {task.done ? <CheckIcon size={12} /> : null}
                      </button>
                      <span className="task-icon">
                        {task.kind === "vitals" ? <ActivityIcon size={13} />
                          : task.kind === "labs" ? <FlaskIcon size={13} />
                          : task.kind === "escalate" ? <AlertIcon size={13} />
                          : <ClipboardIcon size={13} />}
                      </span>
                      <span className="task-label">{task.label}</span>
                      <span className="task-due" title={task.doneBy ? `Done by ${task.doneBy}` : undefined}>{task.done && task.doneBy ? task.doneBy : task.due}</span>
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="row"
                style={{ gap: 6 }}
                onSubmit={(ev) => { ev.preventDefault(); void addTask(e.id); }}
              >
                <input
                  className="input"
                  style={{ flex: 1, height: 30, fontSize: 12.5 }}
                  value={adding[e.id] ?? ""}
                  onChange={(ev) => setAdding((a) => ({ ...a, [e.id]: ev.target.value }))}
                  placeholder="Add a task for this patient"
                  aria-label={`Add a task for ${e.patient.name}`}
                  maxLength={200}
                />
                <Button size="sm" type="submit" icon={<PlusIcon size={13} />} disabled={!(adding[e.id] ?? "").trim()}>Add</Button>
              </form>

              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <CalibratedBadge calibrated={e.calibrated} validity={e.calibrationValidity} estimated={e.risks.mortality !== null} />
                <div className="row" style={{ gap: 8 }}>
                  <Button size="sm" variant="ghost" onClick={() => void act(() => api.post(`/api/v1/encounters/${e.id}/escalate`, { to: "Attending on call", reason: "Escalated from the bedside patient list", urgency: "urgent" }), () => `Escalated ${e.patient.name} to the attending on call`).then(setToast)}>Escalate</Button>
                  <Button size="sm" onClick={() => nav(`/nurse/encounters/${e.id}/results`)}>Open</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AssistiveLine />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
