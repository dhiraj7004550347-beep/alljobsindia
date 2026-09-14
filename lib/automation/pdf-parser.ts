import "server-only";

import { automationConfig } from "./config";

export type PdfTextResult = {
  text: string;
  pagesRead: number;
  totalPages: number;
  scannedLikely: boolean;
};

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
  const pages: string[] = [];

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
    if (text) pages.push(text);
    page.cleanup();
  }

  await loadingTask.destroy();
  const text = pages.join("\n").trim();
  return {
    text,
    pagesRead,
    totalPages,
    scannedLikely: text.length < Math.max(120, pagesRead * 30),
  };
}
