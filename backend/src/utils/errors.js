export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
}
export const badRequest = (m, d) => new ApiError(400, m, 'bad_request', d);
export const unauthorized = (m = 'Please log in') => new ApiError(401, m, 'unauthorized');
export const forbidden = (m = 'You do not have access to this') => new ApiError(403, m, 'forbidden');
export const notFound = (m = 'Not found') => new ApiError(404, m, 'not_found');
export const conflict = (m) => new ApiError(409, m, 'conflict');

/** Wrap async route handlers so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
