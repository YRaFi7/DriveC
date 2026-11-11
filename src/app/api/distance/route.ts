import { NextRequest, NextResponse } from 'next/server';
import { calculateRoadDistance, geocodeLocation, Coords } from '@/lib/routing';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pickup, destination, pickupCoords, destCoords } = body;

    if (!pickup || !destination) {
      return NextResponse.json(
        { error: 'Both pickup and drop-off locations are required to calculate road distance.' },
        { status: 400 }
      );
    }

    const result = await calculateRoadDistance(pickup, destination, pickupCoords, destCoords);

    return NextResponse.json({
      success: true,
      distanceKm: result.distanceKm,
      durationMinutes: result.durationMinutes,
      source: result.source,
      pickupResolved: result.pickupCoords?.label || pickup,
      destinationResolved: result.destCoords?.label || destination
    });
  } catch (err: any) {
    console.error('Error in /api/distance:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to calculate road route distance.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pickup = searchParams.get('pickup') || '';
  const destination = searchParams.get('destination') || searchParams.get('drop') || searchParams.get('dropoff') || '';

  if (!pickup || !destination) {
    return NextResponse.json(
      { error: 'Query parameters pickup and destination are required.' },
      { status: 400 }
    );
  }

  return POST(new NextRequest(req.url, {
    method: 'POST',
    body: JSON.stringify({ pickup, destination }),
    headers: { 'Content-Type': 'application/json' }
  }));
}
