/**
 * A settings scope, read from the API and written back to it.
 *
 * Screens used to start every toggle from a hard-coded default and, at best,
 * fire a save — so a change was stored but the screen forgot it on reload and
 * showed the default again. This reads the stored document first and keeps the
 * screen in step with what the server holds.
 *
 * `save` applies the patch on screen at once, sends it, and on failure puts
 * the previous value back — a toggle that flips and silently stays flipped
 * after the server refused it is the lie this exists to avoid.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/api/client";
import { OFFLINE_NOTICE, isLive, type SettingsScope } from "@/api/actions";

type Doc = Record<string, unknown>;

function merge<T extends Doc>(base: T, patch: Doc): T {
  const out: Doc = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const prev = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" && !Array.isArray(prev)
      ? merge(prev as Doc, v as Doc)
      : v;
  }
  return out as T;
}

export function useSettings<T extends Doc>(scope: SettingsScope, fallback: T) {
  const [settings, setSettings] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(settings);
  current.current = settings;

  const reload = useCallback(async () => {
    if (!isLive()) return;
    try {
      const r = await api.get<{ settings: Doc }>(`/api/v1/settings/${scope}`);
      setSettings(merge(fallback, r.settings));
    } catch {
      // Keep what is on screen; the next save reports the failure in words.
    }
    // `fallback` is a literal at the call site; re-reading on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    void reload().finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [reload]);

  /** Apply `patch`, persist it, and return a sentence for the toast. */
  const save = useCallback(async (patch: Doc, done: string, reason?: string): Promise<string> => {
    if (!isLive()) return OFFLINE_NOTICE;
    const before = current.current;
    setSettings(merge(before, patch));
    try {
      const r = await api.put<{ settings: Doc }>(`/api/v1/settings/${scope}`, { patch, reason: reason ?? null });
      setSettings(merge(fallback, r.settings));
      return done;
    } catch (error) {
      setSettings(before);
      return error instanceof ApiError ? error.message : OFFLINE_NOTICE;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return { settings, loaded, save, reload };
}
