"""A patient's care team, derived from their encounters.

The portal used to read a hand-kept list that nothing tied to the hospital
record, so it could name clinicians who could not see the patient and leave
out the ones who could. Derived here instead, from the same encounters the
access rules read:

* the attending and nurse named on each current encounter;
* that encounter's unit team — the staff whose scope covers the unit, which is
  who can actually read what the patient sends;
* people outside this hospital (a GP, say) kept from the stored list, since no
  encounter here can name them. Hospital staff are never taken from the stored
  list: they are on the team because an encounter says so, or not at all.
"""

from __future__ import annotations

from . import db

ATTENDING = "Attending physician"
NURSE = "Bedside nurse"
UNIT_TEAM = "The doctors, nurses, pharmacist and case manager on this unit"


def _person(name: str | None) -> str | None:
    from .routers.clinical import _person as person

    return person(name)


def for_patient(portal_id: str) -> list[dict]:
    links = db.document("portal_links") or {}
    clinical_ids = {cid for cid, pid in links.items() if pid == portal_id} | {portal_id}
    encounters = [e for e in db.docs("SELECT doc FROM encounters")
                  if e["patient"]["id"] in clinical_ids]
    current = [e for e in encounters if e.get("state") != "closed"] or encounters
    current.sort(key=lambda e: e.get("admittedAt") or "", reverse=True)

    facility_of = {u["id"]: f["name"] for f in db.docs("SELECT doc FROM facilities")
                   for u in f.get("units", [])}

    team: list[dict] = []
    named: set[str] = set()
    units: set[str] = set()
    for i, e in enumerate(current):
        facility = facility_of.get(e.get("unitId"), e.get("unitName", ""))
        base = {"facility": facility, "since": e.get("admittedAt"), "encounterId": e["id"],
                "unitName": e.get("unitName")}
        for who, role, tag in ((e.get("attending"), ATTENDING, "att"), (e.get("nurse"), NURSE, "rn")):
            if who and _person(who) not in named:
                named.add(_person(who))
                team.append({**base, "id": f"ct_{e['id']}_{tag}", "name": who, "role": role,
                             "primary": i == 0 and role == ATTENDING, "source": "encounter"})
        if e.get("unitId") and e["unitId"] not in units:
            units.add(e["unitId"])
            team.append({**base, "id": f"ct_{e['id']}_unit", "name": f"{e.get('unitName')} team",
                         "role": UNIT_TEAM, "primary": False, "source": "unit"})

    staff = {_person(u["name"]) for u in db.docs("SELECT doc FROM users")}
    for m in db.docs("SELECT doc FROM care_team WHERE patient_id=?", (portal_id,)):
        who = _person(m.get("name"))
        if who in staff or who in named:
            continue
        team.append({**m, "primary": bool(m.get("primary")) and not team, "source": "external"})
    return team
