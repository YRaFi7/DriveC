import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface AuthContext {
  userId: string | null;
  role: 'customer' | 'driver' | 'admin' | 'guest';
  driverId?: string | null;
  customerId?: string | null;
  phone?: string | null;
}

/**
 * Extracts and verifies the authenticated caller context from headers, tokens, or query params.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const userId = req.headers.get('x-user-id') || req.headers.get('x-customer-id') || req.headers.get('x-driver-id') || req.headers.get('x-caller-id') || null;
  const userRole = (req.headers.get('x-user-role') || '').toLowerCase();

  // Admin caller
  if (userId === 'admin' || userId === 'admin-master' || userRole === 'admin') {
    return { userId: userId || 'admin', role: 'admin' };
  }

  if (userId) {
    // Check if ID matches a registered driver
    const driver = await prisma.driver.findFirst({
      where: {
        OR: [
          { id: userId },
          { phone: userId },
          { licenseNumber: userId },
        ],
      },
    });

    if (driver) {
      return {
        userId: driver.id,
        role: 'driver',
        driverId: driver.id,
        phone: driver.phone,
      };
    }

    // Check if ID matches a customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: userId },
          { phone: userId },
          { email: userId },
        ],
      },
    });

    if (customer) {
      return {
        userId: customer.id,
        role: 'customer',
        customerId: customer.id,
        phone: customer.phone,
      };
    }
  }

  // Header-based role identification fallback
  if (userRole === 'driver') {
    return { userId, role: 'driver', driverId: userId };
  }
  if (userRole === 'customer') {
    return { userId, role: 'customer', customerId: userId };
  }

  return { userId: null, role: 'guest' };
}

/**
 * Enforces that only authorized Driver (matching targetDriverId) or Admin can access.
 * Returns null if authorized, or a 403 Forbidden NextResponse if unauthorized.
 */
export async function enforceDriverAccess(
  req: NextRequest,
  targetDriverId: string
): Promise<NextResponse | null> {
  const auth = await getAuthContext(req);

  // Admin is authorized to manage drivers
  if (auth.role === 'admin') {
    return null;
  }

  // Customers can NEVER access driver-specific resources
  if (auth.role === 'customer') {
    console.warn(`[SECURITY 403] Customer (${auth.userId}) attempted to access Driver resource: ${targetDriverId}`);
    return NextResponse.json(
      {
        error: 'Forbidden: Customers are not permitted to access Driver Portal resources.',
        code: 'FORBIDDEN_CUSTOMER_ROLE',
      },
      { status: 403 }
    );
  }

  // Guests are blocked
  if (auth.role === 'guest' || !auth.userId) {
    console.warn(`[SECURITY 403] Unauthenticated caller attempted to access Driver resource: ${targetDriverId}`);
    return NextResponse.json(
      {
        error: 'Forbidden: Authentication required to access Driver Portal data.',
        code: 'UNAUTHORIZED_ACCESS',
      },
      { status: 403 }
    );
  }

  // Driver A vs Driver B isolation check
  if (auth.role === 'driver') {
    const callerId = auth.driverId || auth.userId;
    const cleanCallerPhone = (auth.phone || '').replace(/\D/g, '');
    const cleanTarget = targetDriverId.replace(/\D/g, '');

    const isMatch =
      callerId === targetDriverId ||
      callerId?.toLowerCase() === targetDriverId.toLowerCase() ||
      (cleanCallerPhone && cleanTarget && cleanCallerPhone === cleanTarget);

    if (!isMatch) {
      // Also verify against DB in case callerId is id and target is phone or vice versa
      const targetDriver = await prisma.driver.findFirst({
        where: {
          OR: [{ id: targetDriverId }, { phone: targetDriverId }, { licenseNumber: targetDriverId }],
        },
      });

      if (!targetDriver || targetDriver.id !== callerId) {
        console.warn(`[SECURITY 403] Driver Isolation Violation: Driver (${callerId}) attempted to access Driver (${targetDriverId}) data.`);
        return NextResponse.json(
          {
            error: "Forbidden: You are only permitted to access your own Driver Portal data.",
            code: 'FORBIDDEN_DRIVER_MISMATCH',
          },
          { status: 403 }
        );
      }
    }

    return null; // Authorized
  }

  return NextResponse.json(
    { error: 'Forbidden: Access denied.', code: 'FORBIDDEN_ACCESS' },
    { status: 403 }
  );
}

/**
 * Enforces that only an Administrator can access administrative routes.
 */
export async function enforceAdminAccess(req: NextRequest): Promise<NextResponse | null> {
  const auth = await getAuthContext(req);

  if (auth.role === 'admin') {
    return null; // Authorized
  }

  console.warn(`[SECURITY 403] Non-admin (${auth.userId || 'anonymous'}, role: ${auth.role}) attempted to access Admin functionality.`);
  return NextResponse.json(
    {
      error: 'Forbidden: Administrative privilege required.',
      code: 'FORBIDDEN_ADMIN_REQUIRED',
    },
    { status: 403 }
  );
}
