import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enforceDriverAccess } from '@/lib/auth';

// PATCH /api/drivers/[id]/online
// body: { isOnline: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Authorization: Only this specific driver or Admin may update status
    const authError = await enforceDriverAccess(req, id);
    if (authError) {
      return authError;
    }

    const { isOnline } = await req.json();

    // Only approved drivers can go online
    const existing = await prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    if (existing.approvalStatus !== 'approved') {
      return NextResponse.json({ error: 'Driver is not approved' }, { status: 403 });
    }

    const driver = await prisma.driver.update({
      where: { id },
      data: { isOnline: Boolean(isOnline) },
    });

    const { password: _pw, ...safe } = driver;
    return NextResponse.json(safe);
  } catch (err) {
    console.error('PATCH /api/drivers/[id]/online error:', err);
    return NextResponse.json({ error: 'Failed to update online status' }, { status: 500 });
  }
}
