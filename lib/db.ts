import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'aps_models',
    });
  }
  return pool;
}

export async function initDb() {
  const db = getDb();
  
  // Create model_entity table if not exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS model_entity (
      id SERIAL PRIMARY KEY,
      "fileName" VARCHAR(255) NOT NULL,
      "objectId" VARCHAR(512) UNIQUE NOT NULL,
      urn VARCHAR(1024) NOT NULL,
      status VARCHAR(50) DEFAULT 'processing',
      progress VARCHAR(50),
      error TEXT,
      "modelUnit" VARCHAR(10),
      "refModelX" DOUBLE PRECISION,
      "refModelY" DOUBLE PRECISION,
      "refModelZ" DOUBLE PRECISION,
      "refGpsLat" DOUBLE PRECISION,
      "refGpsLon" DOUBLE PRECISION,
      "refGpsElev" DOUBLE PRECISION,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_model_entity_urn ON model_entity(urn);
  `);
  
  // Add modelUnit column if it doesn't exist (migration)
  await db.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='model_entity' AND column_name='modelUnit'
      ) THEN
        ALTER TABLE model_entity ADD COLUMN "modelUnit" VARCHAR(10);
      END IF;
    END $$;
  `);
  
  // Add reference point columns if they don't exist (migration)
  await db.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='model_entity' AND column_name='refModelX'
      ) THEN
        ALTER TABLE model_entity ADD COLUMN "refModelX" DOUBLE PRECISION;
        ALTER TABLE model_entity ADD COLUMN "refModelY" DOUBLE PRECISION;
        ALTER TABLE model_entity ADD COLUMN "refModelZ" DOUBLE PRECISION;
        ALTER TABLE model_entity ADD COLUMN "refGpsLat" DOUBLE PRECISION;
        ALTER TABLE model_entity ADD COLUMN "refGpsLon" DOUBLE PRECISION;
        ALTER TABLE model_entity ADD COLUMN "refGpsElev" DOUBLE PRECISION;
      END IF;
    END $$;
  `);
  
  // Fix sequence issue: sync the id sequence with the max id in the table
  await db.query(`
    SELECT setval(
      pg_get_serial_sequence('model_entity', 'id'),
      COALESCE((SELECT MAX(id) FROM model_entity), 0) + 1,
      false
    );
  `);
  
  console.log('Database initialized');
}

export interface ModelEntity {
  id: number;
  fileName: string;
  objectId: string;
  urn: string;
  status: 'processing' | 'success' | 'failed';
  progress: string | null;
  error: string | null;
  modelUnit?: string | null;
  refModelX?: number | null;
  refModelY?: number | null;
  refModelZ?: number | null;
  refGpsLat?: number | null;
  refGpsLon?: number | null;
  refGpsElev?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
