import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbGet, dbRun } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, password, role } = await req.json();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password and role are required.' },
        { status: 400 }
      );
    }

    if (role !== 'presenter' && role !== 'student') {
      return NextResponse.json(
        { error: 'Invalid role scope.' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) {
      return NextResponse.json(
        { error: 'Username already exists.' },
        { status: 409 }
      );
    }

    // Encrypt password (SHA256)
    const sha256 = crypto.createHash('sha256').update(password).digest('hex');

    // Save to SQLite
    await dbRun(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, sha256, role]
    );

    return NextResponse.json(
      { message: 'User registered successfully.' },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Register API error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
