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
        CREATE TABLE IF NOT EXISTS food_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          food_categories TEXT,
          portion_category TEXT,
          meal_period TEXT,
          date_time TEXT,
          notes TEXT,
          is_uncertain INTEGER DEFAULT 0,
          glucose_entry_id TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        CREATE INDEX IF NOT EXISTS idx_local_glucose_user_date ON glucose_entries(user_id, date_time DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_local_insulin_user_entry_date ON insulin_entries(user_id, entry_date);
        CREATE INDEX IF NOT EXISTS idx_local_weight_user_date ON weight_entries(user_id, entry_date DESC);
        CREATE INDEX IF NOT EXISTS idx_local_food_user_date ON food_entries(user_id, date_time DESC);
      `;
      
      // Clean up any historical duplicate insulin rows before creating unique index (keep newest row per user/date)
      try {
        await database.execute(`
          DELETE FROM insulin_entries 
          WHERE rowid NOT IN (
            SELECT MAX(rowid) FROM insulin_entries GROUP BY user_id, entry_date
          );
        `);
      } catch (cleanErr) {
        console.warn("[SQLITE] Pre-index insulin duplicate cleanup notice:", cleanErr);
      }

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
  // Cache glucose entries (transaction-batched for ultra-fast native execution)
  async cacheGlucose(entries: any[]) {
    if (!isMobile || !database || !entries || entries.length === 0) return;
    try {
      await database.execute("BEGIN TRANSACTION;");
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO glucose_entries (id, user_id, glucose, reading_type, notes, date_time, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.user_id, entry.glucose, entry.reading_type, entry.notes, entry.date_time, entry.sync_status || "synced"]
        );
      }
      await database.execute("COMMIT;");
    } catch (err) {
      try { await database.execute("ROLLBACK;"); } catch {}
      console.error("[SQLITE] Error caching glucose:", err);
    }
  },

  // Get glucose entries
  async getGlucose(userId: string, limit?: number) {
    const limitClause = limit ? ` LIMIT ${Number(limit)}` : "";
    return this.selectQuery(
      `SELECT * FROM glucose_entries WHERE user_id = ? ORDER BY date_time DESC${limitClause}`,
      [userId]
    );
  },

  // Cache insulin entries (transaction-batched with strict uniqueness on user_id + entry_date)
  async cacheInsulin(entries: any[]) {
    if (!isMobile || !database || !entries || entries.length === 0) return;
    try {
      await database.execute("BEGIN TRANSACTION;");
      for (const entry of entries) {
        const entryId = entry.id || `${entry.user_id}_${entry.entry_date}`;
        await database.run(
          `INSERT INTO insulin_entries (id, user_id, morning, lunch, afternoon, evening, night, entry_date, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, entry_date) DO UPDATE SET
             morning = excluded.morning,
             lunch = excluded.lunch,
             afternoon = excluded.afternoon,
             evening = excluded.evening,
             night = excluded.night,
             sync_status = excluded.sync_status`,
          [
            entryId,
            entry.user_id,
            Math.round(Number(entry.morning) || 0),
            Math.round(Number(entry.lunch) || 0),
            Math.round(Number(entry.afternoon) || 0),
            Math.round(Number(entry.evening) || 0),
            Math.round(Number(entry.night) || 0),
            entry.entry_date,
            entry.sync_status || "synced",
          ]
        );
      }
      await database.execute("COMMIT;");
    } catch (err) {
      try { await database.execute("ROLLBACK;"); } catch {}
      console.error("[SQLITE] Error caching insulin:", err);
    }
  },

  // Get insulin entries
  async getInsulin(userId: string, limit?: number) {
    const limitClause = limit ? ` LIMIT ${Number(limit)}` : "";
    const rows = await this.selectQuery(
      `SELECT * FROM insulin_entries WHERE user_id = ? ORDER BY entry_date DESC${limitClause}`,
      [userId]
    );
    // Deduplicate by entry_date to guarantee clean single daily schedule
    const seenDates = new Set<string>();
    return rows.filter((r: any) => {
      const dateKey = r.entry_date?.split("T")[0];
      if (!dateKey || seenDates.has(dateKey)) return false;
      seenDates.add(dateKey);
      return true;
    });
  },

  // Cache weight entries (transaction-batched)
  async cacheWeight(entries: any[]) {
    if (!isMobile || !database || !entries || entries.length === 0) return;
    try {
      await database.execute("BEGIN TRANSACTION;");
      for (const entry of entries) {
        await database.run(
          `INSERT OR REPLACE INTO weight_entries (id, user_id, weight_kg, notes, entry_date, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.user_id, entry.weight_kg, entry.notes, entry.entry_date, entry.sync_status || "synced"]
        );
      }
      await database.execute("COMMIT;");
    } catch (err) {
      try { await database.execute("ROLLBACK;"); } catch {}
      console.error("[SQLITE] Error caching weight:", err);
    }
  },

  // Get weight entries
  async getWeight(userId: string, limit?: number) {
    const limitClause = limit ? ` LIMIT ${Number(limit)}` : "";
    return this.selectQuery(
      `SELECT * FROM weight_entries WHERE user_id = ? ORDER BY entry_date DESC${limitClause}`,
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

  // Cache smart scan readings (transaction-batched)
  async cacheScanReadings(readings: any[]) {
    if (!isMobile || !database || !readings || readings.length === 0) return;
    try {
      await database.execute("BEGIN TRANSACTION;");
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
      await database.execute("COMMIT;");
    } catch (err) {
      try { await database.execute("ROLLBACK;"); } catch {}
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

  // Cache food entries (transaction-batched)
  async cacheFood(entries: any[]) {
    if (!isMobile || !database || !entries || entries.length === 0) return;
    try {
      await database.execute("BEGIN TRANSACTION;");
      for (const f of entries) {
        const catStr = Array.isArray(f.food_categories)
          ? JSON.stringify(f.food_categories)
          : typeof f.food_categories === "string"
          ? f.food_categories
          : "[]";
        await database.run(
          `INSERT OR REPLACE INTO food_entries (id, user_id, food_categories, portion_category, meal_period, date_time, notes, is_uncertain, glucose_entry_id, sync_status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            f.id,
            f.user_id,
            catStr,
            f.portion_category || "unspecified",
            f.meal_period || "Other time",
            f.date_time,
            f.notes || "",
            f.is_uncertain ? 1 : 0,
            f.glucose_entry_id || null,
            f.sync_status || "synced",
          ]
        );
      }
      await database.execute("COMMIT;");
    } catch (err) {
      try { await database.execute("ROLLBACK;"); } catch {}
      console.error("[SQLITE] Error caching food:", err);
    }
  },

  // Get food entries
  async getFood(userId: string, limit?: number) {
    const limitClause = limit ? ` LIMIT ${Number(limit)}` : "";
    const rows = await this.selectQuery(
      `SELECT * FROM food_entries WHERE user_id = ? ORDER BY date_time DESC${limitClause}`,
      [userId]
    );
    return rows.map((r: any) => {
      let cats: string[] = [];
      try {
        cats = typeof r.food_categories === "string" ? JSON.parse(r.food_categories) : r.food_categories || [];
      } catch {
        cats = r.food_categories ? [r.food_categories] : [];
      }
      return {
        ...r,
        food_categories: cats,
        is_uncertain: Boolean(r.is_uncertain),
      };
    });
  },

  // Delete food entry
  async deleteFood(id: string) {
    return this.runQuery(`DELETE FROM food_entries WHERE id = ?`, [id]);
  },

  // Fetch all pending sync rows across all health tables
  async getPendingSyncRows() {
    const pendingGlucose = await this.selectQuery(`SELECT * FROM glucose_entries WHERE sync_status = 'pending_sync'`);
    const pendingInsulin = await this.selectQuery(`SELECT * FROM insulin_entries WHERE sync_status = 'pending_sync'`);
    const pendingWeight = await this.selectQuery(`SELECT * FROM weight_entries WHERE sync_status = 'pending_sync'`);
    const pendingFood = await this.selectQuery(`SELECT * FROM food_entries WHERE sync_status = 'pending_sync'`);
    const pendingProfile = await this.selectQuery(`SELECT * FROM profiles WHERE sync_status = 'pending_sync'`);
    const pendingScans = await this.selectQuery(`SELECT * FROM smart_scan_readings WHERE sync_status = 'pending_sync'`);

    return {
      glucose: pendingGlucose,
      insulin: pendingInsulin,
      weight: pendingWeight,
      food: pendingFood.map((f: any) => {
        let cats: string[] = [];
        try {
          cats = typeof f.food_categories === "string" ? JSON.parse(f.food_categories) : f.food_categories || [];
        } catch {
          cats = f.food_categories ? [f.food_categories] : [];
        }
        return {
          ...f,
          food_categories: cats,
          is_uncertain: Boolean(f.is_uncertain),
        };
      }),
      profile: pendingProfile,
      scans: pendingScans.map((r: any) => ({
        ...r,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
      })),
    };
  },

  // Clear user-specific cache on logout or user switch
  async clearUserCache(userId: string) {
    if (!isMobile || !database || !userId) return;
    try {
      await database.execute("BEGIN TRANSACTION;");
      await database.run("DELETE FROM glucose_entries WHERE user_id = ?", [userId]);
      await database.run("DELETE FROM insulin_entries WHERE user_id = ?", [userId]);
      await database.run("DELETE FROM weight_entries WHERE user_id = ?", [userId]);
      await database.run("DELETE FROM food_entries WHERE user_id = ?", [userId]);
      await database.run("DELETE FROM profiles WHERE user_id = ?", [userId]);
      await database.run("DELETE FROM smart_scan_readings WHERE user_id = ?", [userId]);
      await database.execute("COMMIT;");
      console.log(`[SQLITE] User cache cleared for: ${userId}`);
    } catch (err) {
      try { await database.execute("ROLLBACK;"); } catch {}
      console.error("[SQLITE] Failed to clear user cache:", err);
    }
  },

  // Clear all local caches
  async clearAllCaches() {
    if (!isMobile || !database) return;
    try {
      await database.execute(`
        DELETE FROM glucose_entries;
        DELETE FROM insulin_entries;
        DELETE FROM weight_entries;
        DELETE FROM food_entries;
        DELETE FROM profiles;
        DELETE FROM smart_scan_readings;
      `);
      console.log("[SQLITE] Local caches cleared.");
    } catch (err) {
      console.error("[SQLITE] Failed to clear local caches:", err);
    }
  }
};
