import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { modelUnit } = await request.json();
    
    if (typeof modelUnit !== 'string') {
      return NextResponse.json(
        { error: 'modelUnit must be a string' },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Update the model with unit
    await db.query(
      `UPDATE model_entity 
       SET "modelUnit" = $1, "updatedAt" = NOW() 
       WHERE id = $2`,
      [modelUnit, parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating model unit:', error);
    return NextResponse.json(
      { error: 'Failed to update model unit' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    
    const result = await db.query(
      `SELECT "modelUnit" FROM model_entity WHERE id = $1`,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    return NextResponse.json({ modelUnit: result.rows[0].modelUnit });
  } catch (error) {
    console.error('Error fetching model unit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model unit' },
      { status: 500 }
    );
  }
}
