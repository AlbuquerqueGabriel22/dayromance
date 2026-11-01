import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, randomToken, sha256 } from "../_shared/http.ts";
import { sendGuestQrDocuments } from "../_shared/whatsapp.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const url = configuredEnv("SUPABASE_URL");
    const anonKey = configuredEnv("SUPABASE_ANON_KEY");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);
    const { data: adminMembership, error: membershipError } = await userClient
      .from("wedding_members")
      .select("user_id,wedding_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (membershipError || !adminMembership) return jsonResponse({ error: "forbidden" }, 403);

    const body = await request.json();
    const familyId = typeof body.familyId === "string" ? body.familyId : "";
    if (!familyId) return jsonResponse({ error: "invalid_input" }, 400);
    const { data: accessibleFamily, error: accessError } = await userClient
      .from("guest_families")
      .select("id")
      .eq("id", familyId)
      .eq("wedding_id", adminMembership.wedding_id)
      .maybeSingle();
    if (accessError) throw accessError;
    if (!accessibleFamily) return jsonResponse({ error: "family_not_found" }, 404);

    const supabase = createClient(
      url,
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: family, error: familyError } = await supabase
      .from("guest_families")
      .select("id, phone, rsvp_submitted_at, guests(id, name, confirmed)")
      .eq("id", familyId)
      .maybeSingle();
    if (familyError) throw familyError;
    if (!family || !family.rsvp_submitted_at) {
      return jsonResponse({ error: "rsvp_not_submitted" }, 409);
    }

    const confirmedGuests = (family.guests || []).filter((guest: { confirmed: boolean | null }) => guest.confirmed === true);
    const qrTokens: Record<string, string> = {};
    const rawTokens: Record<string, string> = {};
    for (const guest of confirmedGuests) {
      const token = randomToken();
      rawTokens[guest.id] = token;
      qrTokens[guest.id] = await sha256(token);
    }

    const { data: tokenGuests, error: tokenError } = await supabase.rpc("reissue_guest_qr_tokens", {
      p_family_id: familyId,
      p_qr_tokens: qrTokens,
    });
    if (tokenError) throw tokenError;

    const guestsWithTokens = (tokenGuests || []).map((guest: { id: string; name: string }) => ({
      ...guest,
      token: rawTokens[guest.id],
    }));
    let delivery: Array<{ guestId: string; sent: boolean }> = [];
    if (guestsWithTokens.length) {
      try {
        delivery = await sendGuestQrDocuments(family.phone || "", guestsWithTokens);
      } catch (error) {
        console.error("WhatsApp QR resend is not configured or failed", error);
        delivery = guestsWithTokens.map((guest: { id: string }) => ({ guestId: guest.id, sent: false }));
      }
    }

    return jsonResponse({
      status: "resent",
      confirmedCount: guestsWithTokens.length,
      delivery,
    });
  } catch (error) {
    console.error("resend-guest-qrs failed", error);
    return jsonResponse({ error: "resend_unavailable" }, 500);
  }
});
