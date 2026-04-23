# SD-JWT Migration Plan

## Current State Summary
- Files migrated: 6/8 (based on the 6 verifier modules in scope here: `types.ts`, `verify-helpers.ts`, `resolve-did.ts`, `check-status.ts`, `verify-vp.ts`, `validate-scope.ts` are SD-JWT/ES256-oriented)
- Tests passing: 34/34
- Dependencies: `node-fetch` (runtime), Node built-ins (`crypto`, `zlib`, `util`), dev/test stack (`jest`, `ts-jest`, `typescript`, `@types/node`, `@types/jest`)

## File-by-File Analysis

### resolve-did.ts
**Current:** Resolves issuer DIDs to DID Documents. Handles `did:key` locally by decoding multibase/base58 + P-256 multicodec and deriving JWK `x/y`; resolves non-`did:key` via Universal Resolver HTTP endpoint. Expects DID strings and outputs `DIDDocument` (not JWT payloads directly). No EdDSA; this module is P-256 aware and feeds ES256 verification in downstream logic. Imports: `node-fetch`, `DIDDocument` type.

**Migration needed:** Core SD-JWT migration is already done. Remaining work is hardening/documentation consistency, not format migration:
- Keep/clarify conditional requirement for `resolverUrl` on non-`did:key`.
- Consider TypeScript overloads to enforce `resolverUrl` for non-`did:key` call sites at compile time (currently runtime-enforced).
- Ensure downstream callers always pass resolver URL when issuer DID method is not `did:key`.
- Edge cases: malformed multibase keys, unsupported multicodec, fragment stripping behavior, resolver network failures.

**Test status:** Covered by `tests/resolve-did.test.ts` directly; also mocked in `tests/verify-vp.test.ts` and `tests/integration.test.ts`. Current suite status: all passing as part of 34/34 total tests.

**Complexity:** Medium

### check-status.ts
**Current:** Fetches Bitstring Status List, decodes `encodedList` (gzip, raw deflate, or plain fallback), and checks revocation bit (`0=active`, `1=revoked`) for `CredentialStatusEntry.statusListIndex`. It is independent of JWT vs SD-JWT envelope; it consumes the `credentialStatus` claim shape already used by SD-JWT issuer payloads. No signature crypto here. Imports: `node-fetch`, `zlib` (`gunzip`, `inflateRaw`), `util` (`promisify`), `CredentialStatusEntry` type.

**Migration needed:** SD-JWT compatibility is functionally in place. Remaining work is robustness:
- Validate broader status-list document shapes if needed (currently expects `credentialSubject.encodedList` or top-level `encodedList`).
- Optional stricter media type/response validation.
- Optional telemetry-friendly error taxonomy (currently throws string messages).
- Edge cases: very large lists, malformed compressed payloads, non-byte-aligned indexing assumptions.

**Test status:** Directly covered by `tests/check-status.test.ts`; mocked in VP/integration suites. Current suite status: passing within 34/34 total tests.

**Complexity:** Low-Medium

### verify-vp.ts
**Current:** Full SD-JWT+KB verifier:
- Parses compact SD-JWT+KB (`issuerJwt~disclosures~kbJwt`)
- Enforces `vct` URI and `_sd_alg: sha-256`
- Resolves issuer DID and verifies issuer ES256 signature via P-256 JWK
- Verifies disclosure hashes against `_sd`
- Verifies KB-JWT (`aud`, `nonce`, `sd_hash`) and holder key binding (`cnf.jwk`)
- Runs revocation check whenever `credentialStatus` is present
- Enforces delegation constraints and scope
Types are SD-JWT-specific (`I2H2AIssuerPayload`, disclosures, `KbJwtPayload`). Crypto is ES256/P-256 + SHA-256 only. Imports: `crypto`, `check-status`, `resolve-did`, `validate-scope`, and helpers from `verify-helpers`.

**Migration needed:** Primary migration is already complete. Remaining work is behavioral hardening and coverage expansion:
- Preserve and surface lower-level signature verification errors consistently (helper now throws wrapped verification errors).
- Optionally tighten payload/header schema validation (currently partial shape checks).
- Add explicit behavior for missing `resolverUrl` when issuer DID is non-`did:key` (currently returns generic DID-resolution failure).
- Edge cases: duplicate disclosures, malformed disclosure tuple content, inconsistent `cnf.jwk` shapes, resolver outages.

**Test status:** Covered by `tests/verify-vp.test.ts` and `tests/integration.test.ts` (both mocked dependencies). Current suite status: passing within 34/34 total tests.

**Complexity:** High

### validate-scope.ts
**Current:** Minimal scope gate: verifies `scope.mcpServers` exists and includes `mcpServerId`. Uses disclosed-claims type from SD-JWT flow (`I2H2ADisclosedClaims`). No JWT parsing and no crypto. Imports: only `I2H2ADisclosedClaims` type.

**Migration needed:** No SD-JWT format changes required; logic is already operating on disclosed claims. Remaining work is policy completeness:
- If required by policy, enforce `scope.taskType` (currently ignored by this function).
- Add explicit normalization/validation for server identifiers (case/whitespace expectations).
- Edge cases: non-string values inside `scope.mcpServers`, empty strings, duplicates.

**Test status:** No direct unit test file for `validate-scope.ts`; indirectly covered through `verify-vp` and integration tests that assert allow/deny outcomes.

**Complexity:** Low

## Migration Order
1. `verify-vp.ts` - central verifier path; highest risk and largest blast radius for production behavior.
2. `resolve-did.ts` - resolver-url requirement and DID-method handling directly gate verifier success/failure paths.
3. `check-status.ts` - revocation correctness and resilience; important but isolated behind a single API.
4. `validate-scope.ts` - smallest surface; primarily policy-hardening and direct-test addition.

## Risks & Blockers
- `resolverUrl` is runtime-required for non-`did:key`; callers that omit it will fail verification with a generic DID resolution error path.
- `validate-scope.ts` has no direct unit tests, so scope-policy regressions are only caught indirectly.
- Signature verification helper now throws wrapped errors; verifier currently maps failures to generic messages, which may hide root-cause diagnostics unless explicitly surfaced.
- Status-list decoding accepts gzip/raw/plain fallback; malformed data paths are handled, but performance bounds for very large lists are not explicitly tested.

## Estimated Completion
- `verify-vp.ts`: 0.5-1 day (error-path polish + additional negative-path tests)
- `resolve-did.ts`: 0.25-0.5 day (typed API hardening + caller contract checks)
- `check-status.ts`: 0.25-0.5 day (edge-case coverage and optional strict parsing)
- `validate-scope.ts`: 0.25 day (direct tests + optional `taskType` policy extension)
