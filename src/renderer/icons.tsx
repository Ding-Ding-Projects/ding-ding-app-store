import type { SVGProps } from 'react';

type IconDefinition = { path?: string; paths?: string[]; circle?: string; line?: string; polyline?: string };

/* Local geometry keeps the renderer independent of remote fonts, CDNs, and Unicode fallbacks. */
export const iconMap: Record<string, IconDefinition> = {
  apps: { path: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' }, block: { path: 'M5 5l14 14M19 5 5 19M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  inventory_2: { path: 'M5 4h14v16H5zM8 2h8v4H8zM8 9h8M8 13h5' },
  system_update: { path: 'M5 4h14v13H5zM8 20h8', polyline: '9 10 12 13 15 10' },
  menu_book: { path: 'M4 5c3-1 6 0 8 2v13c-2-2-5-3-8-2zM20 5c-3-1-6 0-8 2v13c2-2 5-3 8-2z' },
  history: { path: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 8v4l3 2' },
  settings: { path: 'M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2zM19.4 13.2l1.3 1-.2 1.8-1.7.7-.5 1.6-1.8.7-1.3-1-1.6.6-.6 1.5h-1.9l-.7-1.5-1.6-.6-1.3 1-1.7-.7-.5-1.6-1.7-.7-.2-1.8 1.3-1-.1-1.6-1.3-1 .2-1.8 1.7-.7.5-1.6 1.8-.7 1.3 1 1.6-.6.6-1.5h1.9l.7 1.5 1.6.6 1.3-1 1.7.7.5 1.6 1.7.7.2 1.8-1.3 1z' },
  close: { path: 'm6 6 12 12M18 6 6 18' }, cancel: { path: 'm6 6 12 12M18 6 6 18' },
  search: { circle: '11 11 6.5', line: '16 16 21 21' },
  regular_expression: { path: 'M4 8h3M4 12h3M4 16h3M17 8l3 8M20 8l-3 8M9 12h5' },
  deployed_code: { path: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16' },
  download: { path: 'M12 3v12M7 10l5 5 5-5M5 20h14' },
  star: { path: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z' },
  build: { path: 'M14.5 5.5a4 4 0 0 0-5 5L4 16a2.1 2.1 0 1 0 3 3l5.5-5.5a4 4 0 0 0 5-5l-2.8 2.1-2.2-2.2z' },
  delete: { path: 'M5 7h14M10 4h4l1 3H9zM7 7l1 13h8l1-13M10 10v7M14 10v7' },
  storefront: { path: 'M4 10v10h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-5h6v5' },
  remove: { line: '5 12 19 12' }, crop_square: { path: 'M5 5h14v14H5z' },
  refresh: { path: 'M20 11a8 8 0 0 0-14.6-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.6 4L21 14M21 19v-5h-5' },
  wifi_off: { path: 'm3 3 18 18M8.5 8.5a8 8 0 0 1 10.8 3.1M5.1 5.1a13 13 0 0 1 13.8 1.8M2 9a18 18 0 0 1 2.5-1.3M12 20h.01M8.1 12.1a6 6 0 0 1 7.8 0' },
  search_off: { circle: '11 11 6.5', line: '3 3 21 21' }, arrow_back: { path: 'M20 12H5M11 6l-6 6 6 6' }, arrow_forward: { path: 'M4 12h15M13 6l6 6-6 6' },
  check_circle: { circle: '12 12 9', polyline: '8 12 11 15 16 9' }, error: { circle: '12 12 9', line: '12 8 12 13', path: 'M12 16h.01' },
  content_copy: { path: 'M8 8h11v12H8zM5 16H4V4h11v1' }, push_pin: { path: 'm15 4 5 5-3 1 1 5-2 2-5-5-4 4-1-1 4-4-5-5 2-2 5 1zM12 17l-2 4' },
  folder: { path: 'M3 6h7l2 2h9v10H3z' }, more_horiz: { paths: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'] }, expand_more: { polyline: '6 9 12 15 18 9' },
  chevron_right: { polyline: '9 6 15 12 9 18' }, chevron_left: { polyline: '15 6 9 12 15 18' }, drag_indicator: { paths: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'] },
  palette: { path: 'M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-10z', paths: ['M7 10h.01', 'M9 7h.01', 'M14 7h.01', 'M17 10h.01'] },
  schedule: { circle: '12 12 9', line: '12 7 12 12 15 14' }, restart_alt: { path: 'M4 10a8 8 0 1 1 2 7M4 5v5h5' }, upload: { path: 'M12 16V4M7 9l5-5 5 5M5 20h14' },
  tab: { path: 'M4 5h16v14H4zM4 9h16M8 7h.01' }, info: { circle: '12 12 9', line: '12 11 12 16', path: 'M12 8h.01' }, edit: { path: 'm4 16-.7 4.7L8 20l11-11-4-4zM13 6l4 4' },
  undo: { path: 'M9 7H4v5M4 12a8 8 0 1 0 2-5' }, keyboard: { path: 'M3 6h18v12H3zM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h9M17 14h1' },
  contrast: { path: 'M12 3a9 9 0 0 0 0 18 9 9 0 0 0 0-18zM12 3v18' }, visibility: { path: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z', circle: '12 12 2.5' },
  key: { circle: '8 15 3', path: 'm10 13 8-8 3 3-2 2-2-2-2 2 2 2-2 2' }, notifications: { path: 'M6 10a6 6 0 0 1 12 0v5l2 2H4l2-2zM10 20h4' }, code: { polyline: '8 7 3 12 8 17M16 7l5 5-5 5M14 4l-4 16' },
  open_in_new: { path: 'M14 4h6v6M20 4l-9 9M18 13v6H4V5h6' }, notifications_off: { path: 'm3 3 18 18M6 10a6 6 0 0 1 10.8-3.6M18 10v5l2 2H8M10 20h4' }, swap_vert: { path: 'M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3' },
  check_box: { path: 'M5 5h14v14H5z', polyline: '8 12 11 15 16 9' }, done: { polyline: '5 12 10 17 19 7' }, delete_sweep: { path: 'M5 7h14M10 4h4l1 3H9zM7 7l1 13h8l1-13M10 10v7M14 10v7' }, lock: { path: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3' }, lock_open: { path: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 7-2' },
  warning: { path: 'm12 4 9 16H3zM12 10v4M12 17h.01' }, support_agent: { circle: '12 11 7', path: 'M5 11v5H3v-4a9 9 0 0 1 18 0v4h-2v-5M19 16a3 3 0 0 1-3 3h-2' }, confirmation_number: { path: 'M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4h16a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4zM12 8v8' }, folder_open: { path: 'M3 7h7l2 2h9v9H3zM3 7l2 12h14' },
  language: { circle: '12 12 9', path: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }, add: { line: '12 5 12 19', path: 'M5 12h14' },
  download_for_offline: { path: 'M12 3v10M8 10l4 4 4-4M5 19h14M5 7a4 4 0 0 1 4-4' }, terminal: { path: 'M4 5h16v14H4z', polyline: '7 9 10 12 7 15' },
  verified_user: { path: 'M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z', polyline: '8 12 11 15 16 9' }, qr_code_2: { path: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h2v2h-2zM19 14h1v6h-6v-2M12 12h2v2h-2z' },
};

const linePoints = (value: string | undefined) => value?.split(' ').map(Number) as [number, number, number, number] | undefined;

export function Icon({ children, size = 20, strokeWidth = 1.9, ...props }: { children: string; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'children'>) {
  const definition = iconMap[children] ?? { path: 'M12 5v14M5 12h14' };
  const line = linePoints(definition.line);
  return <svg className="material-symbol" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    {definition.path && <path d={definition.path} />}
    {definition.paths?.map((path, index) => <path key={`path-${index}`} d={path} />)}
    {definition.circle && (() => { const values = definition.circle.split(' ').map(Number); return <circle cx={values[0]} cy={values[1]} r={values[2]} />; })()}
    {line && <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} />}
    {definition.polyline && <polyline points={definition.polyline} />}
  </svg>;
}
