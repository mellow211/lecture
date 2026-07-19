import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_lecture_key_session_session_jwt';

export interface TokenPayload {
  id: number;
  username: string;
  role: 'presenter' | 'student';
}

/**
 * Generate a JWT token for the user.
 */
export function generateToken(user: { id: number; username: string; role: 'presenter' | 'student' }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' } // Match original Express token lifetime or keep it 7 days
  );
}

/**
 * Verify a JWT token.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Next.js Request Authtenticator Helper
 * Authenticates request using Bearer token from the Authorization header.
 */
export function authenticateRequest(req: NextRequest): TokenPayload | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}
