import { createWorker, type Worker } from "tesseract.js";
import {
  MAX_OCR_PAGE_BLOCKS,
  MAX_OCR_PAGE_LINES,
  MAX_OCR_PAGE_TEXT_CHARS,
  MAX_OCR_PAGE_WORDS,
  type OcrBlockResult,
  type OcrBoundingBox,
  type OcrConfidence,
  type OcrLanguage,
  type OcrPageInput,
  type OcrProvider,
  type OcrProviderPageOutput,
  type OcrProviderProgress,
  type OcrProviderSupport,
  type OcrLineResult,
  type OcrWordResult,
} from "../../domain/ocr/types";

const TESSERACT_VERSION = "7.0.0";
const TESSERACT_DATA_VERSION = "4.0.0_best_int";
const LOCAL_WORKER_PATH = "/ocr/tesseract/worker.min.js";
const LOCAL_CORE_PATH = "/ocr/tesseract";
const LOCAL_LANG_PATH = `/ocr/lang/${TESSERACT_DATA_VERSION}`;

interface TesseractBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: TesseractBox;
}

interface TesseractLine {
  text: string;
  confidence: number;
  bbox: TesseractBox;
  words: TesseractWord[];
}

interface TesseractParagraph {
  text: string;
  confidence: number;
  bbox: TesseractBox;
  lines: TesseractLine[];
}

interface TesseractBlock {
  text: string;
  confidence: number;
  bbox: TesseractBox;
  paragraphs: TesseractParagraph[];
}

interface TesseractData {
  text: string;
  confidence: number;
  blocks?: TesseractBlock[] | null;
}

function bounded(value: string, limit: number): string {
  return value.slice(0, limit);
}

function box(value: TesseractBox | null | undefined): OcrBoundingBox | null {
  if (!value || !Number.isFinite(value.x0) || !Number.isFinite(value.y0) || !Number.isFinite(value.x1) || !Number.isFinite(value.y1)) return null;
  return { left: Math.max(0, value.x0), top: Math.max(0, value.y0), width: Math.max(0, value.x1 - value.x0), height: Math.max(0, value.y1 - value.y0) };
}

function confidence(value: number | null | undefined): OcrConfidence {
  return Number.isFinite(value) ? { value: Math.max(0, Math.min(100, value as number)), metric: "engine-reported", note: "Tesseract engine confidence is a recognition signal, not a semantic accuracy guarantee." } : { value: null, metric: "not-reported", note: "The OCR engine did not report a confidence value." };
}

function mapWord(value: TesseractWord): OcrWordResult {
  return { text: bounded(value.text ?? "", 300), box: box(value.bbox), confidence: confidence(value.confidence) };
}

function mapLine(value: TesseractLine): OcrLineResult {
  return { text: bounded(value.text ?? "", 1_000), box: box(value.bbox), words: (value.words ?? []).slice(0, MAX_OCR_PAGE_WORDS).map(mapWord) };
}

function mapBlock(value: TesseractBlock): OcrBlockResult {
  const lines = (value.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? []).slice(0, MAX_OCR_PAGE_LINES).map(mapLine);
  return { text: bounded(value.text ?? "", 2_000), box: box(value.bbox), lines };
}

function providerProgress(message: string, pageNumber: number, phase: OcrProviderProgress["phase"], progress: number | null, onProgress?: (progress: OcrProviderProgress) => void): void {
  onProgress?.({ pageNumber, phase, progress, message });
}

export class TesseractOcrProvider implements OcrProvider {
  readonly id = `tesseract.js@${TESSERACT_VERSION}`;
  private worker: Worker | null = null;
  private language: OcrLanguage | null = null;
  private cancelled = false;

  async detectSupport(): Promise<OcrProviderSupport> {
    const available = typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
    return { providerId: this.id, available, supportedLanguages: ["eng"], workerSupported: typeof Worker !== "undefined", wasmSupported: typeof WebAssembly !== "undefined", offlineReady: true, message: available ? "Tesseract.js is available through same-origin worker, core, and English language resources." : "This browser does not expose the Worker and WebAssembly features required by local OCR." };
  }

  private async ensureWorker(language: OcrLanguage, onProgress?: (progress: OcrProviderProgress) => void, pageNumber = 1): Promise<Worker> {
    if (language !== "eng") throw new Error(`OCR language ${language} is not bundled in this Phase 5 build.`);
    if (this.worker && this.language === language) return this.worker;
    await this.terminate();
    this.cancelled = false;
    providerProgress("Initializing local OCR worker…", pageNumber, "initializing", 0, onProgress);
    const worker = await createWorker(language, 1, {
      workerPath: LOCAL_WORKER_PATH,
      corePath: LOCAL_CORE_PATH,
      langPath: LOCAL_LANG_PATH,
      cachePath: "smartdocs-ocr-v1",
      cacheMethod: "write",
      gzip: true,
      workerBlobURL: true,
      legacyCore: false,
      legacyLang: false,
      logger: (message: { status?: string; progress?: number }) => {
        const rawProgress = typeof message.progress === "number" && Number.isFinite(message.progress) ? Math.max(0, Math.min(1, message.progress)) : null;
        const phase = message.status?.includes("loading") || message.status?.includes("initial") ? "loading-language" : "recognizing";
        providerProgress(message.status ?? "Processing local OCR…", pageNumber, phase, rawProgress, onProgress);
      },
      errorHandler: (error: unknown) => {
        if (!this.cancelled) onProgress?.({ pageNumber, phase: "failed", progress: null, message: error instanceof Error ? error.message : "Local OCR worker failed." });
      },
    });
    this.worker = worker;
    this.language = language;
    return worker;
  }

  async recognizePage(input: OcrPageInput, options: { language: OcrLanguage; onProgress?: (progress: OcrProviderProgress) => void; signal?: AbortSignal }): Promise<OcrProviderPageOutput> {
    if (options.signal?.aborted) throw new DOMException("OCR cancelled.", "AbortError");
    this.cancelled = false;
    const worker = await this.ensureWorker(options.language, options.onProgress, input.pageNumber);
    if (options.signal?.aborted) throw new DOMException("OCR cancelled.", "AbortError");
    providerProgress(`Recognizing page ${input.pageNumber}…`, input.pageNumber, "recognizing", 0, options.onProgress);
    const result = await worker.recognize(input.image, {}, { text: true, blocks: true });
    if (options.signal?.aborted || this.cancelled) throw new DOMException("OCR cancelled.", "AbortError");
    const data = result.data as unknown as TesseractData;
    const blocks = (data.blocks ?? []).slice(0, MAX_OCR_PAGE_BLOCKS).map(mapBlock);
    const lines = blocks.flatMap((candidate) => candidate.lines).slice(0, MAX_OCR_PAGE_LINES);
    const words = lines.flatMap((candidate) => candidate.words).slice(0, MAX_OCR_PAGE_WORDS);
    const boundingBoxes = [...blocks.map((candidate) => candidate.box), ...lines.map((candidate) => candidate.box), ...words.map((candidate) => candidate.box)].filter((candidate): candidate is OcrBoundingBox => candidate !== null);
    providerProgress(`Recognized page ${input.pageNumber}.`, input.pageNumber, "complete", 1, options.onProgress);
    return { text: bounded(data.text ?? "", MAX_OCR_PAGE_TEXT_CHARS), blocks, lines, words, boundingBoxes, confidence: confidence(data.confidence), language: options.language };
  }

  async recognizeDocument(inputs: AsyncIterable<OcrPageInput>, options: { language: OcrLanguage; onProgress?: (progress: OcrProviderProgress) => void; signal?: AbortSignal }): Promise<OcrProviderPageOutput[]> {
    const results: OcrProviderPageOutput[] = [];
    for await (const input of inputs) {
      if (options.signal?.aborted) throw new DOMException("OCR cancelled.", "AbortError");
      results.push(await this.recognizePage(input, options));
    }
    return results;
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    await this.terminate();
  }

  async terminate(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    this.language = null;
    if (worker) await worker.terminate().catch(() => undefined);
  }
}

export const tesseractOcrProvider = new TesseractOcrProvider();

export const tesseractOcrAssets = { version: TESSERACT_VERSION, dataVersion: TESSERACT_DATA_VERSION, workerPath: LOCAL_WORKER_PATH, corePath: LOCAL_CORE_PATH, languagePath: LOCAL_LANG_PATH } as const;
