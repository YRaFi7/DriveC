import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/customers — list all customers or fetch single customer promo status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const id = searchParams.get('id');

    if (id || phone) {
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(id ? [{ id }] : []),
            ...(phone ? [{ phone }] : [])
          ]
        },
        include: {
          vehicles: true,
          bookings: {
            where: { status: 'completed' },
            select: { id: true }
          }
        }
      });

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      const completedCount = customer.bookings.length;
      const isPromoUsed = Boolean(customer.firstRidePromoUsed || completedCount > 0);

      return NextResponse.json({
        ...customer,
        completedRidesCount: completedCount,
        hasCompletedRide: completedCount > 0,
        firstRidePromoUsed: isPromoUsed
      });
    }

    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vehicles: true,
        bookings: {
          where: { status: 'completed' },
          select: { id: true }
        }
      }
    });

    const enriched = customers.map(c => ({
      ...c,
      completedRidesCount: c.bookings.length,
      hasCompletedRide: c.bookings.length > 0,
      firstRidePromoUsed: Boolean(c.firstRidePromoUsed || c.bookings.length > 0)
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('GET /api/customers error:', err);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// POST /api/customers — register new customer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, city, password, emergencyContact, vehicle, vehicles } = body;

    if (!name || !phone || !email || !city) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Default password to phone or 'kerago123' if not provided
    const userPassword = password || phone || 'kerago123';

    // Check if phone or email already exists
    const existing = await prisma.customer.findFirst({
      where: { OR: [{ phone }, { email }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Phone or email already registered' },
        { status: 409 }
      );
    }

    // Prepare vehicle creation data
    const vehicleListToCreate = [];
    if (Array.isArray(vehicles) && vehicles.length > 0) {
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (v && v.makeModel) {
          vehicleListToCreate.push({
            makeModel: v.makeModel,
            vehicleType: v.vehicleType || 'sedan',
            transmission: v.transmission || 'manual',
            fuelType: v.fuelType || 'petrol',
            notes: v.notes || null,
            isDefault: i === 0,
          });
        }
      }
    } else if (vehicle && vehicle.makeModel) {
      vehicleListToCreate.push({
        makeModel: vehicle.makeModel,
        vehicleType: vehicle.vehicleType || 'sedan',
        transmission: vehicle.transmission || 'manual',
        fuelType: vehicle.fuelType || 'petrol',
        notes: vehicle.notes || null,
        isDefault: true,
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email,
        city,
        password: userPassword,
        emergencyContact,
        ...(vehicleListToCreate.length > 0 ? {
          vehicles: {
            create: vehicleListToCreate,
          }
        } : {})
      },
      include: {
        vehicles: true,
      }
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    console.error('POST /api/customers error:', err);
    return NextResponse.json({ error: 'Failed to register customer' }, { status: 500 });
  }
}
