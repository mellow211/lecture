import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { authenticateRequest } from '@/lib/auth';
import { parsePptx } from '@/lib/pptxParser';

export async function POST(req: NextRequest) {
  try {
    // 1. Guard check: Presenter only
    const user = authenticateRequest(req);
    if (!user || user.role !== 'presenter') {
      return NextResponse.json(
        { error: 'Only presenters can access uploads.' },
        { status: 403 }
      );
    }

    // 2. Parse JSON body payload instead of binary FormData (Bypasses Vercel 4.5MB body limit)
    const { fileUrl, originalName, mimeType } = await req.json();

    if (!fileUrl || !originalName) {
      return NextResponse.json(
        { error: 'Missing fileUrl or originalName payload.' },
        { status: 400 }
      );
    }

    const ext = path.extname(originalName).toLowerCase();
    const isPptx = ext === '.pptx';
    let slides: any[] = [];

    // 3. For PPTX files, download temporarily and execute regex text parser
    if (isPptx) {
      try {
        console.log(`Downloading PPTX from Supabase Storage for slide parsing: ${fileUrl}`);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PPTX file from storage url. HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save temporarily in OS tmp directory
        const tmpDir = os.tmpdir();
        const tmpFilePath = path.join(tmpDir, `temp-${Date.now()}-${Math.round(Math.random() * 1e9)}.pptx`);
        fs.writeFileSync(tmpFilePath, buffer);

        try {
          // Parse PPTX texts
          slides = parsePptx(tmpFilePath);
        } finally {
          // Ensure temp file is cleaned up to prevent leaks
          if (fs.existsSync(tmpFilePath)) {
            fs.unlinkSync(tmpFilePath);
          }
        }
      } catch (parserError: any) {
        console.error('Failed parsing PPTX from Cloud Storage pointer:', parserError.message);
        // Do not crash the upload flow; fallback to empty slides so it saves as raw file
        slides = [];
      }
    }

    return NextResponse.json({
      originalName: originalName,
      fileUrl: fileUrl, // Returns the Supabase public URL
      mimeType: mimeType || 'application/octet-stream',
      slides: slides
    }, { status: 201 });

  } catch (error: any) {
    console.error('Consolidated Upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
