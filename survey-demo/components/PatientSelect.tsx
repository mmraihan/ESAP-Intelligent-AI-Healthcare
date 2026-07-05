"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

interface PatientSummary {
  patient_id: string;
  external_id: string;
  full_name: string;
  date_of_birth: string;
  biological_sex: string;
}

interface Props {
  onSelect: (patientId: string) => void;
  onBack: () => void;
}

export default function PatientSelect({ onSelect, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      const data = await apiFetch<PatientSummary[]>(`/api/patients?${params.toString()}`);
      setResults(data);
      setSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="mb-4">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-2">← Back</button>
        <h2 className="text-lg font-bold text-slate-800">Select Patient</h2>
        <p className="text-xs text-slate-400 mt-0.5">Search for the registered patient this check-in is for.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {searched && results.length === 0 && !error && (
        <p className="text-sm text-slate-400 text-center py-6">No patients found. Register the patient first.</p>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {results.map((p) => (
          <button
            key={p.patient_id}
            onClick={() => onSelect(p.patient_id)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-slate-100 hover:border-blue-300 hover:bg-blue-50 text-left transition-all"
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">{p.full_name}</p>
              <p className="text-xs text-slate-400">{p.external_id} · {p.date_of_birth} · {p.biological_sex}</p>
            </div>
            <span className="text-blue-500 text-sm font-medium">Select →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
