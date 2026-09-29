/**
 * The signed-in clinician's own assigned unit (§4.6 unit scoping).
 *
 * Several screens defaulted a unit picker — or an admit/triage target — to
 * "the first unit in the list" rather than the signed-in user's own. For a
 * charge or bedside nurse that is almost always the wrong unit: their roster
 * opened on someone else's empty ward, and an admit could silently target a
 * unit they don't work on. Centralised here so every screen that needs
 * "my unit" reads it the same way.
 */
import { USERS } from "@/mock/db";
import { useSession } from "./session";

export function myUnitId(): string | undefined {
  const { email } = useSession.getState();
  return USERS.find((u) => u.email === email)?.unitIds?.[0];
}
