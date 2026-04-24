import fetch from 'node-fetch';
import { gunzip, inflateRaw } from 'zlib';
import { promisify } from 'util';
import type { CredentialStatusEntry } from './types';

const gunzipAsync = promisify(gunzip);
const inflateRawAsync = promisify(inflateRaw);

async function decodeBitstringBytes(encoded: string): Promise<Buffer> {
  const raw = Buffer.from(encoded, 'base64');

  try {
    return await gunzipAsync(raw);
  } catch {
    // Fall through to raw inflate.
  }

  try {
    return await inflateRawAsync(raw);
  } catch {
    // Fall through to uncompressed bitstring.
  }

  return raw;
}

function parseStatusListIndex(index: number | string): number {
  if (typeof index === 'number') {
    if (!Number.isFinite(index) || index < 0 || !Number.isInteger(index)) {
      throw new Error('credentialStatus.statusListIndex must be a finite non-negative integer');
    }
    return index;
  }

  if (typeof index !== 'string' || !/^[0-9]+$/.test(index)) {
    throw new Error(
      'credentialStatus.statusListIndex must be a base-10 string or finite non-negative integer'
    );
  }

  const parsed = Number.parseInt(index, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error('credentialStatus.statusListIndex exceeds supported integer range');
  }
  return parsed;
}

/**
 * Fetch a status list credential (JSON) and test the bit at `statusListIndex`.
 */
export async function checkCredentialStatus(status: CredentialStatusEntry): Promise<boolean> {
  const listUrl = status.statusListCredential;
  if (!listUrl || typeof listUrl !== 'string') {
    throw new Error('credentialStatus.statusListCredential URL is required');
  }

  const index = parseStatusListIndex(status.statusListIndex);

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
  const MAX_ENCODED_SIZE = 10 * 1024 * 1024; // 10MB
  if (encoded.length > MAX_ENCODED_SIZE) {
    throw new Error(
      `Status list encodedList too large (${encoded.length} bytes, max ${MAX_ENCODED_SIZE})`
    );
  }

  const buf = await decodeBitstringBytes(encoded);
  const MAX_DECOMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB decompressed
  if (buf.length > MAX_DECOMPRESSED_SIZE) {
    throw new Error(
      `Status list too large after decompression (${buf.length} bytes, max ${MAX_DECOMPRESSED_SIZE})`
    );
  }
  const byteIndex = Math.floor(index / 8);
  const bitPos = index % 8;

  if (byteIndex >= buf.length) {
    throw new Error('statusListIndex out of range for encoded status list');
  }

  const byte = buf[byteIndex];
  if (byte === undefined) {
    throw new Error('statusListIndex byte is undefined');
  }
  const bit = (byte >> (7 - bitPos)) & 1;

  // Bit convention per W3C Bitstring Status List §7: 0 = active, 1 = revoked.
  return bit === 0;
}
