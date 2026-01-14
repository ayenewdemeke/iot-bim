import { NextRequest, NextResponse } from 'next/server';
import { getModel } from '@/lib/aps';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const modelId = parseInt(id, 10);

    if (isNaN(modelId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const model = await getModel(modelId);

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    return NextResponse.json({ urn: model.urn, status: model.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get URN' },
      { status: 500 }
    );
  }
}
