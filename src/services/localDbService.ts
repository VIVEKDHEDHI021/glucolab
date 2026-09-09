import { Capacitor } from "@capacitor/core";

// We use dynamic imports for native Capacitor SQLite to avoid breaking Web builds
let sqliteConnection: any = null;
let database: any = null;

const isMobile = Capacitor.isNativePlatform();

export const localDbService = {
  // Initialize connection and tables on mobile
  async initDb() {
    if (!isMobile) return;

    try {
      console.log("[SQLITE] Initializing database...");
      const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
      
      sqliteConnection = new SQLiteConnection(CapacitorSQLite);
      
      // Check if connection already exists
      const isConn = await sqliteConnection.isConnection("glucolab_local", false);
      
      if (isConn.result) {
        database = await sqliteConnection.retrieveConnection("glucolab_local", false);
      } else {
        database = await sqliteConnection.createConnection(
          "glucolab_local",
          false,
          "no-encryption",
          1,
          false
        );
      }

      await database.open();
      console.log("[SQLITE] Database opened successfully.");

      // Run DDL scripts
      const tablesSchema = `
        CREATE TABLE IF NOT EXISTS glucose_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          glucose REAL,
          reading_type TEXT,
          notes TEXT,
          date_time TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE TABLE IF NOT EXISTS insulin_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          morning INTEGER,
          lunch INTEGER,
          afternoon INTEGER DEFAULT 0,
          evening INTEGER,
          night INTEGER,
          entry_date TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE TABLE IF NOT EXISTS weight_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          weight_kg REAL,
          notes TEXT,
          entry_date TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE TABLE IF NOT EXISTS profiles (
          user_id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE TABLE IF NOT EXISTS smart_scan_readings (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          device_type TEXT,
          reading_date TEXT,
          reading_time TEXT,
          confidence REAL,
          ocr_source TEXT,
          image_url TEXT,
          notes TEXT,
          data TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          category TEXT,
          title TEXT,
          description TEXT,
          is_enabled INTEGER DEFAULT 1,
          schedule_type TEXT,
          schedule_data TEXT,
          reminder_data TEXT,
          sound TEXT,
          vibrate INTEGER DEFAULT 1,
          sync_status TEXT DEFAULT 'synced',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS reminder_history (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          reminder_id TEXT,
          category TEXT,
          title TEXT,
          description TEXT,
          scheduled_time TEXT,
          status TEXT,
          action_taken TEXT,
          action_time TEXT,
          notes TEXT,
          sync_status TEXT DEFAULT 'synced',
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS patient_reminder_settings (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE,
          insulin_reminder_enabled INTEGER DEFAULT 0,
          insulin_reminder_time TEXT DEFAULT '20:00',
          glucose_reminder_enabled INTEGER DEFAULT 0,
          glucose_reminder_days INTEGER DEFAULT 2,
          last_insulin_reminder_at TEXT,
          last_glucose_reminder_at TEXT,
          user_timezone TEXT DEFAULT 'UTC',
          sync_status TEXT DEFAULT 'synced',
          created_at TEXT,
          updated_at TEXT
        );
      `;
      
      await database.execute(tablesSchema);
      console.log("[SQLITE] Database schema verified.");

      // Migration: Add afternoon column if not exists
      try {
        await database.execute("ALTER TABLE insulin_entries ADD COLUMN afternoon INTEGER DEFAULT 0");
        console.log("[SQLITE] Successfully added afternoon column to insulin_entries table.");
      } catch (e) {
        // Will fail if the column already exists, which is expected on subsequent runs
      }
    } catch (err) {
      console.error("[SQLITE] Failed to initialize local SQLite database:", err);
    }
  },

  // Generic write execution
  async runQuery(query: string, values: any[] = []) {
    if (!isMobile || !database) return null;
    try {
      return await database.run(query, values);
    } catch (err) {
      console.error(`[SQLITE] Run query failed: ${query}`, err);
      throw err;
    }
  },

  // Generic read query
  async selectQuery(query: string, values: any[] = []) {
    if (!isMobile || !database) return [];
    try {
      const res = await database.query(query, values);
      return res.values || [];
    } catch (err) {
      console.error(`[SQLITE] Select query failed: ${query}`, err);
      return [];
    }
  },

  // Cache glucose entries
  async cacheGlucose(entries: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO glucose_entries (id, user_id, glucose, reading_type, notes, date_time, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.user_id, entry.glucose, entry.reading_type, entry.notes, entry.date_time, entry.sync_status || "synced"]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching glucose:", err);
    }
  },

  // Get glucose entries
  async getGlucose(userId: string) {
    return this.selectQuery(
      `SELECT * FROM glucose_entries WHERE user_id = ? ORDER BY date_time DESC`,
      [userId]
    );
  },

  // Cache insulin entries
  async cacheInsulin(entries: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO insulin_entries (id, user_id, morning, lunch, afternoon, evening, night, entry_date, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.user_id, entry.morning, entry.lunch, entry.afternoon || 0, entry.evening, entry.night, entry.entry_date, entry.sync_status || "synced"]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching insulin:", err);
    }
  },

  // Get insulin entries
  async getInsulin(userId: string) {
    return this.selectQuery(
      `SELECT * FROM insulin_entries WHERE user_id = ? ORDER BY entry_date DESC`,
      [userId]
    );
  },

  // Cache weight entries
  async cacheWeight(entries: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO weight_entries (id, user_id, weight_kg, notes, entry_date, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.user_id, entry.weight_kg, entry.notes, entry.entry_date, entry.sync_status || "synced"]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching weight:", err);
    }
  },

  // Get weight entries
  async getWeight(userId: string) {
    return this.selectQuery(
      `SELECT * FROM weight_entries WHERE user_id = ? ORDER BY entry_date DESC`,
      [userId]
    );
  },

  // Cache profile
  async cacheProfile(userId: string, profile: any) {
    if (!isMobile || !database || !profile) return;
    try {
      await database.run(
        `INSERT OR REPLACE INTO profiles (user_id, name, phone, sync_status) VALUES (?, ?, ?, ?)`,
        [userId, profile.name || "", profile.phone || "", profile.sync_status || "synced"]
      );
    } catch (err) {
      console.error("[SQLITE] Error caching profile:", err);
    }
  },

  // Get profile
  async getProfile(userId: string) {
    const rows = await this.selectQuery(`SELECT * FROM profiles WHERE user_id = ?`, [userId]);
    return rows.length > 0 ? rows[0] : null;
  },

  // Cache smart scan readings
  async cacheScanReadings(readings: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const r of readings) {
        await database.run(
          `INSERT OR REPLACE INTO smart_scan_readings (id, user_id, device_type, reading_date, reading_time, confidence, ocr_source, image_url, notes, data, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.id,
            r.user_id,
            r.device_type,
            r.reading_date,
            r.reading_time,
            r.confidence,
            r.ocr_source,
            r.image_url || "",
            r.notes || "",
            typeof r.data === "string" ? r.data : JSON.stringify(r.data),
            r.sync_status || "synced",
          ]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching scan readings:", err);
    }
  },

  // Get smart scan readings
  async getScanReadings(userId: string) {
    const rows = await this.selectQuery(
      `SELECT * FROM smart_scan_readings WHERE user_id = ? ORDER BY reading_date DESC, reading_time DESC`,
      [userId]
    );
    return rows.map((r: any) => ({
      ...r,
      data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
    }));
  },

  // Cache reminders
  async cacheReminders(entries: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO reminders (id, user_id, category, title, description, is_enabled, schedule_type, schedule_data, reminder_data, sound, vibrate, sync_status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id,
            entry.user_id,
            entry.category,
            entry.title,
            entry.description || null,
            entry.is_enabled ? 1 : 0,
            entry.schedule_type,
            typeof entry.schedule_data === "string" ? entry.schedule_data : JSON.stringify(entry.schedule_data),
            typeof entry.reminder_data === "string" ? entry.reminder_data : JSON.stringify(entry.reminder_data),
            entry.sound || "default",
            entry.vibrate ? 1 : 0,
            entry.sync_status || "synced",
            entry.created_at,
            entry.updated_at
          ]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching reminders:", err);
    }
  },

  // Get reminders
  async getReminders(userId: string) {
    const rows = await this.selectQuery(
      `SELECT * FROM reminders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r: any) => ({
      ...r,
      is_enabled: r.is_enabled === 1,
      vibrate: r.vibrate === 1,
      schedule_data: typeof r.schedule_data === "string" ? JSON.parse(r.schedule_data) : r.schedule_data,
      reminder_data: typeof r.reminder_data === "string" ? JSON.parse(r.reminder_data) : r.reminder_data,
    }));
  },

  // Cache reminder history
  async cacheReminderHistory(entries: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO reminder_history (id, user_id, reminder_id, category, title, description, scheduled_time, status, action_taken, action_time, notes, sync_status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id,
            entry.user_id,
            entry.reminder_id || null,
            entry.category,
            entry.title,
            entry.description || null,
            entry.scheduled_time,
            entry.status,
            entry.action_taken || null,
            entry.action_time || null,
            entry.notes || null,
            entry.sync_status || "synced",
            entry.created_at,
            entry.updated_at
          ]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching reminder history:", err);
    }
  },

  // Get reminder history
  async getReminderHistory(userId: string) {
    const rows = await this.selectQuery(
      `SELECT * FROM reminder_history WHERE user_id = ? ORDER BY scheduled_time DESC`,
      [userId]
    );
    return rows.map((r: any) => ({
      ...r,
      action_taken: r.action_taken || null,
      action_time: r.action_time || null,
      notes: r.notes || null,
    }));
  },

  // Cache patient reminder settings
  async cacheReminderSettings(entries: any[]) {
    if (!isMobile || !database) return;
    try {
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO patient_reminder_settings (
            id, user_id, insulin_reminder_enabled, insulin_reminder_time,
            glucose_reminder_enabled, glucose_reminder_days,
            last_insulin_reminder_at, last_glucose_reminder_at,
            user_timezone, sync_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id,
            entry.user_id,
            entry.insulin_reminder_enabled ? 1 : 0,
            entry.insulin_reminder_time || "20:00",
            entry.glucose_reminder_enabled ? 1 : 0,
            entry.glucose_reminder_days || 2,
            entry.last_insulin_reminder_at || null,
            entry.last_glucose_reminder_at || null,
            entry.user_timezone || "UTC",
            entry.sync_status || "synced",
            entry.created_at,
            entry.updated_at
          ]
        );
      }
    } catch (err) {
      console.error("[SQLITE] Error caching patient reminder settings:", err);
    }
  },

  // Get patient reminder settings
  async getReminderSettings(userId: string) {
    const rows = await this.selectQuery(
      `SELECT * FROM patient_reminder_settings WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      ...r,
      insulin_reminder_enabled: r.insulin_reminder_enabled === 1,
      glucose_reminder_enabled: r.glucose_reminder_enabled === 1,
      last_insulin_reminder_at: r.last_insulin_reminder_at || null,
      last_glucose_reminder_at: r.last_glucose_reminder_at || null,
    };
  },

  // Fetch all pending sync rows across all tables
  async getPendingSyncRows() {
    const pendingGlucose = await this.selectQuery(`SELECT * FROM glucose_entries WHERE sync_status = 'pending_sync'`);
    const pendingInsulin = await this.selectQuery(`SELECT * FROM insulin_entries WHERE sync_status = 'pending_sync'`);
    const pendingWeight = await this.selectQuery(`SELECT * FROM weight_entries WHERE sync_status = 'pending_sync'`);
    const pendingProfile = await this.selectQuery(`SELECT * FROM profiles WHERE sync_status = 'pending_sync'`);
    const pendingScans = await this.selectQuery(`SELECT * FROM smart_scan_readings WHERE sync_status = 'pending_sync'`);
    const pendingReminders = await this.selectQuery(`SELECT * FROM reminders WHERE sync_status = 'pending_sync'`);
    const pendingHistory = await this.selectQuery(`SELECT * FROM reminder_history WHERE sync_status = 'pending_sync'`);
    const pendingReminderSettings = await this.selectQuery(`SELECT * FROM patient_reminder_settings WHERE sync_status = 'pending_sync'`);

    return {
      glucose: pendingGlucose,
      insulin: pendingInsulin,
      weight: pendingWeight,
      profile: pendingProfile,
      scans: pendingScans.map((r: any) => ({
        ...r,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
      })),
      reminders: pendingReminders.map((r: any) => ({
        ...r,
        is_enabled: r.is_enabled === 1,
        vibrate: r.vibrate === 1,
        schedule_data: typeof r.schedule_data === "string" ? JSON.parse(r.schedule_data) : r.schedule_data,
        reminder_data: typeof r.reminder_data === "string" ? JSON.parse(r.reminder_data) : r.reminder_data,
      })),
      history: pendingHistory,
      reminderSettings: pendingReminderSettings.map((r: any) => ({
        ...r,
        insulin_reminder_enabled: r.insulin_reminder_enabled === 1,
        glucose_reminder_enabled: r.glucose_reminder_enabled === 1,
      })),
    };
  },

  // Clear caches
  async clearAllCaches() {
    if (!isMobile || !database) return;
    try {
      await database.execute(`
        DELETE FROM glucose_entries;
        DELETE FROM insulin_entries;
        DELETE FROM weight_entries;
        DELETE FROM profiles;
        DELETE FROM smart_scan_readings;
        DELETE FROM reminders;
        DELETE FROM reminder_history;
        DELETE FROM patient_reminder_settings;
      `);
      console.log("[SQLITE] Local caches cleared.");
    } catch (err) {
      console.error("[SQLITE] Failed to clear local caches:", err);
    }
  }
};
