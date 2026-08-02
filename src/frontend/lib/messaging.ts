import { toast } from "sonner";

/**
 * Service to handle sending messages (SMS, etc.)
 * To use a real SMS service like Twilio, add your credentials to .env
 * and implement the fetch call here.
 */
export const messagingService = {
  async sendGlucoseAlert(
    phone: string,
    data: { glucose: number; type: string; date: string; notes?: string | null },
  ) {
    console.log(`[MESSAGING_SERVICE] Preparing alert for ${phone}...`);

    if (!phone) {
      console.warn("[MESSAGING_SERVICE] No phone number provided, skipping alert.");
      return;
    }

    let messageHeader = "🩸 GlucoLab Alert:";
    if (data.glucose < 70) {
      messageHeader = "🚨 CRITICAL LOW SUGAR WARNING:";
    } else if (data.glucose > 180) {
      messageHeader = "⚠️ HIGH SUGAR ALERT:";
    }

    const message = `${messageHeader} New reading ${data.glucose} mg/dL (${data.type}) at ${data.date}. ${data.notes ? "Notes: " + data.notes : ""}`;

    console.log(`[MESSAGING_SERVICE] MESSAGE CONTENT: "${message}"`);
    console.log(`[MESSAGING_SERVICE] TO: ${phone}`);

    if (data.glucose < 70) {
      toast.error("🚨 CRITICAL LOW SUGAR WARNING", {
        description: `Alert sent to ${phone}: ${data.glucose} mg/dL (${data.type}). Take 15g fast-acting sugar immediately!`,
        duration: 15000,
      });
    } else if (data.glucose > 180) {
      toast.warning("⚠️ HIGH SUGAR ALERT", {
        description: `Alert sent to ${phone}: ${data.glucose} mg/dL (${data.type}). Check your insulin or drink water.`,
        duration: 15000,
      });
    } else {
      toast.info("Reading Alert Recorded", {
        description: `Logged for ${phone}: ${data.glucose} mg/dL (${data.type})`,
      });
    }

    return true;
  },
};
