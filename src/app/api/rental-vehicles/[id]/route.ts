import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updateData: any = {};
    if (typeof body.isAvailable === 'boolean') {
      updateData.isAvailable = body.isAvailable;
    }
    if ('offlineUntil' in body) {
      updateData.offlineUntil = body.offlineUntil || null;
    }
    if ('maintenanceReason' in body) {
      updateData.maintenanceReason = body.maintenanceReason || null;
    }
    if (body.model) updateData.model = body.model;
    if (body.brand) updateData.brand = body.brand;
    if (body.category) updateData.category = body.category;
    if (body.dailyRate !== undefined) updateData.dailyRate = Number(body.dailyRate);
    if (body.hourlyRate !== undefined) updateData.hourlyRate = Number(body.hourlyRate);
    if (body.advanceAmount !== undefined) updateData.advanceAmount = Number(body.advanceAmount);
    if (body.approvalStatus) updateData.approvalStatus = body.approvalStatus;

    const updated = await prisma.rentalVehicle.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating rental vehicle:', error);
    return NextResponse.json({ error: 'Failed to update rental vehicle' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.rentalVehicle.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting rental vehicle:', error);
    return NextResponse.json({ error: 'Failed to delete rental vehicle' }, { status: 500 });
  }
}
