import type { ReactNode } from 'react';

export type IconName =
  | 'plus' | 'list' | 'chart' | 'x' | 'search' | 'ext' | 'copy' | 'left'
  | 'right' | 'check' | 'alert' | 'mic' | 'cap' | 'retry' | 'play';

const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  ext: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>),
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 5 5 9-10" />,
  alert: (<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  cap: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M13 15h4M7 11h10" /></>),
  retry: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  play: (<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m10 8 6 4-6 4Z" /></>),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: 15 | 18 }) {
  return (
    <svg className={size === 15 ? 'ico sm' : 'ico'} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
