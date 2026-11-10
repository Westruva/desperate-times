import { Resolver } from "node:dns/promises";

export const dnsServer = process.env.DNS_SERVER ?? "1.1.1.1";

// A Resolver talks to the DNS server directly, so /etc/hosts is never consulted.
// (The default getaddrinfo path used by fetch/https is what reads /etc/hosts.)
export async function resolveIp(hostname: string): Promise<string> {
  const resolver = new Resolver();
  resolver.setServers([dnsServer]);
  const [ip] = await resolver.resolve4(hostname);
  if (!ip) throw new Error(`No A record found for ${hostname}`);
  return ip;
}
