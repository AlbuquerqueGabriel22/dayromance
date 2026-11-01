const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const sessionKey = 'dayromance-supabase-session';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function getStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  } catch {
    return null;
  }
}

function storeSession(session) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(sessionKey);
}

async function authRequest(path, body) {
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.msg || result.message || 'Falha na autenticação.');
  return result;
}

async function restRequest(path, { method = 'GET', body, accessToken, headers = {} } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function signInAdmin(email, password) {
  if (!isSupabaseConfigured) throw new Error('Configure o Supabase no arquivo .env.local antes de entrar.');
  const session = await authRequest('token?grant_type=password', { email, password });
  session.expires_at = session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in;
  storeSession(session);
  return session;
}

export async function signUpCouple(email, password) {
  if (!isSupabaseConfigured) throw new Error('Configure o Supabase no arquivo .env.local antes de criar a conta.');
  const result = await authRequest('signup', { email, password });
  if (result.access_token) {
    result.expires_at = result.expires_at || Math.floor(Date.now() / 1000) + result.expires_in;
    storeSession(result);
  }
  return result;
}

export function signOutAdmin() {
  clearSession();
}

export async function getAdminSession() {
  const session = getStoredSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 > Date.now() + 60_000) return session;
  if (!session.refresh_token) {
    clearSession();
    return null;
  }
  try {
    const refreshed = await authRequest('token?grant_type=refresh_token', {
      refresh_token: session.refresh_token
    });
    refreshed.expires_at = refreshed.expires_at || Math.floor(Date.now() / 1000) + refreshed.expires_in;
    storeSession(refreshed);
    return refreshed;
  } catch {
    clearSession();
    return null;
  }
}

export async function loadUserWedding(accessToken) {
  const rows = await restRequest(
    'wedding_members?select=wedding_id,weddings(id,name)&limit=1',
    { accessToken }
  );
  const membership = rows?.[0];
  if (!membership) return null;
  const wedding = Array.isArray(membership.weddings) ? membership.weddings[0] : membership.weddings;
  if (!wedding?.id) throw new Error('A conta não está associada a um casamento.');
  return { id: wedding.id, name: wedding.name };
}

export async function createWeddingForCurrentUser(name, state, accessToken) {
  const rows = await restRequest('rpc/create_wedding_for_current_user', {
    method: 'POST',
    accessToken,
    body: { p_name: name, p_state: state }
  });
  const wedding = Array.isArray(rows) ? rows[0] : rows;
  if (!wedding?.wedding_id) throw new Error('Não foi possível criar o espaço do casamento.');
  return { id: wedding.wedding_id, name: wedding.wedding_name };
}

export async function loadWeddingState(weddingId, accessToken) {
  const rows = await restRequest(
    `wedding_state?wedding_id=eq.${encodeURIComponent(weddingId)}&select=couple_data,gifts,guest_messages,tasks,financials&limit=1`,
    { accessToken }
  );
  if (!rows?.[0]) throw new Error('As configurações deste casamento não foram encontradas.');
  const state = rows[0];
  return {
    coupleData: state.couple_data,
    gifts: state.gifts,
    guestMessages: state.guest_messages,
    tasks: state.tasks,
    financials: state.financials
  };
}

export async function saveWeddingState(weddingId, state, accessToken) {
  await restRequest('rpc/save_wedding_state_for_current_user', {
    method: 'POST',
    accessToken,
    body: {
      p_wedding_id: weddingId,
      p_couple_data: state.coupleData,
      p_gifts: state.gifts,
      p_tasks: state.tasks,
      p_financials: state.financials
    }
  });
}

export async function loadFamilies(weddingId, accessToken) {
  const rows = await restRequest(
    `guest_families?wedding_id=eq.${encodeURIComponent(weddingId)}&select=id,name,phone,rsvp_submitted_at,guests(id,name,is_child,age,confirmed)&order=created_at.asc`,
    { accessToken }
  );
  return (rows || []).map(family => ({
    id: family.id,
    name: family.name,
    phone: family.phone || '',
    rsvpSubmittedAt: family.rsvp_submitted_at,
    members: (family.guests || []).map(member => ({
      id: member.id,
      name: member.name,
      isChild: member.is_child,
      age: member.age,
      confirmed: member.confirmed
    }))
  }));
}

async function deleteMissingRows(table, key, ids, accessToken, scopeQuery = '') {
  if (!ids.length) return;
  const filter = ids.map(id => `"${String(id).replace(/"/g, '\\"')}"`).join(',');
  await restRequest(`${table}?${scopeQuery ? `${scopeQuery}&` : ''}${key}=not.in.(${encodeURIComponent(filter)})`, {
    method: 'DELETE',
    accessToken,
    headers: { Prefer: 'return=minimal' }
  });
}

export async function saveFamilies(families, weddingId, accessToken, previousFamilies = []) {
  const currentFamilyIds = families.map(family => family.id);

  for (const family of families) {
    const previousFamily = previousFamilies.find(item => item.id === family.id);
    if (
      !previousFamily
      || previousFamily.name !== family.name
      || (previousFamily.phone || '') !== (family.phone || '')
    ) {
      await restRequest('guest_families?on_conflict=id', {
        method: 'POST',
        accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { id: family.id, wedding_id: weddingId, name: family.name, phone: family.phone || '' }
      });
    }

    const previousMembers = previousFamily?.members || [];
    const changedMembers = family.members
      .filter(member => {
        const previous = previousMembers.find(item => item.id === member.id);
        return !previous
          || previous.name !== member.name
          || Boolean(previous.isChild) !== Boolean(member.isChild)
          || (Number(previous.age) || 0) !== (Number(member.age) || 0)
          || (previous.confirmed ?? null) !== (member.confirmed ?? null);
      })
      .map(member => {
        const previous = previousMembers.find(item => item.id === member.id);
        const guestRow = {
          id: member.id,
          family_id: family.id,
          name: member.name,
          is_child: Boolean(member.isChild),
          age: Number(member.age) || 0
        };
        if (!previous || (previous.confirmed ?? null) !== (member.confirmed ?? null)) {
          guestRow.confirmed = member.confirmed ?? null;
        }
        return guestRow;
      });

    if (changedMembers.length) {
      await restRequest('guests?on_conflict=id', {
        method: 'POST',
        accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: changedMembers
      });
    }

    const currentMemberIds = family.members.map(member => member.id);
    await deleteMissingRows(
      'guests',
      'id',
      previousMembers.map(member => member.id).filter(id => !currentMemberIds.includes(id)),
      accessToken,
      `family_id=eq.${encodeURIComponent(family.id)}`
    );
  }

  for (const previousFamily of previousFamilies) {
    if (!currentFamilyIds.includes(previousFamily.id)) {
      await restRequest(`guest_families?id=eq.${encodeURIComponent(previousFamily.id)}&wedding_id=eq.${encodeURIComponent(weddingId)}`, {
        method: 'DELETE',
        accessToken,
        headers: { Prefer: 'return=minimal' }
      });
    }
  }
}

export async function callPublicFunction(name, payload) {
  if (!isSupabaseConfigured) throw new Error('O serviço de confirmação ainda não está configurado.');
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || result.error || 'Não foi possível concluir a operação.');
    error.code = result.error;
    throw error;
  }
  return result;
}

export async function callAdminFunction(name, payload, accessToken) {
  if (!isSupabaseConfigured) throw new Error('O serviço de convidados ainda não está configurado.');
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || result.error || 'Não foi possível concluir a operação.');
    error.code = result.error;
    throw error;
  }
  return result;
}

export async function createFamilyInvite(familyId, accessToken) {
  return callAdminFunction('create-family-invite', { familyId }, accessToken);
}

export async function loadFamilyInvite(token) {
  return callPublicFunction('get-family-invite', { token });
}

export async function invokeCheckIn(token, accessToken) {
  return callAdminFunction('check-in', { token }, accessToken);
}

export function getCheckInUrlToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}
