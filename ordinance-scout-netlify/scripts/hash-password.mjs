// Usage: node scripts/hash-password.mjs "the password"   ->  prints the OI_PASS_HASH value to store in Netlify
import { randomBytes, scryptSync } from 'node:crypto';
const pw = process.argv[2];
if (!pw) { console.error('usage: node scripts/hash-password.mjs "password"'); process.exit(1); }
const salt = randomBytes(16);
console.log(`scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`);
