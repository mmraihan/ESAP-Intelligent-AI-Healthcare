/**
 * Patient <-> hospital connection (§13.2).
 *
 * A self-registered patient asks a hospital to take them on; a clinician there
 * accepts, which creates an encounter under them and links the patient's portal
 * account to it. After that, releases reach the patient and the patient's
 * submissions reach the clinician's "From the patient" panel.
 */
import { useEffect, useState } from "react";
import {
  acceptConnectionRequest, isLive, listConnectionRequests, listHospitals, myConnectRequests,
  requestConnect, type ConnectionRequest, type Hospital,
} from "@/api/actions";
import { Badge, Button, Card, Field, Select, TextInput } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { useSession } from "@/lib/session";
import { can } from "@/lib/rbac";

/** Patient side: request to connect with a hospital, and see request status. */
export function PatientConnectCard() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("F");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!isLive()) return;
    try {
      const [h, r] = await Promise.all([listHospitals(), myConnectRequests()]);
      setHospitals(h.hospitals);
      setRequests(r.requests);
      if (!hospitalId && h.hospitals[0]) setHospitalId(h.hospitals[0].id);
    } catch { /* offline: leave empty */ }
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    if (!hospitalId || !age) return;
    setBusy(true);
    const msg = await requestConnect(hospitalId, Number(age), sex, reason.trim());
    setToast(msg);
    setReason("");
    await load();
    setBusy(false);
  }

  return (
    <Card
      title="Connect with a hospital"
      subtitle="Ask a hospital to take you on. A clinician there accepts, and then you can share information both ways."
    >
      {requests.length > 0 && (
        <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
          {requests.map((r) => {
            const h = hospitals.find((x) => x.id === r.tenantId);
            return (
              <div key={r.id} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <span>{h ? h.name : r.tenantId}</span>
                <Badge tone={r.status === "accepted" ? "good" : r.status === "open" ? "neutral" : "warning"}>
                  {r.status === "open" ? "pending" : r.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      <Field label="Hospital">
        <Select value={hospitalId} onChange={(e) => setHospitalId(e.currentTarget.value)}>
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </Field>
      <div className="row" style={{ gap: 10 }}>
        <Field label="Your age">
          <TextInput inputMode="numeric" value={age} onChange={(e) => setAge(e.currentTarget.value)} placeholder="e.g. 62" />
        </Field>
        <Field label="Sex">
          <Select value={sex} onChange={(e) => setSex(e.currentTarget.value)}>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </Select>
        </Field>
      </div>
      <Field label="Reason (optional)">
        <TextInput value={reason} onChange={(e) => setReason(e.currentTarget.value)} placeholder="What brings you in?" />
      </Field>
      <Button variant="primary" disabled={busy || !hospitalId || !age} onClick={() => void submit()}>
        {busy ? "Sending…" : "Request to connect"}
      </Button>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}

/** Clinician side: accept pending patient connection requests. */
export function ConnectionRequestsCard() {
  const role = useSession((s) => s.role);
  // Accepting admits the patient, so the server gates both the list and the
  // accept on patient:write. Roles without it (e.g. case manager) share the
  // worklist screen; don't ask for a list the server will refuse.
  const allowed = can(role, "patient:write");
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!allowed || !isLive()) return;
    try { setRequests((await listConnectionRequests()).requests); } catch { /* ignore */ }
  }
  useEffect(() => { void load(); }, [allowed]);

  async function accept(id: string) {
    setBusy(id);
    setToast(await acceptConnectionRequest(id));
    await load();
    setBusy(null);
  }

  if (requests.length === 0) return null;

  return (
    <Card
      title={<span className="row" style={{ gap: 8 }}>Patient connection requests <Badge tone="accent">{requests.length}</Badge></span>}
      subtitle="Self-registered patients asking to be taken on here. Accepting admits them under you and links their portal account."
    >
      <div className="stack" style={{ gap: 8 }}>
        {requests.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>{r.patientName}</strong>{" "}
              <span className="muted">{r.age} {r.sex} · {r.patientEmail}</span>
              {r.reason && <div className="muted" style={{ fontSize: 12.5 }}>{r.reason}</div>}
            </div>
            <Button size="sm" variant="primary" disabled={busy === r.id} onClick={() => void accept(r.id)}>
              {busy === r.id ? "Accepting…" : "Accept & admit"}
            </Button>
          </div>
        ))}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}
