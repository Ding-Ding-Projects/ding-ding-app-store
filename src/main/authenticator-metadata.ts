import { z } from 'zod';
import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_ACCOUNT_LENGTH,
  AUTHENTICATOR_MAX_ENTRIES,
  AUTHENTICATOR_MAX_GROUP_LENGTH,
  AUTHENTICATOR_MAX_ISSUER_LENGTH,
  AUTHENTICATOR_MAX_LABEL_LENGTH,
  type AuthenticatorEntryMetadata,
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
});

const legacyEntryMetadataSchema = entryMetadataSchema.omit({ group: true }).extend({
  label: z.string().min(1).max(AUTHENTICATOR_MAX_ISSUER_LENGTH + AUTHENTICATOR_MAX_ACCOUNT_LENGTH + 3),
});

/** v1 remains readable for existing installs; v2 is written once group metadata is touched. */
export const metadataDocumentSchema = z.union([
  z.strictObject({
    schemaVersion: z.literal(1),
    entries: z.array(legacyEntryMetadataSchema).max(AUTHENTICATOR_MAX_ENTRIES),
  }),
  z.strictObject({
    schemaVersion: z.literal(2),
    entries: z.array(entryMetadataSchema).max(AUTHENTICATOR_MAX_ENTRIES),
  }),
]);

export function parseEntryMetadata(value: unknown): AuthenticatorEntryMetadata {
  return entryMetadataSchema.parse(value) as AuthenticatorEntryMetadata;
}
