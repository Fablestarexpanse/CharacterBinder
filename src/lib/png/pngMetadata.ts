import type { MetadataKey, PngChunkInfo } from "../../types";
import { CHARACTER_METADATA_KEYS, DATA_CARD_TYPES } from "../../types";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(data: Uint8Array): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let crcTableCache: Uint32Array | null = null;
function makeCrcTable(): Uint32Array {
  if (crcTableCache) return crcTableCache;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  crcTableCache = table;
  return table;
}

interface PngChunk {
  type: string;
  data: Uint8Array;
}

/** The card's own name, from the V2 `data` block or a flat body. */
function readCardName(jsonData: string): string | null {
  try {
    const parsed = JSON.parse(jsonData) as { name?: unknown; data?: { name?: unknown } };
    const name = parsed?.data?.name ?? parsed?.name;
    return typeof name === "string" && name.trim() ? name : null;
  } catch {
    return null;
  }
}

/**
 * A PNG can declare a chunk length up to 2^32-1, but this app only ever deals
 * in card art. Anything past this is malformed or hostile, and refusing early
 * keeps us from trying to allocate it.
 */
const MAX_CHUNK_LENGTH = 64 * 1024 * 1024;
/** Ordinary PNGs have a handful of chunks; thousands means something is wrong. */
const MAX_CHUNKS = 4096;

function readChunks(bytes: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8; // skip PNG signature

  while (offset + 8 <= bytes.length) {
    // getUint32 rather than shifts: `<<` and `|` coerce to *signed* int32, so a
    // length with the high bit set came out negative and `offset += length`
    // walked the cursor backwards — an unterminated loop on a crafted file.
    const length = view.getUint32(offset, false);

    // A chunk must fit in what's left, after its own 4-byte CRC.
    if (length > MAX_CHUNK_LENGTH || length > bytes.length - offset - 12) break;

    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    const data = bytes.slice(offset + 8, offset + 8 + length);

    // Belt and braces: every iteration must consume at least 12 bytes, so the
    // cursor can only move forward and the loop must terminate.
    offset += 12 + length;

    chunks.push({ type, data });
    if (type === "IEND" || chunks.length >= MAX_CHUNKS) break;
  }

  return chunks;
}

function makeChunkBytes(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const length = data.length;
  const chunk = new Uint8Array(4 + 4 + length + 4);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(4 + length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  view.setUint32(8 + length, crc32(crcInput), false);

  return chunk;
}

function makeTextChunk(keyword: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(keyword);
  const textBytes = enc.encode(text);
  const data = new Uint8Array(keyBytes.length + 1 + textBytes.length);
  data.set(keyBytes, 0);
  data[keyBytes.length] = 0; // null separator
  data.set(textBytes, keyBytes.length + 1);
  return makeChunkBytes("tEXt", data);
}

/**
 * The tEXt/iTXt keywords this encoder owns. Derived from the card vocabulary so
 * a new card kind is carried by the PNG paths without a second list to update.
 */
const CARD_KEYS: readonly MetadataKey[] = [...CHARACTER_METADATA_KEYS, ...DATA_CARD_TYPES];

/**
 * The keyword and text bytes of a tEXt or iTXt chunk, or null when the chunk
 * has no null separator and so no keyword at all.
 *
 * iTXt's layout is the reason this is worth its own function: keyword, null,
 * compression flag, compression method, language tag, null, translated
 * keyword, null, and only then the text.
 */
function textChunkPayload(chunk: PngChunk): { keyword: string; text: Uint8Array } | null {
  const nullIdx = chunk.data.indexOf(0);
  if (nullIdx === -1) return null;
  const keyword = new TextDecoder().decode(chunk.data.slice(0, nullIdx));

  if (chunk.type !== "iTXt") return { keyword, text: chunk.data.slice(nullIdx + 1) };

  let pos = nullIdx + 1;
  const compressionFlag = chunk.data[pos];
  pos += 2; // compression flag + compression method
  // Language tag and translated keyword, each null-terminated.
  for (let skipped = 0; skipped < 2; skipped++) {
    while (pos < chunk.data.length && chunk.data[pos] !== 0) pos++;
    pos++;
  }
  // Compressed text is not something this app writes, and inflating it here
  // would mean shipping a decompressor for a case no card format uses.
  return { keyword, text: compressionFlag === 0 ? chunk.data.slice(pos) : new Uint8Array(0) };
}

/**
 * The card JSON inside a chunk's text, or null when it does not hold any.
 *
 * Card payloads are conventionally base64 but plain JSON appears in the wild,
 * so both are tried and the result must parse as JSON to count.
 */
function decodeCardPayload(text: Uint8Array): string | null {
  const raw = new TextDecoder().decode(text);
  let decoded: string;
  try {
    // Base64 first, through a UTF-8 round-trip so non-ASCII names survive.
    decoded = decodeURIComponent(escape(atob(raw.trim())));
  } catch {
    decoded = raw;
  }
  try {
    JSON.parse(decoded);
    return decoded;
  } catch {
    return null;
  }
}

export function decodeCharaFromPng(bytes: Uint8Array): {
  json: string | null;
  /** Always one of the keys this app writes; never an arbitrary chunk keyword. */
  key: MetadataKey | null;
  chunks: PngChunkInfo[];
  /** Set when a card chunk exists but its payload wouldn't decode. */
  corruptKey?: string | null;
} {
  if (!isPng(bytes)) return { json: null, key: null, chunks: [], corruptKey: null };

  const chunkInfos: PngChunkInfo[] = [];
  let foundJson: string | null = null;
  let foundKey: MetadataKey | null = null;
  let corruptKey: string | null = null;

  for (const chunk of readChunks(bytes)) {
    if (chunk.type !== "tEXt" && chunk.type !== "iTXt") continue;
    const payload = textChunkPayload(chunk);
    if (!payload) continue;

    chunkInfos.push({ keyword: payload.keyword, dataLength: payload.text.length, chunkType: chunk.type });

    const cardKey = CARD_KEYS.find((k) => k === payload.keyword);
    if (foundJson || !cardKey) continue;

    const json = decodeCardPayload(payload.text);
    if (json) {
      foundJson = json;
      foundKey = cardKey;
    } else {
      // The chunk is there and carries the right keyword, but its payload
      // won't decode. Remember that: reporting it as "no card found" sends the
      // user looking for the wrong problem, when the chunk is listed right
      // there in Decode PNG's own table.
      corruptKey = payload.keyword;
    }
  }

  return { json: foundJson, key: foundKey, chunks: chunkInfos, corruptKey: foundJson ? null : corruptKey };
}

export function encodeCharaToPng(
  pngBytes: Uint8Array,
  jsonData: string,
  metadataKey: MetadataKey,
  preserveUnknown = true
): Uint8Array {
  if (!isPng(pngBytes)) throw new Error("Invalid PNG data");

  const base64Data = btoa(unescape(encodeURIComponent(jsonData)));
  const chunks = readChunks(pngBytes);
  // Keys this encoder owns and therefore rewrites from scratch on every save.
  // "name" belongs here: it used to be absent, so preserveUnknown kept every
  // previous copy and appended a new one, leaving readers that take the first
  // `name` chunk showing the original name forever.
  const knownKeys = [...CARD_KEYS, "name"];

  const keepChunks: PngChunk[] = [];
  let ihdChunk: PngChunk | null = null;
  const idatChunks: PngChunk[] = [];
  let iendChunk: PngChunk | null = null;

  for (const chunk of chunks) {
    if (chunk.type === "IHDR") {
      ihdChunk = chunk;
    } else if (chunk.type === "IDAT") {
      idatChunks.push(chunk);
    } else if (chunk.type === "IEND") {
      iendChunk = chunk;
    } else if (chunk.type === "tEXt" || chunk.type === "iTXt") {
      const payload = textChunkPayload(chunk);
      if (payload) {
        if (knownKeys.includes(payload.keyword)) continue; // remove old chara chunks
        if (preserveUnknown) keepChunks.push(chunk);
      }
    } else {
      keepChunks.push(chunk);
    }
  }

  // Chunk order is the part that matters: the card and name chunks go ahead of
  // IDAT, because readers that scan for metadata routinely stop at the first
  // image data chunk and would never see them otherwise.
  const parts: Uint8Array[] = [PNG_SIGNATURE];
  if (ihdChunk) parts.push(makeChunkBytes("IHDR", ihdChunk.data));
  for (const chunk of keepChunks) {
    parts.push(makeChunkBytes(chunk.type, chunk.data));
  }
  parts.push(makeTextChunk(metadataKey, base64Data));
  // The name chunk is written for SillyTavern compatibility.
  // Parsed rather than regex-scraped: a regex over the serialised string breaks
  // on escaped quotes in the name and can match a nested `character_book.name`
  // that happens to appear earlier in the document.
  const cardName = readCardName(jsonData);
  if (cardName) {
    parts.push(makeTextChunk("name", cardName));
  }
  for (const chunk of idatChunks) {
    parts.push(makeChunkBytes("IDAT", chunk.data));
  }
  if (iendChunk) parts.push(makeChunkBytes("IEND", iendChunk.data));

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

export function getPngDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (!isPng(bytes) || bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}


