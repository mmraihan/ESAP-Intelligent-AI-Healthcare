/**
 * Re-render when the data store is reloaded.
 *
 * The store fills its collections in place, so nothing React watches changes
 * when a hydrate lands. This subscribes to the store's version counter and
 * returns it, which is enough to make a component re-read the arrays after a
 * write refreshes them.
 */

import { useSyncExternalStore } from "react";
import { dataVersion, subscribeToData } from "@/mock/db";

export function useDataVersion(): number {
  return useSyncExternalStore(subscribeToData, dataVersion, dataVersion);
}
