/**
 * Example: MCP (Model Context Protocol) server wiring — verify I2H2A VP before
 * handling tool calls so only delegated agents with valid credentials proceed.
 *
 * Pseudocode for a Node MCP server using `@modelcontextprotocol/sdk` or similar:
 *
 * ```ts
 * import { verifyI2H2AVP } from '@i2h2a/mcp-middleware';
 *
 * // When the client connects or sends an initial message with a VP:
 * async function onClientVp(vp: VerifiablePresentation) {
 *   const out = await verifyI2H2AVP(vp, {
 *     mcpServerId: 'my-mcp-server-id',
 *     taskType: 'read-only',
 *   });
 *   if (!out.valid) throw new Error(out.error ?? 'Invalid I2H2A VP');
 *   return out.claims;
 * }
 * ```
 *
 * Bind `onClientVp` to your transport’s authentication or session setup phase.
 */

export {};
