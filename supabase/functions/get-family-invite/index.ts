import { createClient } from "npm:@supabase/supabase-js@2";
import { configuredEnv, handleOptions, jsonResponse, sha256 } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    if (token.length < 32 || token.length > 100) {
      return jsonResponse({ error: "invite_not_found" }, 404);
    }

    const supabase = createClient(
      configuredEnv("SUPABASE_URL"),
      configuredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data: invitation, error: invitationError } = await supabase
      .from("family_invite_links")
      .select("family_id, guest_families!inner(id,name,phone,rsvp_submitted_at,wedding_id,guests(id,name,is_child,age,confirmed))")
      .eq("token_hash", await sha256(token))
      .maybeSingle();
    if (invitationError) throw invitationError;
    if (!invitation) return jsonResponse({ error: "invite_not_found" }, 404);

    const family = invitation.guest_families as {
      id: string;
      name: string;
      phone: string;
      rsvp_submitted_at: string | null;
      wedding_id: string;
      guests: Array<{ id: string; name: string; is_child: boolean; age: number; confirmed: boolean | null }>;
    };
    const { data: state, error: stateError } = await supabase
      .from("wedding_state")
      .select("couple_data,gifts,guest_messages")
      .eq("wedding_id", family.wedding_id)
      .maybeSingle();
    if (stateError) throw stateError;
    if (!state) return jsonResponse({ error: "invite_not_found" }, 404);

    const gifts = (Array.isArray(state.gifts) ? state.gifts : []).map((gift: Record<string, unknown>) => ({
      id: gift.id,
      title: gift.title,
      price: gift.price,
      image: gift.image,
      totalQuotas: gift.totalQuotas,
      giftedQuotas: gift.giftedQuotas || 0,
      reservedQuotas: gift.reservedQuotas || 0,
    }));

    return jsonResponse({
      coupleData: state.couple_data,
      gifts,
      guestMessages: state.guest_messages,
      family: {
        id: family.id,
        name: family.name,
        phone: family.phone,
        rsvpSubmittedAt: family.rsvp_submitted_at,
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
    console.error("get-family-invite failed", error);
    return jsonResponse({ error: "invite_unavailable" }, 500);
  }
});
