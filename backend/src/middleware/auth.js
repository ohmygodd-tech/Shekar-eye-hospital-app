import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db/index.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.accessTokenTtl });
}

/** Requires a valid Bearer token; loads req.user. */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('Session expired, please log in again');
    }
    const user = await one(
      'SELECT id, phone, name, email, role, is_active FROM users WHERE id = $1 AND deleted_at IS NULL',
      [payload.sub],
    );
    if (!user || !user.is_active) throw unauthorized();
    if (user.role === 'doctor') {
      const d = await one('SELECT id FROM doctors WHERE user_id = $1', [user.id]);
      user.doctorId = d?.id || null;
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

/** Restrict a route to given roles. */
export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());

export const STAFF = ['admin', 'receptionist', 'doctor'];
