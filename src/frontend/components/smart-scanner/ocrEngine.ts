import { createWorker } from "tesseract.js";
import { Capacitor } from "@capacitor/core";
import { preprocessCanvasForOcr } from "./imageFilters";
import { OcrBlock, OcrResult } from "./types";

let tesseractWorker: any = null;
let isInitializing = false;

// Initialize Tesseract Worker
export async function initOcrEngine(): Promise<void> {
  console.log("[OCR] Disabled to reduce load.");
  return;
}

// Terminate Tesseract Worker to free up memory
export async function terminateOcrEngine(): Promise<void> {
  if (tesseractWorker) {
    try {
      await tesseractWorker.terminate();
      tesseractWorker = null;
      console.log("[OCR] Tesseract.js worker terminated.");
    } catch (e) {
      console.error("[OCR] Error terminating worker:", e);
    }
  }
}

/**
 * Perform OCR on a canvas element.
 * If native Capacitor platform, it could delegate to native plugins if configured,
 * otherwise runs Tesseract.js locally inside a Web Worker.
 */
export async function performOcr(canvas: HTMLCanvasElement): Promise<OcrResult> {
  // Option 1: Native Capacitor OCR (e.g. Google ML Kit / Apple Vision)
  if (Capacitor.isNativePlatform()) {
    try {
      // Lazy load Capacitor plugins to avoid importing them on Web platforms
      const { Ocr } = await import("@capacitor-community/image-to-text");
      const { Filesystem, Directory } = await import("@capacitor/filesystem");

      // Get base64 representation of canvas
      const base64Data = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");
      const fileName = `ocr_temp_${Date.now()}.jpg`;

      // Write temp file to local disk (required for the detectText API)
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Run native OCR
      const nativeResult = await Ocr.detectText({
        filename: writeResult.uri,
      });

      // Clean up temp file asynchronously
      Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache,
      }).catch((err) => console.warn("[OCR] Temp file deletion failed:", err));

      const texts = nativeResult.textDetections.map((d: any) => d.text).join("\n");
      const blocks: OcrBlock[] = nativeResult.textDetections.map((d: any) => ({
        text: d.text,
        confidence: d.confidence || 80,
        x: d.boundingBox?.x || 0,
        y: d.boundingBox?.y || 0,
        width: d.boundingBox?.width || 0,
        height: d.boundingBox?.height || 0,
      }));

      return {
        text: texts,
        blocks,
        source: "Google ML Kit",
      };
    } catch (err) {
      console.warn(
        "[OCR] Native OCR failed or plugins not installed, falling back to Tesseract.js:",
        err,
      );
      // Fallback to Tesseract.js below
    }
  }

  // Option 2: Tesseract.js Web/Mobile Fallback
  // Create a copy of canvas and run binarization filter on it for better local OCR results
  const filterCanvas = document.createElement("canvas");
  filterCanvas.width = canvas.width;
  filterCanvas.height = canvas.height;
  const fCtx = filterCanvas.getContext("2d");
  if (fCtx) {
    fCtx.drawImage(canvas, 0, 0);
    preprocessCanvasForOcr(filterCanvas);
  }

  if (!tesseractWorker) {
    await initOcrEngine();
  }

  if (!tesseractWorker) {
    throw new Error("OCR engine is not ready.");
  }

  // Run recognition on binarized filterCanvas
  const { data } = await tesseractWorker.recognize(filterCanvas);
  const blocks: OcrBlock[] = (data.words || []).map((word: any) => ({
    text: word.text,
    confidence: word.confidence || 0,
    x: word.bbox?.x0 || 0,
    y: word.bbox?.y0 || 0,
    width: (word.bbox?.x1 || 0) - (word.bbox?.x0 || 0),
    height: (word.bbox?.y1 || 0) - (word.bbox?.y0 || 0),
  }));

  return {
    text: data.text || "",
    blocks,
    source: "Tesseract.js",
  };
}
