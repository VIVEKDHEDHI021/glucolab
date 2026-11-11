/**
 * GLUCOLAB PRO — EXPORT & FILE OPENER SERVICE
 * Handles document persistence (PDF & Excel), file existence verification,
 * native file opening via FileProvider / intent, and user-friendly messaging.
 */

import { Capacitor } from "@capacitor/core";

export type ExportFormat = "pdf" | "xlsx";

export type ExportState =
  | "idle"
  | "generating"
  | "saving"
  | "exported"
  | "opening"
  | "opened"
  | "error";

export interface ExportedFileRecord {
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  uri?: string;          // Native file:// URI
  relativePath?: string; // Relative path inside Directory.Documents, e.g. GlucoLab/report.pdf
  blobUrl?: string;      // Web Blob URL for in-browser opening/viewing
  exportedAt: number;
}

export const EXPORT_MIME_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export const EXPORT_MESSAGES = {
  pdfSuccess: "Your PDF report is ready.",
  xlsxSuccess: "Your Excel file is ready.",
  exportFailed: "Unable to export your file. Please try again.",
  fileOpening: "Opening your file...",
  fileOpenedSuccess: "File opened successfully.",
  noCompatibleApp: "No compatible app found to open this file.",
  permissionDenied: "Unable to access storage. Please check your device permissions.",
  exportCancelled: "Export cancelled.",
} as const;

class ExportService {
  private inFlightOpening = false;

  /**
   * Translates technical or native errors into simple, patient-friendly export messages.
   * Strips all internal filesystem paths (/storage/emulated/0, file:///, etc.).
   */
  public sanitizeErrorMessage(error: unknown): string {
    if (!error) return EXPORT_MESSAGES.exportFailed;

    const rawMsg =
      typeof error === "string"
        ? error
        : (error as any)?.message || (error as any)?.localizedMessage || "";
    const rawCode = (error as any)?.code?.toString() || "";
    const lower = rawMsg.toLowerCase();

    // 1. Missing application / ActivityNotFound
    if (
      rawCode === "8" ||
      lower.includes("activitynotfound") ||
      lower.includes("activity not found") ||
      lower.includes("no activity found") ||
      lower.includes("no app found") ||
      lower.includes("no application") ||
      lower.includes("no compatible app")
    ) {
      return EXPORT_MESSAGES.noCompatibleApp;
    }

    // 2. Storage / permission denials
    if (
      lower.includes("permission") ||
      lower.includes("access denied") ||
      lower.includes("storage")
    ) {
      return EXPORT_MESSAGES.permissionDenied;
    }

    // 3. User cancellations
    if (lower.includes("cancel") || lower.includes("abort")) {
      return EXPORT_MESSAGES.exportCancelled;
    }

    return EXPORT_MESSAGES.exportFailed;
  }

  /**
   * Saves generated export payload to appropriate storage (Documents on Native, Blob on Web).
   */
  public async saveExport(
    fileName: string,
    format: ExportFormat,
    payload: { base64Data?: string; blob?: Blob }
  ): Promise<ExportedFileRecord> {
    const mimeType = EXPORT_MIME_TYPES[format];

    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");

      // 1. Verify storage permissions
      try {
        const status = await Filesystem.checkPermissions();
        if (status.publicStorage !== "granted") {
          const req = await Filesystem.requestPermissions();
          if (req.publicStorage !== "granted") {
            throw new Error(EXPORT_MESSAGES.permissionDenied);
          }
        }
      } catch (permErr: any) {
        if (permErr?.message === EXPORT_MESSAGES.permissionDenied) throw permErr;
        // Non-blocking fallback for newer Android versions (Scoped Storage doesn't need publicStorage)
      }

      // 2. Ensure GlucoLab directory exists inside Documents
      const relativePath = `GlucoLab/${fileName}`;
      await Filesystem.mkdir({
        path: "GlucoLab",
        directory: Directory.Documents,
        recursive: true,
      }).catch(() => {
        // Directory may already exist, continue safely
      });

      // 3. Write file
      if (!payload.base64Data) {
        throw new Error(EXPORT_MESSAGES.exportFailed);
      }

      const writeResult = await Filesystem.writeFile({
        path: relativePath,
        data: payload.base64Data,
        directory: Directory.Documents,
      });

      // 4. Verify file was completely written and exists
      try {
        const stat = await Filesystem.stat({
          path: relativePath,
          directory: Directory.Documents,
        });
        if (stat.size === 0) {
          throw new Error("Written file is empty");
        }
      } catch (statErr) {
        console.error("[ExportService] Stat verification failed:", statErr);
        throw new Error(EXPORT_MESSAGES.exportFailed);
      }

      return {
        format,
        fileName,
        mimeType,
        uri: writeResult.uri,
        relativePath,
        exportedAt: Date.now(),
      };
    }

    // Web Platform
    let blobUrl = "";
    if (payload.blob) {
      blobUrl = URL.createObjectURL(payload.blob);
    } else if (payload.base64Data) {
      const byteChars = atob(payload.base64Data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      blobUrl = URL.createObjectURL(blob);
    }

    return {
      format,
      fileName,
      mimeType,
      blobUrl,
      exportedAt: Date.now(),
    };
  }

  /**
   * Directly opens the exported file in an external viewer or browser tab.
   */
  public async openFile(record: ExportedFileRecord): Promise<{ success: boolean; message: string }> {
    if (this.inFlightOpening) {
      return { success: false, message: EXPORT_MESSAGES.fileOpening };
    }
    this.inFlightOpening = true;

    try {
      // Yield to prevent race conditions and debounce simultaneous double-taps
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { FileOpener } = await import("@capacitor-community/file-opener");

        const targetPath = record.relativePath || `GlucoLab/${record.fileName}`;

        // 1. Verify existence before invoking native opener
        let fileUri = record.uri;
        try {
          const stat = await Filesystem.stat({
            path: targetPath,
            directory: Directory.Documents,
          });
          if (!stat || stat.size === 0) {
            throw new Error("File empty or missing");
          }
          if (!fileUri) {
            const uriResult = await Filesystem.getUri({
              path: targetPath,
              directory: Directory.Documents,
            });
            fileUri = uriResult.uri;
          }
        } catch (statErr) {
          console.error("[ExportService] Target file does not exist before opening:", statErr);
          throw new Error(EXPORT_MESSAGES.exportFailed);
        }

        // 2. Open via FileOpener plugin
        await FileOpener.open({
          filePath: fileUri || targetPath,
          contentType: record.mimeType,
          openWithDefault: true,
        });

        return { success: true, message: EXPORT_MESSAGES.fileOpenedSuccess };
      }

      // Web fallback
      if (record.blobUrl) {
        if (record.format === "pdf") {
          window.open(record.blobUrl, "_blank");
        } else {
          // Trigger download / view for Excel
          const a = document.createElement("a");
          a.href = record.blobUrl;
          a.download = record.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        return { success: true, message: EXPORT_MESSAGES.fileOpenedSuccess };
      }

      throw new Error(EXPORT_MESSAGES.exportFailed);
    } catch (err: any) {
      const sanitized = this.sanitizeErrorMessage(err);
      console.error("[ExportService] Error opening file:", err);
      throw new Error(sanitized);
    } finally {
      this.inFlightOpening = false;
    }
  }
}

export const exportService = new ExportService();
