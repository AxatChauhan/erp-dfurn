import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await params;

    const file = await prisma.enquiryFile.findUnique({
      where: { id: fileId }
    });

    if (!file || file.enquiryId !== id) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Attempt deleting on-disk file if it exists
    if (file.url) {
      const relativePath = file.url.startsWith('/') ? file.url.slice(1) : file.url;
      const diskPath = path.join(process.cwd(), 'public', relativePath.replace(/^uploads\//, 'uploads/'));
      try {
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath);
        }
      } catch (err) {
        console.warn('Could not remove file from disk:', err);
      }
    }

    await prisma.enquiryFile.delete({ where: { id: fileId } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/enquiries/[id]/files/[fileId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete file' }, { status: 500 });
  }
}
