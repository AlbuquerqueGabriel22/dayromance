import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pg from 'pg';
import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const { Pool } = pg;
const port = Number(process.env.PORT || 3001);
const databaseUrl = process.env.DATABASE_URL;
const expectedDatabase = process.env.DATABASE_NAME || 'dayromance';
const jwtSecret = process.env.JWT_SECRET;
const publicUrl = process.env.APP_PUBLIC_URL?.replace(/\/+$/, '');
const sessionDurationMs = 12 * 60 * 60 * 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!databaseUrl) throw new Error('DATABASE_URL must be set.');
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
if (!publicUrl || !URL.canParse(publicUrl)) throw new Error('APP_PUBLIC_URL must be a valid public URL.');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
  connectionTimeoutMillis: 10_000
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  const allowedOrigins = new Set([
    publicUrl,
    ...(process.env.APP_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean)
  ]);
  const origin = req.get('origin');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const asyncRoute = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

class ApiError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireText(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new ApiError(400, 'invalid_input', `O campo ${field} é inválido.`);
  }
  return value.trim();
}

function validateJson(value, field, maxBytes = 500_000) {
  if (value === undefined || value === null || typeof value !== 'object') {
    throw new ApiError(400, 'invalid_input', `O campo ${field} é inválido.`);
  }
  if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) {
    throw new ApiError(413, 'payload_too_large', `O campo ${field} excede o tamanho permitido.`);
  }
  return value;
}

function weddingStateFrom(value) {
  const state = validateJson(value, 'estado do casamento');
  if (state.coupleData !== undefined && (!state.coupleData || typeof state.coupleData !== 'object' || Array.isArray(state.coupleData))) {
    throw new ApiError(400, 'invalid_wedding_state');
  }
  for (const key of ['gifts', 'guestMessages', 'tasks']) {
    if (state[key] !== undefined && !Array.isArray(state[key])) throw new ApiError(400, 'invalid_wedding_state');
    if (Array.isArray(state[key]) && state[key].some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw new ApiError(400, 'invalid_wedding_state');
    }
  }
  if (state.financials !== undefined && (!state.financials || typeof state.financials !== 'object' || Array.isArray(state.financials))) {
    throw new ApiError(400, 'invalid_wedding_state');
  }
  return state;
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizedName(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');
}

function userShape(row) {
  return {
    id: row.id,
    email: row.email,
    user_metadata: { couple_profile: row.couple_profile || {} }
  };
}

async function createSession(user, res) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await pool.query(
    'INSERT INTO dr_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [id, user.id, expiresAt]
  );
  const accessToken = jwt.sign({ sub: user.id, jti: id }, jwtSecret, { expiresIn: '12h' });
  res.json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: Math.floor(sessionDurationMs / 1000),
    expires_at: Math.floor(expiresAt.getTime() / 1000),
    user: userShape(user)
  });
}

const requireAuth = asyncRoute(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new ApiError(401, 'unauthorized');
  let claims;
  try {
    claims = jwt.verify(authorization.slice(7), jwtSecret);
  } catch {
    throw new ApiError(401, 'unauthorized');
  }
  if (typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.jti !== 'string') {
    throw new ApiError(401, 'unauthorized');
  }
  const result = await pool.query(
    `SELECT u.id, u.email, u.couple_profile
       FROM dr_sessions s JOIN dr_users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [claims.jti, claims.sub]
  );
  if (!result.rows[0]) throw new ApiError(401, 'unauthorized');
  req.user = result.rows[0];
  req.sessionId = claims.jti;
  next();
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Muitas tentativas. Aguarde alguns minutos.' }
});

const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Muitas tentativas. Aguarde alguns minutos.' }
});

async function weddingForOwner(weddingId, userId, client = pool) {
  const result = await client.query(
    'SELECT * FROM dr_weddings WHERE id = $1 AND owner_user_id = $2',
    [weddingId, userId]
  );
  if (!result.rows[0]) throw new ApiError(404, 'wedding_not_found');
  return result.rows[0];
}

function familyShape(family, members) {
  return {
    id: family.id,
    name: family.name,
    phone: family.phone || '',
    rsvpSubmittedAt: family.rsvp_submitted_at,
    members: members.map(member => ({
      id: member.id,
      name: member.name,
      isChild: member.is_child,
      age: member.age,
      confirmed: member.confirmed
    }))
  };
}

function publicGiftList(gifts) {
  return (Array.isArray(gifts) ? gifts : []).map(gift => ({
    ...gift,
    reservations: (Array.isArray(gift.reservations) ? gift.reservations : [])
      .filter(reservation => reservation && typeof reservation === 'object')
      .map(({ whatsapp, ...reservation }) => reservation)
  }));
}

function mergeGiftReservations(submittedGifts, persistedGifts) {
  const savedById = new Map((Array.isArray(persistedGifts) ? persistedGifts : []).map(gift => [String(gift.id), gift]));
  const submittedIds = new Set(submittedGifts.map(gift => String(gift.id)));
  const merged = submittedGifts.map(gift => {
    const saved = savedById.get(String(gift.id));
    if (!saved) return gift;
    const reservationsById = new Map(
      (Array.isArray(saved.reservations) ? saved.reservations : [])
        .filter(reservation => reservation && typeof reservation === 'object')
        .map(reservation => [String(reservation.id), reservation])
    );
    for (const reservation of Array.isArray(gift.reservations) ? gift.reservations : []) {
      if (reservation?.status === 'gifted') reservationsById.set(String(reservation.id), reservation);
    }
    const reservations = [...reservationsById.values()];
    const reservedQuotas = reservations
      .filter(reservation => reservation.status === 'reserved')
      .reduce((sum, reservation) => sum + (Number(reservation.quotas) || 0), 0);
    return { ...gift, reservedQuotas, reservations };
  });
  for (const saved of savedById.values()) {
    if (submittedIds.has(String(saved.id))) continue;
    const activeReservations = (Array.isArray(saved.reservations) ? saved.reservations : [])
      .filter(reservation => reservation?.status === 'reserved');
    if (activeReservations.length) merged.push(saved);
  }
  return merged;
}

function mergeGuestMessages(submittedMessages, persistedMessages) {
  const submittedIds = new Set(submittedMessages.map(message => String(message.id)));
  return [
    ...submittedMessages,
    ...persistedMessages.filter(message => !submittedIds.has(String(message.id)))
  ];
}

async function getFamilyWithMembers(client, familyId) {
  const familyResult = await client.query('SELECT * FROM dr_guest_families WHERE id = $1', [familyId]);
  const family = familyResult.rows[0];
  if (!family) return null;
  const guests = await client.query(
    'SELECT id, name, is_child, age, confirmed, checked_in_at FROM dr_guests WHERE family_id = $1 ORDER BY created_at',
    [familyId]
  );
  return { family, guests: guests.rows, shape: familyShape(family, guests.rows) };
}

function familyMemberNamesMatch(guests, suppliedName) {
  const provided = normalizedName(suppliedName);
  return guests.some(guest => normalizedName(guest.name) === provided);
}

async function getInvitation(token, client = pool) {
  if (!token || typeof token !== 'string' || token.length > 200) throw new ApiError(404, 'invite_invalid');
  const result = await client.query(
    `SELECT f.*, w.couple_data, w.gifts, w.guest_messages
       FROM dr_guest_families f JOIN dr_weddings w ON w.id = f.wedding_id
      WHERE f.invite_token_hash = $1 AND f.invite_expires_at > now()`,
    [tokenHash(token)]
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'invite_invalid');
  const family = await getFamilyWithMembers(client, row.id);
  return {
    row,
    data: {
      coupleData: row.couple_data,
      gifts: publicGiftList(row.gifts),
      guestMessages: row.guest_messages,
      family: family.shape
    }
  };
}

async function createGuestPdf(guest, token) {
  const checkInUrl = `${publicUrl}/check-in?token=${encodeURIComponent(token)}`;
  const qrPng = await QRCode.toBuffer(checkInUrl, { type: 'png', width: 360, margin: 2 });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 280;
  page.drawText('Convite individual', { x: 50, y: 765, size: 22, font: boldFont, color: rgb(0.20, 0.30, 0.24) });
  page.drawText(guest.name, { x: 50, y: 715, size: 18, font: boldFont, color: rgb(0.12, 0.16, 0.13) });
  page.drawText('Apresente este QR code na entrada da festa.', { x: 50, y: 680, size: 12, font, color: rgb(0.35, 0.39, 0.36) });
  page.drawImage(qrImage, { x: (595 - qrSize) / 2, y: 340, width: qrSize, height: qrSize });
  page.drawText('Este convite é pessoal e válido para uma entrada.', { x: 50, y: 295, size: 10, font, color: rgb(0.45, 0.48, 0.46) });
  return Buffer.from(await pdf.save());
}

async function sendWhatsAppQr(phone, guest, token) {
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!graphVersion || !phoneNumberId || !accessToken || !templateName) {
    throw new Error('WhatsApp Cloud API is not configured.');
  }
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) throw new Error('A família não tem um WhatsApp válido.');
  const destination = digits.startsWith('55') ? digits : `55${digits}`;
  const pdf = await createGuestPdf(guest, token);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), `convite-${guest.id}.pdf`);
  const baseUrl = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}`;
  const mediaResponse = await fetch(`${baseUrl}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
  const mediaResult = await mediaResponse.json();
  if (!mediaResponse.ok || !mediaResult.id) throw new Error(`WhatsApp media upload failed (${mediaResponse.status}).`);

  const messageResponse = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destination,
      type: 'template',
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR' },
        components: [
          { type: 'header', parameters: [{ type: 'document', document: { id: mediaResult.id, filename: `convite-${guest.id}.pdf` } }] },
          { type: 'body', parameters: [{ type: 'text', text: guest.name }] }
        ]
      }
    })
  });
  if (!messageResponse.ok) throw new Error(`WhatsApp message failed (${messageResponse.status}).`);
}

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.post('/api/auth/signup', authRateLimit, asyncRoute(async (req, res) => {
  const email = requireText(req.body?.email, 'e-mail', 254).toLowerCase();
  const password = requireText(req.body?.password, 'senha', 200);
  const profile = validateJson(req.body?.profile, 'perfil', 10_000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'invalid_email', 'Informe um e-mail válido.');
  if (password.length < 8) throw new ApiError(400, 'weak_password', 'A senha deve ter pelo menos 8 caracteres.');
  if (typeof profile.groom !== 'string' || !profile.groom.trim() || typeof profile.bride !== 'string' || !profile.bride.trim()) {
    throw new ApiError(400, 'invalid_profile', 'Informe o nome dos dois noivos.');
  }
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  let result;
  try {
    result = await pool.query(
      'INSERT INTO dr_users (id, email, password_hash, couple_profile) VALUES ($1, $2, $3, $4) RETURNING id, email, couple_profile',
      [id, email, passwordHash, JSON.stringify(profile)]
    );
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'email_already_registered', 'Este e-mail já possui uma conta.');
    throw error;
  }
  await createSession(result.rows[0], res);
}));

app.post('/api/auth/login', authRateLimit, asyncRoute(async (req, res) => {
  const email = requireText(req.body?.email, 'e-mail', 254).toLowerCase();
  const password = requireText(req.body?.password, 'senha', 200);
  const result = await pool.query(
    'SELECT id, email, password_hash, couple_profile FROM dr_users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
  }
  await createSession(user, res);
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  res.json({ user: userShape(req.user) });
}));

app.post('/api/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  await pool.query('UPDATE dr_sessions SET revoked_at = now() WHERE id = $1', [req.sessionId]);
  res.sendStatus(204);
}));

app.post('/api/auth/forgot-password', authRateLimit, asyncRoute(async (req, res) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.MAIL_FROM) {
    throw new ApiError(503, 'email_not_configured', 'Configure SMTP no servidor para habilitar a recuperação de senha.');
  }
  const email = requireText(req.body?.email, 'e-mail', 254).toLowerCase();
  const userResult = await pool.query('SELECT id FROM dr_users WHERE email = $1', [email]);
  if (userResult.rows[0]) {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await pool.query('DELETE FROM dr_password_resets WHERE user_id = $1', [userResult.rows[0].id]);
    await pool.query(
      'INSERT INTO dr_password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash(token), userResult.rows[0].id, expiresAt]
    );
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Redefinição de senha - DayRomance',
        text: `Para redefinir sua senha, acesse: ${publicUrl}/#type=recovery&access_token=${encodeURIComponent(token)}\n\nO link expira em 30 minutos.`
      });
    } catch (error) {
      await pool.query('DELETE FROM dr_password_resets WHERE token_hash = $1', [tokenHash(token)]);
      throw new ApiError(503, 'email_delivery_failed', 'Não foi possível enviar o e-mail. Verifique a configuração SMTP.');
    }
  }
  res.json({ message: 'Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha.' });
}));

app.post('/api/auth/reset-password', authRateLimit, asyncRoute(async (req, res) => {
  const token = requireText(req.body?.token, 'token', 200);
  const password = requireText(req.body?.password, 'senha', 200);
  if (password.length < 8) throw new ApiError(400, 'weak_password', 'A senha deve ter pelo menos 8 caracteres.');
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reset = await client.query(
      'SELECT user_id FROM dr_password_resets WHERE token_hash = $1 AND expires_at > now() FOR UPDATE',
      [tokenHash(token)]
    );
    if (!reset.rows[0]) throw new ApiError(400, 'invalid_recovery_token', 'O link de recuperação é inválido ou expirou.');
    await client.query('UPDATE dr_users SET password_hash = $1 WHERE id = $2', [passwordHash, reset.rows[0].user_id]);
    await client.query('DELETE FROM dr_password_resets WHERE user_id = $1', [reset.rows[0].user_id]);
    await client.query('UPDATE dr_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [reset.rows[0].user_id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.sendStatus(204);
}));

app.get('/api/weddings/me', requireAuth, asyncRoute(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name FROM dr_weddings WHERE owner_user_id = $1',
    [req.user.id]
  );
  res.json(result.rows[0] || null);
}));

app.post('/api/weddings', requireAuth, asyncRoute(async (req, res) => {
  const name = requireText(req.body?.name, 'nome', 200);
  const state = weddingStateFrom(req.body?.state);
  const weddingId = crypto.randomUUID();
  try {
    const result = await pool.query(
      `INSERT INTO dr_weddings (id, owner_user_id, name, couple_data, gifts, guest_messages, tasks, financials)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name`,
      [
        weddingId,
        req.user.id,
        name,
        JSON.stringify(state.coupleData || {}),
        JSON.stringify(state.gifts || []),
        JSON.stringify(state.guestMessages || []),
        JSON.stringify(state.tasks || []),
        JSON.stringify(state.financials || {})
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') throw new ApiError(409, 'wedding_already_exists', 'Esta conta já possui um painel de casamento.');
    throw error;
  }
}));

app.get('/api/weddings/:weddingId/state', requireAuth, asyncRoute(async (req, res) => {
  const wedding = await weddingForOwner(req.params.weddingId, req.user.id);
  res.json({
    coupleData: wedding.couple_data,
    gifts: wedding.gifts,
    guestMessages: wedding.guest_messages,
    tasks: wedding.tasks,
    financials: wedding.financials
  });
}));

app.put('/api/weddings/:weddingId/state', requireAuth, asyncRoute(async (req, res) => {
  const state = weddingStateFrom(req.body?.state);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const weddingResult = await client.query(
      'SELECT gifts, guest_messages FROM dr_weddings WHERE id = $1 AND owner_user_id = $2 FOR UPDATE',
      [req.params.weddingId, req.user.id]
    );
    if (!weddingResult.rows[0]) throw new ApiError(404, 'wedding_not_found');
    const gifts = mergeGiftReservations(state.gifts || [], weddingResult.rows[0].gifts);
    const guestMessages = mergeGuestMessages(
      state.guestMessages || [],
      Array.isArray(weddingResult.rows[0].guest_messages) ? weddingResult.rows[0].guest_messages : []
    );
    await client.query(
      `UPDATE dr_weddings
          SET couple_data = $1, gifts = $2, guest_messages = $3, tasks = $4, financials = $5, updated_at = now()
        WHERE id = $6 AND owner_user_id = $7`,
      [
        JSON.stringify(state.coupleData || {}),
        JSON.stringify(gifts),
        JSON.stringify(guestMessages),
        JSON.stringify(state.tasks || []),
        JSON.stringify(state.financials || {}),
        req.params.weddingId,
        req.user.id
      ]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.sendStatus(204);
}));

app.get('/api/weddings/:weddingId/families', requireAuth, asyncRoute(async (req, res) => {
  await weddingForOwner(req.params.weddingId, req.user.id);
  const result = await pool.query(
    `SELECT f.id, f.name, f.phone, f.rsvp_submitted_at,
            COALESCE(json_agg(json_build_object(
              'id', g.id, 'name', g.name, 'isChild', g.is_child, 'age', g.age, 'confirmed', g.confirmed
            ) ORDER BY g.created_at) FILTER (WHERE g.id IS NOT NULL), '[]'::json) AS members
       FROM dr_guest_families f
       LEFT JOIN dr_guests g ON g.family_id = f.id
      WHERE f.wedding_id = $1
      GROUP BY f.id
      ORDER BY f.created_at`,
    [req.params.weddingId]
  );
  res.json(result.rows.map(row => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    rsvpSubmittedAt: row.rsvp_submitted_at,
    members: row.members
  })));
}));

app.put('/api/weddings/:weddingId/families', requireAuth, asyncRoute(async (req, res) => {
  const families = validateJson(req.body?.families, 'lista de famílias');
  if (!Array.isArray(families) || families.length > 5000) throw new ApiError(400, 'invalid_families');
  const previousFamilies = req.body?.previousFamilies === undefined
    ? []
    : validateJson(req.body.previousFamilies, 'lista anterior de famílias');
  if (!Array.isArray(previousFamilies)) throw new ApiError(400, 'invalid_previous_families');
  if (previousFamilies.some(family => (
    !family
    || typeof family !== 'object'
    || !uuidPattern.test(family.id || '')
    || !Array.isArray(family.members)
  ))) throw new ApiError(400, 'invalid_previous_families');
  await weddingForOwner(req.params.weddingId, req.user.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const familyIds = new Set();
    const previousById = new Map(previousFamilies.map(family => [String(family.id), family]));
    for (const family of families) {
      if (!family || typeof family !== 'object' || !uuidPattern.test(family.id || '') || !Array.isArray(family.members) || family.members.length > 100) {
        throw new ApiError(400, 'invalid_family');
      }
      familyIds.add(family.id);
      const familyName = requireText(family.name, 'família', 200);
      if (family.phone !== undefined && family.phone !== null && typeof family.phone !== 'string') throw new ApiError(400, 'invalid_phone');
      const phone = String(family.phone || '').slice(0, 40);
      const oldFamily = previousById.get(family.id);
      const persistedFamily = await client.query(
        'SELECT wedding_id, name, phone FROM dr_guest_families WHERE id = $1 FOR UPDATE',
        [family.id]
      );
      if (persistedFamily.rows[0] && persistedFamily.rows[0].wedding_id !== req.params.weddingId) {
        throw new ApiError(403, 'family_not_owned');
      }
      const nextFamilyName = oldFamily && familyName === oldFamily.name ? persistedFamily.rows[0]?.name || familyName : familyName;
      const nextPhone = oldFamily && phone === (oldFamily.phone || '') ? persistedFamily.rows[0]?.phone || '' : phone;
      await client.query(
        `INSERT INTO dr_guest_families (id, wedding_id, name, phone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone
         WHERE dr_guest_families.wedding_id = EXCLUDED.wedding_id`,
        [family.id, req.params.weddingId, nextFamilyName, nextPhone]
      );
      if (oldFamily && !Array.isArray(oldFamily.members)) throw new ApiError(400, 'invalid_previous_families');
      const oldMembers = new Map((oldFamily?.members || []).map(member => {
        if (!member || typeof member !== 'object' || !uuidPattern.test(member.id || '')) throw new ApiError(400, 'invalid_previous_families');
        return [String(member.id), member];
      }));
      const currentGuestIds = new Set();
      for (const member of family.members) {
        if (!member || typeof member !== 'object' || !uuidPattern.test(member.id || '')) throw new ApiError(400, 'invalid_guest');
        const age = member.age === undefined || member.age === null || member.age === '' ? 0 : Number(member.age);
        if (!Number.isInteger(age) || age < 0 || age > 130) throw new ApiError(400, 'invalid_guest_age');
        const memberName = requireText(member.name, 'convidado', 200);
        if (member.isChild !== undefined && typeof member.isChild !== 'boolean') throw new ApiError(400, 'invalid_guest_type');
        const isChild = Boolean(member.isChild);
        const confirmed = member.confirmed === true ? true : member.confirmed === false ? false : null;
        if (member.confirmed !== undefined && member.confirmed !== null && typeof member.confirmed !== 'boolean') {
          throw new ApiError(400, 'invalid_guest_status');
        }
        const oldMember = oldMembers.get(member.id);
        const persistedMember = await client.query(
          'SELECT family_id, name, is_child, age, confirmed FROM dr_guests WHERE id = $1 FOR UPDATE',
          [member.id]
        );
        if (persistedMember.rows[0] && persistedMember.rows[0].family_id !== family.id) {
          throw new ApiError(403, 'guest_not_owned');
        }
        const currentMember = persistedMember.rows[0];
        const nextName = oldMember && memberName === oldMember.name ? currentMember?.name || memberName : memberName;
        const nextIsChild = oldMember && isChild === Boolean(oldMember.isChild) ? currentMember?.is_child ?? isChild : isChild;
        const nextAge = oldMember && age === (Number(oldMember.age) || 0) ? currentMember?.age ?? age : age;
        const nextConfirmed = oldMember && confirmed === (oldMember.confirmed ?? null)
          ? currentMember?.confirmed ?? null
          : confirmed;
        currentGuestIds.add(member.id);
        await client.query(
          `INSERT INTO dr_guests (id, family_id, name, is_child, age, confirmed)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, is_child = EXCLUDED.is_child, age = EXCLUDED.age,
             confirmed = EXCLUDED.confirmed
           WHERE dr_guests.family_id = EXCLUDED.family_id`,
          [member.id, family.id, nextName, nextIsChild, nextAge, nextConfirmed]
        );
      }
      const deletedGuestIds = [...oldMembers.keys()].filter(id => !currentGuestIds.has(id));
      if (deletedGuestIds.length) {
        await client.query('DELETE FROM dr_guests WHERE family_id = $1 AND id = ANY($2::uuid[])', [family.id, deletedGuestIds]);
      }
    }
    const deletedFamilyIds = [...previousById.keys()].filter(id => !familyIds.has(id));
    if (deletedFamilyIds.length) {
      await client.query('DELETE FROM dr_guest_families WHERE wedding_id = $1 AND id = ANY($2::uuid[])', [req.params.weddingId, deletedFamilyIds]);
    }
    await client.query('COMMIT');
    res.sendStatus(204);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/functions/v1/create-family-invite', requireAuth, asyncRoute(async (req, res) => {
  const familyId = requireText(req.body?.familyId, 'família', 64);
  const result = await pool.query(
    `SELECT f.id, f.wedding_id, w.couple_data
       FROM dr_guest_families f JOIN dr_weddings w ON w.id = f.wedding_id
      WHERE f.id = $1 AND w.owner_user_id = $2`,
    [familyId, req.user.id]
  );
  if (!result.rows[0]) throw new ApiError(404, 'family_not_found');
  const token = randomToken();
  const expiresAt = result.rows[0].couple_data?.weddingDate
    ? new Date(new Date(result.rows[0].couple_data.weddingDate).getTime() + 90 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
  await pool.query(
    'UPDATE dr_guest_families SET invite_token_hash = $1, invite_expires_at = $2 WHERE id = $3',
    [tokenHash(token), expiresAt, familyId]
  );
  res.json({ inviteUrl: `${publicUrl}/convite/${encodeURIComponent(token)}` });
}));

app.post('/api/functions/v1/get-family-invite', publicRateLimit, asyncRoute(async (req, res) => {
  const invitation = await getInvitation(req.body?.token);
  res.json(invitation.data);
}));

app.post('/api/functions/v1/verify-invite', publicRateLimit, asyncRoute(async (req, res) => {
  const name = requireText(req.body?.name, 'nome', 200);
  const phoneLastFour = requireText(req.body?.phoneLastFour, 'código', 4);
  if (!/^\d{4}$/.test(phoneLastFour)) throw new ApiError(400, 'invalid_input');
  const { row } = await getInvitation(req.body?.familyInviteToken);
  const family = await getFamilyWithMembers(pool, row.id);
  if (family.family.rsvp_submitted_at) throw new ApiError(409, 'already_sent');
  if (family.family.verification_locked_until && new Date(family.family.verification_locked_until) > new Date()) {
    throw new ApiError(429, 'too_many_attempts');
  }
  const phoneDigits = String(family.family.phone || '').replace(/\D/g, '');
  const valid = phoneDigits.length >= 4
    && phoneDigits.slice(-4) === phoneLastFour
    && familyMemberNamesMatch(family.guests, name);
  if (!valid) {
    const attempts = family.family.verification_attempts + 1;
    await pool.query(
      `UPDATE dr_guest_families
          SET verification_attempts = CASE WHEN $2 >= 5 THEN 0 ELSE $2 END,
              verification_locked_until = CASE WHEN $2 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
        WHERE id = $1`,
      [row.id, attempts]
    );
    throw new ApiError(attempts >= 5 ? 429 : 401, attempts >= 5 ? 'too_many_attempts' : 'invite_not_found');
  }
  const inviteToken = randomToken();
  await pool.query(
    `UPDATE dr_guest_families
        SET rsvp_token_hash = $1, rsvp_expires_at = now() + interval '20 minutes',
            verification_attempts = 0, verification_locked_until = NULL
      WHERE id = $2`,
    [tokenHash(inviteToken), row.id]
  );
  res.json({ inviteToken, family: family.shape });
}));

app.post('/api/functions/v1/submit-rsvp', publicRateLimit, asyncRoute(async (req, res) => {
  const familyId = requireText(req.body?.familyId, 'família', 64);
  const inviteToken = requireText(req.body?.inviteToken, 'token', 200);
  const responses = validateJson(req.body?.responses, 'respostas', 20_000);
  if (Array.isArray(responses) || Object.values(responses).some(value => typeof value !== 'boolean') || !Object.keys(responses).length) {
    throw new ApiError(400, 'invalid_responses');
  }
  const client = await pool.connect();
  const rawTokens = new Map();
  try {
    await client.query('BEGIN');
    const familyResult = await client.query(
      `SELECT f.id, f.rsvp_token_hash, f.rsvp_expires_at, f.rsvp_submitted_at, f.phone
         FROM dr_guest_families f WHERE f.id = $1 FOR UPDATE`,
      [familyId]
    );
    const family = familyResult.rows[0];
    if (!family || family.rsvp_token_hash !== tokenHash(inviteToken) || new Date(family.rsvp_expires_at) < new Date()) {
      throw new ApiError(401, 'invite_expired');
    }
    if (family.rsvp_submitted_at) throw new ApiError(409, 'already_sent');
    const guestsResult = await client.query(
      'SELECT id, name FROM dr_guests WHERE family_id = $1 FOR UPDATE',
      [familyId]
    );
    const knownIds = new Set(guestsResult.rows.map(guest => guest.id));
    if (Object.keys(responses).length !== knownIds.size || Object.keys(responses).some(id => !knownIds.has(id))) {
      throw new ApiError(400, 'invalid_responses');
    }
    const confirmedGuests = [];
    for (const guest of guestsResult.rows) {
      const confirmed = responses[guest.id];
      let qrHash = null;
      if (confirmed) {
        const qrToken = randomToken();
        rawTokens.set(guest.id, qrToken);
        qrHash = tokenHash(qrToken);
        confirmedGuests.push({ id: guest.id, name: guest.name, token: qrToken });
      }
      await client.query(
        'UPDATE dr_guests SET confirmed = $1, qr_token_hash = $2, checked_in_at = NULL WHERE id = $3',
        [confirmed, qrHash, guest.id]
      );
    }
    await client.query(
      `UPDATE dr_guest_families
          SET rsvp_submitted_at = now(), rsvp_token_hash = NULL, rsvp_expires_at = NULL
        WHERE id = $1`,
      [familyId]
    );
    await client.query('COMMIT');

    const delivery = [];
    for (const guest of confirmedGuests) {
      try {
        await sendWhatsAppQr(family.phone, guest, rawTokens.get(guest.id));
        delivery.push({ guestId: guest.id, sent: true });
      } catch (error) {
        console.error('WhatsApp QR delivery failed', error.message);
        delivery.push({ guestId: guest.id, sent: false });
      }
    }
    res.json({ status: 'submitted', confirmedCount: confirmedGuests.length, delivery });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/functions/v1/create-guest-message', publicRateLimit, asyncRoute(async (req, res) => {
  const name = requireText(req.body?.name, 'nome', 100);
  const text = requireText(req.body?.text, 'mensagem', 2000);
  const { row } = await getInvitation(req.body?.inviteToken);
  const message = { id: crypto.randomUUID(), name, text, date: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date()) };
  await pool.query(
    `UPDATE dr_weddings
        SET guest_messages = jsonb_build_array($1::jsonb) || guest_messages, updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(message), row.wedding_id]
  );
  res.status(201).json({ message });
}));

app.post('/api/functions/v1/create-gift-reservation', publicRateLimit, asyncRoute(async (req, res) => {
  const reservationId = requireText(req.body?.id, 'reserva', 64);
  const guestName = requireText(req.body?.guestName, 'nome', 200);
  const whatsapp = requireText(req.body?.whatsapp, 'WhatsApp', 40);
  const giftId = requireText(req.body?.giftId, 'presente', 100);
  const quotas = Number(req.body?.quotas);
  if (!Number.isInteger(quotas) || quotas < 1 || quotas > 100) throw new ApiError(400, 'invalid_quotas');
  const { row } = await getInvitation(req.body?.inviteToken);
  const eventDate = String(row.couple_data?.weddingDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new ApiError(400, 'invalid_event_date');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  if (eventDate <= today) throw new ApiError(400, 'event_date_passed');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const weddingResult = await client.query('SELECT gifts FROM dr_weddings WHERE id = $1 FOR UPDATE', [row.wedding_id]);
    const gifts = weddingResult.rows[0]?.gifts || [];
    const gift = gifts.find(item => String(item.id) === giftId);
    if (!gift) throw new ApiError(404, 'gift_not_found');
    const total = Number(gift.totalQuotas || 1);
    const gifted = Number(gift.giftedQuotas || 0);
    const reserved = Number(gift.reservedQuotas || 0);
    const existingReservation = (gift.reservations || []).find(item => item.id === reservationId);
    if (existingReservation) {
      if (existingReservation.name !== guestName || Number(existingReservation.quotas) !== quotas) {
        throw new ApiError(409, 'reservation_conflict');
      }
      await client.query('COMMIT');
      return res.status(200).json({ status: 'reserved' });
    }
    if (quotas > total - gifted - reserved) throw new ApiError(409, 'gift_unavailable');
    const reservation = { id: reservationId, name: guestName, whatsapp, quotas, status: 'reserved' };
    gift.reservations = [...(gift.reservations || []).filter(item => item.id !== reservationId), reservation];
    gift.reservedQuotas = reserved + quotas;
    await client.query(
      'UPDATE dr_weddings SET gifts = $1, updated_at = now() WHERE id = $2',
      [JSON.stringify(gifts), row.wedding_id]
    );
    const daysUntilEvent = (
      Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
    ) / 86_400_000;
    for (const daysBefore of [30, 15]) {
      if (daysUntilEvent < daysBefore) continue;
      const scheduledFor = new Date(Date.parse(`${eventDate}T00:00:00Z`) - daysBefore * 86_400_000)
        .toISOString()
        .slice(0, 10);
      await client.query(
        `INSERT INTO dr_gift_reminders
          (id, wedding_id, reservation_id, scheduled_for, event_date, days_before, guest_name, whatsapp, gift_title)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (reservation_id, days_before) DO NOTHING`,
        [crypto.randomUUID(), row.wedding_id, reservationId, scheduledFor, eventDate, daysBefore, guestName, whatsapp, gift.title]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.status(201).json({ status: 'reserved' });
}));

app.post('/api/functions/v1/resend-guest-qrs', requireAuth, asyncRoute(async (req, res) => {
  const familyId = requireText(req.body?.familyId, 'família', 64);
  const ownerFamily = await pool.query(
    `SELECT f.id, f.wedding_id, f.phone
       FROM dr_guest_families f JOIN dr_weddings w ON w.id = f.wedding_id
      WHERE f.id = $1 AND w.owner_user_id = $2`,
    [familyId, req.user.id]
  );
  const family = ownerFamily.rows[0];
  if (!family) throw new ApiError(404, 'family_not_found');
  const guests = await pool.query(
    'SELECT id, name FROM dr_guests WHERE family_id = $1 AND confirmed = true ORDER BY created_at',
    [familyId]
  );
  const delivery = [];
  for (const guest of guests.rows) {
    const token = randomToken();
    await pool.query('UPDATE dr_guests SET qr_token_hash = $1 WHERE id = $2', [tokenHash(token), guest.id]);
    try {
      await sendWhatsAppQr(family.phone, guest, token);
      delivery.push({ guestId: guest.id, sent: true });
    } catch (error) {
      console.error('WhatsApp QR resend failed', error.message);
      delivery.push({ guestId: guest.id, sent: false });
    }
  }
  res.json({ confirmedCount: guests.rows.length, delivery });
}));

app.post('/api/functions/v1/check-in', requireAuth, asyncRoute(async (req, res) => {
  const token = requireText(req.body?.token, 'QR code', 200);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT g.id, g.name, g.confirmed, g.checked_in_at
         FROM dr_guests g JOIN dr_guest_families f ON f.id = g.family_id
         JOIN dr_weddings w ON w.id = f.wedding_id
        WHERE g.qr_token_hash = $1 AND w.owner_user_id = $2
        FOR UPDATE OF g`,
      [tokenHash(token), req.user.id]
    );
    const guest = result.rows[0];
    if (!guest) throw new ApiError(404, 'invalid_qr');
    if (guest.confirmed !== true) throw new ApiError(404, 'not_confirmed', 'Convidado não confirmado');
    if (guest.checked_in_at) {
      await client.query('COMMIT');
      return res.json({ status: 'already_checked_in', guestName: guest.name });
    }
    const checkedIn = await client.query(
      'UPDATE dr_guests SET checked_in_at = now() WHERE id = $1 RETURNING checked_in_at',
      [guest.id]
    );
    await client.query('COMMIT');
    res.json({
      status: 'checked_in',
      guestName: guest.name,
      checkedInAt: checkedIn.rows[0].checked_in_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', message: 'Rota não encontrada.' }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: 'O corpo da requisição não contém JSON válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload_too_large', message: 'O corpo da requisição excede o tamanho permitido.' });
  }
  console.error('API request failed', error);
  return res.status(500).json({ error: 'internal_error', message: 'Não foi possível concluir a operação.' });
});

let server;
async function start() {
  const database = await pool.query('SELECT current_database() AS name');
  if (database.rows[0].name !== expectedDatabase) {
    throw new Error(`Connected database must be "${expectedDatabase}".`);
  }
  server = app.listen(port, '127.0.0.1', () => {
    console.log(`DayRomance API listening on 127.0.0.1:${port}`);
  });
}

async function shutdown() {
  if (!server) {
    await pool.end();
    return;
  }
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
start().catch(async error => {
  console.error(`DayRomance API startup failed: ${error.message}`);
  await pool.end();
  process.exitCode = 1;
});
