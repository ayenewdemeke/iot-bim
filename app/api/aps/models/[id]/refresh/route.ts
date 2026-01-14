import { NextRequest, NextResponse } from 'next/server';
import { refreshModelStatus } from '@/lib/aps';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const modelId = parseInt(id, 10);

    if (isNaN(modelId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const model = await refreshModelStatus(modelId);
    return NextResponse.json(model);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to refresh model status' },
      { status: 500 }
    );
  }
}
