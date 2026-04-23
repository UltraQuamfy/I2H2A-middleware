import { describe, expect, it } from '@jest/globals';
import { validateDelegationScope } from '../src/validate-scope';
import type { I2H2ADisclosedClaims } from '../src/types';

describe('validateDelegationScope', () => {
  it('allows when mcpServerId is in scope.mcpServers', () => {
    const claims: I2H2ADisclosedClaims = {
      'scope.mcpServers': ['server-a', 'server-b'],
    };
    expect(validateDelegationScope(claims, 'server-a')).toBe(true);
  });

  it('denies when mcpServerId is not in scope.mcpServers', () => {
    const claims: I2H2ADisclosedClaims = {
      'scope.mcpServers': ['server-a', 'server-b'],
    };
    expect(validateDelegationScope(claims, 'server-c')).toBe(false);
  });

  it('denies when scope.mcpServers is empty', () => {
    const claims: I2H2ADisclosedClaims = {
      'scope.mcpServers': [],
    };
    expect(validateDelegationScope(claims, 'server-a')).toBe(false);
  });

  it('denies when scope.mcpServers is missing', () => {
    const claims: I2H2ADisclosedClaims = {};
    expect(validateDelegationScope(claims, 'server-a')).toBe(false);
  });

  it('denies when scope.mcpServers contains empty strings', () => {
    const claims: I2H2ADisclosedClaims = {
      'scope.mcpServers': ['server-a', '', 'server-b'],
    };
    expect(validateDelegationScope(claims, '')).toBe(false);
  });

  it('denies when scope.mcpServers contains non-strings', () => {
    const claims: I2H2ADisclosedClaims = {
      'scope.mcpServers': ['server-a', 123 as any, 'server-b'],
    };
    expect(validateDelegationScope(claims, 'server-a')).toBe(false);
  });

  it('handles whitespace trimming', () => {
    const claims: I2H2ADisclosedClaims = {
      'scope.mcpServers': [' server-a ', 'server-b'],
    };
    expect(validateDelegationScope(claims, 'server-a')).toBe(true);
    expect(validateDelegationScope(claims, ' server-a ')).toBe(true);
  });
});
