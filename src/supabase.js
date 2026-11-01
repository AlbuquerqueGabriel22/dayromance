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
  const admins = await restRequest(
    `couple_admins?user_id=eq.${encodeURIComponent(session.user.id)}&select=user_id`,
    { accessToken: session.access_token }
  );
  if (!admins?.length) {
    throw new Error('Esta conta não tem autorização para acessar o painel dos noivos.');
  }
  storeSession(session);
  return session;
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

export async function loadFamilies(accessToken) {
  const rows = await restRequest(
    'guest_families?select=id,name,phone,rsvp_submitted_at,guests(id,name,is_child,age,confirmed)&order=created_at.asc',
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

async function deleteMissingRows(table, key, ids, accessToken) {
  if (!ids.length) return;
  const filter = ids.map(id => `"${String(id).replace(/"/g, '\\"')}"`).join(',');
  await restRequest(`${table}?${key}=not.in.(${encodeURIComponent(filter)})`, {
    method: 'DELETE',
    accessToken,
    headers: { Prefer: 'return=minimal' }
  });
}

export async function saveFamilies(families, accessToken) {
  const currentRows = await restRequest(
    'guest_families?select=id,guests(id)',
    { accessToken }
  );
  const currentFamilies = currentRows || [];
  const familyIds = families.map(family => family.id);

  for (const family of families) {
    await restRequest('guest_families?on_conflict=id', {
      method: 'POST',
      accessToken,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { id: family.id, name: family.name, phone: family.phone || '' }
    });

    const members = family.members.map(member => ({
      id: member.id,
      family_id: family.id,
      name: member.name,
      is_child: Boolean(member.isChild),
      age: Number(member.age) || 0,
      confirmed: member.confirmed ?? null
    }));
    if (members.length) {
      await restRequest('guests?on_conflict=id', {
        method: 'POST',
        accessToken,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: members
      });
    }

    const oldFamily = currentFamilies.find(item => item.id === family.id);
    await deleteMissingRows(
      'guests',
      'id',
      (oldFamily?.guests || []).map(member => member.id).filter(id => !members.some(member => member.id === id)),
      accessToken
    );
  }

  for (const oldFamily of currentFamilies) {
    if (!familyIds.includes(oldFamily.id)) {
      await restRequest(`guest_families?id=eq.${encodeURIComponent(oldFamily.id)}`, {
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

export async function invokeCheckIn(token, accessToken) {
  return callAdminFunction('check-in', { token }, accessToken);
}

export function getCheckInUrlToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}
