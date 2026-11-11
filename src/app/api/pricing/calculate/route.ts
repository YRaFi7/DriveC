import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateFare, defaultDriverServicesPricingConfig } from '@/lib/store';
import { DriverServicesPricingConfig, RideServiceType, VehicleCategory } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      serviceType = 'one-way',
      category = 'sedan',
      distanceKm = 25,
      durationHours = 0,
      isRoundTrip = false,
      promoCode,
      isFirstRide = false
    } = body;

    // Fetch active database pricing config
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'driver_services_pricing' }
    });

    const pricingConfig: DriverServicesPricingConfig = (setting && setting.value)
      ? { ...defaultDriverServicesPricingConfig, ...(setting.value as any) }
      : defaultDriverServicesPricingConfig;

    const fare = calculateFare(
      serviceType as RideServiceType,
      category as VehicleCategory,
      Number(distanceKm) || 25,
      0, // intermediate stops removed
      Number(durationHours) || 0,
      Boolean(isRoundTrip),
      promoCode,
      Boolean(isFirstRide),
      pricingConfig
    );

    return NextResponse.json({
      success: true,
      fare
    });
  } catch (error: any) {
    console.error('Failed to calculate backend fare:', error);
    return NextResponse.json({ error: error.message || 'Calculation error' }, { status: 500 });
  }
}
