/**
 * Seed exporter — keeps the one demo dataset in sync across its two consumers.
 *
 * The seeded generator (mulberry32 / 20260922) that first produced the data has
 * been retired; `src/mock/seed.json` is now the source of truth, and
 * `src/mock/db.ts` loads it. This script re-exports it through that store — a
 * lossless round trip — with the permission matrix refreshed from `rbac.ts`, and
 * writes the result to both copies. The backend loads it into SQLite rather than
 * keeping a Python copy that would drift on the first edit to either side.
 *
 *   npm run seed:dump    # -> src/mock/seed.json and ../backend/seed/seed.json
 */

import current from "@/mock/seed.json";
import { ALL_PERMISSIONS, MATRIX, ROLES } from "@/lib/rbac";

// The dataset itself is seed.json; only the permission matrix is refreshed, so
// the server enforces the exact grades src/lib/rbac.ts defines and the UI renders.
const seed = {
  ...current,
  rbac: { roles: ROLES, matrix: MATRIX, permissions: ALL_PERMISSIONS },
};

process.stdout.write(JSON.stringify(seed, null, 2));
