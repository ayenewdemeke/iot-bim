import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Save or update reference point for a model
 * This endpoint sets the reference point mapping between GPS and model coordinates
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { refModelX, refModelY, refModelZ, refGpsLat, refGpsLon, refGpsElev } = body;

    // Validate required fields
    if (
      typeof refModelX !== 'number' ||
      typeof refModelY !== 'number' ||
      typeof refModelZ !== 'number' ||
      typeof refGpsLat !== 'number' ||
      typeof refGpsLon !== 'number' ||
      typeof refGpsElev !== 'number'
    ) {
      return NextResponse.json(
        { error: 'All reference point coordinates are required (refModelX, refModelY, refModelZ, refGpsLat, refGpsLon, refGpsElev)' },
        { status: 400 }
      );
    }

    const db = getDb();
    const modelId = parseInt(params.id, 10);

    // Check if model exists
    const modelCheck = await db.query(
      'SELECT id FROM model_entity WHERE id = $1',
      [modelId]
    );

    if (modelCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    // Update reference point
    const result = await db.query(
      `UPDATE model_entity 
       SET "refModelX" = $1, 
           "refModelY" = $2, 
           "refModelZ" = $3, 
           "refGpsLat" = $4, 
           "refGpsLon" = $5, 
           "refGpsElev" = $6,
           "updatedAt" = NOW()
       WHERE id = $7
       RETURNING *`,
      [refModelX, refModelY, refModelZ, refGpsLat, refGpsLon, refGpsElev, modelId]
    );

    return NextResponse.json({
      success: true,
      model: result.rows[0],
    });
  } catch (error) {
    console.error('Error saving reference point:', error);
    return NextResponse.json(
      { error: 'Failed to save reference point' },
      { status: 500 }
    );
  }
}

/**
 * Get reference point for a model
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const db = getDb();
    const modelId = parseInt(params.id, 10);

    const result = await db.query(
      `SELECT "refModelX", "refModelY", "refModelZ", 
              "refGpsLat", "refGpsLon", "refGpsElev"
       FROM model_entity 
       WHERE id = $1`,
      [modelId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    const refPoint = result.rows[0];
    
    // Check if reference point is set
    if (
      refPoint.refModelX === null ||
      refPoint.refModelY === null ||
      refPoint.refModelZ === null ||
      refPoint.refGpsLat === null ||
      refPoint.refGpsLon === null ||
      refPoint.refGpsElev === null
    ) {
      return NextResponse.json({
        hasReferencePoint: false,
        referencePoint: null,
      });
    }

    return NextResponse.json({
      hasReferencePoint: true,
      referencePoint: {
        model: {
          x: refPoint.refModelX,
          y: refPoint.refModelY,
          z: refPoint.refModelZ,
        },
        gps: {
          lat: refPoint.refGpsLat,
          lon: refPoint.refGpsLon,
          elev: refPoint.refGpsElev,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching reference point:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reference point' },
      { status: 500 }
    );
  }
}
