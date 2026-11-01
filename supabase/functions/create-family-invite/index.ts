import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, randomToken, sha256 } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "unauthorized" }, 401);

    const url = configuredEnv("SUPABASE_URL");
    const anonKey = configuredEnv("SUPABASE_ANON_KEY");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await request.json();
    const familyId = typeof body.familyId === "string" ? body.familyId : "";
    if (!familyId) return jsonResponse({ error: "invalid_input" }, 400);

    const { data: family, error: familyError } = await userClient
      .from("guest_families")
      .select("id")
      .eq("id", familyId)
      .maybeSingle();
    if (familyError) throw familyError;
    if (!family) return jsonResponse({ error: "family_not_found" }, 404);

    const token = randomToken();
    const serviceClient = createClient(
      url,
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { error: insertError } = await serviceClient
      .from("family_invite_links")
      .insert({ family_id: familyId, token_hash: await sha256(token) });
    if (insertError) throw insertError;

    const baseUrl = configuredEnv("APP_PUBLIC_URL").replace(/\/+$/, "");
    return jsonResponse({ inviteUrl: `${baseUrl}/convite/${encodeURIComponent(token)}` });
  } catch (error) {
    console.error("create-family-invite failed", error);
    return jsonResponse({ error: "invite_creation_unavailable" }, 500);
  }
});
