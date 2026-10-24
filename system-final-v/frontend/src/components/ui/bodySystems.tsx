/**
 * Body-system glyphs for CCSR families — the anatomical shorthand a clinician
 * scans a differential by (heart, lungs, kidney, brain…).
 *
 * Same drawing rules as icons.tsx: 1.6px stroke on a 24-grid, currentColor.
 * They are always rendered beside the family name, never instead of it, so the
 * glyph reinforces identity rather than carrying it (§14.3.3).
 */
import type { ReactNode } from "react";
import { bodySystem, familyColorVar, type BodySystem } from "@/lib/ccsrFamilies";
import { cx } from "./primitives";

const GLYPH: Record<BodySystem, ReactNode> = {
  circulatory: (
    <>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
      <path d="M7.5 12.5h2.2l1.2-2 1.8 4 1.2-2h2.6" />
    </>
  ),
  respiratory: (
    <>
      <path d="M12 3.5v8.5" />
      <path d="M12 9.5c-.8 0-1.6.5-2.2 1.4" />
      <path d="M12 9.5c.8 0 1.6.5 2.2 1.4" />
      <path d="M9.4 7.2C7.2 7.6 4.5 12 4.5 16.6c0 2 .9 3.4 2.6 3.4 2 0 3.4-1.2 3.4-3.6V9" />
      <path d="M14.6 7.2c2.2.4 4.9 4.8 4.9 9.4 0 2-.9 3.4-2.6 3.4-2 0-3.4-1.2-3.4-3.6V9" />
    </>
  ),
  endocrine: (
    <>
      <path d="M12 9.2c-1.4-2.6-6.5-3.2-6.5 1.3 0 3.6 2.6 6.4 4.6 5.8 1.2-.4 1.9-1.6 1.9-3 0 1.4.7 2.6 1.9 3 2 .6 4.6-2.2 4.6-5.8 0-4.5-5.1-3.9-6.5-1.3z" />
      <path d="M12 4v5.2M12 16.5V20" />
    </>
  ),
  genitourinary: (
    <>
      <path d="M8.8 4.5c-3 0-4.3 3.3-4.3 6.6s1.4 7.4 4.4 7.4c2 0 2.7-1.6 2.7-3.2 0-1.1-.9-1.6-.9-2.7s.9-1.6.9-2.7c0-2.7-.6-5.4-2.8-5.4z" />
      <path d="M15.2 4.5c3 0 4.3 3.3 4.3 6.6s-1.4 7.4-4.4 7.4c-2 0-2.7-1.6-2.7-3.2 0-1.1.9-1.6.9-2.7s-.9-1.6-.9-2.7c0-2.7.6-5.4 2.8-5.4z" />
    </>
  ),
  mental: (
    <>
      <path d="M14.5 20.5V18h2a2 2 0 0 0 2-2v-2.2l1.6-.8-1.6-3.2A7 7 0 1 0 7 15.2v5.3" />
      <path d="M10 9.5a2 2 0 0 1 3.6-1.2 1.8 1.8 0 0 1 .4 3.4" />
      <path d="M12 11.7v1.3" />
    </>
  ),
  digestive: (
    <>
      <path d="M9.5 3.5v3.8c0 1.6-3.5 2.6-3.5 7a6 6 0 0 0 6 6h1.2a4.8 4.8 0 0 0 4.8-4.8c0-3.4-3.8-3.4-3.8-6.6V3.5" />
      <path d="M9 14.5c1 1.4 3 1.8 4.6.8" />
    </>
  ),
  nervous: (
    <>
      <path d="M12 5.3a3 3 0 0 0-5.6 1.2A3 3 0 0 0 4.6 11a3 3 0 0 0 1 5.1A3 3 0 0 0 12 18.6V5.3z" />
      <path d="M12 5.3a3 3 0 0 1 5.6 1.2 3 3 0 0 1 1.8 4.5 3 3 0 0 1-1 5.1 3 3 0 0 1-6.4 2.5" />
      <path d="M8.6 9.8c.9.2 1.6.9 1.8 1.8M15.4 9.8c-.9.2-1.6.9-1.8 1.8" />
    </>
  ),
  infectious: (
    <>
      <circle cx="12" cy="12" r="4.8" />
      <path d="M12 3.5v3.7M12 16.8v3.7M3.5 12h3.7M16.8 12h3.7M6 6l2.6 2.6M15.4 15.4 18 18M6 18l2.6-2.6M15.4 8.6 18 6" />
      <circle cx="10.6" cy="11" r=".9" />
      <circle cx="13.4" cy="13.2" r=".7" />
    </>
  ),
  blood: (
    <>
      <path d="M12 3.5s-6 6.4-6 10.8a6 6 0 0 0 12 0c0-4.4-6-10.8-6-10.8z" />
      <path d="M9.4 14.8a2.7 2.7 0 0 0 2.6 2.6" />
    </>
  ),
  musculoskeletal: (
    <>
      <path d="M9.3 7.9 16.1 14.7M7.9 9.3l6.8 6.8" />
      <circle cx="6.4" cy="8.9" r="2" />
      <circle cx="8.9" cy="6.4" r="2" />
      <circle cx="15.1" cy="17.6" r="2" />
      <circle cx="17.6" cy="15.1" r="2" />
    </>
  ),
  injury: (
    <>
      <rect x="3" y="8.6" width="18" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
      <path d="M9.6 9.6l4.8 4.8" opacity=".55" />
      <circle cx="11.1" cy="12.9" r=".45" />
      <circle cx="12.9" cy="11.1" r=".45" />
    </>
  ),
  neoplasm: (
    <>
      <circle cx="9.2" cy="10" r="4.2" />
      <circle cx="15.6" cy="14.4" r="3.4" />
      <circle cx="9.2" cy="10" r="1.2" />
      <circle cx="15.6" cy="14.4" r=".9" />
    </>
  ),
  other: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
};

export function BodySystemGlyph({ family, size = 16 }: { family: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {GLYPH[bodySystem(family)]}
    </svg>
  );
}

/** The glyph on a soft tile tinted with the family's categorical slot. */
export function BodySystemTile({ family, size = 30, className }: { family: string; size?: number; className?: string }) {
  return (
    <span
      className={cx("body-tile", className)}
      style={{ width: size, height: size, ["--fam" as string]: familyColorVar(family) }}
      aria-hidden="true"
    >
      <BodySystemGlyph family={family} size={Math.round(size * 0.56)} />
    </span>
  );
}
