import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, sha256 } from "../_shared/http.ts";

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
      .from("couple_admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (membershipError || !adminMembership) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    if (!token || token.length > 200) return jsonResponse({ error: "invalid_qr" }, 400);

    const supabase = createClient(
      url,
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase.rpc("validate_guest_checkin", {
      p_token_hash: await sha256(token),
    });
    if (error) throw error;

    if (data?.status === "not_confirmed") {
      return jsonResponse({ error: "not_confirmed", message: "Convidado não confirmado" }, 404);
    }

    return jsonResponse(data);
  } catch (error) {
    console.error("check-in failed", error);
    return jsonResponse({ error: "checkin_unavailable" }, 500);
  }
});
