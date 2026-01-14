import { NextRequest, NextResponse } from 'next/server';
import { getSocketIO } from '@/lib/socket';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (typeof body.x !== 'number' || typeof body.y !== 'number' || typeof body.z !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid coordinates. Required: x, y, z (numbers)' },
        { status: 400 }
      );
    }

    // Check immediately
    let io = getSocketIO();
    console.log('[Sensor API] Socket.io available:', !!io);
    
    // Wait for Socket.io to be ready (max 10 attempts, 2 seconds total)
    let attempts = 0;
    while (!io && attempts < 10) {
      console.log(`[Sensor API] Waiting for Socket.io... attempt ${attempts + 1}`);
      await new Promise(resolve => setTimeout(resolve, 200));
      io = getSocketIO();
      attempts++;
    }

    if (!io) {
      console.log('[Sensor API] Socket.io not available after retries');
      return NextResponse.json(
        { error: 'Socket.io server not ready. Make sure a viewer is connected first.' },
        { status: 503 }
      );
    }

    // Broadcast sensor data to all connected clients
    const poseData = {
      actorId: body.actorId || 'worker_1',
      ts: Date.now(),
      x: body.x,
      y: body.y,
      z: body.z,
      rotation: body.rotation || 0,
    };

    io.emit('pose', poseData);
    console.log('[Sensor API] Broadcasted pose data:', poseData);

    return NextResponse.json({ 
      success: true, 
      message: 'Sensor data broadcasted',
      data: poseData 
    });

  } catch (error: any) {
    console.error('[Sensor API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process sensor data' },
      { status: 500 }
    );
  }
}
