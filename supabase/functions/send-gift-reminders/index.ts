import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse } from "../_shared/http.ts";

type DueReminder = {
  reservation_id: string;
  days_before: 30 | 15;
  guest_name: string;
  whatsapp: string;
  gift_title: string;
};

async function sendReminder(reminder: DueReminder) {
  const response = await fetch(
    `https://graph.facebook.com/${configuredEnv("WHATSAPP_GRAPH_API_VERSION")}/${configuredEnv("WHATSAPP_PHONE_NUMBER_ID")}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuredEnv("WHATSAPP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: reminder.whatsapp,
        type: "template",
        template: {
          name: configuredEnv("WHATSAPP_REMINDER_TEMPLATE_NAME"),
          language: { code: Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: reminder.guest_name },
              { type: "text", text: reminder.gift_title },
              { type: "text", text: String(reminder.days_before) },
            ],
          }],
        },
      }),
    },
  );
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`WhatsApp API error (${response.status}): ${responseBody}`);
  }
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const expectedAuthorization = `Bearer ${configuredEnv("GIFT_REMINDER_CRON_SECRET")}`;
    if (request.headers.get("Authorization") !== expectedAuthorization) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(
      configuredEnv("SUPABASE_URL"),
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: reminders, error: claimError } = await supabase.rpc("claim_due_gift_reminders");
    if (claimError) throw claimError;

    let sent = 0;
    let failed = 0;
    for (const reminder of (reminders || []) as DueReminder[]) {
      try {
        await sendReminder(reminder);
        const { error } = await supabase.rpc("mark_gift_reminder_sent", {
          p_reservation_id: reminder.reservation_id,
          p_days_before: reminder.days_before,
        });
        if (error) throw error;
        sent += 1;
      } catch (error) {
        console.error(
          `Gift reminder delivery failed for reservation ${reminder.reservation_id} (${reminder.days_before} days before)`,
          error,
        );
        const { error: updateError } = await supabase.rpc("mark_gift_reminder_failed", {
          p_reservation_id: reminder.reservation_id,
          p_days_before: reminder.days_before,
          p_error: error instanceof Error ? error.message : String(error),
        });
        if (updateError) throw updateError;
        failed += 1;
      }
    }

    return jsonResponse({ processed: sent + failed, sent, failed });
  } catch (error) {
    console.error("send-gift-reminders failed", error);
    return jsonResponse({ error: "reminder_delivery_unavailable" }, 500);
  }
});
