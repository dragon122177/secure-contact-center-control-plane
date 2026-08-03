import { describe, expect, it } from 'vitest';
import { ipv4MatchesCidr, isNetworkAccessAllowed } from '../domain/network-policy.js';

describe('network policy', () => {
  it('matches an IPv4 address inside a provider network', () => {
    expect(ipv4MatchesCidr('10.44.18.22', '10.44.0.0/16')).toBe(true);
    expect(ipv4MatchesCidr('10.45.18.22', '10.44.0.0/16')).toBe(false);
  });

  it('supports exact and open prefix boundaries', () => {
    expect(ipv4MatchesCidr('192.0.2.8', '192.0.2.8/32')).toBe(true);
    expect(ipv4MatchesCidr('203.0.113.9', '0.0.0.0/0')).toBe(true);
  });

  it('rejects invalid addresses and prefixes', () => {
    expect(ipv4MatchesCidr('not-an-ip', '10.0.0.0/8')).toBe(false);
    expect(ipv4MatchesCidr('10.0.0.1', '10.0.0.0/99')).toBe(false);
    expect(ipv4MatchesCidr('10.0.0.1', 'bad/8')).toBe(false);
  });

  it('allows access if any configured range matches', () => {
    expect(isNetworkAccessAllowed('198.51.100.42', ['10.44.0.0/16', '198.51.100.0/24'])).toBe(true);
  });
});
