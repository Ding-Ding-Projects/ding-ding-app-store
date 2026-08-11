import { z } from 'zod';
import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_ACCOUNT_LENGTH,
  AUTHENTICATOR_MAX_ENTRIES,
  AUTHENTICATOR_MAX_ISSUER_LENGTH,
  type AuthenticatorEntryMetadata,
} from '../shared/contracts.js';

export const entryMetadataSchema = z.strictObject({
  id: z.string().uuid(),
  issuer: z.string().max(AUTHENTICATOR_MAX_ISSUER_LENGTH),
  account: z.string().min(1).max(AUTHENTICATOR_MAX_ACCOUNT_LENGTH),
  label: z.string().min(1).max(AUTHENTICATOR_MAX_ISSUER_LENGTH + AUTHENTICATOR_MAX_ACCOUNT_LENGTH + 3),
  algorithm: z.enum(AUTHENTICATOR_ALGORITHMS),
  digits: z.union(AUTHENTICATOR_DIGITS.map((value) => z.literal(value)) as [z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>]),
  periodSeconds: z.number().int().min(1).max(3_600),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  order: z.number().int().min(0).max(AUTHENTICATOR_MAX_ENTRIES - 1),
});

export const metadataDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(entryMetadataSchema).max(AUTHENTICATOR_MAX_ENTRIES),
});

export function parseEntryMetadata(value: unknown): AuthenticatorEntryMetadata {
  return entryMetadataSchema.parse(value) as AuthenticatorEntryMetadata;
}
