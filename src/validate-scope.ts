import type { I2H2ACredential } from './types';

function firstSubject(cred: I2H2ACredential) {
  const cs = cred.credentialSubject;
  if (Array.isArray(cs)) return cs[0];
  return cs;
}

/**
 * Validate delegation scope: MCP server allow-list and task type.
 */
export function validateDelegationScope(
  credential: I2H2ACredential,
  mcpServerId: string,
  taskType: string
): boolean {
  const subject = firstSubject(credential);
  if (!subject?.scope) {
    return false;
  }

  const servers = subject.scope.mcpServers;
  const allowedTask = subject.scope.taskType;

  if (!Array.isArray(servers) || typeof allowedTask !== 'string') {
    return false;
  }

  if (!servers.includes(mcpServerId)) {
    return false;
  }

  return allowedTask === taskType;
}
