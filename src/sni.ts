// Minimal TLS ClientHello parser: extracts the SNI (server name) without decrypting anything.

const RECORD_HEADER = 5;

// Total bytes of the first TLS record (header + payload), or null if we
// haven't received enough bytes yet to read the header.
// Throws if the data doesn't look like TLS.
export function firstRecordLength(buf: Buffer): number | null {
  if (buf.length < RECORD_HEADER) return null;
  if (buf[0] !== 0x16) throw new Error("Not a TLS handshake");
  return RECORD_HEADER + buf.readUInt16BE(3);
}

// Returns the SNI hostname, or null if the ClientHello has none.
// `buf` must contain the complete first record.
export function parseSni(buf: Buffer): string | null {
  let pos = RECORD_HEADER;
  if (buf[pos] !== 0x01) throw new Error("Not a ClientHello");
  pos += 4; // handshake type (1) + length (3)
  pos += 2 + 32; // client version + random
  pos += 1 + buf[pos]!; // session id
  pos += 2 + buf.readUInt16BE(pos); // cipher suites
  pos += 1 + buf[pos]!; // compression methods

  const extensionsEnd = pos + 2 + buf.readUInt16BE(pos);
  pos += 2;

  while (pos + 4 <= extensionsEnd) {
    const type = buf.readUInt16BE(pos);
    const length = buf.readUInt16BE(pos + 2);
    pos += 4;
    if (type === 0x0000) {
      // server_name extension: list length (2), name type (1), name length (2), name
      const nameLength = buf.readUInt16BE(pos + 3);
      return buf.toString("ascii", pos + 5, pos + 5 + nameLength);
    }
    pos += length;
  }
  return null;
}
