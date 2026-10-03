/**
 * The readable half of a right-of-access export (§13.3): the whole record as a
 * printable A4 PDF, laid out like a clinical letter — letterhead, a patient
 * identification block, numbered sections, and a footer on every page that
 * says whose record this is.
 *
 * It renders exactly what the audited export returned, nothing more. Patients
 * never see a raw score (§13.6), and the export never carries one, so there is
 * nothing here to withhold.
 *
 * The PDF is always English: the standard PDF fonts cannot shape Arabic, and a
 * record taken to a new doctor is read in the language the record was written in.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CareTeamMember, ConsentGrant, RecordDocument, ReleasedResult } from "@/mock/types";

export type RecordExport = {
  patient?: { name?: string; email?: string; mrn?: string | null; age?: number | null; sex?: string | null };
  encounters?: {
    id: string; admittedAt?: string; admissionType?: string; unitName?: string; bed?: string;
    chiefComplaint?: string; attending?: string; nurse?: string; state?: string;
  }[];
  careTeam?: CareTeamMember[];
  records?: RecordDocument[];
  results?: ReleasedResult[];
  consents?: ConsentGrant[];
};

export type ExportMeta = { id: string; requestedAt: string; reason?: string | null };

type RGB = [number, number, number];
const ACCENT: RGB = [11, 107, 176];
const VITAL: RGB = [13, 148, 136];
const INK: RGB = [22, 32, 45];
const MUTED: RGB = [96, 108, 124];
const RULE: RGB = [214, 222, 232];
const PANEL: RGB = [244, 247, 251];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // side margin, mm
const CONTENT_W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - 22; // keep clear of the footer

const KIND_LABEL: Record<RecordDocument["kind"], string> = {
  visit_summary: "Visit summary", lab: "Test result", imaging: "Scan or x-ray",
  medication: "Medicines", discharge: "Going-home letter",
};
const SOURCE_LABEL: Record<RecordDocument["source"], string> = {
  local: "This hospital", esap_fast: "Another hospital", tefca: "Another hospital",
};
const SEX_LABEL: Record<string, string> = { F: "Female", M: "Male" };

/** Standard PDF fonts are WinAnsi; map typographic characters rather than print boxes. */
function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s*—\s*/g, " - ").replace(/–/g, "-").replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "18 Sep 2026" / "18 Sep 2026, 09:15" — fixed English, whatever the browser locale. */
function date(iso?: string | null, withTime = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return clean(iso);
  const day = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

function title(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function buildRecordPdf(data: RecordExport, meta: ExportMeta): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const patient = data.patient ?? {};
  const name = clean(patient.name || "Patient");
  const mrn = clean(patient.mrn || "Not assigned");
  let y = 0;

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold" | "italic" | "bolditalic", size: number, family = "helvetica") => {
    doc.setFont(family, style);
    doc.setFontSize(size);
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = continuationHeader();
    }
  };

  // ── Letterhead ────────────────────────────────────────────────────────────
  function logo(x: number, top: number, size: number) {
    doc.setFillColor(...ACCENT);
    doc.roundedRect(x, top, size, size, 2, 2, "F");
    doc.setFillColor(...VITAL);
    doc.roundedRect(x + size * 0.5, top, size * 0.5, size, 2, 2, "F");
    doc.rect(x + size * 0.5, top, size * 0.2, size, "F");
    // White medical cross
    doc.setFillColor(255, 255, 255);
    const c = size / 2, arm = size * 0.14, len = size * 0.34;
    doc.rect(x + c - arm, top + c - len, arm * 2, len * 2, "F");
    doc.rect(x + c - len, top + c - arm, len * 2, arm * 2, "F");
  }

  function letterhead(): number {
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, PAGE_W, 3, "F");
    logo(M, 10, 13);
    font("bold", 16); color(INK);
    doc.text("ESAP", M + 17, 16);
    font("bold", 7.5); color(VITAL);
    doc.text("CLINICAL AI", M + 17, 20.5, { charSpace: 0.6 });
    font("normal", 7.5); color(MUTED);
    doc.text("Patient health record - right of access copy", M + 17, 24.5);

    font("bold", 15); color(INK);
    doc.text("Patient Health Record", PAGE_W - M, 15.5, { align: "right" });
    font("normal", 8); color(MUTED);
    doc.text(`Document no. ${clean(meta.id).toUpperCase()}`, PAGE_W - M, 21, { align: "right" });
    doc.text(`Issued ${date(meta.requestedAt, true)}`, PAGE_W - M, 25, { align: "right" });

    doc.setDrawColor(...VITAL);
    doc.setLineWidth(0.6);
    doc.line(M, 30, PAGE_W - M, 30);
    return 36;
  }

  function continuationHeader(): number {
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, PAGE_W, 3, "F");
    logo(M, 8, 8);
    font("bold", 9); color(INK);
    doc.text("ESAP Clinical AI - Patient Health Record", M + 11, 13.5);
    font("normal", 8); color(MUTED);
    doc.text(`${name}  |  MRN ${mrn}`, PAGE_W - M, 13.5, { align: "right" });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, 18, PAGE_W - M, 18);
    return 25;
  }

  y = letterhead();

  // ── Patient identification block (the "prescription" header) ─────────────
  const boxH = 40;
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CONTENT_W, boxH, 2, 2, "FD");
  doc.setFillColor(...ACCENT);
  doc.rect(M, y, 1.4, boxH, "F");

  font("bolditalic", 26, "times"); color(ACCENT);
  doc.text("Rx", M + 6, y + 14);

  const field = (label: string, value: string, x: number, top: number, w: number) => {
    font("bold", 6.8); color(MUTED);
    doc.text(label.toUpperCase(), x, top, { charSpace: 0.3 });
    font("normal", 10); color(INK);
    doc.text(doc.splitTextToSize(value, w)[0] ?? "", x, top + 4.6);
  };
  const ageSex = [patient.age != null ? `${patient.age} years` : null,
    patient.sex ? SEX_LABEL[patient.sex] ?? clean(patient.sex) : null].filter(Boolean).join("  /  ") || "-";
  const col1 = M + 24, col2 = M + 24 + 58, col3 = M + 24 + 58 + 50;
  font("bold", 14); color(INK);
  doc.text(name, col1, y + 9);
  field("Medical record no.", mrn, col1, y + 18, 54);
  field("Age / sex", ageSex, col2, y + 18, 46);
  field("Contact", clean(patient.email || "-"), col3, y + 18, PAGE_W - M - col3 - 4);
  field("Records on file", String((data.records ?? []).length), col1, y + 30, 54);
  field("Hospital stays", String((data.encounters ?? []).length), col2, y + 30, 46);
  field("Released results", String((data.results ?? []).length), col3, y + 30, 40);
  y += boxH + 8;

  // ── Section helpers ───────────────────────────────────────────────────────
  let section = 0;
  function heading(text: string, sub?: string) {
    ensure(22);
    section += 1;
    doc.setFillColor(...ACCENT);
    doc.circle(M + 3, y - 1.3, 3, "F");
    font("bold", 8.5); doc.setTextColor(255, 255, 255);
    doc.text(String(section), M + 3, y + 0.2, { align: "center" });
    font("bold", 12); color(INK);
    doc.text(text, M + 9, y);
    if (sub) {
      font("normal", 8); color(MUTED);
      doc.text(sub, PAGE_W - M, y, { align: "right" });
    }
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, y + 3, PAGE_W - M, y + 3);
    y += 8;
  }

  function empty(text: string) {
    font("italic", 9.5); color(MUTED);
    doc.text(text, M + 2, y + 1);
    y += 9;
  }

  function paragraph(text: string, size = 9.5, indent = 0, c: RGB = INK) {
    font("normal", size); color(c);
    const lines = doc.splitTextToSize(clean(text), CONTENT_W - indent);
    const lh = size * 0.45;
    for (const line of lines) {
      ensure(lh + 1);
      doc.text(line, M + indent, y);
      y += lh;
    }
  }

  function bullets(label: string, items: string[]) {
    if (!items.length) return;
    ensure(12);
    font("bold", 8); color(VITAL);
    doc.text(label.toUpperCase(), M + 4, y, { charSpace: 0.3 });
    y += 4.6;
    for (const item of items) {
      font("normal", 9.5); color(INK);
      const lines = doc.splitTextToSize(clean(item), CONTENT_W - 12);
      ensure(lines.length * 4.3 + 1);
      doc.setFillColor(...VITAL);
      doc.circle(M + 6, y - 1.2, 0.7, "F");
      doc.text(lines, M + 9, y);
      y += lines.length * 4.3 + 1;
    }
    y += 2;
  }

  function table(head: string[], body: string[][], widths?: number[]) {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map(clean)),
      margin: { left: M, right: M, top: 25, bottom: PAGE_H - BOTTOM },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.8, cellPadding: 2.2, textColor: INK, lineColor: RULE, lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.2 },
      alternateRowStyles: { fillColor: PANEL },
      columnStyles: Object.fromEntries((widths ?? []).map((w, i) => [i, { cellWidth: w }])),
      didDrawPage: (d) => { if (d.pageNumber > 1) continuationHeader(); },
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 9;
  }

  // ── 1. Hospital stays ─────────────────────────────────────────────────────
  const stays = data.encounters ?? [];
  heading("Hospital stays", stays.length ? `${stays.length} on record` : undefined);
  if (stays.length) {
    table(
      ["Admitted", "Reason for visit", "Ward / bed", "Doctor", "Nurse", "Status"],
      stays.map((e) => [
        date(e.admittedAt, true),
        [e.chiefComplaint, e.admissionType ? `(${title(e.admissionType)})` : ""].filter(Boolean).join(" "),
        [e.unitName, e.bed ? `Bed ${e.bed}` : ""].filter(Boolean).join(", ") || "-",
        e.attending || "-", e.nurse || "-", e.state ? title(e.state) : "-",
      ]),
      [27, 42, 30, 27, 26, 26],
    );
  } else empty("No hospital stays are on your record yet.");

  // ── 2. Results released by the care team ──────────────────────────────────
  const results = data.results ?? [];
  heading("Results explained by your care team", results.length ? `${results.length} released` : undefined);
  if (results.length) {
    for (const r of results) {
      ensure(22);
      doc.setFillColor(...VITAL);
      doc.rect(M, y - 4, 1, 6, "F");
      font("bold", 10.5); color(INK);
      const head = doc.splitTextToSize(clean(r.headline), CONTENT_W - 4);
      doc.text(head, M + 4, y);
      y += head.length * 4.8;
      font("normal", 8); color(MUTED);
      doc.text(`Reviewed and released by ${clean(r.releasedBy)} on ${date(r.releasedAt, true)}`, M + 4, y);
      y += 6;
      paragraph(r.plainLanguage, 9.5, 4);
      y += 3;
      bullets("What this means", r.whatThisMeans ?? []);
      bullets("Questions to ask your care team", r.questionsToAsk ?? []);
      y += 3;
    }
  } else empty("No results have been released to you yet. Your doctor releases each one after reading it.");

  // ── 3. Care team ──────────────────────────────────────────────────────────
  const team = data.careTeam ?? [];
  heading("Your care team");
  if (team.length) {
    table(
      ["Name", "Role", "Where", "Since"],
      team.map((m) => [`${m.name}${m.primary ? "  (primary)" : ""}`, m.role, m.facility || m.unitName || "-", date(m.since)]),
      [50, 60, 44, 24],
    );
  } else empty("No care team is listed yet.");

  // ── 4. Documents ──────────────────────────────────────────────────────────
  const records = [...(data.records ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  heading("Documents on your record", records.length ? `${records.length} documents` : undefined);
  if (records.length) {
    table(
      ["Date", "Document", "Type", "Facility", "Source"],
      records.map((r) => [date(r.date), r.title, KIND_LABEL[r.kind] ?? title(r.kind), r.facility, SOURCE_LABEL[r.source] ?? r.source]),
      [24, 56, 30, 42, 26],
    );
  } else empty("No documents are on your record yet.");

  // ── 5. Sharing & consent ──────────────────────────────────────────────────
  const consents = data.consents ?? [];
  heading("Who you have shared your record with");
  if (consents.length) {
    table(
      ["Shared with", "Purpose", "What they can see", "Granted", "Ends", "Status"],
      consents.map((c) => [
        `${c.grantee} (${c.granteeType})`, c.purpose, c.scope.join(", "),
        date(c.grantedAt), c.expiresAt ? date(c.expiresAt) : "No end date", title(c.status),
      ]),
      [38, 28, 46, 22, 22, 22],
    );
  } else empty("You have not shared your record with anyone.");

  // ── Certification block ───────────────────────────────────────────────────
  ensure(40);
  y += 2;
  doc.setDrawColor(...RULE);
  doc.setFillColor(...PANEL);
  doc.roundedRect(M, y, CONTENT_W, 30, 2, 2, "FD");
  font("bold", 9); color(INK);
  doc.text("About this document", M + 5, y + 7);
  font("normal", 8.2); color(MUTED);
  doc.text(doc.splitTextToSize(
    "This is a complete copy of your health record, issued to you under your legal right of access. " +
    "It was generated electronically and is valid without a signature. The download was recorded in the " +
    "hospital audit log under the document number shown. Explanations were written by your clinicians; " +
    "computer-assisted estimates are reviewed by a doctor and are never shown as raw scores.",
    CONTENT_W - 62,
  ), M + 5, y + 12);

  // Verification stamp
  const sx = PAGE_W - M - 50;
  doc.setDrawColor(...VITAL);
  doc.setLineWidth(0.5);
  doc.roundedRect(sx, y + 4, 45, 22, 2, 2, "S");
  font("bold", 7.5); color(VITAL);
  doc.text("ELECTRONICALLY ISSUED", sx + 22.5, y + 10, { align: "center" });
  font("normal", 7.5);
  doc.text(date(meta.requestedAt, true), sx + 22.5, y + 15, { align: "center" });
  doc.text(clean(meta.id).toUpperCase(), sx + 22.5, y + 20, { align: "center" });

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14);
    font("bold", 7); color(ACCENT);
    doc.text("CONFIDENTIAL - PERSONAL HEALTH INFORMATION", M, PAGE_H - 9.5);
    font("normal", 7); color(MUTED);
    doc.text(`${name}  |  MRN ${mrn}  |  ESAP Clinical AI`, M, PAGE_H - 6);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 9.5, { align: "right" });
  }
  return doc;
}

/** A safe file name: `health-record_delia-salib_2026-10-03.pdf`. */
export function recordFileName(data: RecordExport, meta: ExportMeta): string {
  const who = (data.patient?.name ?? "patient").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `health-record_${who || "patient"}_${meta.requestedAt.slice(0, 10)}.pdf`;
}
