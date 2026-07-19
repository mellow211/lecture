import { NextRequest, NextResponse } from 'next/server';
import { dbAll, dbGet, dbRun } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

/**
 * GET: Retrieve all curriculum presentations sorted by order_index.
 * Allowed for all authenticated users (presenter and student).
 */
export async function GET(req: NextRequest) {
  try {
    const user = authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized session.' }, { status: 401 });
    }

    const rows = await dbAll('SELECT * FROM presentations ORDER BY order_index ASC');
    
    // Parse content_data JSON string to objects
    const items = rows.map((row) => ({
      ...row,
      content_data: JSON.parse(row.content_data)
    }));

    return NextResponse.json(items);

  } catch (error) {
    console.error('GET presentations error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST: Create a new presentation curriculum.
 * Allowed for presenters only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = authenticateRequest(req);
    if (!user || user.role !== 'presenter') {
      return NextResponse.json({ error: 'Only presenters can create presentations.' }, { status: 403 });
    }

    const { title, source_type, content_data, file_url } = await req.json();
    if (!title || !source_type || !content_data) {
      return NextResponse.json({ error: 'Title, source_type, and content_data are required.' }, { status: 400 });
    }

    // Determine order_index
    const maxOrder = await dbGet('SELECT MAX(order_index) as max_idx FROM presentations');
    const nextIndex = maxOrder && maxOrder.max_idx !== null ? maxOrder.max_idx + 1 : 0;

    const contentString = typeof content_data === 'string' ? content_data : JSON.stringify(content_data);

    await dbRun(
      'INSERT INTO presentations (title, source_type, content_data, file_url, order_index) VALUES (?, ?, ?, ?, ?)',
      [title, source_type, contentString, file_url || null, nextIndex]
    );

    const newItem = await dbGet('SELECT * FROM presentations WHERE id = last_insert_rowid()');
    
    return NextResponse.json({
      ...newItem,
      content_data: JSON.parse(newItem.content_data)
    }, { status: 201 });

  } catch (error) {
    console.error('POST presentations error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
