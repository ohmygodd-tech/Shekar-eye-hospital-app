import { query } from '../db/index.js';

/** Record who did what to which record. Never throws (audit must not break requests). */
export async function audit(req, action, entity, entityId, meta) {
  try {
    await query(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, meta, ip) VALUES ($1,$2,$3,$4,$5,$6)',
      [req?.user?.id || null, action, entity || null, entityId ? String(entityId) : null, meta || null, req?.ip || null],
    );
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}
