import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/drivers
// ?status=approved|pending|rejected|suspended  (filter by approvalStatus)
// ?approved=true  (shortcut for approved-only, used by booking engine)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'suspended' | null;
    const approvedOnly = searchParams.get('approved') === 'true';

    const where: Record<string, unknown> = {};
    if (approvedOnly) {
      where.approvalStatus = 'approved';
    } else if (status) {
      where.approvalStatus = status;
    }

    const drivers = await prisma.driver.findMany({
      where,
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
    });

    // Strip password before sending
    const safe = drivers.map(({ password: _pw, ...d }) => d);
    return NextResponse.json(safe);
  } catch (err) {
    console.error('GET /api/drivers error:', err);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

// POST /api/drivers — register new driver (goes to pending)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, phone, email, city, password,
      licenseNumber,
      transmissionCapabilities,
      fuelCapabilities,
      licenseDocName
    } = body;

    if (!name || !phone || !licenseNumber) {
      return NextResponse.json({ error: 'Name, phone, and commercial driving license number are required' }, { status: 400 });
    }

    const driverEmail = email || `${phone.replace(/\D/g, '')}@drivec.in`;
    const driverCity = city || 'Kochi';
    const driverPassword = password || phone || 'kerago123';

    // Validate driver capability checkboxes (Requirement 3: at least one transmission and one fuel/power type)
    const validTransmissions = Array.isArray(transmissionCapabilities) && transmissionCapabilities.length > 0
      ? transmissionCapabilities
      : ['manual', 'automatic'];

    const validFuels = Array.isArray(fuelCapabilities) && fuelCapabilities.length > 0
      ? fuelCapabilities
      : ['petrol', 'diesel', 'ev'];

    if (validTransmissions.length === 0 || validFuels.length === 0) {
      return NextResponse.json({ 
        error: 'Please select at least one transmission capability and one fuel/power type capability' 
      }, { status: 400 });
    }

    // Check uniqueness on phone, email, licenseNumber (drivers do not register vehicles!)
    const existing = await prisma.driver.findFirst({
      where: { OR: [{ phone }, { email: driverEmail }, { licenseNumber }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Phone, email, or license number already registered' },
        { status: 409 }
      );
    }

    const driver = await prisma.driver.create({
      data: {
        name,
        phone,
        email: driverEmail,
        city: driverCity,
        password: driverPassword,
        licenseNumber,
        transmissionCapabilities: validTransmissions,
        fuelCapabilities: validFuels,
        vehicleModel: 'Customer-Provided Vehicle', // DriveC model: drivers drive customer's car
        approvalStatus: 'pending',
        documents: {
          create: [
            {
              type: 'driving_license',
              filename: licenseDocName || 'Kerala_Commercial_Driving_License.pdf',
              status: 'pending',
            }
          ]
        }
      },
      include: { documents: true },
    });

    const { password: _pw, ...safe } = driver;
    return NextResponse.json(safe, { status: 201 });
  } catch (err) {
    console.error('POST /api/drivers error:', err);
    return NextResponse.json({ error: 'Failed to register driver' }, { status: 500 });
  }
}
