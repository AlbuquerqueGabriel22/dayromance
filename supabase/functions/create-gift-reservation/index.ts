import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, sha256 } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";
    const giftTitle = typeof body.giftTitle === "string" ? body.giftTitle.trim() : "";
    const giftId = typeof body.giftId === "string" ? body.giftId : "";
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : "";
    const eventDate = typeof body.eventDate === "string" ? body.eventDate : "";
    const quotas = Number(body.quotas);
    const whatsappInput = typeof body.whatsapp === "string" ? body.whatsapp : "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const parsedDate = datePattern.test(eventDate) ? new Date(`${eventDate}T00:00:00.000Z`) : null;
    const rawPhoneDigits = whatsappInput.replace(/\D/g, "");
    let whatsapp = rawPhoneDigits;
    if (whatsappInput.trim().startsWith("00")) whatsapp = rawPhoneDigits.slice(2);
    if (!whatsappInput.trim().startsWith("+") && !whatsapp.startsWith("55")) {
      whatsapp = `55${whatsapp.replace(/^0/, "")}`;
    }

    if (
      !uuidPattern.test(id)
      || !giftId
      || inviteToken.length < 32
      || guestName.length < 2
      || guestName.length > 120
      || giftTitle.length < 1
      || giftTitle.length > 160
      || !Number.isInteger(quotas)
      || quotas < 1
      || quotas > 100
      || !parsedDate
      || parsedDate.toISOString().slice(0, 10) !== eventDate
      || !/^[0-9]{10,15}$/.test(whatsapp)
    ) {
      return jsonResponse({ error: "invalid_input" }, 400);
    }

    const clientIp = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0].trim();
    if (!clientIp) {
      return jsonResponse({ error: "reservation_unavailable" }, 503);
    }

    const supabase = createClient(
      configuredEnv("SUPABASE_URL"),
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: invitation, error: inviteError } = await supabase
      .from("family_invite_links")
      .select("guest_families!inner(wedding_id)")
      .eq("token_hash", await sha256(inviteToken))
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invitation) return jsonResponse({ error: "invite_not_found" }, 404);
    const family = invitation.guest_families as { wedding_id: string };

    const { data: canAttempt, error: rateLimitError } = await supabase.rpc(
      "allow_guest_lookup_attempt",
      { p_lookup_key: await sha256(`gift-reservation:${clientIp}`) },
    );
    if (rateLimitError) throw rateLimitError;
    if (!canAttempt) return jsonResponse({ error: "too_many_attempts" }, 429);

    const { error } = await supabase.rpc("create_gift_reservation", {
      p_id: id,
      p_gift_id: giftId,
      p_guest_name: guestName,
      p_whatsapp: whatsapp,
      p_gift_title: giftTitle,
      p_quotas: quotas,
      p_event_date: eventDate,
      p_wedding_id: family.wedding_id,
    });
    if (error?.message.includes("gift_reminders_not_enabled")) {
      return jsonResponse({ error: "reminders_not_configured" }, 503);
    }
    if (error?.message.includes("gift_event_date_not_future")) {
      return jsonResponse({ error: "event_date_passed" }, 400);
    }
    if (error?.message.includes("gift_reservation_id_conflict")) {
      return jsonResponse({ error: "reservation_conflict" }, 409);
    }
    if (error?.message.includes("gift_not_found") || error?.message.includes("gift_no_quotas_available")) {
      return jsonResponse({ error: "gift_no_quotas_available" }, 409);
    }
    if (error) throw error;

    return jsonResponse({ status: "registered", reservationId: id });
  } catch (error) {
    console.error("create-gift-reservation failed", error);
    return jsonResponse({ error: "reservation_unavailable" }, 500);
  }
});
