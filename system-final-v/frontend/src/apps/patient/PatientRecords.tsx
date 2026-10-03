/**
 * Screen P6 — My Records (§13.3).
 *
 * The HIPAA Right-of-Access / Cures-Act surface. The legal obligation is that
 * the patient can get their record; the product obligation is that getting it
 * is a button rather than a request form, and that records pulled in from
 * other hospitals are clearly labelled as such.
 */
import { useMemo, useState } from "react";
import { RECORDS } from "@/mock/db";
import type { RecordDocument } from "@/mock/types";
import { dateLabel } from "@/lib/format";
import { t, tr } from "@/i18n";
import { Badge, Banner, Button, Card, PageHeader, SegmentedControl } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import {
  BookIcon, BuildingIcon, DownloadIcon, FileIcon, FlaskIcon, GlobeIcon, PillIcon, ShieldIcon,
} from "@/components/ui/icons";
import { act } from "@/api/actions";
import { api } from "@/api/client";
import { RequestDialog, type RequestSpec } from "./RequestDialog";
import type { ExportMeta, RecordExport } from "@/lib/recordPdf";

/** Save JSON through the browser. The export itself was recorded server-side first. */
function saveJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const KIND_META: Record<RecordDocument["kind"], { label: string; icon: JSX.Element }> = {
  visit_summary: { label: "Visit summary", icon: <FileIcon size={18} /> },
  lab: { label: "Test result", icon: <FlaskIcon size={18} /> },
  imaging: { label: "Scan or x-ray", icon: <BookIcon size={18} /> },
  medication: { label: "Medicines", icon: <PillIcon size={18} /> },
  discharge: { label: "Going-home letter", icon: <FileIcon size={18} /> },
};

const SOURCE_META: Record<RecordDocument["source"], { label: string; tone: "neutral" | "accent" }> = {
  local: { label: "From this hospital", tone: "neutral" },
  esap_fast: { label: "Sent from another hospital", tone: "accent" },
  tefca: { label: "Sent from another hospital", tone: "accent" },
};

export function PatientRecords() {
  const [filter, setFilter] = useState<"all" | "here" | "elsewhere">("all");
  const [toast, setToast] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestSpec | null>(null);

  /** The whole record — a right-of-access export, recorded first, then saved as a readable PDF. */
  async function downloadAll() {
    const message = await act(
      async () => {
        // The PDF library is loaded only when someone actually asks for a PDF.
        const [res, pdf] = await Promise.all([
          api.post<{ export: ExportMeta; data: RecordExport }>("/api/v1/exports", { kind: "patient_record", reason: "Patient right of access request" }),
          import("@/lib/recordPdf"),
        ]);
        return { res, pdf };
      },
      ({ res, pdf }) => {
        pdf.buildRecordPdf(res.data, res.export).save(pdf.recordFileName(res.data, res.export));
        return t("Your whole record has been downloaded");
      },
    );
    setToast(message);
  }

  /** The same export as a structured file another hospital's system can read. */
  async function downloadStructured() {
    const message = await act(
      () => api.post<{ data: unknown }>("/api/v1/exports", { kind: "patient_record", reason: "Patient right of access request (structured file)" }),
      (res) => {
        saveJson("my-health-record.json", res.data);
        return t("Your whole record has been downloaded");
      },
    );
    setToast(message);
  }

  /** One record, exported through the audited export endpoint, then saved. */
  async function downloadRecord(r: RecordDocument) {
    const message = await act(
      () => api.post<{ data: { records: RecordDocument[] } }>("/api/v1/exports", {
        kind: "patient_record", reason: `Patient downloaded their own record: ${r.title}`, scope: { record_id: r.id },
      }),
      (res) => {
        const record = res.data.records.find((x) => x.id === r.id) ?? r;
        saveJson(`${r.id}.json`, record);
        return t("{title} downloaded", { title: t(r.title) });
      },
    );
    setToast(message);
  }

  const rows = useMemo(
    () =>
      RECORDS.filter((r) =>
        filter === "all" ? true : filter === "here" ? r.source === "local" : r.source !== "local",
      ).sort((a, b) => b.date.localeCompare(a.date)),
    [filter],
  );

  const elsewhere = RECORDS.filter((r) => r.source !== "local").length;

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("My records")}
        title={t("Everything on your record")}
        lede={t("Your visit summaries, test results and letters. This is your record — you can download all of it, at any time, without asking anyone.")}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button icon={<GlobeIcon size={16} />} onClick={() => void downloadStructured()}>{t("Structured file")}</Button>
            <Button variant="primary" icon={<DownloadIcon size={16} />} onClick={() => void downloadAll()}>{t("Download everything (PDF)")}</Button>
          </div>
        }
      />

      <Banner tone="accent" icon={<ShieldIcon size={18} />} title={t("You have a legal right to all of this")}>
        {t("You do not need to give a reason, and nobody can charge you for an electronic copy. If a download does not work or something seems to be missing, tell the hospital’s privacy officer — that is exactly what they are there for.")}
      </Banner>

      <SegmentedControl
        ariaLabel={t("Filter records")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("All ({n})", { n: RECORDS.length }) },
          { value: "here", label: t("From this hospital ({n})", { n: RECORDS.length - elsewhere }) },
          { value: "elsewhere", label: t("From elsewhere ({n})", { n: elsewhere }) },
        ]}
      />

      <div className="stack" style={{ gap: 12 }}>
        {rows.map((r) => (
          <Card
            key={r.id}
            title={
              <span className="row" style={{ gap: 10 }}>
                <span className="big-choice-icon" style={{ width: 36, height: 36 }}>{KIND_META[r.kind].icon}</span>
                {t(r.title)}
              </span>
            }
            subtitle={`${t(KIND_META[r.kind].label)} · ${t(r.facility)} · ${dateLabel(r.date)}`}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <Badge tone={SOURCE_META[r.source].tone} icon={r.source === "local" ? <BuildingIcon size={11} /> : <GlobeIcon size={11} />}>
                  {t(SOURCE_META[r.source].label)}
                </Badge>
                <Button size="sm" icon={<DownloadIcon size={13} />} onClick={() => void downloadRecord(r)}>{t("Download")}</Button>
              </div>
            }
          >
            {r.source !== "local" && (
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
                {t("This came from {facility} because you or your care team asked for it to be sent here. You can see when, and who asked, under Share & consent.", { facility: t(r.facility) })}
              </p>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-2">
        <Card title={t("Something missing?")}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75 }}>
            {t("If you have been treated somewhere else and that record is not here, you can ask for it to be sent. It usually takes a few days, and you will be told when it arrives.")}
          </p>
          <Button onClick={() => setRequest({
            kind: "record_request",
            title: t("Request a record from another hospital"),
            label: t("Which hospital, and roughly when were you seen there?"),
            done: t("Request sent — you will be told when the record arrives"),
          })}>{t("Request a record from another hospital")}</Button>
        </Card>

        <Card title={t("Something wrong?")}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75 }}>
            {t("If something on your record is factually wrong — a condition you do not have, a medicine you stopped years ago — you can ask for it to be corrected. A wrong record is not a paperwork problem: everything your care team does is built on it.")}
          </p>
          <Button onClick={() => setRequest({
            kind: "record_correction",
            title: t("Ask for a correction"),
            label: t("What is wrong, and what should it say?"),
            done: t("Correction request sent to your care team"),
          })}>{t("Ask for a correction")}</Button>
        </Card>
      </div>

      <Card title={t("What a download contains")} subtitle={t("Two formats, both yours")}>
        <ul className="qa-list">
          <li>
            <FileIcon size={16} />
            <span>{tr("**A readable PDF** — what you would print, or take to a new doctor.")}</span>
          </li>
          <li>
            <GlobeIcon size={16} />
            <span>{tr("**A structured file** — a standard format another hospital’s computer system can read directly, so nothing has to be typed in again.")}</span>
          </li>
        </ul>
      </Card>

      <RequestDialog spec={request} onClose={() => setRequest(null)} onResult={setToast} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
