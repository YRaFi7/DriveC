import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enforceAdminAccess } from '@/lib/auth';

// PATCH /api/drivers/[id]/approve
// body: { action: 'approve' | 'reject' | 'suspend', notes?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authorization: Only Admin may approve, reject, or suspend drivers
    const authError = await enforceAdminAccess(req);
    if (authError) {
      return authError;
    }

    const { id } = params;
    const body = await req.json();
    const { action, notes } = body as { action: string; notes?: string };

    const statusMap: Record<string, 'approved' | 'rejected' | 'suspended'> = {
      approve: 'approved',
      reject: 'rejected',
      suspend: 'suspended',
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action. Use approve, reject, or suspend.' }, { status: 400 });
    }

    const driver = await prisma.driver.update({
      where: { id },
      data: {
        approvalStatus: newStatus,
        approvalNotes: notes ?? null,
        // If re-approved, bring online capability back
        isOnline: newStatus === 'approved' ? false : false,
      },
      include: { documents: true },
    });

    const { password: _pw, ...safe } = driver;
    return NextResponse.json(safe);
  } catch (err) {
    console.error('PATCH /api/drivers/[id]/approve error:', err);
    return NextResponse.json({ error: 'Failed to update driver status' }, { status: 500 });
  }
}
