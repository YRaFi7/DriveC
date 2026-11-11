import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/complaints
export async function GET() {
  try {
    const complaints = await prisma.complaint.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(complaints);
  } catch (err) {
    console.error('GET /api/complaints error:', err);
    return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });
  }
}

// POST /api/complaints — file a new complaint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      bookingId, bookingRef,
      complainantId, complainantName, complainantRole,
      category, description,
    } = body;

    if (!bookingId || !complainantId || !category || !description) {
      return NextResponse.json({ error: 'Missing required complaint fields' }, { status: 400 });
    }

    const complaint = await prisma.complaint.create({
      data: {
        bookingId,
        bookingRef,
        complainantId,
        complainantName,
        complainantRole,
        category,
        description,
        status: 'submitted',
      },
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (err) {
    console.error('POST /api/complaints error:', err);
    return NextResponse.json({ error: 'Failed to file complaint' }, { status: 500 });
  }
}
