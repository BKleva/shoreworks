import { getStore } from '@netlify/blobs';
import { verifyToken, bearer } from './_auth.mjs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const store = () => getStore({ name: 'gallery', consistency: 'strong' });

function slugExt(type) {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}

export default async (req) => {
  const url = new URL(req.url);

  // ---- GET: serve one image, or list keys ----
  if (req.method === 'GET') {
    const img = url.searchParams.get('img');
    if (img) {
      const blob = await store().getWithMetadata(img, { type: 'arrayBuffer' });
      if (!blob || !blob.data) return new Response('Not found', { status: 404 });
      return new Response(blob.data, {
        headers: {
          'Content-Type': (blob.metadata && blob.metadata.type) || 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    const listed = await store().list();
    // keys are `<timestamp>-<rand>.<ext>` — newest first
    const uploaded = (listed.blobs || [])
      .map((b) => b.key)
      .sort()
      .reverse();
    return Response.json(
      { uploaded },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  }

  // ---- everything below requires a valid admin session ----
  if (!verifyToken(bearer(req))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ---- POST: upload an image (multipart/form-data, field "file") ----
  if (req.method === 'POST') {
    let form;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: 'Expected multipart form data.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return Response.json({ error: 'Use a JPG, PNG or WebP image.' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'Image must be under 10 MB.' }, { status: 413 });
    }
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${slugExt(file.type)}`;
    await store().set(key, await file.arrayBuffer(), {
      metadata: { type: file.type, name: String(file.name || '').slice(0, 120) },
    });
    return Response.json({ ok: true, key });
  }

  // ---- DELETE: remove an image (?img=key) ----
  if (req.method === 'DELETE') {
    const key = url.searchParams.get('img');
    if (!key) return Response.json({ error: 'Missing img key.' }, { status: 400 });
    await store().delete(key);
    return Response.json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
};

export const config = { path: '/api/gallery' };
