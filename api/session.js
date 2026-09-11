import { getSession } from './lib/auth.js';
export default async function handler(req, res) {
  const session = getSession(req);
  return res.status(200).json({ authenticated: Boolean(session), username: session?.sub || null });
}
