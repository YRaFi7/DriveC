import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/complaints/[id]/resolve
// body: { status: 'resolved' | 'closed' | 'under_review', resolutionNotes?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { status = 'resolved', resolutionNotes = '' } = body;

    const complaint = await prisma.complaint.update({
      where: { id },
      data: {
        status,
        resolutionNotes,
      },
    });

    return NextResponse.json(complaint);
  } catch (err) {
    console.error('PATCH /api/complaints/[id]/resolve error:', err);
    return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
  }
}
