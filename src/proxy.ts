import http from "node:http";
import net from "node:net";
import { dnsServer, resolveIp } from "./dns.js";

// Optional env vars: PORT (default 8080), DNS_SERVER (default 1.1.1.1)
const port = Number(process.env.PORT ?? 8080);

const server = http.createServer((_req, res) => {
  // Only HTTPS tunnels (CONNECT) are supported.
  res.writeHead(405).end("Only CONNECT (HTTPS) is supported\n");
});

// Browsers send "CONNECT host:443" to open an HTTPS tunnel through a proxy.
server.on("connect", async (req, clientSocket: net.Socket, head) => {
  clientSocket.on("error", () => {});

  try {
    const url = new URL(`http://${req.url}`);
    const hostname = url.hostname;
    const targetPort = Number(url.port || 443);

    // Resolve ourselves (skipping /etc/hosts), unless it is already an IP.
    const ip = net.isIP(hostname) ? hostname : await resolveIp(hostname);
    console.log(`CONNECT ${hostname}:${targetPort} -> ${ip}`);

    const upstream = net.connect(targetPort, ip, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      // Pipe raw bytes both ways; TLS stays end-to-end between browser and site.
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });

    upstream.on("error", (err) => {
      console.error(`Upstream error for ${hostname}: ${err.message}`);
      clientSocket.destroy();
    });
    clientSocket.on("close", () => upstream.destroy());
  } catch (err) {
    console.error("CONNECT failed:", err instanceof Error ? err.message : err);
    clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
  }
});

// 127.0.0.1 only, so other machines on the network can't use the proxy.
server.listen(port, "127.0.0.1", () => {
  console.log(`Proxy listening on 127.0.0.1:${port} (DNS ${dnsServer})`);
});
