import { isIP } from 'node:net';

function ipv4ToInteger(value: string): number {
  return (
    value
      .split('.')
      .map(Number)
      .reduce((result, octet) => (result << 8) + octet, 0) >>> 0
  );
}

export function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [network, prefixText] = cidr.split('/');
  if (!network || isIP(network) !== 4 || prefixText === undefined) return false;

  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInteger(ip) & mask) === (ipv4ToInteger(network) & mask);
}

export function isNetworkAccessAllowed(ip: string, allowedCidrs: string[]): boolean {
  return allowedCidrs.some((cidr) => ipv4MatchesCidr(ip, cidr));
}
