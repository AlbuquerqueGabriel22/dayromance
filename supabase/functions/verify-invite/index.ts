import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, randomToken, sha256 } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phoneLastFour = typeof body.phoneLastFour === "string"
      ? body.phoneLastFour.replace(/\D/g, "")
      : "";
    if (name.length < 2 || name.length > 120 || phoneLastFour.length !== 4) {
      return jsonResponse({ error: "invalid_input" }, 400);
    }

    const supabase = createClient(
      configuredEnv("SUPABASE_URL"),
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || request.headers.get("cf-connecting-ip")
      || request.headers.get("x-real-ip");
    if (!clientIp) {
      return jsonResponse({ error: "verification_unavailable" }, 503);
    }

    const { data: canAttempt, error: rateLimitError } = await supabase.rpc(
      "allow_guest_lookup_attempt",
      { p_lookup_key: await sha256(`${clientIp}:${name.normalize("NFKC").toLowerCase()}`) },
    );
    if (rateLimitError) throw rateLimitError;
    if (!canAttempt) {
      return jsonResponse({ error: "too_many_attempts" }, 429);
    }

    const { data: matches, error } = await supabase
      .from("guests")
      .select("family_id, guest_families!inner(id, name, phone, rsvp_submitted_at, guests(id, name, is_child, age, confirmed))")
      .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
      .limit(100);

    if (error) throw error;
    if (!matches?.length) {
      return jsonResponse({ error: "invite_not_found" }, 404);
    }

    type InviteFamily = {
      id: string;
      name: string;
      phone: string;
      rsvp_submitted_at: string | null;
      guests: Array<{ id: string; name: string; is_child: boolean; age: number; confirmed: boolean | null }>;
    };
    const matchingFamilies = new Map<string, InviteFamily>();
    for (const match of matches) {
      const family = match.guest_families as InviteFamily;
      const phoneDigits = String(family.phone || "").replace(/\D/g, "");
      if (phoneDigits.length >= 4 && phoneDigits.slice(-4) === phoneLastFour) {
        matchingFamilies.set(family.id, family);
      }
    }
    if (matchingFamilies.size !== 1) {
      return jsonResponse({ error: "invite_not_found" }, 404);
    }
    const family = [...matchingFamilies.values()][0];
    if (!family) {
      return jsonResponse({ error: "invite_not_found" }, 404);
    }
    if (family.rsvp_submitted_at) {
      return jsonResponse({ error: "already_sent" }, 409);
    }

    const rawToken = randomToken();
    const { error: inviteError } = await supabase.from("guest_rsvp_invites").insert({
      family_id: family.id,
      token_hash: await sha256(rawToken),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (inviteError) throw inviteError;

    return jsonResponse({
      inviteToken: rawToken,
      family: {
        id: family.id,
        name: family.name,
        phone: family.phone,
        members: family.guests.map(guest => ({
          id: guest.id,
          name: guest.name,
          isChild: guest.is_child,
          age: guest.age,
          confirmed: guest.confirmed,
        })),
      },
    });
  } catch (error) {
    console.error("verify-invite failed", error);
    return jsonResponse({ error: "verification_unavailable" }, 500);
  }
});
