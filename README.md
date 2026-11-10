# desperate-times

Reach a site that your `/etc/hosts` file blocks (e.g. `127.0.0.1 x.com`) without editing the
hosts file or changing browser settings. Written in TypeScript, no runtime dependencies.

## Why it works

`/etc/hosts` is only consulted by the system resolver. These tools look up the real IP
through a DNS server you choose (default `1.1.1.1`) and connect to it directly.

## Setup

```
npm install
```

## Tools

### 1. Passthrough server (no browser settings needed)

Your hosts file sends `x.com` to localhost, so the browser connects to this server. It reads
the site name (SNI) from the TLS handshake, looks up the real IP, and pipes the encrypted
bytes through. TLS stays end-to-end with the real site, so there are no certificate warnings.

It must listen on port 443. Pick one way to allow that:

```
# a) run as root
sudo env "PATH=$PATH" npm run start

# b) allow Node to bind low ports (affects every Node script), then run normally
sudo setcap cap_net_bind_service=+ep "$(readlink -f "$(which node)")"
npm run start

# c) listen on 8443 and redirect 443 -> 8443 with nftables (IPv4 shown)
sudo nft add table ip nat
sudo nft 'add chain ip nat output { type nat hook output priority -100; }'
sudo nft add rule ip nat output ip daddr 127.0.0.1 tcp dport 443 redirect to :8443
PORT=8443 npm run start
```

Then open https://x.com. It listens on `127.0.0.1` and `::1` only.

### 2. CONNECT proxy (needs a browser proxy setting)

```
npm run proxy          # 127.0.0.1:8080
curl -x http://127.0.0.1:8080 https://x.com
```

### 3. Command-line fetcher

```
npm run dev                          # fetches https://x.com
npm run dev -- https://x.com/home
```

## Environment variables

| Variable     | Default    | Used by              |
| ------------ | ---------- | -------------------- |
| `DNS_SERVER` | `1.1.1.1`  | all tools            |
| `PORT`       | 443 / 8080 | passthrough / proxy  |

## Scripts

`npm run typecheck` checks types, `npm run build` compiles to `dist/`.
