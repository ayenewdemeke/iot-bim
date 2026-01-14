import { getDb, ModelEntity } from './db';

type ApsTokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
};

// In-memory token cache
const tokenCache = new Map<string, { token: ApsTokenResponse; expMs: number }>();

const baseUrl = 'https://developer.api.autodesk.com';

function getConfig() {
  return {
    clientId: process.env.APS_CLIENT_ID || '',
    clientSecret: process.env.APS_CLIENT_SECRET || '',
    bucketKey: process.env.APS_BUCKET_KEY || '',
    scopesViewer: process.env.APS_SCOPES_VIEWER || 'viewables:read',
    scopesInternal: process.env.APS_SCOPES_INTERNAL || 'data:read data:write data:create bucket:create bucket:read',
  };
}

async function fetchToken(scopes: string): Promise<ApsTokenResponse> {
  const now = Date.now();
  const cached = tokenCache.get(scopes);
  if (cached && now < cached.expMs) return cached.token;

  const config = getConfig();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: scopes,
  });

  const res = await fetch(`${baseUrl}/authentication/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`APS token failed (${res.status}): ${text}`);
  }

  const token = (await res.json()) as ApsTokenResponse;
  // refresh 60s early
  tokenCache.set(scopes, { token, expMs: now + Math.max(token.expires_in - 60, 60) * 1000 });
  return token;
}

export async function getViewerToken(): Promise<ApsTokenResponse> {
  const config = getConfig();
  return fetchToken(config.scopesViewer);
}

async function getInternalToken(): Promise<ApsTokenResponse> {
  const config = getConfig();
  return fetchToken(config.scopesInternal);
}

async function ensureBucket(): Promise<void> {
  const config = getConfig();
  const token = await getInternalToken();

  const res = await fetch(`${baseUrl}/oss/v2/buckets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketKey: config.bucketKey, policyKey: 'temporary' }),
  });

  if (res.ok) return;
  if (res.status === 409) return; // already exists

  const text = await res.text().catch(() => '');
  throw new Error(`Bucket create failed (${res.status}): ${text}`);
}

function toBase64UrlUrn(objectId: string): string {
  const b64 = Buffer.from(objectId, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function uploadObject(objectKey: string, bytes: Buffer): Promise<any> {
  const config = getConfig();
  const token = await getInternalToken();

  const signRes = await fetch(
    `${baseUrl}/oss/v2/buckets/${encodeURIComponent(config.bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload?parts=1`,
    { method: 'GET', headers: { Authorization: `Bearer ${token.access_token}` } }
  );

  if (!signRes.ok) {
    const text = await signRes.text().catch(() => '');
    throw new Error(`Signed upload URL failed (${signRes.status}): ${text}`);
  }

  const signed = (await signRes.json()) as { uploadKey: string; urls: string[] };
  const s3Url = signed.urls?.[0];
  if (!s3Url) throw new Error('No signed S3 URL returned.');

  const s3Res = await fetch(s3Url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bytes.length),
    },
    body: new Uint8Array(bytes),
  });

  if (!s3Res.ok) {
    const text = await s3Res.text().catch(() => '');
    throw new Error(`S3 upload failed (${s3Res.status}): ${text}`);
  }

  const completeRes = await fetch(
    `${baseUrl}/oss/v2/buckets/${encodeURIComponent(config.bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadKey: signed.uploadKey }),
    }
  );

  if (!completeRes.ok) {
    const text = await completeRes.text().catch(() => '');
    throw new Error(`Finalize upload failed (${completeRes.status}): ${text}`);
  }

  return completeRes.json();
}

async function startSvf2Translation(objectId: string): Promise<any> {
  const token = await getInternalToken();
  const urn = toBase64UrlUrn(objectId);

  const res = await fetch(`${baseUrl}/modelderivative/v2/designdata/job`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { urn },
      output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Translation job failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function getManifest(objectId: string): Promise<any> {
  const token = await getInternalToken();
  const urn = toBase64UrlUrn(objectId);

  const res = await fetch(
    `${baseUrl}/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest`,
    { method: 'GET', headers: { Authorization: `Bearer ${token.access_token}` } }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Manifest fetch failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function uploadAndStartTranslation(fileName: string, fileBuffer: Buffer): Promise<ModelEntity> {
  if (!fileBuffer?.length) throw new Error('Empty upload');

  await ensureBucket();

  const uploaded = await uploadObject(fileName, fileBuffer);
  const objectId = uploaded.objectId as string;
  const urn = toBase64UrlUrn(objectId);

  await startSvf2Translation(objectId);

  const db = getDb();
  const result = await db.query(
    `INSERT INTO model_entity ("fileName", "objectId", urn, status, progress, error)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [fileName, objectId, urn, 'processing', '0%', null]
  );

  return result.rows[0];
}

export async function listModels(): Promise<ModelEntity[]> {
  const db = getDb();
  const result = await db.query(
    'SELECT * FROM model_entity ORDER BY "createdAt" DESC'
  );
  return result.rows;
}

export async function getModel(id: number): Promise<ModelEntity | null> {
  const db = getDb();
  const result = await db.query(
    'SELECT * FROM model_entity WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function getLatestReadyUrn(): Promise<{ urn: string | null }> {
  const db = getDb();
  const result = await db.query(
    `SELECT urn FROM model_entity WHERE status = 'success' ORDER BY "createdAt" DESC LIMIT 1`
  );
  return { urn: result.rows[0]?.urn || null };
}

export async function refreshModelStatus(id: number): Promise<ModelEntity> {
  const row = await getModel(id);
  if (!row) throw new Error('Model not found');

  try {
    const manifest = await getManifest(row.objectId);

    const progress = String(manifest?.progress ?? '');
    const status =
      manifest?.status === 'success' || progress === 'complete'
        ? 'success'
        : manifest?.status === 'failed' || progress === 'failed'
        ? 'failed'
        : 'processing';

    const db = getDb();
    const result = await db.query(
      `UPDATE model_entity 
       SET progress = $1, status = $2, error = $3, "updatedAt" = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        progress || row.progress,
        status,
        status === 'failed' ? JSON.stringify(manifest) : null,
        id,
      ]
    );

    return result.rows[0];
  } catch (e: any) {
    const db = getDb();
    const result = await db.query(
      `UPDATE model_entity 
       SET error = $1, "updatedAt" = NOW()
       WHERE id = $2
       RETURNING *`,
      [e?.message ?? String(e), id]
    );
    return result.rows[0];
  }
}
