import assert from "node:assert";
import {
  exportService,
  EXPORT_MESSAGES,
  EXPORT_MIME_TYPES,
} from "./src/frontend/services/exportService.ts";

console.log("=======================================================");
console.log("📄 TESTING GLUCOLAB EXPORT SERVICE & DIRECT FILE OPENER");
console.log("=======================================================\n");

// 1. Message Simplification Requirements Verification
console.log("Test 1: Verify exact simplified messages match requirements...");
assert.strictEqual(EXPORT_MESSAGES.pdfSuccess, "Your PDF report is ready.");
assert.strictEqual(EXPORT_MESSAGES.xlsxSuccess, "Your Excel file is ready.");
assert.strictEqual(EXPORT_MESSAGES.exportFailed, "Unable to export your file. Please try again.");
assert.strictEqual(EXPORT_MESSAGES.fileOpening, "Opening your file...");
assert.strictEqual(EXPORT_MESSAGES.fileOpenedSuccess, "File opened successfully.");
assert.strictEqual(EXPORT_MESSAGES.noCompatibleApp, "No compatible app found to open this file.");
assert.strictEqual(
  EXPORT_MESSAGES.permissionDenied,
  "Unable to access storage. Please check your device permissions."
);
console.log("✅ [PASS] 1. All user-facing messages strictly adhere to design specs.\n");

// 2. MIME Types Verification
console.log("Test 2: Verify exact MIME types for PDF & Excel...");
assert.strictEqual(EXPORT_MIME_TYPES.pdf, "application/pdf");
assert.strictEqual(
  EXPORT_MIME_TYPES.xlsx,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
);
console.log("✅ [PASS] 2. MIME types for PDF and Excel (.xlsx) verified.\n");

// 3. Error Sanitization & Zero Internal Path Leaks
console.log("Test 3: Verify sanitizeErrorMessage prevents path leaks & maps errors...");

// 3a. Missing viewer / ActivityNotFound
const actNotFoundErr = new Error(
  "android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.intent.action.VIEW dat=content://com.vioraa.glucolab.file.opener.provider/external-files/GlucoLab/report.pdf typ=application/pdf }"
);
assert.strictEqual(
  exportService.sanitizeErrorMessage(actNotFoundErr),
  EXPORT_MESSAGES.noCompatibleApp,
  "ActivityNotFoundException must map to noCompatibleApp"
);

// 3b. Code 8 from Capacitor FileOpener
const code8Err = { code: "8", message: "Activity not found" };
assert.strictEqual(
  exportService.sanitizeErrorMessage(code8Err),
  EXPORT_MESSAGES.noCompatibleApp,
  "Code 8 must map to noCompatibleApp"
);

// 3c. Permission Denials
const permErr1 = new Error(
  "Permission Denial: opening provider requires android.permission.READ_EXTERNAL_STORAGE"
);
assert.strictEqual(
  exportService.sanitizeErrorMessage(permErr1),
  EXPORT_MESSAGES.permissionDenied,
  "Storage permission denial must map to permissionDenied"
);

// 3d. Absolute filesystem path leak protection
const rawPathError = new Error(
  "Failed to write file to /storage/emulated/0/Documents/GlucoLab/patient_2026-11-11.xlsx (EACCES)"
);
const sanitizedPathErr = exportService.sanitizeErrorMessage(rawPathError);
assert.ok(!sanitizedPathErr.includes("/storage/emulated/0"), "Must not leak /storage/emulated/0");
assert.ok(!sanitizedPathErr.includes("GlucoLab"), "Must not leak internal folder name");
assert.ok(!sanitizedPathErr.includes(".xlsx"), "Must not leak raw filename in error");
assert.strictEqual(sanitizedPathErr, EXPORT_MESSAGES.permissionDenied);

// 3e. Null, undefined, empty errors
assert.strictEqual(exportService.sanitizeErrorMessage(null), EXPORT_MESSAGES.exportFailed);
assert.strictEqual(exportService.sanitizeErrorMessage(undefined), EXPORT_MESSAGES.exportFailed);
assert.strictEqual(exportService.sanitizeErrorMessage(""), EXPORT_MESSAGES.exportFailed);
console.log("✅ [PASS] 3. Error sanitization verified: no paths leaked, native errors correctly translated.\n");

// 4. Web Export & File Record Lifecycle
console.log("Test 4: Verify saveExport creates valid records on web...");
const dummyBlob = new Blob(["dummy test content"], { type: "application/pdf" });
const record = await exportService.saveExport("doctor_report.pdf", "pdf", { blob: dummyBlob });

assert.strictEqual(record.fileName, "doctor_report.pdf");
assert.strictEqual(record.format, "pdf");
assert.strictEqual(record.mimeType, EXPORT_MIME_TYPES.pdf);
assert.ok(record.blobUrl && record.blobUrl.startsWith("blob:"), "Must generate valid blob URL on web");
assert.ok(typeof record.exportedAt === "number" && record.exportedAt > 0, "Must set exportedAt timestamp");
console.log("✅ [PASS] 4. saveExport generates structured ExportedFileRecord with blob URL.\n");

// 5. In-flight Debounce Protection
console.log("Test 5: Verify in-flight opening debounce protection...");
// Mock window.open to simulate browser opening
globalThis.window = globalThis.window || {};
globalThis.window.open = () => null;

const openPromise1 = exportService.openFile(record);
const openPromise2 = exportService.openFile(record);

const [res1, res2] = await Promise.all([openPromise1, openPromise2]);
// One completes successfully, concurrent call returns debounce/in-flight notice
assert.strictEqual(res1.success, true);
assert.strictEqual(res1.message, EXPORT_MESSAGES.fileOpenedSuccess);
assert.strictEqual(res2.success, false);
assert.strictEqual(res2.message, EXPORT_MESSAGES.fileOpening);
console.log("✅ [PASS] 5. Concurrent open requests safely debounced.\n");

console.log("=======================================================");
console.log("🎉 ALL EXPORT SERVICE TESTS PASSED SUCCESSFULLY!");
console.log("=======================================================");
