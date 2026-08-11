export const iconMap: Record<string, string> = {
  apps: '⊞', inventory_2: '▣', system_update: '↻', menu_book: '▤', history: '◴', settings: '⚙',
  close: '×', search: '⌕', regular_expression: '.*', deployed_code: '◆', download: '↓', star: '★',
  build: '⌁', delete: '⌫', storefront: '◈', remove: '−', crop_square: '□', refresh: '↻', wifi_off: '⌁',
  search_off: '∅', arrow_forward: '→', check_circle: '✓', error: '!', content_copy: '⧉',
  push_pin: '⚲', folder: '▭', more_horiz: '⋯', expand_more: '⌄', chevron_right: '›', drag_indicator: '⠿',
  palette: '◑', schedule: '◷', restart_alt: '⟳', upload: '↑', tab: '▱', info: 'ⓘ', edit: '✎', undo: '↶',
  keyboard: '⌨', contrast: '◐', visibility: '◉', key: '⚿', notifications: '♧', code: '</>', open_in_new: '↗', notifications_off: '♧',
  swap_vert: '↕', check_box: '☑', delete_sweep: '⌫',
  lock: '🔒', lock_open: '🔓', warning: '⚠', support_agent: '♟', confirmation_number: '▤', folder_open: '▱',
};

export function Icon({ children }: { children: string }) {
  return <span className="material-symbol" aria-hidden="true">{iconMap[children] ?? '•'}</span>;
}
