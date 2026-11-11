import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/reviews
// ?targetId=<id>   — reviews for a specific driver or customer
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('targetId');

    const reviews = await prisma.review.findMany({
      where: targetId ? { targetId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews);
  } catch (err) {
    console.error('GET /api/reviews error:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST /api/reviews — submit a review
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      bookingId, bookingRef,
      reviewerId, reviewerName, reviewerRole,
      targetId, targetName, targetRole,
      punctualityRating, cleanlinessRating, comfortRating, overallRating,
      comment,
    } = body;

    if (!bookingId || !reviewerId || !targetId || !overallRating) {
      return NextResponse.json({ error: 'Missing required review fields' }, { status: 400 });
    }

    // Requirement 2: Check booking status is completed & prevent duplicate review
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, driverId: true, driverName: true },
    });

    if (booking && booking.status !== 'completed') {
      return NextResponse.json({ error: 'Reviews are strictly allowed only after the ride is marked Completed.' }, { status: 400 });
    }

    const existingReview = await prisma.review.findFirst({
      where: { bookingId },
    });

    if (existingReview) {
      return NextResponse.json({ error: 'A review has already been submitted for this completed booking.' }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: {
        bookingId,
        bookingRef,
        reviewerId,
        reviewerName,
        reviewerRole,
        targetId,
        targetName,
        targetRole,
        punctualityRating: Number(punctualityRating),
        cleanlinessRating: Number(cleanlinessRating),
        comfortRating: Number(comfortRating),
        overallRating: Number(overallRating),
        comment: comment ?? '',
        verifiedTrip: true,
      },
    });

    // Update driver rating average if review targets a driver
    if (targetRole === 'driver') {
      const allDriverReviews = await prisma.review.findMany({
        where: { targetId, targetRole: 'driver' },
        select: { overallRating: true },
      });
      const avg =
        allDriverReviews.reduce((sum, r) => sum + r.overallRating, 0) /
        allDriverReviews.length;
      await prisma.driver.update({
        where: { id: targetId },
        data: {
          ratingAverage: parseFloat(avg.toFixed(1)),
          ratingCount: allDriverReviews.length,
        },
      });
    }

    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    console.error('POST /api/reviews error:', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}

// PATCH /api/reviews — admin posts reply to a review
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, adminReply } = body;
    if (!id || !adminReply) {
      return NextResponse.json({ error: 'Review id and adminReply are required' }, { status: 400 });
    }

    // Update review with admin reply
    const updated = await prisma.review.update({
      where: { id },
      data: {
        adminReply,
        adminRepliedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/reviews error:', err);
    return NextResponse.json({ error: 'Failed to update review reply' }, { status: 500 });
  }
}

// DELETE /api/reviews?id=<id> — admin deletes a review
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Review id is required' }, { status: 400 });

    const deleted = await prisma.review.delete({ where: { id } });
    return NextResponse.json(deleted);
  } catch (err) {
    console.error('DELETE /api/reviews error:', err);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
