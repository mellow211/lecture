import { NextRequest } from 'next/server';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: 'presenter' | 'student';
}

/**
 * Bypassed authentication checker for Admin-Only tool workspace.
 * Always grants Presenter role immediately without token checks.
 */
export function authenticateRequest(req: NextRequest): AuthenticatedUser | null {
  // Authentication bypass: Always returns presenter session
  return {
    id: 1,
    username: 'admin',
    role: 'presenter',
  };
}

export function generateToken(payload: { id: number; username: string; role: string }): string {
  return 'bypassed_token';
}
