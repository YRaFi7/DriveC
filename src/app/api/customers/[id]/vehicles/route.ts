import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/customers/[id]/vehicles — list customer vehicles
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const vehicles = await prisma.customerVehicle.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(vehicles);
  } catch (err) {
    console.error('GET /api/customers/[id]/vehicles error:', err);
    return NextResponse.json({ error: 'Failed to fetch customer vehicles' }, { status: 500 });
  }
}

// POST /api/customers/[id]/vehicles — add a new vehicle for customer
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const body = await req.json();
    const { makeModel, vehicleType, transmission, fuelType, notes, isDefault } = body;

    if (!makeModel || !transmission || !fuelType) {
      return NextResponse.json(
        { error: 'Vehicle make & model, transmission, and fuel type are required' },
        { status: 400 }
      );
    }

    // Check existing count; if first vehicle, mark default
    const existingCount = await prisma.customerVehicle.count({ where: { customerId } });
    const shouldBeDefault = existingCount === 0 || Boolean(isDefault);

    if (shouldBeDefault && existingCount > 0) {
      await prisma.customerVehicle.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const newVehicle = await prisma.customerVehicle.create({
      data: {
        customerId,
        makeModel: makeModel.trim(),
        vehicleType: vehicleType || 'sedan',
        transmission: transmission || 'manual',
        fuelType: fuelType || 'petrol',
        notes: notes || null,
        isDefault: shouldBeDefault,
      },
    });

    return NextResponse.json(newVehicle, { status: 201 });
  } catch (err) {
    console.error('POST /api/customers/[id]/vehicles error:', err);
    return NextResponse.json({ error: 'Failed to add customer vehicle' }, { status: 500 });
  }
}

// PUT /api/customers/[id]/vehicles — update a vehicle
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const body = await req.json();
    const { vehicleId, makeModel, vehicleType, transmission, fuelType, notes, isDefault } = body;

    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicleId is required' }, { status: 400 });
    }

    if (isDefault) {
      await prisma.customerVehicle.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.customerVehicle.update({
      where: { id: vehicleId },
      data: {
        ...(makeModel ? { makeModel: makeModel.trim() } : {}),
        ...(vehicleType ? { vehicleType } : {}),
        ...(transmission ? { transmission } : {}),
        ...(fuelType ? { fuelType } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/customers/[id]/vehicles error:', err);
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/vehicles — delete a vehicle
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get('vehicleId');

    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicleId is required' }, { status: 400 });
    }

    await prisma.customerVehicle.delete({
      where: { id: vehicleId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/customers/[id]/vehicles error:', err);
    return NextResponse.json({ error: 'Failed to delete vehicle' }, { status: 500 });
  }
}
