import { NextRequest, NextResponse } from 'next/server';
import { getLatestReadyUrn } from '@/lib/aps';

export async function GET() {
  try {
    const result = await getLatestReadyUrn();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get latest URN' },
      { status: 500 }
    );
  }
}
