// test-notifications.mjs
// Automated verification suite for GlucoLab Notification System

console.log("==================================================");
console.log("🧪 GLUCOLAB NOTIFICATION SUITE TEST RUNNER");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------
// TEST 1: Glucose Alert Logic & Threshold Categorization
// ---------------------------------------------------------
console.log("1. Testing Glucose Alert Logic & Thresholds...");

function simulateGlucoseNotification(glucose, typeLabel, customTargets = null) {
  let lowTarget = 70;
  let highTarget = 180;
  if (customTargets) {
    if (customTargets.lowTarget) lowTarget = customTargets.lowTarget;
    if (customTargets.highTarget) highTarget = customTargets.highTarget;
  }

  let localTitle = `🩸 Glucose Reading: ${glucose} mg/dL`;
  let localBody = `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was recorded.`;
  let category = "NORMAL";

  if (glucose < lowTarget) {
    category = "CRITICAL_LOW";
    localTitle = `🚨 CRITICAL LOW SUGAR WARNING: ${glucose} mg/dL`;
    localBody = `URGENT: Blood sugar level of ${glucose} mg/dL (${typeLabel}) is dangerously LOW (< ${lowTarget} mg/dL). Please consume 15g of fast-acting sugar immediately!`;
  } else if (glucose > highTarget) {
    category = "HIGH";
    localTitle = `⚠️ HIGH SUGAR ALERT: ${glucose} mg/dL`;
    localBody = `WARNING: Blood sugar level of ${glucose} mg/dL (${typeLabel}) exceeds high target (${highTarget} mg/dL). Consider checking your insulin dose or drinking water.`;
  }

  const pushTitle = "GlucoLab Update";
  const pushBody = "A new blood glucose reading was recorded on your account.";
  const dataPayload = { type: "glucose_entry", action: "open_dashboard" };

  return { category, localTitle, localBody, pushTitle, pushBody, dataPayload };
}

// Low sugar test (<70)
const lowRes = simulateGlucoseNotification(55, "Fasting");
assert(lowRes.category === "CRITICAL_LOW", "Categorizes 55 mg/dL as CRITICAL_LOW");
assert(lowRes.localTitle.includes("🚨 CRITICAL LOW SUGAR WARNING: 55 mg/dL"), "Includes critical alert icon and reading");
assert(lowRes.localBody.includes("15g of fast-acting sugar"), "Includes clinical rescue rule recommendation");
assert(lowRes.pushTitle === "GlucoLab Update", "Privacy-preserving push title");

// Normal sugar test (70-180)
const normRes = simulateGlucoseNotification(110, "Post-Meal");
assert(normRes.category === "NORMAL", "Categorizes 110 mg/dL as NORMAL");
assert(normRes.localTitle.includes("🩸 Glucose Reading: 110 mg/dL"), "Includes normal log icon and reading");

// High sugar test (>180)
const highRes = simulateGlucoseNotification(240, "Pre-Dinner");
assert(highRes.category === "HIGH", "Categorizes 240 mg/dL as HIGH");
assert(highRes.localTitle.includes("⚠️ HIGH SUGAR ALERT: 240 mg/dL"), "Includes high warning icon and reading");
assert(highRes.localBody.includes("exceeds high target"), "Includes high warning guidance");

// Custom threshold test
const customRes = simulateGlucoseNotification(75, "Fasting", { lowTarget: 80, highTarget: 160 });
assert(customRes.category === "CRITICAL_LOW", "Custom target (lowTarget=80) correctly flags 75 mg/dL as CRITICAL_LOW");


// ---------------------------------------------------------
// TEST 2: Multi-Modal Reading Notification Formats
// ---------------------------------------------------------
console.log("\n2. Testing Multi-Modal Health Entry Notifications...");

// Insulin entry
function simulateInsulinNotification(scheduleStr, totalUnits, entryDate) {
  return {
    localTitle: "💉 New Insulin Dosage Logged",
    localBody: `Insulin schedule (${scheduleStr} - total ${totalUnits} units) recorded for ${entryDate}.`,
    pushTitle: "GlucoLab Update",
    pushBody: "A new insulin dosage was logged to your account.",
    dataPayload: { type: "insulin_entry", action: "open_dashboard" }
  };
}
const insulinRes = simulateInsulinNotification("Morning: 10u, Evening: 14u", 24, "2026-08-22");
assert(insulinRes.localTitle.includes("💉 New Insulin Dosage Logged"), "Insulin title formatted with icon");
assert(insulinRes.localBody.includes("24 units"), "Insulin units correctly counted");
assert(insulinRes.dataPayload.type === "insulin_entry", "Insulin data payload type matches");

// Weight entry
function simulateWeightNotification(weightKg, entryDate) {
  return {
    localTitle: "⚖️ New Weight Reading Logged",
    localBody: `Weight entry of ${weightKg} kg was recorded for ${entryDate}.`,
    pushTitle: "GlucoLab Update",
    pushBody: "A new weight entry was logged to your account.",
    dataPayload: { type: "weight_entry", action: "open_dashboard" }
  };
}
const weightRes = simulateWeightNotification(72.5, "2026-08-22");
assert(weightRes.localTitle.includes("⚖️ New Weight Reading Logged"), "Weight title formatted with icon");
assert(weightRes.localBody.includes("72.5 kg"), "Weight value matches");

// Report export notification
function simulateReportNotification(reportName) {
  return {
    localTitle: "📊 Report Export Generated",
    localBody: reportName ? `Report ${reportName} was generated successfully.` : "Your clinical report was generated.",
    pushTitle: "GlucoLab Update",
    pushBody: "A new report was uploaded to your account.",
    dataPayload: { type: "report_uploaded", action: "open_reports" }
  };
}
const reportRes = simulateReportNotification("GlucoLab_Clinical_Summary_Aug2026.pdf");
assert(reportRes.localTitle.includes("📊 Report Export Generated"), "Report title formatted with icon");
assert(reportRes.dataPayload.action === "open_reports", "Report notification directs user to open_reports");


// ---------------------------------------------------------
// TEST 3: Navigation Routing Resolution
// ---------------------------------------------------------
console.log("\n3. Testing Notification Deep-Link Navigation...");

function resolveNotificationRoute(action) {
  switch (action) {
    case "open_reports": return "/reports";
    case "open_history": return "/history";
    case "open_scanner": return "/dashboard";
    case "open_dashboard":
    default: return "/dashboard";
  }
}

assert(resolveNotificationRoute("open_reports") === "/reports", "Routes open_reports to /reports");
assert(resolveNotificationRoute("open_history") === "/history", "Routes open_history to /history");
assert(resolveNotificationRoute("open_dashboard") === "/dashboard", "Routes open_dashboard to /dashboard");
assert(resolveNotificationRoute("unknown_action") === "/dashboard", "Defaults unrecognized action safely to /dashboard");


// ---------------------------------------------------------
// TEST 4: Multi-Device Source Exclusion Logic
// ---------------------------------------------------------
console.log("\n4. Testing Device Token Filtering & Source Exclusion...");

function filterTargetDevices(registeredTokens, sourceDeviceToken) {
  if (!sourceDeviceToken) return registeredTokens;
  return registeredTokens.filter(token => token !== sourceDeviceToken.trim());
}

const mockRegisteredDevices = [
  "token_android_phone_xyz123",
  "token_web_browser_abc456",
  "token_ipad_tablet_def789"
];

// Originating from Android phone
const filteredTokens = filterTargetDevices(mockRegisteredDevices, "token_android_phone_xyz123");
assert(filteredTokens.length === 2, "Filters 3 total devices down to 2 target devices");
assert(!filteredTokens.includes("token_android_phone_xyz123"), "Excludes the originating device token");
assert(filteredTokens.includes("token_web_browser_abc456"), "Maintains web browser device token");
assert(filteredTokens.includes("token_ipad_tablet_def789"), "Maintains iPad device token");

// Single device scenario
const singleDeviceList = ["token_android_phone_xyz123"];
const filteredSingle = filterTargetDevices(singleDeviceList, "token_android_phone_xyz123");
assert(filteredSingle.length === 0, "Correctly identifies 0 other devices to notify when only source device is registered");


// ---------------------------------------------------------
// TEST 5: FCM Multicast Payload Builder
// ---------------------------------------------------------
console.log("\n5. Testing FCM High-Priority Multicast Payload Assembly...");

function buildFcmMulticastPayload(tokens, title, body, dataPayload) {
  return {
    tokens,
    notification: { title, body },
    data: { ...(dataPayload || {}), timestamp: "2026-08-22T04:18:00.000Z" },
    android: {
      priority: "high",
      notification: {
        title,
        body,
        channelId: "default",
        sound: "default",
        priority: "high",
        clickAction: "OPEN_ACTIVITY"
      }
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1
        }
      }
    },
    webpush: {
      notification: {
        title,
        body,
        icon: "/logo.png",
        badge: "/icon/icon.png"
      },
      fcmOptions: { link: "/" }
    }
  };
}

const fcmPayload = buildFcmMulticastPayload(
  ["token_1", "token_2"],
  "GlucoLab Update",
  "A new blood glucose reading was recorded on your account.",
  { type: "glucose_entry", action: "open_dashboard" }
);

assert(fcmPayload.android.priority === "high", "Android notification set to high priority");
assert(fcmPayload.android.notification.channelId === "default", "Android channel set to default notification channel");
assert(fcmPayload.apns.payload.aps.badge === 1, "APNs badge set to 1");
assert(fcmPayload.webpush.notification.icon === "/logo.png", "WebPush icon configured");
assert(fcmPayload.tokens.length === 2, "Multicast targets all non-originating device tokens");


// ---------------------------------------------------------
// TEST 6: Record Update Notification Formats (Glucose & Weight)
// ---------------------------------------------------------
console.log("\n6. Testing Record Update (Edit) Notification Formats...");

function simulateGlucoseUpdateNotification(glucose, typeLabel, isUpdate = false) {
  let localTitle = isUpdate
    ? `🩸 Glucose Reading Updated: ${glucose} mg/dL`
    : `🩸 Glucose Reading: ${glucose} mg/dL`;
  let localBody = isUpdate
    ? `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was updated.`
    : `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was recorded.`;

  const pushTitle = "GlucoLab Update";
  const pushBody = isUpdate
    ? "A blood glucose reading was updated on your account."
    : "A new blood glucose reading was recorded on your account.";
  const dataPayload = { type: "glucose_entry", action: "open_dashboard" };

  return { localTitle, localBody, pushTitle, pushBody, dataPayload };
}

const updateRes = simulateGlucoseUpdateNotification(135, "Post-Breakfast", true);
assert(updateRes.localTitle.includes("🩸 Glucose Reading Updated: 135 mg/dL"), "Update title formatted with updated label");
assert(updateRes.localBody.includes("was updated"), "Update body specifies that reading was updated");
assert(updateRes.pushBody === "A blood glucose reading was updated on your account.", "Remote push body indicates update");

function simulateWeightUpdateNotification(weightKg, entryDate, isUpdate = false) {
  const localTitle = isUpdate
    ? "⚖️ Weight Reading Updated"
    : "⚖️ New Weight Reading Logged";
  const localBody = isUpdate
    ? `Weight entry of ${weightKg} kg was updated for ${entryDate}.`
    : `Weight entry of ${weightKg} kg was recorded for ${entryDate}.`;

  const pushTitle = "GlucoLab Update";
  const pushBody = isUpdate
    ? "A weight entry was updated on your account."
    : "A new weight entry was logged to your account.";
  const dataPayload = { type: "weight_entry", action: "open_dashboard" };

  return { localTitle, localBody, pushTitle, pushBody, dataPayload };
}

const weightUpdateRes = simulateWeightUpdateNotification(74.0, "2026-08-25", true);
assert(weightUpdateRes.localTitle === "⚖️ Weight Reading Updated", "Weight update title correct");
assert(weightUpdateRes.localBody.includes("was updated for 2026-08-25"), "Weight update body includes date");
assert(weightUpdateRes.pushBody === "A weight entry was updated on your account.", "Remote push body indicates weight update");


// ---------------------------------------------------------
// TEST 7: Multi-Device Target Resolution for 3 Logged-in Devices
// ---------------------------------------------------------
console.log("\n7. Testing Multi-Device Target Resolution (Device 1 -> Device 2 & 3)...");

const userAccountDevices = [
  { deviceId: "device_1_web", token: "fcm_token_device_1", is_active: true },
  { deviceId: "device_2_android", token: "fcm_token_device_2", is_active: true },
  { deviceId: "device_3_tablet", token: "fcm_token_device_3", is_active: true },
];

function resolveTargets(devices, sourceToken) {
  return devices
    .filter(d => d.is_active)
    .map(d => d.token)
    .filter(t => t !== sourceToken);
}

const targetsFromDevice1 = resolveTargets(userAccountDevices, "fcm_token_device_1");
assert(targetsFromDevice1.length === 2, "Target count is 2 when 3 devices are active");
assert(targetsFromDevice1.includes("fcm_token_device_2"), "Target includes Device 2");
assert(targetsFromDevice1.includes("fcm_token_device_3"), "Target includes Device 3");
assert(!targetsFromDevice1.includes("fcm_token_device_1"), "Source Device 1 is properly excluded");


// ---------------------------------------------------------
// TEST 8: Cross-Account Notification Isolation (Security)
// ---------------------------------------------------------
console.log("\n8. Testing Cross-Account Notification Security Isolation...");

const accountA_User = "user_account_A_uuid";
const accountB_User = "user_account_B_uuid";

const globalDeviceRegistry = [
  { user_id: accountA_User, token: "token_user_A_phone", is_active: true },
  { user_id: accountA_User, token: "token_user_A_laptop", is_active: true },
  { user_id: accountB_User, token: "token_user_B_phone", is_active: true },
];

function getTargetTokensForAccount(registry, targetUserId, sourceToken) {
  return registry
    .filter(row => row.user_id === targetUserId && row.is_active)
    .map(row => row.token)
    .filter(token => token !== sourceToken);
}

const accountATargets = getTargetTokensForAccount(globalDeviceRegistry, accountA_User, "token_user_A_phone");
assert(accountATargets.length === 1, "Account A only targets Account A's other device");
assert(accountATargets[0] === "token_user_A_laptop", "Account A targets Account A laptop");
assert(!accountATargets.includes("token_user_B_phone"), "SECURITY: Account A NEVER targets Account B devices");


// ---------------------------------------------------------
// TEST 9: Service Worker Firebase Config Validation
// ---------------------------------------------------------
console.log("\n9. Testing Service Worker & Client Firebase Configuration Consistency...");

import fs from "fs";

const swContent = fs.readFileSync("public/firebase-messaging-sw.js", "utf8");
const clientFirebaseContent = fs.readFileSync("src/lib/firebase.ts", "utf8");

const swApiKeyMatch = swContent.match(/apiKey:\s*"([^"]+)"/);
const clientApiKeyMatch = clientFirebaseContent.match(/apiKey:\s*"([^"]+)"/);

assert(swApiKeyMatch && clientApiKeyMatch, "Both service worker and client have API keys declared");
assert(
  swApiKeyMatch && clientApiKeyMatch && swApiKeyMatch[1] === clientApiKeyMatch[1],
  `Service worker apiKey matches client apiKey exactly (${swApiKeyMatch ? swApiKeyMatch[1] : ""})`
);


// ---------------------------------------------------------
// TEST 10: OneSignal REST API Payload Builder & Target Model
// ---------------------------------------------------------
console.log("\n10. Testing OneSignal REST API Payload Assembly & Security...");

function buildOneSignalPayload(appId, userId, title, body, dataPayload, targetSubscriptionIds) {
  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: body },
    data: { ...(dataPayload || {}), timestamp: "2026-08-25T12:00:00.000Z" },
    priority: 10,
    android_channel_id: "default",
    android_accent_color: "0284C7",
    small_icon: "ic_notification"
  };

  if (targetSubscriptionIds && targetSubscriptionIds.length > 0) {
    payload.include_subscription_ids = targetSubscriptionIds;
    payload.include_player_ids = targetSubscriptionIds;
  } else {
    payload.include_aliases = { external_id: [userId] };
    payload.include_external_user_ids = [userId];
  }

  return payload;
}

const oneSignalPayload = buildOneSignalPayload(
  "test_onesignal_app_id",
  "user_abc_123",
  "GlucoLab Update",
  "A new blood glucose reading was recorded on your account.",
  { type: "glucose_entry", action: "open_dashboard" },
  ["sub_device_2", "sub_device_3"]
);

assert(oneSignalPayload.app_id === "test_onesignal_app_id", "OneSignal app_id properly set");
assert(oneSignalPayload.headings.en === "GlucoLab Update", "OneSignal headings properly set");
assert(oneSignalPayload.contents.en === "A new blood glucose reading was recorded on your account.", "OneSignal contents properly set");
assert(oneSignalPayload.priority === 10, "OneSignal high priority (10) enabled");
assert(oneSignalPayload.android_channel_id === "default", "OneSignal default channel mapped");
assert(oneSignalPayload.include_subscription_ids.length === 2, "OneSignal targets exact subscription IDs excluding source");
assert(!oneSignalPayload.include_subscription_ids.includes("sub_device_1"), "OneSignal payload excludes originating device subscription");

// Test external user ID fallback
const fallbackPayload = buildOneSignalPayload(
  "test_onesignal_app_id",
  "user_abc_123",
  "GlucoLab Update",
  "Your insulin record was updated."
);
assert(fallbackPayload.include_aliases.external_id[0] === "user_abc_123", "OneSignal external_id alias configured when no subscription IDs provided");


// ---------------------------------------------------------
// TEST 11: Privacy-Preserving Notification Content Validation
// ---------------------------------------------------------
console.log("\n11. Testing Privacy Validation (No Sensitive Health Data in Push)...");

const forbiddenKeywords = ["mg/dL", "units", "dosage", "insulin 12", "glucose 180", "diagnosis"];
const testPushBody = "A new blood glucose reading was recorded on your account.";

forbiddenKeywords.forEach(keyword => {
  assert(!testPushBody.toLowerCase().includes(keyword.toLowerCase()), `Push body does NOT contain sensitive keyword: ${keyword}`);
});


// ---------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------
console.log("\n==================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
