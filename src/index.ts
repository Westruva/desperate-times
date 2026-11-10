import https from "node:https";
import { dnsServer, resolveIp } from "./dns.js";

// Usage: npm run dev -- [url]
// Optional env var: DNS_SERVER (default 1.1.1.1)
const target = new URL(process.argv[2] ?? "https://x.com");

// Connect to the IP ourselves, but keep the real hostname for TLS (SNI + cert
// check) and the HTTP Host header, so the server and certificate still match.
function request(ip: string, url: URL): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: ip,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "GET",
        servername: url.hostname,
        headers: { Host: url.hostname, "User-Agent": "desperate-times/0.1" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function main(): Promise<void> {
  const ip = await resolveIp(target.hostname);
  console.log(`${target.hostname} -> ${ip} (via DNS ${dnsServer})`);

  const { status, body } = await request(ip, target);
  console.log(`HTTP ${status}, ${body.length} bytes`);
  console.log(body.slice(0, 300));
}

main().catch((err: unknown) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
