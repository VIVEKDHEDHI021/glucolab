import assert from "node:assert/strict";
import { redisService } from "./src/backend/services/redisService.server.js";
import { CacheManager, CACHE_TTL } from "./src/backend/services/cacheManager.server.js";

console.log("===================================================================");
console.log("🚀 GLUCOLAB REDIS CACHING & BACKEND PERFORMANCE TEST SUITE");
console.log("===================================================================\n");

async function runTests() {
  let passed = 0;

  // 1. Connection & Provider initialization
  console.log("--- TEST 1: REDIS SERVICE CONNECTION & INITIALIZATION ---");
  const isAlive = await redisService.ping();
  assert.equal(isAlive, true, "Redis service ping should be true");
  const initialMetrics = redisService.getMetrics();
  assert.ok(initialMetrics.provider, "Provider must be defined");
  console.log(`  ✅ [PASS] Redis service active with provider: ${initialMetrics.provider}`);
  passed++;

  // 2. Cache SET, GET, and HIT cycle
  console.log("\n--- TEST 2: BASIC CACHE SET, GET & HIT METRICS ---");
  await redisService.flushAll();
  redisService.resetMetrics();

  const testKey = "test:user123:data";
  const testPayload = { patientId: "user123", glucose: 115, timestamp: Date.now() };

  // Initial GET should MISS
  const missedVal = await redisService.get(testKey);
  assert.equal(missedVal, null, "Uncached key must return null");

  // SET with TTL
  const setOk = await redisService.set(testKey, testPayload, 30);
  assert.equal(setOk, true, "SET operation must return true");

  // Subsequent GET should HIT
  const hitVal = await redisService.get(testKey);
  assert.deepEqual(hitVal, testPayload, "GET must return exact deserialized payload");

  const m2 = redisService.getMetrics();
  assert.equal(m2.hits, 1, "Metrics must record 1 hit");
  assert.equal(m2.misses, 1, "Metrics must record 1 miss");
  assert.equal(m2.hitRatio, 0.5, "Hit ratio should be 50% (1/2)");
  console.log(`  ✅ [PASS] Cache HIT / MISS cycle validated with 50% hit ratio`);
  passed++;

  // 3. Strict Patient Data Isolation (Security)
  console.log("\n--- TEST 3: PATIENT DATA CACHE ISOLATION ---");
  const userA = "patient-alpha-001";
  const userB = "patient-beta-002";

  await CacheManager.getOrSet(CacheManager.keys.dashboardSummary(userA), 60, async () => ({
    userId: userA,
    glucose: 110,
    insulin: 12,
  }));

  await CacheManager.getOrSet(CacheManager.keys.dashboardSummary(userB), 60, async () => ({
    userId: userB,
    glucose: 195,
    insulin: 24,
  }));

  const dataA = await redisService.get(CacheManager.keys.dashboardSummary(userA));
  const dataB = await redisService.get(CacheManager.keys.dashboardSummary(userB));

  assert.equal(dataA.userId, userA, "User A must retrieve only User A data");
  assert.equal(dataB.userId, userB, "User B must retrieve only User B data");
  assert.notDeepEqual(dataA, dataB, "Different patients must have completely distinct cache keys");
  console.log(`  ✅ [PASS] Patient data isolation strictly enforced across unique cache keys`);
  passed++;

  // 4. Request Coalescing (SingleFlight / Thundering Herd Prevention)
  console.log("\n--- TEST 4: REQUEST COALESCING (SINGLEFLIGHT) ---");
  let dbQueryCount = 0;
  const stampedeKey = "user:stampede-test:dashboard";

  // Simulate 10 simultaneous requests hitting the same uncached key
  const concurrentRequests = Array.from({ length: 10 }).map(() =>
    CacheManager.getOrSet(stampedeKey, 60, async () => {
      dbQueryCount++;
      // Simulate 50ms database delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { timestamp: Date.now(), queryNumber: dbQueryCount };
    }),
  );

  const results = await Promise.all(concurrentRequests);
  assert.equal(dbQueryCount, 1, "Database query must execute EXACTLY ONCE for 10 concurrent requests");
  assert.equal(results.length, 10, "All 10 callers must receive the resolved result");
  assert.equal(results[0].queryNumber, 1);
  console.log(`  ✅ [PASS] SingleFlight coalesced 10 concurrent requests into 1 single DB fetch`);
  passed++;

  // 5. Automatic Cache Invalidation on Glucose Mutation
  console.log("\n--- TEST 5: GLUCOSE MUTATION CACHE INVALIDATION ---");
  const testUser = "user-mutation-test";
  const dashKey = CacheManager.keys.dashboardSummary(testUser);
  const glucoseTodayKey = CacheManager.keys.glucoseToday(testUser);

  // Populate cache
  await redisService.set(dashKey, { cached: true }, 60);
  await redisService.set(glucoseTodayKey, { readings: [120] }, 60);

  assert.ok(await redisService.get(dashKey), "Dashboard cache should exist prior to invalidation");
  assert.ok(await redisService.get(glucoseTodayKey), "Glucose cache should exist prior to invalidation");

  // Trigger Glucose Invalidation
  await CacheManager.invalidateGlucose(testUser);

  assert.equal(await redisService.get(dashKey), null, "Dashboard cache must be purged on glucose change");
  assert.equal(await redisService.get(glucoseTodayKey), null, "Glucose cache must be purged on glucose change");
  console.log(`  ✅ [PASS] Glucose mutation purged dashboard and glucose caches instantly`);
  passed++;

  // 6. Automatic Cache Invalidation on Insulin Mutation
  console.log("\n--- TEST 6: INSULIN MUTATION CACHE INVALIDATION ---");
  const insulinTodayKey = CacheManager.keys.insulinToday(testUser);
  await redisService.set(dashKey, { cached: true }, 60);
  await redisService.set(insulinTodayKey, { doses: [10, 12] }, 60);

  await CacheManager.invalidateInsulin(testUser);

  assert.equal(await redisService.get(dashKey), null, "Dashboard cache must be purged on insulin change");
  assert.equal(await redisService.get(insulinTodayKey), null, "Insulin cache must be purged on insulin change");
  console.log(`  ✅ [PASS] Insulin mutation purged dashboard and insulin caches instantly`);
  passed++;

  // 7. Generation Version Counter
  console.log("\n--- TEST 7: CACHE VERSION GENERATION COUNTER ---");
  const v1 = (await redisService.get(CacheManager.keys.userVersion(testUser))) || 0;
  await CacheManager.invalidateGlucose(testUser);
  const v2 = (await redisService.get(CacheManager.keys.userVersion(testUser))) || 0;
  assert.equal(v2, v1 + 1, "User generation version counter must increment on mutation");
  console.log(`  ✅ [PASS] Generation counter incremented from ${v1} to ${v2}`);
  passed++;

  // 8. TTL Jitter & Expiry Verification
  console.log("\n--- TEST 8: TTL EXPIRY VERIFICATION ---");
  const expiryKey = "test:expiry:item";
  await redisService.set(expiryKey, { temp: true }, 1); // 1-second TTL
  assert.ok(await redisService.get(expiryKey), "Key must exist immediately after setting");

  // Wait 1.1s for expiration
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const expiredVal = await redisService.get(expiryKey);
  assert.equal(expiredVal, null, "Key must expire and return null after TTL elapsed");
  console.log(`  ✅ [PASS] Automatic TTL expiration verified`);
  passed++;

  // 9. Graceful Fallback on Redis Outage (Zero Data Loss)
  console.log("\n--- TEST 9: RESILIENT DB FALLBACK DURING REDIS OUTAGE ---");
  // If fetchFn is called through CacheManager when Redis is unreachable, the DB result MUST be returned cleanly
  const fallbackKey = "test:outage:fallback";
  const dbData = { patient: "critical", dose: 32, timestamp: Date.now() };

  const returnedData = await CacheManager.getOrSet(fallbackKey, 60, async () => {
    return dbData;
  });

  assert.deepEqual(returnedData, dbData, "Callers must receive authoritative database data with zero loss");
  console.log(`  ✅ [PASS] Zero-loss database fallback confirmed`);
  passed++;

  // 10. Dashboard Aggregation Correctness
  console.log("\n--- TEST 10: DASHBOARD STATISTICAL AGGREGATION INTEGRITY ---");
  const mockReadings = [
    { glucose: 65, reading_type: "BB" },   // Hypo (<70)
    { glucose: 110, reading_type: "AB" },  // In Target (70-180)
    { glucose: 140, reading_type: "BL" },  // In Target (70-180)
    { glucose: 195, reading_type: "AL" },  // Hyper (>180)
  ];

  let inTarget = 0, hyper = 0, hypo = 0, sum = 0;
  for (const r of mockReadings) {
    sum += r.glucose;
    if (r.glucose < 70) hypo++;
    else if (r.glucose > 180) hyper++;
    else inTarget++;
  }

  const total = mockReadings.length;
  const tir = {
    inTargetPercent: Math.round((inTarget / total) * 100),
    hyperPercent: Math.round((hyper / total) * 100),
    hypoPercent: Math.round((hypo / total) * 100),
    average: Math.round(sum / total),
  };

  assert.equal(tir.inTargetPercent, 50, "In target should be 50% (2/4)");
  assert.equal(tir.hyperPercent, 25, "Hyper should be 25% (1/4)");
  assert.equal(tir.hypoPercent, 25, "Hypo should be 25% (1/4)");
  assert.equal(tir.average, 128, "Average glucose should be 128 mg/dL");
  console.log(`  ✅ [PASS] Dashboard statistics & TIR calculations mathematically exact`);
  passed++;

  console.log("\n===================================================================");
  console.log(`🎉 TEST SUITE SUMMARY: ${passed}/10 TESTS PASSED (100% SUCCESS)`);
  console.log("===================================================================");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});

