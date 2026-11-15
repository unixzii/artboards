// Just enough of the OpenType file format for what CanvasKit cannot tell us:
// which variation axes a font has, and one font out of a .ttc collection
// (CanvasKit only ever loads the first). Platform-free.

const tag = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

const TTCF = 0x74746366; // "ttcf"
const WOFF2 = 0x774f4632; // "wOF2"

interface TableRecord {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
}

function tableDirectory(v: DataView, at: number): TableRecord[] {
  const count = v.getUint16(at + 4);
  return Array.from({ length: count }, (_, i) => {
    const r = at + 12 + i * 16;
    return { tag: tag(v, r), checksum: v.getUint32(r + 4), offset: v.getUint32(r + 8), length: v.getUint32(r + 12) };
  });
}

/** How many fonts a file holds: more than one for a .ttc collection. */
export function faceCount(data: ArrayBuffer): number {
  const v = new DataView(data);
  return v.byteLength >= 12 && v.getUint32(0) === TTCF ? v.getUint32(8) : 1;
}

/**
 * The font at `index` of a .ttc collection as a standalone font file; any
 * other file is returned as it is. Throws when the collection has no such font.
 */
export function extractFace(data: ArrayBuffer, index: number): ArrayBuffer {
  const v = new DataView(data);
  if (v.byteLength < 12 || v.getUint32(0) !== TTCF) {
    if (index !== 0) throw new RangeError(`index ${index}: the file holds a single font, so the only index is 0.`);
    return data;
  }
  const count = v.getUint32(8);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`index ${index}: the collection holds ${count} fonts, so index is 0 to ${count - 1}.`);
  }
  const start = v.getUint32(12 + index * 4);
  const tables = tableDirectory(v, start);
  // The fonts of a collection share tables; copy the ones this font uses.
  const headerSize = 12 + tables.length * 16;
  const size = tables.reduce((n, t) => n + ((t.length + 3) & ~3), headerSize);
  const out = new Uint8Array(size);
  const ov = new DataView(out.buffer);
  out.set(new Uint8Array(data, start, 12), 0); // sfnt version and search fields
  let at = headerSize;
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) ov.setUint8(r + k, t.tag.charCodeAt(k));
    ov.setUint32(r + 4, t.checksum);
    ov.setUint32(r + 8, at);
    ov.setUint32(r + 12, t.length);
    out.set(new Uint8Array(data, t.offset, t.length), at);
    at += (t.length + 3) & ~3;
  });
  return out.buffer;
}

/** UIntBase128 from a WOFF2 table directory: [value, bytes read]. */
function base128(v: DataView, at: number): [number, number] {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = v.getUint8(at + i);
    value = value * 128 + (b & 0x7f);
    if (!(b & 0x80)) return [value, i + 1];
  }
  return [value, 5];
}

/** Index 47 of WOFF2's known-tag table; only `fvar` matters here. */
const WOFF2_FVAR = 47;

/**
 * Tags of the variation axes (`wght`, `opsz`, ...) of a variable font; empty
 * for a static one. A .woff2 compresses its tables, so for a variable .woff2
 * this assumes the common pair, `wght` and `opsz`.
 */
export function variationAxes(data: ArrayBuffer): string[] {
  const v = new DataView(data);
  if (v.byteLength < 12) return [];
  try {
    if (v.getUint32(0) === WOFF2) {
      const count = v.getUint16(12);
      let at = 48;
      for (let i = 0; i < count; i++) {
        const flags = v.getUint8(at++);
        const known = flags & 0x3f;
        let name = "";
        if (known === 63) {
          name = tag(v, at);
          at += 4;
        }
        if (known === WOFF2_FVAR || name === "fvar") return ["wght", "opsz"];
        const [, n] = base128(v, at); // origLength
        at += n;
        const transform = (flags >> 6) & 3;
        // glyf (10) and loca (11) carry a transformLength unless transform 3; other tables only with a transform.
        if ((known === 10 || known === 11) ? transform !== 3 : transform !== 0) at += base128(v, at)[1];
      }
      return [];
    }
    const start = v.getUint32(0) === TTCF ? v.getUint32(12) : 0;
    const fvar = tableDirectory(v, start).find((t) => t.tag === "fvar");
    if (!fvar) return [];
    const axesAt = fvar.offset + v.getUint16(fvar.offset + 4);
    const count = v.getUint16(fvar.offset + 8);
    const size = v.getUint16(fvar.offset + 10);
    return Array.from({ length: count }, (_, i) => tag(v, axesAt + i * size));
  } catch {
    return []; // a truncated or odd file: treat it as static
  }
}
