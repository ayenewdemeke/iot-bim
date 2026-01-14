import { NextRequest, NextResponse } from 'next/server';
import { listModels } from '@/lib/aps';

export async function GET() {
  try {
    const models = await listModels();
    return NextResponse.json(models);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list models' },
      { status: 500 }
    );
  }
}
