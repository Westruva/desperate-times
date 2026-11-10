import net from "node:net";
import { dnsServer, resolveIp } from "./dns.js";
import { firstRecordLength, parseSni } from "./sni.js";

// Optional env vars: PORT (default 443), DNS_SERVER (default 1.1.1.1)
const port = Number(process.env.PORT ?? 443);
const MAX_CLIENT_HELLO = 16 * 1024 + 5; // max size of one TLS record

// /etc/hosts sends x.com to localhost, so the browser connects here. We read the
// server name from the TLS handshake, look up the real IP, and pipe the raw bytes
// through. TLS stays end-to-end between browser and site, so no certificates needed.
function handleConnection(client: net.Socket): void {
  client.on("error", () => {});
  let buffered = Buffer.alloc(0);

  const onData = async (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);

    try {
      const needed = firstRecordLength(buffered);
      if (needed === null || buffered.length < needed) {
        if (buffered.length > MAX_CLIENT_HELLO) throw new Error("ClientHello too large");
        return; // wait for more bytes
      }

      client.off("data", onData);
      client.pause();

      const hostname = parseSni(buffered);
      if (!hostname) throw new Error("No SNI in ClientHello");

      const ip = await resolveIp(hostname);
      // Guard against looping back into ourselves if DNS ever returns loopback.
      if (ip.startsWith("127.")) throw new Error(`${hostname} resolved to loopback`);
      console.log(`${hostname} -> ${ip}`);

      const upstream = net.connect(443, ip, () => {
        upstream.write(buffered);
        client.pipe(upstream);
        upstream.pipe(client);
        client.resume();
      });
      upstream.on("error", (err) => {
        console.error(`Upstream error for ${hostname}: ${err.message}`);
        client.destroy();
      });
      client.on("close", () => upstream.destroy());
    } catch (err) {
      console.error("Connection rejected:", err instanceof Error ? err.message : err);
      client.destroy();
    }
  };

  client.on("data", onData);
}

// Listen on IPv4 and IPv6 loopback only (your hosts file maps x.com to both).
// Binding to loopback means other machines on the network can't use this.
for (const host of ["127.0.0.1", "::1"]) {
  const server = net.createServer(handleConnection);
  server.on("error", (err) => console.error(`Cannot listen on [${host}]:${port}: ${err.message}`));
  server.listen(port, host, () => console.log(`Listening on [${host}]:${port} (DNS ${dnsServer})`));
}
