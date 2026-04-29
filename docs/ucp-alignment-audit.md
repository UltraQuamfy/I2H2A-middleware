# I2H2A ↔ UCP Alignment Audit

## Executive Summary (Priority-Ordered Gaps)

1. **Token carriage conflict with UCP OAuth usage (highest priority).**  
   Current middleware usage assumes the I2H2A presentation is the primary credential input (`sdJwtKb` string, often passed as bearer in MCP-style integrations), while UCP already uses OAuth bearer tokens for platform authentication.  
   **Recommendation:** Define a transport-agnostic I2H2A carriage convention for UCP (e.g., separate `I2H2A-Presentation` header for REST, equivalent `meta.i2h2a.presentation` for MCP/A2A/Embedded), keeping OAuth in `Authorization`.

2. **Scope model is MCP-oriented and under-specified for UCP operations.**  
   Spec/middleware enforce `scope.mcpServers` and `scope.taskType`, which do not map 1:1 to UCP capability/version/operation semantics.  
   **Recommendation:** Introduce a UCP scope profile (capability IDs, operation names, optional merchant/domain binding, risk constraints) while preserving backward compatibility.

3. **Verification output/error model does not map to UCP error taxonomy.**  
   Middleware returns `{ valid, error, claims }`; UCP defines transport-specific error patterns/codes (REST+MCP) and profile negotiation semantics.  
   **Recommendation:** Add a UCP adapter layer that maps I2H2A verification failures into UCP-compliant codes/messages/status behavior.

4. **Performance and network dependency risk for checkout latency budgets.**  
   DID resolution and status-list fetches are network-bound; UCP checkout targets are latency-sensitive.  
   **Recommendation:** require caching strategy + timeout budgets + fallback behavior for resolver/status infrastructure in merchant deployments.

5. **Some I2H2A/UCP bindings are implied but not explicitly specified.**  
   I2H2A is DID-method agnostic (correct), but UCP-specific integration details (where to carry VP, how to bind to merchant request context, and OAuth coexistence profile) are not yet formalized.  
   **Recommendation:** publish an “I2H2A for UCP” integration profile.

---

## Inputs Audited

- I2H2A spec: `I2H2A Specification v0.3` draft (`I2H2A-v0.3-draft.md`, dated 2026-04-25)
- Middleware code (`src/`):
  - `types.ts`
  - `verify-helpers.ts`
  - `verify-vp.ts`
  - `resolve-did.ts`
  - `check-status.ts`
  - `validate-scope.ts`
- UCP docs:
  - [Core Concepts](https://ucp.dev/documentation/core-concepts/)
  - [Specification Overview](https://ucp.dev/latest/specification/overview/)

---

## 1) Credential Structure

### Does current I2H2A SD-JWT carry what a UCP merchant needs?

**Yes for baseline delegation proof, partially for UCP commerce context.**

What is already present and useful:
- Issuer authenticity + temporal validity (`iss`, `iat`, `nbf`, `exp`)
- Credential type lock (`vct`)
- Holder binding (`cnf.jwk` + KB-JWT proof-of-possession)
- Revocation (`credentialStatus`)
- Delegation identity (`delegatedBy`)
- Delegation controls (`scope.mcpServers`, `scope.taskType`, `delegationDepth`, `parentCredential`)
- Opaque extensibility (`authorization`)

### Missing/misaligned relative to UCP concepts

- **Scope field naming is MCP-centric** (`scope.mcpServers`) vs UCP’s capability/operation model.
- No explicit first-class fields for:
  - UCP capability identifiers (e.g., `dev.ucp.shopping.checkout`)
  - operation-level restrictions (e.g., `complete_checkout`, `update_checkout`)
  - merchant or business profile binding (domain/profile URL)
  - transaction/risk constraints expected in commerce flows (amount/currency windows, expiry tighter than VC lifetime, etc.)
- `authorization` is intentionally opaque, but without a profile it can create interoperability drift across merchants/platforms.

### Scope/authorization mapping to UCP checkout capabilities

- **Current mapping is possible but indirect.**
  - `scope.taskType` can approximate operation class.
  - `authorization` can carry UCP-specific restrictions.
- **Not clean enough for broad interoperability** unless a shared schema/profile is defined for UCP usage.

---

## 2) Verification Flow

### Alignment with UCP verification expectations

**Cryptographic flow is strong and compatible with UCP security posture**, including:
- ES256/P-256 signatures
- key binding via KB-JWT (`aud`, `nonce`, `sd_hash`)
- status/revocation checks
- DID-based key resolution

But **integration semantics are not yet UCP-native**:
- middleware returns generic app-level result object, not UCP response/error contracts
- no built-in mapping to UCP negotiation/auth/signature error codes

### Is it fast enough for `<1s` checkout expectations?

**Potentially, with deployment controls; not guaranteed by default.**

Fast path:
- local parsing/hash/signature checks are cheap
- `did:key` resolution is local in middleware

Risk path:
- non-`did:key` issuer resolution requires external resolver URL
- status list check requires network fetch + decode
- both can add variable latency and timeout risk

Conclusion:
- For strict UCP checkout SLOs, production deploys need cache/timeout policy and likely prefetch/warm caches.

### Does VP presentation mechanic work for UCP?

**Yes cryptographically; needs transport/application adaptation.**

- SD-JWT+KB is suitable as proof object.
- UCP request contracts currently center on OAuth identity + UCP profile negotiation + transport-specific metadata.
- Therefore VP format is reusable, but carriage and binding to UCP request context must be standardized.

---

## 3) Transport Compatibility

UCP transports: REST, MCP, A2A, Embedded.

### Is middleware MCP-only?

**No.**  
Library API is transport-agnostic (`verifyI2H2APresentation(token, options)`) and can be called from any runtime path.

### What is currently MCP-leaning?

- Scope field naming (`mcpServers`)
- examples/docs framing around MCP session challenge flow

### Changes needed for REST/HTTP UCP endpoints

- Define deterministic extraction point for I2H2A presentation in HTTP requests.
- Define nonce/audience derivation per transport:
  - REST: audience tied to merchant verifier ID/endpoint profile; nonce from merchant challenge/session state.
  - MCP/A2A/Embedded: equivalent binding via protocol metadata/session context.
- Add UCP adapter docs for response mapping and failure behavior.

---

## 4) OAuth Coexistence

### Current state

- Middleware consumes an SD-JWT+KB presentation token as input.
- UCP already uses OAuth bearer for platform auth and identity binding.

### Recommended coexistence model

**Do not overload OAuth bearer. Carry I2H2A separately.**

Recommended pattern:
- `Authorization: Bearer <oauth_access_token>` (unchanged UCP platform auth)
- Add separate I2H2A field:
  - REST: `I2H2A-Presentation: <sd-jwt+kb>` header (or explicit JSON body field if header size constraints apply)
  - MCP: `meta.i2h2a.presentation`
  - A2A/Embedded: equivalent protocol metadata field

Rationale:
- avoids collision with UCP OAuth assumptions
- keeps authn (platform) separate from delegation proof (human-to-agent authorization)
- enables clear auditing and policy checks.

---

## 5) Missing Pieces

### In UCP that I2H2A middleware/spec does not currently address directly

- UCP profile negotiation lifecycle and capability intersection semantics
- UCP transport-native error/status contracts
- UCP message-signature framework and key discovery flow
- Payment handler lifecycle semantics (I2H2A is orthogonal, not substitutive)
- standardized UCP field-level placement for third-party delegation credentials

### In I2H2A that should be clarified/extended for UCP use

- UCP-specific scope profile (capabilities/operations/merchant binding)
- standard carriage rules across REST/MCP/A2A/Embedded
- explicit OAuth coexistence profile text
- latency/caching guidance for resolver + status checks in checkout-grade environments
- optional verifier output profile mapping to UCP error codes/messages

---

## 6) What Is Already Correct

- **DID-method agnostic model is already aligned** with heterogeneous UCP ecosystem requirements.
- **ES256/P-256 cryptographic profile** is compatible with modern commerce/security stacks.
- **Selective disclosure (SD-JWT)** is well-suited for minimizing data sharing in merchant flows.
- **Key-binding via KB-JWT** provides strong anti-replay/context binding primitives (`aud` + `nonce` + `sd_hash`).
- **Revocation support** via status lists matches operational trust needs in commerce.
- **Middleware architecture is reusable** beyond MCP; verification function is transport-independent at code level.

---

## Recommended Next Steps (Practical)

1. Publish an **I2H2A-UCP integration profile** (normative):
   - credential carriage per transport
   - OAuth coexistence rules
   - required nonce/audience derivation
2. Define a **UCP scope vocabulary** (capability/operation/merchant constraints).
3. Add a **UCP adapter package or reference module** mapping middleware outcomes to UCP response/error conventions.
4. Publish **performance deployment guidance** (cache TTLs, timeouts, retry budgets, fallback handling).
5. Add conformance examples for:
   - REST checkout endpoint with OAuth + I2H2A sidecar proof
   - MCP tool call with `meta`-carried I2H2A presentation
   - failure mapping examples (invalid proof, expired delegation, revoked credential).

---

## Bottom Line

I2H2A and the current middleware are **cryptographically and conceptually compatible** with UCP’s agentic commerce model, and already cover the core human-delegation proof gap that OAuth does not solve.  

The main remaining work is **integration standardization** (carriage, scope vocabulary, UCP-native error/transport mapping, and latency-focused operational guidance), not a redesign of the credential model or verifier cryptography.
