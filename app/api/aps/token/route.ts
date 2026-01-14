import { NextRequest, NextResponse } from 'next/server';
import { getViewerToken } from '@/lib/aps';

export async function GET() {
  try {
    const token = await getViewerToken();
    return NextResponse.json(token);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get token' },
      { status: 500 }
    );
  }
}
