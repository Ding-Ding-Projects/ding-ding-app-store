import type { ElementKey } from '../shared/contracts';

/**
 * Marks a rendered element as appearance-editable. The key is a literal from the shared registry,
 * so the appearance editor can resolve a click target with closest('[data-el]') and nothing else.
 * Window controls, the super-confirmation, its keys and slider, and the emergency exit never carry it.
 */
export const el = (key: ElementKey): { 'data-el': ElementKey } => ({ 'data-el': key });
