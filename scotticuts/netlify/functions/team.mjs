import { store, listEmployees, publicEmployee } from './_lib.mjs';

// GET /api/team — public barber profiles + portfolios for the website.
export default async () => {
  const team = (await listEmployees(store())).map(publicEmployee);
  return Response.json({ team }, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } });
};

export const config = { path: '/api/team' };
