import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, randomToken, sha256 } from "../_shared/http.ts";
import { sendGuestQrDocuments } from "../_shared/whatsapp.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const body = await request.json();
    const familyId = typeof body.familyId === "string" ? body.familyId : "";
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : "";
    const responses = body.responses;
    if (!familyId || !inviteToken || !responses || typeof responses !== "object" || Array.isArray(responses)) {
      return jsonResponse({ error: "invalid_input" }, 400);
    }

    const supabase = createClient(
      configuredEnv("SUPABASE_URL"),
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: family, error: familyError } = await supabase
      .from("guest_families")
      .select("id, phone")
      .eq("id", familyId)
      .maybeSingle();
    if (familyError) throw familyError;
    if (!family) return jsonResponse({ error: "invite_invalid" }, 404);

    const responseEntries = Object.entries(responses as Record<string, unknown>);
    if (!responseEntries.length || responseEntries.some(([, value]) => typeof value !== "boolean")) {
      return jsonResponse({ error: "invalid_responses" }, 400);
    }

    const qrTokens: Record<string, string> = {};
    const rawTokens: Record<string, string> = {};
    for (const [guestId, confirmed] of responseEntries) {
      if (confirmed === true) {
        const token = randomToken();
        rawTokens[guestId] = token;
        qrTokens[guestId] = await sha256(token);
      }
    }

    const { data: confirmedGuests, error: submitError } = await supabase.rpc("consume_guest_rsvp", {
      p_family_id: familyId,
      p_invite_hash: await sha256(inviteToken),
      p_responses: responses,
      p_qr_tokens: qrTokens,
    });
    if (submitError) {
      if (submitError.message.includes("rsvp_already_submitted")) {
        return jsonResponse({ error: "already_sent" }, 409);
      }
      if (submitError.message.includes("invite_invalid")) {
        return jsonResponse({ error: "invite_expired" }, 401);
      }
      if (submitError.message.includes("invalid_responses") || submitError.message.includes("invalid_qr_tokens")) {
        return jsonResponse({ error: "invalid_responses" }, 400);
      }
      throw submitError;
    }

    const guestsWithTokens = (confirmedGuests as Array<{ id: string; name: string }>).map(guest => ({
      ...guest,
      token: rawTokens[guest.id],
    }));

    let delivery: Array<{ guestId: string; sent: boolean }> = [];
    if (guestsWithTokens.length) {
      try {
        delivery = await sendGuestQrDocuments(family.phone || "", guestsWithTokens);
      } catch (error) {
        console.error("WhatsApp QR delivery is not configured or failed", error);
        delivery = guestsWithTokens.map(guest => ({ guestId: guest.id, sent: false }));
      }
    }

    return jsonResponse({
      status: "submitted",
      confirmedCount: guestsWithTokens.length,
      delivery,
    });
  } catch (error) {
    console.error("submit-rsvp failed", error);
    return jsonResponse({ error: "rsvp_unavailable" }, 500);
  }
});
