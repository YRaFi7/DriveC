import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/auth/login
// Handles login for customer, driver, and admin
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { role, phone, password } = body as {
      role: 'customer' | 'driver' | 'admin';
      phone: string;
      password: string;
    };

    if (!role || !phone || !password) {
      return NextResponse.json({ error: 'role, phone, and password are required' }, { status: 400 });
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    if (role === 'admin') {
      const cleanPhone = phone.trim().toLowerCase();
      if ((cleanPhone === 'admin' || cleanPhone === 'admin@drivec.in' || cleanPhone === 'admin@kerago.in') && password === 'admin2026') {
        return NextResponse.json({
          id: 'admin',
          role: 'admin',
          name: 'DriveC Chief Administrator',
          phone: 'admin',
          email: 'admin@drivec.in',
        });
      }
      return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
    }

    // ── Customer ─────────────────────────────────────────────────────────────
    if (role === 'customer') {
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: { contains: phone.trim() } },
            { email: { equals: phone.trim(), mode: 'insensitive' } },
          ],
        },
        include: {
          vehicles: true,
        },
      });
      if (!customer) {
        return NextResponse.json({ error: 'No registered customer found with this phone or email' }, { status: 404 });
      }
      if (password && password !== '1234' && customer.password !== password && customer.phone !== password) {
        return NextResponse.json({ error: 'Invalid credentials. Use your password or OTP 1234.' }, { status: 401 });
      }
      return NextResponse.json({
        id: customer.id,
        role: 'customer',
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        city: customer.city,
        emergencyContact: customer.emergencyContact,
        vehicles: customer.vehicles,
        createdAt: customer.createdAt,
      });
    }

    // ── Driver ───────────────────────────────────────────────────────────────
    if (role === 'driver') {
      const rawInput = phone.trim();
      const digitsOnly = rawInput.replace(/\D/g, '');

      // Search by phone, email, name, or license number
      const driver = await prisma.driver.findFirst({
        where: {
          OR: [
            ...(digitsOnly ? [{ phone: { contains: digitsOnly } }] : [{ phone: { contains: rawInput } }]),
            { email: { equals: rawInput, mode: 'insensitive' as const } },
            { name: { equals: rawInput, mode: 'insensitive' as const } },
            { licenseNumber: { equals: rawInput, mode: 'insensitive' as const } },
          ],
        },
        include: { documents: true },
      });

      if (!driver) {
        return NextResponse.json({ error: 'No driver application found with this phone, name, or email.' }, { status: 404 });
      }

      // Allow driver.password, driver.phone, '1234', empty, or stale admin2026 key
      const isPasswordValid = 
        !password ||
        password === '1234' ||
        password === 'admin2026' ||
        password === driver.phone ||
        password === driver.password ||
        (digitsOnly && driver.phone.includes(digitsOnly));

      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Invalid credentials. Use your driver password or OTP 1234.' }, { status: 401 });
      }

      if (driver.approvalStatus === 'pending') {
        return NextResponse.json(
          { error: 'Sign-in Blocked (Approval Pending): Your documents are in the Administrator Pending List. Only Admin-approved drivers can sign in. Please wait for Admin verification.' },
          { status: 403 }
        );
      }

      if (driver.approvalStatus === 'rejected') {
        return NextResponse.json(
          { error: 'Sign-in Blocked (Application Rejected): Your driver verification was declined by the Administrator. Please contact operations.' },
          { status: 403 }
        );
      }

      if (driver.approvalStatus === 'suspended') {
        return NextResponse.json(
          { error: 'Sign-in Blocked (Suspended): Your account has been suspended. Please contact support.' },
          { status: 403 }
        );
      }

      // Approved — return driver data (without password)
      const { password: _pw, ...safe } = driver;
      return NextResponse.json({ ...safe, role: 'driver' });
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
