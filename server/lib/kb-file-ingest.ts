import { createHash } from "crypto";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

const MAX_UPLOAD_BYTES = Number.parseInt(process.env.KB_FILE_UPLOAD_MAX_BYTES || "10485760", 10); // 10MB
const MAX_EXTRACTED_TEXT_CHARS = Number.parseInt(process.env.KB_FILE_EXTRACT_MAX_CHARS || "200000", 10); // 200k chars

type SupportedFileKind =
  | "txt"
  | "md"
  | "csv"
  | "json"
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "doc";

export type ParsedKnowledgeFile = {
  detectedKind: SupportedFileKind;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
};

const TEXT_KINDS = new Set<SupportedFileKind>(["txt", "md", "csv", "json"]);

function getExtension(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

function detectKind(fileName: string, mimeType?: string | null): SupportedFileKind | null {
  const ext = getExtension(fileName);
  if (ext === "txt") return "txt";
  if (ext === "md") return "md";
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "pptx") return "pptx";
  if (ext === "doc") return "doc";

  const type = String(mimeType || "").toLowerCase();
  if (type.includes("pdf")) return "pdf";
  if (type.includes("wordprocessingml")) return "docx";
  if (type.includes("spreadsheetml")) return "xlsx";
  if (type.includes("presentationml")) return "pptx";
  if (type.includes("msword")) return "doc";
  if (type.startsWith("text/")) return "txt";

  return null;
}

function sanitizeTitleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  return withoutExt.trim() || "Uploaded Document";
}

function normalizeExtractedText(value: string): string {
  let text = value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > MAX_EXTRACTED_TEXT_CHARS) {
    text = `${text.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n\n[Content truncated due to extraction limit]`;
  }
  return text;
}

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      try {
        return String.fromCodePoint(Number.parseInt(dec, 10));
      } catch {
        return "";
      }
    });
}

function stripXmlTagsPreserveNewlines(xml: string): string {
  return xml
    .replace(/<a:p[\s>]/g, "\n<a:p ")
    .replace(/<w:p[\s>]/g, "\n<w:p ")
    .replace(/<[^>]+>/g, " ");
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const an = Number.parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      const bn = Number.parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      return an - bn;
    });

  const slides: string[] = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async("text");
    const textRuns = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => xmlDecode(m[1]));
    let text = textRuns.join("\n");
    if (!text.trim()) {
      text = xmlDecode(stripXmlTagsPreserveNewlines(xml));
    }
    const slideNo = path.match(/slide(\d+)\.xml/i)?.[1] || "?";
    slides.push(`## Slide ${slideNo}\n${text.trim()}`);
  }
  return slides.join("\n\n").trim();
}

function extractXlsxText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    sections.push(`## Sheet: ${sheetName}\n${csv || "[Empty sheet]"}`);
  }
  return sections.join("\n\n").trim();
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function extractTextLikeFile(buffer: Buffer): string {
  return buffer.toString("utf8");
}

export function getSupportedKnowledgeUploadExtensions(): string[] {
  return [".txt", ".md", ".csv", ".json", ".pdf", ".docx", ".xlsx", ".pptx", ".doc"];
}

export function getKnowledgeUploadMaxBytes(): number {
  return Number.isFinite(MAX_UPLOAD_BYTES) && MAX_UPLOAD_BYTES > 0 ? MAX_UPLOAD_BYTES : 10 * 1024 * 1024;
}

export async function parseKnowledgeUploadFile(params: {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  buffer: Buffer;
  titleOverride?: string | null;
}): Promise<ParsedKnowledgeFile> {
  const { fileName, mimeType, sizeBytes, buffer, titleOverride } = params;
  if (!fileName || !buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Missing uploaded file");
  }
  const maxBytes = getKnowledgeUploadMaxBytes();
  if (sizeBytes <= 0) throw new Error("Uploaded file is empty");
  if (sizeBytes > maxBytes) {
    throw new Error(`File exceeds upload limit (${Math.ceil(maxBytes / (1024 * 1024))}MB)`);
  }

  const kind = detectKind(fileName, mimeType);
  if (!kind) {
    throw new Error("Unsupported file type. Supported formats: .txt, .md, .csv, .json, .pdf, .docx, .xlsx, .pptx");
  }
  if (kind === "doc") {
    throw new Error("Legacy .doc files are not supported yet. Please convert to .docx and upload again.");
  }

  let extracted = "";
  if (TEXT_KINDS.has(kind)) {
    extracted = extractTextLikeFile(buffer);
  } else if (kind === "pdf") {
    extracted = await extractPdfText(buffer);
  } else if (kind === "docx") {
    extracted = await extractDocxText(buffer);
  } else if (kind === "xlsx") {
    extracted = extractXlsxText(buffer);
  } else if (kind === "pptx") {
    extracted = await extractPptxText(buffer);
  }

  const normalized = normalizeExtractedText(extracted);
  if (!normalized || normalized.length < 5) {
    throw new Error("Could not extract readable text from this file");
  }

  const title = (titleOverride || "").trim() || sanitizeTitleFromFileName(fileName);
  return {
    detectedKind: kind,
    title,
    content: normalized,
    metadata: {
      sourceType: "file_upload",
      originalFileName: fileName,
      mimeType: mimeType || null,
      detectedFormat: kind,
      sizeBytes,
      contentHash: createHash("sha256").update(buffer).digest("hex"),
      extractedAt: new Date().toISOString(),
      parserVersion: "kb-file-upload-v1",
    },
  };
}
