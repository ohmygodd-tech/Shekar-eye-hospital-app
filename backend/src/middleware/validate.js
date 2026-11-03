import { badRequest } from '../utils/errors.js';

/** Validate req[part] with a zod schema and replace it with the parsed value. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[part]);
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(badRequest(details[0] ? `${details[0].field || 'input'}: ${details[0].message}` : 'Invalid input', details));
  }
  if (part === 'query') req.validQuery = r.data; else req[part] = r.data;
  next();
};
