import { z } from 'zod';
import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_ACCOUNT_LENGTH,
  AUTHENTICATOR_MAX_ENTRIES,
  AUTHENTICATOR_MAX_GROUP_LENGTH,
  AUTHENTICATOR_MAX_GROUPS,
  AUTHENTICATOR_MAX_ISSUER_LENGTH,
  AUTHENTICATOR_MAX_LABEL_LENGTH,
  type AuthenticatorEntryMetadata,
  type AuthenticatorGroup,
} from '../shared/contracts.js';

export const entryMetadataSchema = z.strictObject({
  id: z.string().uuid(),
  issuer: z.string().max(AUTHENTICATOR_MAX_ISSUER_LENGTH).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)),
  account: z.string().min(1).max(AUTHENTICATOR_MAX_ACCOUNT_LENGTH).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)),
  label: z.string().min(1).max(AUTHENTICATOR_MAX_LABEL_LENGTH).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)),
  algorithm: z.enum(AUTHENTICATOR_ALGORITHMS),
  digits: z.union(AUTHENTICATOR_DIGITS.map((value) => z.literal(value)) as [z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>]),
  periodSeconds: z.number().int().min(1).max(3_600),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  order: z.number().int().min(0).max(AUTHENTICATOR_MAX_ENTRIES - 1),
  // v1 metadata written before saved-entry management had no group field;
  // default it during the bounded read migration rather than rewriting it.
  group: z.string().min(1).max(AUTHENTICATOR_MAX_GROUP_LENGTH).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)).nullable().default(null),
  groupId: z.string().uuid().nullable().default(null),
});

const legacyEntryMetadataSchema = entryMetadataSchema.omit({ group: true }).extend({
  label: z.string().min(1).max(AUTHENTICATOR_MAX_ISSUER_LENGTH + AUTHENTICATOR_MAX_ACCOUNT_LENGTH + 3),
});

export const authenticatorGroupSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1).max(AUTHENTICATOR_MAX_GROUP_LENGTH).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int().min(0).max(AUTHENTICATOR_MAX_GROUPS - 1),
  collapsed: z.boolean(),
});

const legacyGroups = z.array(authenticatorGroupSchema).max(AUTHENTICATOR_MAX_GROUPS).default([]);

/** v1 remains readable for existing installs; v2 is written once group metadata is touched. */
export const metadataDocumentSchema = z.union([
  z.strictObject({
    schemaVersion: z.literal(1),
    entries: z.array(legacyEntryMetadataSchema).max(AUTHENTICATOR_MAX_ENTRIES),
    groups: legacyGroups.optional(),
  }),
  z.strictObject({
    schemaVersion: z.literal(2),
    entries: z.array(entryMetadataSchema).max(AUTHENTICATOR_MAX_ENTRIES),
    groups: legacyGroups.optional(),
  }),
  z.strictObject({
    schemaVersion: z.literal(3),
    entries: z.array(entryMetadataSchema).max(AUTHENTICATOR_MAX_ENTRIES),
    groups: z.array(authenticatorGroupSchema).max(AUTHENTICATOR_MAX_GROUPS),
  }),
]);

export function normalizeAuthenticatorGroups(groups: readonly AuthenticatorGroup[]): AuthenticatorGroup[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  const orders = new Set<number>();
  const sorted = [...groups].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return sorted.filter((group) => {
    if (ids.has(group.id) || names.has(group.name) || orders.has(group.order)) throw new Error('The authenticator group metadata contained duplicate identifiers, names, or order values.');
    ids.add(group.id);
    names.add(group.name);
    orders.add(group.order);
    return true;
  }).slice(0, AUTHENTICATOR_MAX_GROUPS).map((group, order) => ({ ...authenticatorGroupSchema.parse(group), order }));
}

export function parseEntryMetadata(value: unknown): AuthenticatorEntryMetadata {
  return entryMetadataSchema.parse(value) as AuthenticatorEntryMetadata;
}
