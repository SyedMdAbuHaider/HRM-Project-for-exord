import { verifyAccessToken } from './tokens.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = await verifyAccessToken(header.slice(7));
    req.auth = {
      employeeId: String(payload.sub),
      role: payload.role,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : []
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}