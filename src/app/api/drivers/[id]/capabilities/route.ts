import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enforceDriverAccess } from '@/lib/auth';

// PUT /api/drivers/[id]/capabilities — update driving capabilities
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const driverId = params.id;

    // Authorization: Only this specific driver or Admin may update capabilities
    const authError = await enforceDriverAccess(req, driverId);
    if (authError) {
      return authError;
    }

    const body = await req.json();
    const { transmissionCapabilities, fuelCapabilities } = body;

    if (!Array.isArray(transmissionCapabilities) || transmissionCapabilities.length === 0) {
      return NextResponse.json(
        { error: 'At least one transmission capability (Automatic or Manual) is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(fuelCapabilities) || fuelCapabilities.length === 0) {
      return NextResponse.json(
        { error: 'At least one fuel/power capability (Petrol, Diesel, or Electric) is required' },
        { status: 400 }
      );
    }

    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: {
        transmissionCapabilities,
        fuelCapabilities,
      },
    });

    const { password: _pw, ...safe } = updated;
    return NextResponse.json(safe);
  } catch (err) {
    console.error('PUT /api/drivers/[id]/capabilities error:', err);
    return NextResponse.json({ error: 'Failed to update capabilities' }, { status: 500 });
  }
}
