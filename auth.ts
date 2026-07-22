import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import crypto from 'crypto';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  isAdmin?: boolean;
}

// Allowed admin emails
const ADMIN_EMAILS = ['musichalha@gmail.com'];
if (process.env.ADMIN_EMAIL) {
  ADMIN_EMAILS.push(process.env.ADMIN_EMAIL);
}

// Get expected passcode hash
export function getPasscodeHash(): string {
  const code = process.env.ADMIN_PASSCODE || 'AliBest#SmartSecure8391';
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'שגיאת אבטחה: נא להזדהות קודם' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Check if it's a verified passcode token
  const expectedHash = getPasscodeHash();
  if (token === `passcode_verified:${expectedHash}`) {
    req.isAdmin = true;
    return next();
  }

  // 2. Otherwise, check if it's a Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email;
    if (email && ADMIN_EMAILS.includes(email)) {
      req.user = decodedToken;
      req.isAdmin = true;
      return next();
    } else {
      return res.status(403).json({ error: 'שגיאת אבטחה: אינך מורשה לגשת למצב עריכה' });
    }
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'שגיאת אבטחה: פג תוקף החיבור או שהאימות נכשל' });
  }
};
