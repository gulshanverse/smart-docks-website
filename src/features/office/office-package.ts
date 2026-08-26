import { inflateSync } from "fflate";
import type { OfficeInspectionLimits } from "../../domain/office/types";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export interface OfficePackageEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  isDirectory: boolean;
}

export interface OfficePackage {
  entries: readonly OfficePackageEntry[];
  readText(name: string, maxBytes?: number): string | null;
  has(name: string): boolean;
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (u32(bytes, offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function safeEntryName(name: string): boolean {
  return name.length > 0 && name.length <= 512 && !name.startsWith("/") && !name.includes("\\") && !name.split("/").some((part) => part === ".." || part.length === 0 && name.endsWith("/"));
}

export async function openOfficePackage(file: File, limits: OfficeInspectionLimits): Promise<OfficePackage> {
  if (file.size > limits.maxInputBytes) throw new Error("This Office file exceeds the 50 MiB browser-local inspection limit.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 22) throw new Error("The Office package is too small to contain a valid ZIP directory.");
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error("The Office file is not a valid ZIP-based OOXML package.");
  const disk = u16(bytes, eocd + 4);
  const centralDisk = u16(bytes, eocd + 6);
  const entryCount = u16(bytes, eocd + 10);
  const centralSize = u32(bytes, eocd + 12);
  const centralOffset = u32(bytes, eocd + 16);
  if (disk !== 0 || centralDisk !== 0) throw new Error("Multi-disk Office packages are not supported.");
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error("ZIP64 Office packages are not supported by the bounded inspector.");
  if (entryCount > limits.maxEntries || centralSize > limits.maxTotalUncompressedBytes || centralOffset + centralSize > bytes.length) throw new Error("The Office package exceeds bounded archive limits.");

  const entries: OfficePackageEntry[] = [];
  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== CENTRAL_SIGNATURE) throw new Error("The Office package has a malformed central directory.");
    const flags = u16(bytes, cursor + 8);
    const compressionMethod = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const uncompressedSize = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localHeaderOffset = u32(bytes, cursor + 42);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = new TextDecoder().decode(nameBytes);
    if (!safeEntryName(name)) throw new Error("The Office package contains an unsafe entry path.");
    if (flags & 0x1) throw new Error("Encrypted Office packages are not supported.");
    if (compressionMethod !== 0 && compressionMethod !== 8) throw new Error("The Office package uses an unsupported compression method.");
    if (compressedSize > limits.maxEntryCompressedBytes || uncompressedSize > limits.maxEntryUncompressedBytes) throw new Error("An Office package entry exceeds bounded decompression limits.");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxTotalUncompressedBytes) throw new Error("The Office package exceeds bounded decompression limits.");
    if (localHeaderOffset + 30 > bytes.length || u32(bytes, localHeaderOffset) !== LOCAL_SIGNATURE) throw new Error("The Office package has an invalid local file header.");
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset, isDirectory: name.endsWith("/") });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const entryMap = new Map(entries.map((entry) => [entry.name, entry]));
  const readText = (name: string, maxBytes = limits.maxXmlBytes): string | null => {
    const entry = entryMap.get(name);
    if (!entry || entry.isDirectory) return null;
    if (entry.uncompressedSize > maxBytes) throw new Error(`The Office XML part ${name} exceeds the bounded XML limit.`);
    const localNameLength = u16(bytes, entry.localHeaderOffset + 26);
    const localExtraLength = u16(bytes, entry.localHeaderOffset + 28);
    const dataStart = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataStart < 0 || dataEnd > bytes.length) throw new Error(`The Office package entry ${name} is truncated.`);
    const compressed = bytes.subarray(dataStart, dataEnd);
    const output = entry.compressionMethod === 0 ? compressed.slice() : inflateSync(compressed);
    if (output.length > maxBytes || output.length !== entry.uncompressedSize) throw new Error(`The Office package entry ${name} failed bounded decompression validation.`);
    return new TextDecoder("utf-8", { fatal: false }).decode(output);
  };

  return { entries, readText, has: (name: string) => entryMap.has(name) };
}
