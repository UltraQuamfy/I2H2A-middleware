/**
 * Example: Express middleware that verifies an I2H2A Verifiable Presentation
 * on protected routes (OID4VP-style: VP in body or header).
 *
 * Install peer dependency: `npm install express`
 *
 * ```ts
 * import express from 'express';
 * import { verifyI2H2AVP } from '@i2h2a/mcp-middleware';
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.post('/mcp', async (req, res, next) => {
 *   const vp = req.body?.verifiablePresentation;
 *   const result = await verifyI2H2AVP(vp, {
 *     mcpServerId: process.env.MCP_SERVER_ID,
 *     taskType: req.body?.taskType,
 *   });
 *   if (!result.valid) {
 *     return res.status(401).json({ error: result.error ?? 'VP verification failed' });
 *   }
 *   (req as any).i2h2aClaims = result.claims;
 *   next();
 * });
 * ```
 */

export {};
