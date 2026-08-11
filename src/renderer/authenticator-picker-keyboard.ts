/** Return the next active option for a picker navigation key, or null when the key is not navigation. */
export function moveAuthenticatorPickerFocus(key: string, activeIndex: number, optionCount: number): number | null {
  if (optionCount <= 0) return null;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (activeIndex + 1 + optionCount) % optionCount;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (activeIndex - 1 + optionCount) % optionCount;
  if (key === 'Home') return 0;
  if (key === 'End') return optionCount - 1;
  return null;
}
