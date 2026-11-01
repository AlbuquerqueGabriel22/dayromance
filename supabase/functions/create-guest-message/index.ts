import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, sha256 } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const body = await request.json();
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (inviteToken.length < 32 || inviteToken.length > 100 || name.length < 1 || name.length > 80 || text.length < 1 || text.length > 1000) {
      return jsonResponse({ error: "invalid_input" }, 400);
    }

    const clientIp = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0].trim();
    if (!clientIp) return jsonResponse({ error: "message_unavailable" }, 503);

    const supabase = createClient(
      configuredEnv("SUPABASE_URL"),
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: canAttempt, error: rateLimitError } = await supabase.rpc(
      "allow_guest_lookup_attempt",
      { p_lookup_key: await sha256(`guest-message:${clientIp}`) },
    );
    if (rateLimitError) throw rateLimitError;
    if (!canAttempt) return jsonResponse({ error: "too_many_attempts" }, 429);

    const { data: invitation, error: invitationError } = await supabase
      .from("family_invite_links")
      .select("guest_families!inner(wedding_id)")
      .eq("token_hash", await sha256(inviteToken))
      .maybeSingle();
    if (invitationError) throw invitationError;
    if (!invitation) return jsonResponse({ error: "invite_not_found" }, 404);
    const family = invitation.guest_families as { wedding_id: string };

    const { error } = await supabase.rpc("append_guest_message", {
      p_wedding_id: family.wedding_id,
      p_message: {
        id: crypto.randomUUID(),
        name,
        text,
        date: new Date().toLocaleDateString("pt-BR"),
      },
    });
    if (error) throw error;

    return jsonResponse({ status: "published" });
  } catch (error) {
    console.error("create-guest-message failed", error);
    return jsonResponse({ error: "message_unavailable" }, 500);
  }
});
