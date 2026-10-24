import "server-only";

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bundledEnglish from "@tesseract.js-data/eng";
import { automationConfig } from "./config";

export type PdfTextResult = {
  text: string;
  pagesRead: number;
  totalPages: number;
  scannedLikely: boolean;
  ocrPages: number;
  warnings: string[];
};

let ocrQueue: Promise<unknown> = Promise.resolve();

function withOcrLock<T>(task: () => Promise<T>): Promise<T> {
  const current = ocrQueue.then(task, task);
  ocrQueue = current.then(() => undefined, () => undefined);
  return current;
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  // pdfjs checks globalThis.pdfjsWorker before attempting its relative fake-
  // worker import. Load the worker module first so Turbopack never needs to
  // resolve "./pdf.worker.mjs" from a generated .next/server/chunks file.
  // Install real Node canvas globals before PDF.js evaluates.
  const { DOMMatrix, ImageData, Path2D } = await import("@napi-rs/canvas");
  for (const [name, value] of Object.entries({ DOMMatrix, ImageData, Path2D })) {
    if (!Reflect.get(globalThis, name)) {
      Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    }
  }
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    useWorkerFetch: false,
    stopAtErrors: false,
  });
  const document = await loadingTask.promise;

  const totalPages = document.numPages;
  const pagesRead = Math.min(totalPages, automationConfig.maxPdfPages);
  const pageEntries: Array<{ page: Awaited<ReturnType<typeof document.getPage>>; text: string }> = [];

  for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) =>
        typeof item === "object" && item && "str" in item
          ? String(item.str)
          : ""
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pageEntries.push({ page, text });
  }

  const textLayer = pageEntries.map((entry) => entry.text).filter(Boolean).join("\n").trim();
  const scannedLikely = textLayer.length < Math.max(120, pagesRead * 30);
  const warnings: string[] = [];
  let ocrPages = 0;
  let text = textLayer;

  if (scannedLikely && pagesRead > 0) {
    try {
      const ocrText = await withOcrLock(async () => {
        const { createCanvas } = await import("@napi-rs/canvas");
        const { createWorker } = await import("tesseract.js");
        const cachePath = join(tmpdir(), "alljobsindia-tesseract");
        await mkdir(cachePath, { recursive: true });
        const langPath = automationConfig.pdfOcrLangPath
          ? { langPath: automationConfig.pdfOcrLangPath }
          : automationConfig.pdfOcrLanguages === "eng"
            ? { langPath: bundledEnglish.langPath }
            : {};
        const worker = await createWorker(automationConfig.pdfOcrLanguages, 1, {
          ...langPath,
          cachePath,
          cacheMethod: "write",
        });
        const extracted: string[] = [];
        try {
          for (const { page } of pageEntries.slice(0, automationConfig.maxPdfOcrPages)) {
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(1.6, 2000 / Math.max(baseViewport.width, baseViewport.height));
            const viewport = page.getViewport({ scale });
            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const context = canvas.getContext("2d");
            await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
            const recognized = await worker.recognize(canvas.toBuffer("image/png"));
            const pageText = recognized.data.text.replace(/\s+/g, " ").trim();
            if (pageText) extracted.push(pageText);
            ocrPages++;
            canvas.width = 0;
            canvas.height = 0;
          }
        } finally {
          await worker.terminate();
        }
        return extracted.join("\n").trim();
      });
      if (ocrText) text = [textLayer, ocrText].filter(Boolean).join("\n").trim();
      if (ocrPages < totalPages) {
        warnings.push(`Scanned PDF OCR processed ${ocrPages} of ${totalPages} pages (configured limit: ${automationConfig.maxPdfOcrPages}).`);
      }
      if (!ocrText) warnings.push("Scanned PDF OCR completed but could not recognize usable text.");
    } catch (error) {
      warnings.push(`Scanned PDF OCR unavailable: ${error instanceof Error ? error.message : "recognition failed"}`);
    }
  }

  for (const { page } of pageEntries) page.cleanup();
  await loadingTask.destroy();
  return {
    text,
    pagesRead,
    totalPages,
    scannedLikely,
    ocrPages,
    warnings,
  };
}

