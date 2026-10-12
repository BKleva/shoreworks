import { store, imgKey, validId } from './_lib.mjs';

// GET /api/img/<barber>/<image> — serves portfolio and profile photos from Blobs.
export default async (req, context) => {
  const { emp, img } = context.params || {};
  if (!validId(emp) || !/^[a-f0-9]{6,32}$/.test(img || '')) return new Response('Not found', { status: 404 });
  const res = await store().getWithMetadata(imgKey(emp, img), { type: 'arrayBuffer' }).catch(() => null);
  if (!res) return new Response('Not found', { status: 404 });
  return new Response(res.data, {
    headers: {
      'Content-Type': res.metadata?.contentType || 'image/jpeg',
      // ids are unique per upload, so the bytes behind a URL never change
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const config = { path: '/api/img/:emp/:img' };
