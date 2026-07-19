import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { authenticateRequest } from '@/lib/auth';
import { parsePptx } from '@/lib/pptxParser';


export async function POST(req: NextRequest) {
  try {
    // 1. Guard check: Presenter only
    const user = authenticateRequest(req);
    if (!user || user.role !== 'presenter') {
      return NextResponse.json(
        { error: 'Only presenters can upload files.' },
        { status: 403 }
      );
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded.' },
        { status: 400 }
      );
    }

    // 3. Prepare Upload Folder (public/uploads/)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique name
    const timestamp = Date.now();
    const rand = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9가-힣_-]/g, '');
    const filename = `${baseName}-${timestamp}-${rand}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Write file stream
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Static Relative URL path
    const fileUrl = `/uploads/${filename}`;

    // 4. If PPTX, parse text content slide cards
    const isPptx = ext.toLowerCase() === '.pptx';
    let slides: any[] = [];
    if (isPptx) {
      slides = parsePptx(filePath);
    }

    return NextResponse.json({
      originalName: file.name,
      filename: filename,
      fileUrl: fileUrl,
      mimeType: file.type,
      slides: slides
    }, { status: 201 });

  } catch (error: any) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
