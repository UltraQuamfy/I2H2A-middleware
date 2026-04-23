import type { I2H2ADisclosedClaims } from './types';

export function validateDelegationScope(
  claims: I2H2ADisclosedClaims,
  mcpServerId: string
): boolean {
  const allowedServers = claims['scope.mcpServers'];

  if (!Array.isArray(allowedServers) || allowedServers.length === 0) {
    return false;
  }

  for (const server of allowedServers) {
    if (typeof server !== 'string' || server.trim() === '') {
      return false;
    }
  }

  const normalizedId = mcpServerId.trim();
  return allowedServers.some((s) => s.trim() === normalizedId);
}
