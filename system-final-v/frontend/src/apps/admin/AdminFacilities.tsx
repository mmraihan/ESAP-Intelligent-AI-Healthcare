/**
 * 11.4.4 — Facilities & Units.
 *
 * The org structure every scope in the permission model points at. A unit here
 * is not decoration: "Unit: 4-West" on a charge nurse's account resolves to a
 * row on this screen, and deleting a unit orphans those grants.
 */
import { useState } from "react";
import { FACILITIES } from "@/mock/db";
import type { Facility, Unit } from "@/mock/types";
import { num, pct } from "@/lib/format";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, TextInput, Meter } from "@/components/ui/primitives";
import { ConfirmDestructive, Modal, Toast } from "@/components/ui/overlays";
import { seqToken } from "@/lib/format";
import { BedIcon, BuildingIcon, EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { actAndRefresh } from "@/api/actions";
import { api } from "@/api/client";

const TYPE_LABEL: Record<Facility["type"], string> = { hospital: "Hospital", clinic: "Clinic", ed: "Emergency department" };

export function AdminFacilities() {
  const [addUnit, setAddUnit] = useState<Facility | null>(null);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [deleting, setDeleting] = useState<{ unit: Unit; facility: Facility } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ name: "", serviceLine: "Medicine", beds: "0" });
  const [facilityForm, setFacilityForm] = useState({ name: "", type: "clinic" as Facility["type"], beds: "0" });

  const totalBeds = FACILITIES.reduce((a, f) => a + f.beds, 0);
  const allUnits = FACILITIES.flatMap((f) => f.units);
  const occupied = allUnits.reduce((a, u) => a + u.occupied, 0);
  const unitBeds = allUnits.reduce((a, u) => a + u.beds, 0);

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Facilities & units"
        lede="Your org structure. Every scope in the permission model resolves to something on this page — a unit here is what 'Unit: 4-West' on a nurse's account actually means."
        actions={<Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => void actAndRefresh(() => api.post<{ name: string }>("/api/v1/admin/facilities", { name: `New facility ${new Date().getFullYear()}`, type: "clinic", beds: 0 }), (f) => `${f.name} created — rename it from Edit`).then(setToast)}>Add facility</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Facilities" value={FACILITIES.length} icon={<BuildingIcon size={15} />} />
        <StatTile label="Units" value={allUnits.length} hint="Each one can carry its own model display policy" />
        <StatTile label="Licensed beds" value={num(totalBeds)} icon={<BedIcon size={15} />} hint="The metered unit on your plan" />
        <StatTile
          label="Current occupancy"
          value={pct(occupied / Math.max(1, unitBeds), 0)}
          hint={`${occupied} of ${unitBeds} tracked beds`}
        />
      </div>

      <Banner tone="accent" title="Changing this structure changes who can see what">
        Removing a unit does not remove the people scoped to it — it leaves those grants pointing at
        nothing, which fails closed. The confirm dialog lists exactly who would be affected.
      </Banner>

      {FACILITIES.map((f) => (
        <Card
          key={f.id}
          title={f.name}
          subtitle={`${TYPE_LABEL[f.type]} · ${f.units.length} units · ${num(f.beds)} licensed beds`}
          actions={
            <>
              <Button size="sm" icon={<EditIcon size={13} />} onClick={() => { setFacilityForm({ name: f.name, type: f.type, beds: String(f.beds) }); setEditing(f); }}>Edit</Button>
              <Button size="sm" variant="primary" icon={<PlusIcon size={13} />} onClick={() => setAddUnit(f)}>Add unit</Button>
            </>
          }
          padded={false}
        >
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Service line</th>
                  <th style={{ textAlign: "right" }}>Beds</th>
                  <th style={{ width: "26%" }}>Occupancy</th>
                  <th className="col-secondary">Model policy</th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {f.units.length === 0 ? (
                  <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: "center" }}>No units configured on this facility yet.</td></tr>
                ) : (
                  f.units.map((u) => {
                    const rate = u.beds === 0 ? 0 : u.occupied / u.beds;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="cell-stack">
                            <strong>{u.name}</strong>
                            <span className="muted mono">{u.id}</span>
                          </div>
                        </td>
                        <td>{u.serviceLine}</td>
                        <td style={{ textAlign: "right" }} className="tnum">{u.beds || "—"}</td>
                        <td>
                          {u.beds === 0 ? (
                            <span className="muted">not a bedded unit</span>
                          ) : (
                            <div className="cell-stack">
                              <span className="tnum" style={{ fontSize: 12.5 }}>{u.occupied} / {u.beds} · {pct(rate, 0)}</span>
                              <Meter value={rate} color={seqToken(rate)} height={4} label={`${u.name} occupancy`} />
                            </div>
                          )}
                        </td>
                        <td className="col-secondary">
                          <Badge tone="neutral">
                            {u.serviceLine === "Critical Care" ? "M-03 suppressed" : "inherits tenant default"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Button size="sm" variant="ghost" icon={<TrashIcon size={13} />} onClick={() => setDeleting({ unit: u, facility: f })}>Remove</Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <Card title="Why some units suppress a model" subtitle="§11.4.7">
        <p className="prose" style={{ margin: 0 }}>
          An ICU-admission estimate on a patient who is already in the ICU is noise, and noise on a
          clinical screen costs attention. Per-unit suppression exists so that a model can be turned off
          where it is not meaningful without turning it off for the whole hospital. Suppression is
          recorded and visible to clinicians — a hidden model is never silently hidden.
        </p>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? ""}`}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!facilityForm.name.trim()}
              onClick={() => {
                const facility = editing;
                const form = facilityForm;
                setEditing(null);
                if (facility) {
                  void actAndRefresh(
                    () => api.patch(`/api/v1/admin/facilities/${facility.id}`, {
                      name: form.name.trim(), type: form.type, beds: Number(form.beds) || 0,
                    }),
                    () => `${form.name.trim()} saved`,
                  ).then(setToast);
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Facility name" required>
            <TextInput value={facilityForm.name} onChange={(e) => setFacilityForm({ ...facilityForm, name: e.currentTarget.value })} />
          </Field>
          <Field label="Type" required>
            <Select value={facilityForm.type} onChange={(e) => setFacilityForm({ ...facilityForm, type: e.currentTarget.value as Facility["type"] })}>
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
              <option value="ed">Emergency department</option>
            </Select>
          </Field>
          <Field label="Licensed beds" hint="The metered unit on your plan.">
            <TextInput type="number" value={facilityForm.beds} onChange={(e) => setFacilityForm({ ...facilityForm, beds: e.currentTarget.value })} className="tnum" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={addUnit !== null}
        onClose={() => setAddUnit(null)}
        title={`Add a unit to ${addUnit?.name ?? ""}`}
        footer={
          <>
            <Button onClick={() => setAddUnit(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              const facility = addUnit;
              const form = unitForm;
              setAddUnit(null);
              setUnitForm({ name: "", serviceLine: "Medicine", beds: "0" });
              if (facility && form.name.trim()) {
                void actAndRefresh(
                  () => api.post(`/api/v1/admin/facilities/${facility.id}/units`, {
                    name: form.name.trim(),
                    service_line: form.serviceLine,
                    beds: Number(form.beds) || 0,
                    occupied: 0,
                  }),
                  () => `${form.name.trim()} created on ${facility.name}`,
                ).then(setToast);
              }
            }}>Create unit</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Unit name" required hint="Use the name staff actually say on the ward — it appears on the roster and in scope chips."><TextInput placeholder="5-East (Respiratory)" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.currentTarget.value })} /></Field>
          <Field label="Service line" required>
            <Select value={unitForm.serviceLine} onChange={(e) => setUnitForm({ ...unitForm, serviceLine: e.currentTarget.value })}>
              {["Medicine", "Critical Care", "Cardiology", "Emergency", "Oncology", "Surgery", "Rehab", "Primary Care"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Bed count" hint="Leave at zero for a non-bedded unit such as an ambulatory clinic."><TextInput type="number" value={unitForm.beds} onChange={(e) => setUnitForm({ ...unitForm, beds: e.currentTarget.value })} className="tnum" /></Field>
        </div>
      </Modal>

      <ConfirmDestructive
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          if (target) {
            void actAndRefresh(
              () => api.del(`/api/v1/admin/facilities/${target.facility.id}/units/${target.unit.id}`),
              () => `${target.unit.name} removed`,
            ).then(setToast);
          }
        }}
        title="Remove this unit"
        confirmWord={deleting?.unit.name ?? ""}
        actionLabel="Remove unit"
        body={<>You are removing <strong>{deleting?.unit.name}</strong> from the org structure.</>}
        consequences={[
          "Any account scoped to this unit will resolve to an empty scope and lose access — it fails closed, not open.",
          "Open encounters on this unit stay in the record but will no longer appear on any unit roster.",
          "Audit entries that reference this unit keep the name, so history stays readable.",
        ]}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
