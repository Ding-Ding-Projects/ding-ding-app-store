export function selectAuthenticatorRange(
  visibleIds: readonly string[],
  anchorId: string | null,
  targetId: string,
  current: ReadonlySet<string>,
): Set<string> {
  const targetIndex = visibleIds.indexOf(targetId);
  if (targetIndex < 0) return new Set(current);
  const anchorIndex = anchorId ? visibleIds.indexOf(anchorId) : -1;
  const start = anchorIndex < 0 ? targetIndex : Math.min(anchorIndex, targetIndex);
  const end = anchorIndex < 0 ? targetIndex : Math.max(anchorIndex, targetIndex);
  const next = new Set(current);
  for (let index = start; index <= end; index += 1) next.add(visibleIds[index]);
  return next;
}

export function toggleAuthenticatorSelection(
  current: ReadonlySet<string>,
  entryId: string,
  checked: boolean,
): Set<string> {
  const next = new Set(current);
  if (checked) next.add(entryId);
  else next.delete(entryId);
  return next;
}
