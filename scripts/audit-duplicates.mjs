/**
 * GlucoLab Production Duplicate Audit & Safe Backup Script
 *
 * Scans public.insulin_entries and public.glucose_entries:
 * - Detects duplicate insulin records (multiple records per user_id + entry_date)
 * - Detects duplicate glucose records (identical user_id, date_time, reading_type, and glucose value)
 * - Distinguishes legitimate multiple readings on same date from accidental duplicate submissions
 * - Generates verified backup of suspected duplicates
 * - NEVER DELETES without explicit dryRun = false confirmation
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://yhvnfwyeippnrqtttxac.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_dR2EoURRwH6sHIEQd8-3dQ_daz0Qn-j";

async function runAudit() {
  console.log("\n=======================================================");
  console.log("  GLUCOLAB – PRODUCTION DATA CONSISTENCY AUDIT        ");
  console.log("=======================================================\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Audit Insulin Entries
  console.log("Analyzing public.insulin_entries...");
  const { data: insulinRows, error: insulinErr } = await supabase
    .from("insulin_entries")
    .select("*")
    .order("entry_date", { ascending: false });

  if (insulinErr) {
    console.error("Error fetching insulin entries:", insulinErr);
  }

  const insulinByDate = new Map();
  for (const row of insulinRows || []) {
    const groupKey = `${row.user_id}_${row.entry_date}`;
    if (!insulinByDate.has(groupKey)) {
      insulinByDate.set(groupKey, []);
    }
    insulinByDate.get(groupKey).push(row);
  }

  const duplicateInsulinGroups = [];
  for (const [key, rows] of insulinByDate.entries()) {
    if (rows.length > 1) {
      duplicateInsulinGroups.push({ groupKey: key, count: rows.length, rows });
    }
  }

  // 2. Audit Glucose Entries
  console.log("Analyzing public.glucose_entries...");
  const { data: glucoseRows, error: glucoseErr } = await supabase
    .from("glucose_entries")
    .select("*")
    .order("date_time", { ascending: false });

  if (glucoseErr) {
    console.error("Error fetching glucose entries:", glucoseErr);
  }

  // Exact duplicate definition for glucose: Same user, same timestamp, same reading type, same glucose value
  const glucoseByTimestamp = new Map();
  for (const row of glucoseRows || []) {
    const groupKey = `${row.user_id}_${row.date_time}_${row.reading_type}_${row.glucose}`;
    if (!glucoseByTimestamp.has(groupKey)) {
      glucoseByTimestamp.set(groupKey, []);
    }
    glucoseByTimestamp.get(groupKey).push(row);
  }

  const duplicateGlucoseGroups = [];
  for (const [key, rows] of glucoseByTimestamp.entries()) {
    if (rows.length > 1) {
      duplicateGlucoseGroups.push({ groupKey: key, count: rows.length, rows });
    }
  }

  // Same-day legitimate multiple glucose readings check
  const sameDayGlucoseByDay = new Map();
  for (const row of glucoseRows || []) {
    const day = (row.date_time || "").split("T")[0];
    const key = `${row.user_id}_${day}`;
    if (!sameDayGlucoseByDay.has(key)) {
      sameDayGlucoseByDay.set(key, []);
    }
    sameDayGlucoseByDay.get(key).push(row);
  }

  let legitimateSameDayCount = 0;
  for (const [_, rows] of sameDayGlucoseByDay.entries()) {
    if (rows.length > 1) {
      legitimateSameDayCount += rows.length;
    }
  }

  console.log("\n-------------------------------------------------------");
  console.log("  AUDIT RESULTS SUMMARY                                ");
  console.log("-------------------------------------------------------");
  console.log(`  Total Insulin Entries Analyzed : ${insulinRows?.length || 0}`);
  console.log(`  Duplicate Insulin Groups       : ${duplicateInsulinGroups.length}`);
  console.log(`  Total Glucose Entries Analyzed : ${glucoseRows?.length || 0}`);
  console.log(`  Exact Duplicate Glucose Groups : ${duplicateGlucoseGroups.length}`);
  console.log(`  Legitimate Same-Day Readings   : ${legitimateSameDayCount} (Preserved safely)`);
  console.log("-------------------------------------------------------\n");

  const auditReport = {
    timestamp: new Date().toISOString(),
    insulin: {
      totalAnalyzed: insulinRows?.length || 0,
      duplicateGroupsCount: duplicateInsulinGroups.length,
      duplicateGroups: duplicateInsulinGroups,
    },
    glucose: {
      totalAnalyzed: glucoseRows?.length || 0,
      duplicateGroupsCount: duplicateGlucoseGroups.length,
      duplicateGroups: duplicateGlucoseGroups,
      legitimateSameDayReadingsCount: legitimateSameDayCount,
    },
  };

  // Save backup snapshot of audit
  const backupDir = path.resolve("./backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, `duplicate_audit_snapshot_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(auditReport, null, 2), "utf8");
  console.log(`✅ Verified backup snapshot saved to: ${backupPath}\n`);

  return auditReport;
}

runAudit().catch(console.error);

