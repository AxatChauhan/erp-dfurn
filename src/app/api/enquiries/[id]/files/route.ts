import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'dwg', 'dxf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
];

function extOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const files = await prisma.enquiryFile.findMany({
      where: { enquiryId: id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      files: files.map(f => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      }))
    });
  } catch (error: any) {
    console.error('Error in GET /api/enquiries/[id]/files:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const stage = (formData.get('stage') as string) || 'Enquiry';
    const uploadedById = (formData.get('uploadedById') as string) || null;
    const uploadedByName = (formData.get('uploadedByName') as string) || 'User';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 20 MB limit' }, { status: 400 });
    }

    const ext = extOf(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        error: `File type ".${ext || '?'}" isn't allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
      }, { status: 400 });
    }

    const slot = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${slot}_${safeBaseName}`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'enquiryDocuments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const diskPath = path.join(uploadDir, storedFileName);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(diskPath, buffer);

    const publicUrl = `/uploads/enquiryDocuments/${storedFileName}`;

    const record = await prisma.enquiryFile.create({
      data: {
        enquiryId: id,
        slot,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        url: publicUrl,
        stage: stage === 'Quote' ? 'Quote' : 'Enquiry',
        uploadedById,
        uploadedByName,
      }
    });

    return NextResponse.json({
      ok: true,
      record: {
        ...record,
        createdAt: record.createdAt.toISOString(),
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/enquiries/[id]/files:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 });
  }
}
