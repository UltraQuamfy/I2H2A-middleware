import fetch from 'node-fetch';
import type { CredentialStatus, I2H2ACredential } from './types';

function firstStatus(cs: I2H2ACredential['credentialStatus']): CredentialStatus | undefined {
  if (!cs) return undefined;
  return Array.isArray(cs) ? cs[0] : cs;
}

/**
 * Fetch a status list credential (JSON) and test the bit at `statusListIndex`.
 * Stub: assumes bitstring payload compatible with checking index (implementation to be hardened).
 */
export async function checkCredentialStatus(credential: I2H2ACredential): Promise<boolean> {
  const status = firstStatus(credential.credentialStatus);
  if (!status) {
    throw new Error('credentialStatus is missing; cannot check revocation status');
  }

  const listUrl = status.statusListCredential;
  if (!listUrl || typeof listUrl !== 'string') {
    throw new Error('credentialStatus.statusListCredential URL is required');
  }

  const rawIndex = status.statusListIndex;
  const index =
    typeof rawIndex === 'number'
      ? rawIndex
      : typeof rawIndex === 'string'
        ? parseInt(rawIndex, 10)
        : NaN;

  if (!Number.isFinite(index) || index < 0) {
    throw new Error('credentialStatus.statusListIndex must be a non-negative integer');
  }

  const res = await fetch(listUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Status list could not be fetched (${res.status}): ${listUrl}`);
  }

  const listDoc = (await res.json()) as {
    credentialSubject?: { encodedList?: string };
    encodedList?: string;
  };

  const encoded = listDoc.credentialSubject?.encodedList ?? listDoc.encodedList;

  if (!encoded || typeof encoded !== 'string') {
    throw new Error('Status list document missing encodedList');
  }

  const buf = Buffer.from(encoded, 'base64');
  const byteIndex = Math.floor(index / 8);
  const bitPos = index % 8;

  if (byteIndex >= buf.length) {
    throw new Error('statusListIndex out of range for encoded status list');
  }

  const byte = buf[byteIndex]!;
  const bit = (byte >> (7 - bitPos)) & 1;

  // Convention: 0 = valid, 1 = revoked (aligns with Status List 2021 style bitstrings)
  return bit === 0;
}
