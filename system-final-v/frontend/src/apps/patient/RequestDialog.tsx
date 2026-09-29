/**
 * The patient's "ask someone to do something" dialog.
 *
 * Messaging a care-team member, asking about a result, requesting a record or a
 * correction: each is a written request in the patient's own words, sent to
 * `POST /api/v1/requests` so it is stored and on the audit trail. One dialog so
 * every one of those buttons behaves the same way — and none of them claims to
 * have sent something it did not.
 */
import { useState } from "react";
import { t } from "@/i18n";
import { Button, Field, TextArea } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlays";
import { act } from "@/api/actions";
import { api } from "@/api/client";

export type PatientRequestKind =
  | "care_team_message" | "liaison_contact" | "result_question" | "result_explain_request"
  | "result_urgent_flag" | "record_request" | "record_correction" | "account_closure";

export type RequestSpec = {
  kind: PatientRequestKind;
  title: string;
  label: string;
  hint?: string;
  /** What it is about — a care-team member, a result, a record. */
  ref?: string;
  /** Pre-filled text the patient can edit, for requests that need no typing. */
  initial?: string;
  /** The toast on success, already translated. */
  done: string;
};

export function RequestDialog({
  spec, onClose, onResult,
}: { spec: RequestSpec | null; onClose: () => void; onResult: (message: string) => void }) {
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [lastKind, setLastKind] = useState<string | null>(null);

  // A new request starts from its own text, not the previous dialog's.
  const key = spec ? `${spec.kind}:${spec.ref ?? ""}` : null;
  if (key !== lastKind) {
    setLastKind(key);
    setDetail(spec?.initial ?? "");
  }

  async function send() {
    if (!spec) return;
    setSending(true);
    const message = await act(
      () => api.post("/api/v1/requests", { kind: spec.kind, detail: detail.trim(), ref: spec.ref ?? null }),
      () => spec.done,
    );
    setSending(false);
    onClose();
    onResult(message);
  }

  return (
    <Modal
      open={spec !== null}
      onClose={onClose}
      title={spec?.title ?? ""}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" disabled={!detail.trim() || sending} onClick={() => void send()}>
            {sending ? t("Sending…") : t("Send")}
          </Button>
        </>
      }
    >
      {spec && (
        <Field label={spec.label} hint={spec.hint} required>
          <TextArea rows={4} style={{ fontSize: 16 }} value={detail} onChange={(e) => setDetail(e.currentTarget.value)} />
        </Field>
      )}
    </Modal>
  );
}
