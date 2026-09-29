/**
 * Line icons, 1.6px stroke on a 24-grid, inheriting currentColor.
 *
 * Every colored state in this product pairs its color with one of these plus a
 * text label (§14.3.3) — color is never the sole carrier of meaning, so the
 * icon set is a safety control, not decoration.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: P) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const XIcon = (p: P) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const AlertIcon = (p: P) => <Svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /></Svg>;
export const InfoIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const ClockIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const ChevronRight = (p: P) => <Svg className="icon-dir" {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const ChevronDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const ChevronLeft = (p: P) => <Svg className="icon-dir" {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const ArrowUp = (p: P) => <Svg {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>;
export const ArrowDown = (p: P) => <Svg {...p}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>;
export const ArrowRight = (p: P) => <Svg className="icon-dir" {...p}><path d="M5 12h14M12 5l7 7-7 7" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const SunIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const MoonIcon = (p: P) => <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Svg>;
export const MonitorIcon = (p: P) => <Svg {...p}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></Svg>;
export const UserIcon = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const UsersIcon = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.6" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.6 3.6 0 0 1 0 5.6M18 14.4a6.5 6.5 0 0 1 3.5 5.6" /></Svg>;
export const ShieldIcon = (p: P) => <Svg {...p}><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z" /></Svg>;
export const KeyIcon = (p: P) => <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8 2 2-2 2 2 2-2 2-2-2-2 2" /></Svg>;
export const BuildingIcon = (p: P) => <Svg {...p}><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M15 9h3a2 2 0 0 1 2 2v10M2 21h20M8 7h3M8 11h3M8 15h3" /></Svg>;
export const BedIcon = (p: P) => <Svg {...p}><path d="M3 18V7M3 12h18v6M21 18v-6a3 3 0 0 0-3-3h-7v3" /><circle cx="7" cy="10" r="1.8" /></Svg>;
export const HeartPulseIcon = (p: P) => <Svg {...p}><path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 7l-1.3-1.4a5 5 0 1 0-7.1 7.1l1.4 1.4L12 21l7-7.1 1.4-1.4a5 5 0 0 0 0-7.1Z" /><path d="M3.5 12.5h3l1.5-3 2 5 1.5-2.5h3" /></Svg>;
export const ActivityIcon = (p: P) => <Svg {...p}><path d="M3 12h4l3-8 4 16 3-8h4" /></Svg>;
export const ClipboardIcon = (p: P) => <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></Svg>;
export const ListIcon = (p: P) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></Svg>;
export const GridIcon = (p: P) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>;
export const SettingsIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></Svg>;
export const ChartIcon = (p: P) => <Svg {...p}><path d="M3 3v18h18" /><path d="M7 15l3.5-4 3 2.5L20 7" /></Svg>;
export const FileIcon = (p: P) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M12 3v12M7 11l5 5 5-5M4 20h16" /></Svg>;
export const UploadIcon = (p: P) => <Svg {...p}><path d="M12 21V9M7 13l5-5 5 5M4 4h16" /></Svg>;
export const LinkIcon = (p: P) => <Svg {...p}><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9" /><path d="M14 11a5 5 0 0 0-7.1 0L4.5 13.4a5 5 0 0 0 7.1 7.1l1.4-1.4" /></Svg>;
export const SendIcon = (p: P) => <Svg {...p}><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" /></Svg>;
export const MailIcon = (p: P) => <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
export const LockIcon = (p: P) => <Svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Svg>;
export const UnlockIcon = (p: P) => <Svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-1.9" /></Svg>;
export const EyeIcon = (p: P) => <Svg {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const EyeOffIcon = (p: P) => <Svg {...p}><path d="M3 3l18 18" /><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.4A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Svg>;
export const RefreshIcon = (p: P) => <Svg {...p}><path d="M20 11a8 8 0 1 0-1 5" /><path d="M20 4v7h-7" /></Svg>;
export const FlaskIcon = (p: P) => <Svg {...p}><path d="M10 3h4M10.5 3v6L5 18.6A2 2 0 0 0 6.7 21.7h10.6A2 2 0 0 0 19 18.6L13.5 9V3" /><path d="M7.5 15h9" /></Svg>;
export const PillIcon = (p: P) => <Svg {...p}><rect x="2.2" y="8.3" width="19.6" height="7.4" rx="3.7" transform="rotate(-45 12 12)" /><path d="M8.5 8.5 15.5 15.5" /></Svg>;
export const StethoscopeIcon = (p: P) => <Svg {...p}><path d="M5 3v5a4 4 0 0 0 8 0V3" /><path d="M9 12v3a5 5 0 0 0 10 0v-2" /><circle cx="19" cy="11" r="2" /><path d="M5 3H3.5M13 3h1.5" /></Svg>;
export const HandoffIcon = (p: P) => <Svg {...p}><path d="M3 12h11M11 8l4 4-4 4" /><path d="M17 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" /></Svg>;
export const SparkIcon = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Svg>;
export const ScaleIcon = (p: P) => <Svg {...p}><path d="M12 3v18M7 21h10" /><path d="M12 6 5 9l-2.5 5a4 4 0 0 0 8 0L8 9M12 6l7 3 2.5 5a4 4 0 0 1-8 0L16 9" /></Svg>;
export const GlobeIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" /></Svg>;
export const ServerIcon = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></Svg>;
export const CreditCardIcon = (p: P) => <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></Svg>;
export const MenuIcon = (p: P) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const BellIcon = (p: P) => <Svg {...p}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const LogoutIcon = (p: P) => <Svg {...p}><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5M21 12H9" /></Svg>;
export const TrashIcon = (p: P) => <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></Svg>;
export const EditIcon = (p: P) => <Svg {...p}><path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="m14 6 4 4" /></Svg>;
export const FilterIcon = (p: P) => <Svg {...p}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></Svg>;
export const BookIcon = (p: P) => <Svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M19 19H6" /></Svg>;
export const PaletteIcon = (p: P) => <Svg {...p}><path d="M12 3a9 9 0 1 0 0 18 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-8.6Z" /><circle cx="7.5" cy="12" r="1" /><circle cx="9.5" cy="8" r="1" /><circle cx="14.5" cy="7.5" r="1" /></Svg>;
