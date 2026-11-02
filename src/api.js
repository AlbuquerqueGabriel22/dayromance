const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const sessionKey = 'dayromance-api-session';

export const isBackendConfigured = Boolean(apiUrl);

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

async function apiRequest(path, { method = 'GET', body, accessToken } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 204) return null;
  let result;
  try {
    result = await response.json();
  } catch {
    result = {};
  }
  if (!response.ok) {
    const error = new Error(result.message || result.error || 'Não foi possível concluir a operação.');
    error.code = result.error;
    throw error;
  }
  return result;
}

export async function signInAdmin(email, password) {
  const session = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
  storeSession(session);
  return session;
}

export async function signUpCouple(email, password, profile) {
  const session = await apiRequest('/auth/signup', {
    method: 'POST',
    body: { email, password, profile }
  });
  storeSession(session);
  return session;
}

export async function requestPasswordReset(email) {
  await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function updatePasswordWithRecoveryToken(token, password) {
  await apiRequest('/auth/reset-password', { method: 'POST', body: { token, password } });
}

export async function signOutAdmin() {
  const session = getStoredSession();
  if (session?.access_token) {
    try {
      await apiRequest('/auth/logout', { method: 'POST', accessToken: session.access_token });
    } catch (error) {
      if (error.code !== 'unauthorized') throw error;
    }
  }
  clearSession();
}

export async function getAdminSession() {
  const session = getStoredSession();
  if (!session) return null;
  if (!session.expires_at || session.expires_at * 1000 <= Date.now()) {
    clearSession();
    return null;
  }
  try {
    await apiRequest('/auth/me', { accessToken: session.access_token });
    return session;
  } catch (error) {
    if (error.code === 'unauthorized') {
      clearSession();
      return null;
    }
    throw error;
  }
}

export async function loadUserWedding(accessToken) {
  return apiRequest('/weddings/me', { accessToken });
}

export async function createWeddingForCurrentUser(name, state, accessToken) {
  return apiRequest('/weddings', {
    method: 'POST',
    accessToken,
    body: { name, state }
  });
}

export async function loadWeddingState(weddingId, accessToken) {
  return apiRequest(`/weddings/${encodeURIComponent(weddingId)}/state`, { accessToken });
}

export async function saveWeddingState(weddingId, state, accessToken) {
  await apiRequest(`/weddings/${encodeURIComponent(weddingId)}/state`, {
    method: 'PUT',
    accessToken,
    body: { state }
  });
}

export async function loadFamilies(weddingId, accessToken) {
  return apiRequest(`/weddings/${encodeURIComponent(weddingId)}/families`, { accessToken });
}

export async function saveFamilies(families, weddingId, accessToken, previousFamilies = []) {
  await apiRequest(`/weddings/${encodeURIComponent(weddingId)}/families`, {
    method: 'PUT',
    accessToken,
    body: { families, previousFamilies }
  });
}

async function callFunction(name, payload, accessToken) {
  return apiRequest(`/functions/v1/${encodeURIComponent(name)}`, {
    method: 'POST',
    accessToken,
    body: payload
  });
}

export function callPublicFunction(name, payload) {
  return callFunction(name, payload);
}

export function callAdminFunction(name, payload, accessToken) {
  return callFunction(name, payload, accessToken);
}

export function createFamilyInvite(familyId, accessToken) {
  return callAdminFunction('create-family-invite', { familyId }, accessToken);
}

export function loadFamilyInvite(token) {
  return callPublicFunction('get-family-invite', { token });
}

export function invokeCheckIn(token, accessToken) {
  return callAdminFunction('check-in', { token }, accessToken);
}

export function getCheckInUrlToken() {
  return new URLSearchParams(window.location.search).get('token') || '';
}
