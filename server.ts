import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { initDb } from './lib/db';
import { setSocketIO } from './lib/socket';
import { gpsToModel, ReferencePoint } from './lib/gps-converter';
import { getDb } from './lib/db';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Session-based actor model cache
// Maps actorId to model file path (e.g., 'worker_1' -> '/models/worker.glb')
const actorModelCache = new Map<string, string>();

/**
 * Determines the 3D model file to use for a given actorId.
 * Uses a naming convention: extracts the actor type from actorId prefix.
 * Examples:
 *   'worker_1' -> '/models/worker.glb'
 *   'worker_2' -> '/models/worker.glb'
 *   'excavator_1' -> '/models/excavator.glb'
 *   'truck_1' -> '/models/truck.glb'
 */
function getModelForActor(actorId: string): string {
  // Check cache first
  if (actorModelCache.has(actorId)) {
    return actorModelCache.get(actorId)!;
  }

  // Extract actor type from actorId (e.g., 'worker_1' -> 'worker')
  const actorType = actorId.split('_')[0] || 'worker';
  const modelPath = `/models/${actorType}.glb`;

  // Cache the result for this session
  actorModelCache.set(actorId, modelPath);
  
  console.log(`[Actor Model] Mapped ${actorId} -> ${modelPath}`);
  
  return modelPath;
}

// Initialize database before starting server
initDb().then(() => {
  // Database initialized
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      
      // Handle sensor update endpoint directly
      if (req.method === 'POST' && req.url === '/api/sensor/update') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            
            // Check if data contains GPS coordinates or model coordinates
            let modelCoords;
            let sourceType = 'model'; // Track whether data came from GPS or model coords
            let gpsData: { lat: number; lon: number; elev: number } | undefined = undefined;
            
            if (typeof data.lat === 'number' && typeof data.lon === 'number' && typeof data.elev === 'number') {
              sourceType = 'gps';
              gpsData = { lat: data.lat, lon: data.lon, elev: data.elev };
              
              // Convert GPS to model coordinates
              // Fetch modelUnit and reference point from database
              let modelUnitScale = 1.0; // default to meters (scale 1)
              let referencePoint: ReferencePoint | undefined = undefined;
              
              // Get modelId from request data
              const modelId = data.modelId;
              if (!modelId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'modelId is required' }));
                return;
              }
              
              try {
                const db = getDb();
                const result = await db.query(
                  `SELECT "modelUnit", "refModelX", "refModelY", "refModelZ", 
                          "refGpsLat", "refGpsLon", "refGpsElev"
                   FROM model_entity 
                   WHERE id = $1`,
                  [modelId]
                );
                
                if (result.rows.length > 0) {
                  const row = result.rows[0];
                  
                  // Get model unit scale (converts from meters to model unit)
                  if (row.modelUnit) {
                    const modelUnit = String(row.modelUnit).toLowerCase().trim();
                    
                    // Scale converts FROM meters TO model unit
                    // 1 meter = 1000 mm -> scale = 1000
                    // 1 meter = 1 m -> scale = 1
                    // 1 meter = 3.28084 ft -> scale = 3.28084
                    if (modelUnit === 'm' || modelUnit === 'meter' || modelUnit === 'meters') {
                      modelUnitScale = 1;
                    } else if (modelUnit === 'mm' || modelUnit === 'millimeter' || modelUnit === 'millimeters') {
                      modelUnitScale = 1000;
                    } else if (modelUnit === 'ft' || modelUnit === 'foot' || modelUnit === 'feet') {
                      modelUnitScale = 3.28084;
                    } else if (modelUnit === 'in' || modelUnit === 'inch' || modelUnit === 'inches') {
                      modelUnitScale = 39.3701;
                    } else if (modelUnit === 'cm' || modelUnit === 'centimeter' || modelUnit === 'centimeters') {
                      modelUnitScale = 100;
                    } else {
                      // fallback to meters
                      modelUnitScale = 1.0;
                    }
                  }
                  
                  // Get reference point if all values are present
                  if (
                    row.refModelX !== null &&
                    row.refModelY !== null &&
                    row.refModelZ !== null &&
                    row.refGpsLat !== null &&
                    row.refGpsLon !== null &&
                    row.refGpsElev !== null
                  ) {
                    referencePoint = {
                      model: {
                        x: row.refModelX,
                        y: row.refModelY,
                        z: row.refModelZ,
                      },
                      gps: {
                        lat: row.refGpsLat,
                        lon: row.refGpsLon,
                        elev: row.refGpsElev,
                      },
                    };
                  } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                      error: 'Reference point not configured. Please set a reference point for this model first.' 
                    }));
                    return;
                  }
                }
              } catch (err) {
                console.error('[GPS] Failed to fetch model config:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch model configuration' }));
                return;
              }
              
              if (!referencePoint) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  error: 'Reference point not configured. Please set a reference point for this model first.' 
                }));
                return;
              }
              
              modelCoords = gpsToModel({
                lat: data.lat,
                lon: data.lon,
                elev: data.elev,
              }, modelUnitScale, referencePoint);
            } else if (typeof data.x === 'number' && typeof data.y === 'number' && typeof data.z === 'number') {
              // Use model coordinates directly
              modelCoords = { x: data.x, y: data.y, z: data.z };
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing coordinates (provide either lat/lon/elev or x/y/z)' }));
              return;
            }

            const actorId = data.actorId || 'worker_1';
            const modelPath = getModelForActor(actorId);

            const poseData = {
              actorId: actorId,
              modelPath: modelPath,
              ts: Date.now(),
              x: modelCoords.x,
              y: modelCoords.y,
              z: modelCoords.z,
              rotation: data.rotation || 0,
              sourceType: sourceType,
              gps: gpsData,
            };

            io.emit('pose', poseData);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: poseData }));
          } catch (err) {
            console.error('Error processing sensor update:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Setup Socket.io
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',  // Allow all origins for now (change later for production security)
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Send initial position on connect
    const initialActorId = 'worker_1';
    socket.emit('pose', {
      actorId: initialActorId,
      modelPath: getModelForActor(initialActorId),
      ts: Date.now(),
      x: -4544.3,
      y: 8019.0,
      z: 1000,
      rotation: 180,
    });

    socket.on('disconnect', () => {
      // Client disconnected
    });
  });

  // Simulation disabled - using real sensor data from API
  // Uncomment below to enable simulation for testing
  /*
  let t = 0;
  setInterval(() => {
    t += 0.08;
    const walkDistance = 6;
    const walkSpeed = t;
    io.emit('pose', {
      actorId: 'worker_1',
      ts: Date.now(),
      x: -63.1,
      y: -74.5,
      z: 97.8,
      rotation: 270,
    });
  }, 200);
  */

  server.listen(port, () => {
    // Server listening
  });
});
