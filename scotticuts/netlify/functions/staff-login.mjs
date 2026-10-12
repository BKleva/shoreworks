import { store, listEmployees, checkPassword, makeToken, json, publicEmployee } from './_lib.mjs';

// Barber login — each employee has their own username + password (set by the owner).
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let b = {};
  try { b = await req.json(); } catch { /* empty */ }
  await new Promise((r) => setTimeout(r, 400)); // slow down brute force

  const username = String(b.username || '').trim().toLowerCase();
  const emp = (await listEmployees(store())).find((e) => e.username === username);
  // Always run a hash check so a wrong username takes as long as a wrong password.
  const ok = checkPassword(b.password, emp?.passHash) && !!emp;
  if (!ok) return json({ error: 'Invalid username or password.' }, 401);
  return json({ token: makeToken('staff', emp.id), employee: publicEmployee(emp) });
};

export const config = { path: '/api/staff-login' };
