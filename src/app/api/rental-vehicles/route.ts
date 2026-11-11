import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const vehicles = await prisma.rentalVehicle.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error fetching rental vehicles:', error);
    return NextResponse.json({ error: 'Failed to fetch rental vehicles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      model,
      brand,
      category = 'sedan',
      transmission = 'automatic',
      fuel = 'petrol',
      seats = 5,
      luggageCapacity = '3 Large Bags',
      licensePlate,
      year = 2024,
      dailyRate = 2000,
      hourlyRate = 200,
      advanceAmount = 1000,
      location = 'Kochi, Kerala',
      isAvailable = true,
      offlineUntil,
      maintenanceReason,
      approvalStatus = 'approved',
      features = [],
    } = body;

    const vehicleId = id || `rv-${Date.now()}`;

    const newVehicle = await prisma.rentalVehicle.create({
      data: {
        id: vehicleId,
        model,
        brand,
        category,
        transmission,
        fuel,
        seats: Number(seats) || 5,
        luggageCapacity,
        licensePlate,
        year: Number(year) || 2024,
        dailyRate: Number(dailyRate) || 2000,
        hourlyRate: Number(hourlyRate) || 200,
        advanceAmount: Number(advanceAmount) || 1000,
        location,
        isAvailable: Boolean(isAvailable),
        offlineUntil: offlineUntil || null,
        maintenanceReason: maintenanceReason || null,
        approvalStatus,
        features: features || [],
      },
    });

    return NextResponse.json(newVehicle, { status: 201 });
  } catch (error) {
    console.error('Error creating rental vehicle:', error);
    return NextResponse.json({ error: 'Failed to create rental vehicle' }, { status: 500 });
  }
}
