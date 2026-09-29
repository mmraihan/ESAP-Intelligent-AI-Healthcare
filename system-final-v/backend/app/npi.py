"""NPI (National Provider Identifier) verification for self-serve clinician signup (§10.7).

Two layers, so signup never hard-depends on a network call:

1. **Check-digit validation** — the NPI's own Luhn checksum (prefixed with the
   80840 issuer id, per the CMS spec). Deterministic, offline, catches typos and
   invented numbers.
2. **Registry lookup** — an optional NPPES query (the public CMS registry) when
   ``NPI_VERIFY_ONLINE=true``. It confirms the number is issued and returns the
   registered name. Any network failure falls back to checksum-only rather than
   blocking signup, and the result records which layer actually ran.

Swapping in a paid CAQH/again-the-registry verifier is a change to ``_lookup``
only; ``verify`` and its callers stay the same.
"""

from __future__ import annotations

import os
import re

_DIGITS = re.compile(r"\d")


def is_npi_shaped(value: str) -> bool:
    """A bare 10-digit token — what an NPI looks like before the checksum test."""
    return bool(value) and len(re.sub(r"\D", "", value)) == 10 and value.strip().isdigit()


def luhn_valid(npi: str) -> bool:
    """The NPI check-digit test (CMS): Luhn over '80840' + the first 9 digits,
    compared with the 10th digit."""
    digits = re.sub(r"\D", "", npi or "")
    if len(digits) != 10:
        return False
    base = "80840" + digits[:9]
    total = 0
    # Luhn: from the rightmost of `base`, double every second digit.
    for i, ch in enumerate(reversed(base)):
        d = int(ch)
        if i % 2 == 0:  # rightmost of base is doubled (check digit sits to its right)
            d *= 2
            if d > 9:
                d -= 9
        total += d
    check = (10 - (total % 10)) % 10
    return check == int(digits[9])


def _lookup(npi: str) -> dict | None:
    """Query the NPPES registry. Returns {'name': ...} or None. Never raises."""
    if os.environ.get("NPI_VERIFY_ONLINE", "false").lower() not in {"1", "true", "yes"}:
        return None
    try:
        import httpx  # local import: only needed when online verification is on
        r = httpx.get("https://npiregistry.cms.hhs.gov/api/",
                      params={"number": re.sub(r"\D", "", npi), "version": "2.1"}, timeout=6.0)
        data = r.json()
        results = data.get("results") or []
        if not results:
            return {"name": None, "found": False}
        basic = results[0].get("basic", {})
        name = " ".join(x for x in [basic.get("first_name"), basic.get("last_name"),
                                    basic.get("organization_name")] if x).strip()
        return {"name": name or None, "found": True}
    except Exception:  # noqa: BLE001 - offline / DNS / rate-limit all fall back to checksum-only
        return None


def verify(npi: str) -> dict:
    """Verify an NPI as far as the environment allows.

    Returns a record suitable to store on the user:
      { npi, checksumValid, registryChecked, registryFound, registeredName, verified }
    ``verified`` is True only when a real registry match was made; otherwise the
    number is 'checksum-valid' at best, which the UI states honestly.
    """
    clean = re.sub(r"\D", "", npi or "")
    checksum = luhn_valid(clean)
    out = {
        "npi": clean or None,
        "checksumValid": checksum,
        "registryChecked": False,
        "registryFound": None,
        "registeredName": None,
        "verified": False,
    }
    if not checksum:
        return out
    hit = _lookup(clean)
    if hit is not None:
        out["registryChecked"] = True
        out["registryFound"] = bool(hit.get("found"))
        out["registeredName"] = hit.get("name")
        out["verified"] = bool(hit.get("found"))
    return out
