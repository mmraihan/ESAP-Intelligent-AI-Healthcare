"use client";

import { useRef, useState } from "react";
import { RegField, RegAnswers } from "@/data/registration-fields";

interface Props {
  field: RegField;
  value: RegAnswers[string];
  onChange: (id: string, value: RegAnswers[string]) => void;
  allAnswers: RegAnswers;
}

const INPUT_BASE =
  "w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300 transition-colors bg-white";

export default function FieldRenderer({ field, value, onChange, allAnswers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);

  // ── conditional visibility ──────────────────────────────────────
  if (field.conditional) {
    const dep = allAnswers[field.conditional.fieldId];
    if (dep !== field.conditional.value) return null;
  }

  const { id, type, label, required, placeholder, options, min, max, unit, autoCalc } = field;

  // ── auto-calculated (BMI) ───────────────────────────────────────
  if (autoCalc) {
    const h = Number(allAnswers["height_cm"] || 0);
    const w = Number(allAnswers["weight_kg"] || 0);
    const bmi = h > 0 && w > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : "—";
    const cat = bmi === "—" ? "" : Number(bmi) < 18.5 ? "Underweight" : Number(bmi) < 25 ? "Normal" : Number(bmi) < 30 ? "Overweight" : "Obese";
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border-2 border-blue-200">
        <div>
          <p className="text-xs text-blue-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-blue-700">{bmi} <span className="text-sm font-normal text-blue-500">kg/m²</span></p>
          {cat && <p className="text-xs text-blue-400 mt-0.5">{cat}</p>}
        </div>
        <span className="ml-auto text-xs text-blue-400 bg-blue-100 px-2 py-1 rounded-full">Auto-calculated</span>
      </div>
    );
  }

  // ── text / number / date / email / tel ──────────────────────────
  if (["text", "number", "date", "email", "tel"].includes(type)) {
    return (
      <div className="relative">
        <input
          type={type === "number" ? "number" : type === "date" ? "date" : type === "email" ? "email" : type === "tel" ? "tel" : "text"}
          value={(value as string) ?? ""}
          min={min}
          max={max}
          onChange={(e) => onChange(id, e.target.value)}
          placeholder={placeholder}
          className={INPUT_BASE}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded">
            {unit}
          </span>
        )}
      </div>
    );
  }

  // ── textarea ────────────────────────────────────────────────────
  if (type === "textarea") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        rows={4}
        className={`${INPUT_BASE} resize-none`}
      />
    );
  }

  // ── dropdown ────────────────────────────────────────────────────
  if (type === "dropdown") {
    return (
      <select
        value={(value as string) ?? ""}
        onChange={(e) => onChange(id, e.target.value)}
        className={`${INPUT_BASE} cursor-pointer`}
      >
        <option value="">— Select —</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  // ── multiselect ─────────────────────────────────────────────────
  if (type === "multiselect") {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (v: string) => {
      const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v];
      onChange(id, next);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {options?.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                checked
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {checked && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  // ── boolean (yes/no) ────────────────────────────────────────────
  if (type === "boolean") {
    return (
      <div className="flex gap-3">
        {options?.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(id, o.value)}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                active
                  ? o.value === "yes"
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-slate-400 bg-slate-100 text-slate-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  // ── scale (0–10 or 1–10) ────────────────────────────────────────
  if (type === "scale") {
    const lo = min ?? 0;
    const hi = max ?? 10;
    const cur = value !== undefined && value !== null ? (value as number) : lo;
    const steps = Array.from({ length: hi - lo + 1 }, (_, i) => i + lo);
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {steps.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(id, n)}
              className={`w-9 h-9 rounded-lg border-2 text-sm font-bold transition-all ${
                cur === n
                  ? n <= 3 ? "border-emerald-500 bg-emerald-500 text-white"
                  : n <= 6 ? "border-amber-500 bg-amber-500 text-white"
                  : "border-red-500 bg-red-500 text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-blue-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {value !== undefined && value !== null && (
          <p className="text-xs text-slate-500">
            Selected: <span className="font-bold text-slate-700">{cur}</span>
            {id === "pain_scale" && (
              <span className="ml-1 text-slate-400">
                — {cur === 0 ? "No pain" : cur <= 3 ? "Mild" : cur <= 6 ? "Moderate" : cur <= 8 ? "Severe" : "Worst imaginable"}
              </span>
            )}
            {id === "stress_level" && (
              <span className="ml-1 text-slate-400">
                — {cur <= 3 ? "Low stress" : cur <= 6 ? "Moderate stress" : "High stress"}
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  // ── slider ──────────────────────────────────────────────────────
  if (type === "slider") {
    const lo = min ?? 0;
    const hi = max ?? 10;
    const cur = value !== undefined ? (value as number) : lo;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{lo}</span>
          <span className="font-bold text-slate-700 text-sm">{cur}{unit ? ` ${unit}` : ""}</span>
          <span>{hi}</span>
        </div>
        <input
          type="range" min={lo} max={hi} value={cur}
          onChange={(e) => onChange(id, Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    );
  }

  // ── file upload (simulated) ─────────────────────────────────────
  if (type === "file") {
    return (
      <div>
        <label className="flex flex-col items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Click to upload or drag & drop</p>
            <p className="text-xs text-slate-400">PDF, JPG, PNG, DICOM — max 20MB</p>
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.dcm"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setFileNames(files.map((f) => f.name));
              onChange(id, files.map((f) => f.name) as unknown as RegAnswers[string]);
            }}
          />
        </label>
        {fileNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {fileNames.map((name, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                📄 {name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── signature pad ───────────────────────────────────────────────
  if (type === "signature") {
    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setDrawing(true);
      const ctx = canvas.getContext("2d")!;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDraw = () => {
      if (!drawing) return;
      setDrawing(false);
      setHasSig(true);
      onChange(id, canvasRef.current?.toDataURL() ?? "signed");
    };

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
      setHasSig(false);
      onChange(id, null);
    };

    return (
      <div className="space-y-2">
        <div className="relative border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={140}
            className="w-full touch-none cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          {!hasSig && (
            <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none select-none">
              Sign here with your mouse or finger
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Your digital signature constitutes a legally binding consent.</p>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2"
          >
            Clear
          </button>
        </div>
        {hasSig && (
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Signature captured
          </p>
        )}
      </div>
    );
  }

  return null;
}
