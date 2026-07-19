import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

/**
 * PUT: Update presentation contents (e.g. title, slide array, or sorting index).
 * Allowed for presenters only.
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const rawId = (await context.params).id;
    const presentationId = parseInt(rawId, 10);
    
    if (isNaN(presentationId)) {
      return NextResponse.json({ error: 'Invalid presentation ID format.' }, { status: 400 });
    }

    const user = authenticateRequest(req);
    if (!user || user.role !== 'presenter') {
      return NextResponse.json({ error: 'Only presenters can edit presentations.' }, { status: 403 });
    }

    const { title, content_data, file_url, order_index } = await req.json();

    const existing = await dbGet('SELECT * FROM presentations WHERE id = ?', [presentationId]);
    if (!existing) {
      return NextResponse.json({ error: 'Presentation not found.' }, { status: 404 });
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedContent = content_data !== undefined 
      ? (typeof content_data === 'string' ? content_data : JSON.stringify(content_data))
      : existing.content_data;
    const updatedFileUrl = file_url !== undefined ? file_url : existing.file_url;
    const updatedIndex = order_index !== undefined ? order_index : existing.order_index;

    await dbRun(
      'UPDATE presentations SET title = ?, content_data = ?, file_url = ?, order_index = ? WHERE id = ?',
      [updatedTitle, updatedContent, updatedFileUrl, updatedIndex, presentationId]
    );

    const updated = await dbGet('SELECT * FROM presentations WHERE id = ?', [presentationId]);
    
    return NextResponse.json({
      ...updated,
      content_data: JSON.parse(updated.content_data)
    });

  } catch (error) {
    console.error('PUT presentation error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE: Delete a presentation.
 * Allowed for presenters only.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const rawId = (await context.params).id;
    const presentationId = parseInt(rawId, 10);

    if (isNaN(presentationId)) {
      return NextResponse.json({ error: 'Invalid presentation ID format.' }, { status: 400 });
    }

    const user = authenticateRequest(req);
    if (!user || user.role !== 'presenter') {
      return NextResponse.json({ error: 'Only presenters can delete presentations.' }, { status: 403 });
    }

    const existing = await dbGet('SELECT * FROM presentations WHERE id = ?', [presentationId]);
    if (!existing) {
      return NextResponse.json({ error: 'Presentation not found.' }, { status: 404 });
    }

    await dbRun('DELETE FROM presentations WHERE id = ?', [presentationId]);
    
    return NextResponse.json({ message: 'Presentation deleted successfully.' });

  } catch (error) {
    console.error('DELETE presentation error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
