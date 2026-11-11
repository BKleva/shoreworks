// Tiny schema validator. Every write endpoint runs its body through `clean`
// so nothing unvalidated or oversized ever reaches the database.

class ValidationError extends Error {
  constructor(fields) {
    super('Validation failed');
    this.fields = fields; // { fieldName: 'message' }
  }
}

// Strip control chars (keep \n and \t) and trim.
function cleanText(v) {
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * spec: { field: { type, required, max, min, enum, label } }
 * types: string | text | url | email | int | enum | enumList
 * Unknown fields in `input` are dropped.
 */
function clean(input, spec) {
  const out = {};
  const errors = {};
  const src = input && typeof input === 'object' ? input : {};

  for (const [field, rule] of Object.entries(spec)) {
    const label = rule.label || field;
    let v = src[field];
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ||
      (Array.isArray(v) && v.length === 0);

    if (empty) {
      if (rule.required) errors[field] = `${label} is required`;
      else if (rule.type === 'enumList') out[field] = [];
      else if (rule.type === 'int') out[field] = null;
      else out[field] = '';
      continue;
    }

    switch (rule.type) {
      case 'string':
      case 'text': {
        if (typeof v !== 'string') { errors[field] = `${label} must be text`; break; }
        v = cleanText(v);
        if (rule.type === 'string') v = v.replace(/\s*\n\s*/g, ' ');
        const max = rule.max || (rule.type === 'text' ? 4000 : 200);
        if (v.length > max) errors[field] = `${label} must be ${max} characters or fewer`;
        else if (rule.min && v.length < rule.min) errors[field] = `${label} must be at least ${rule.min} characters`;
        else out[field] = v;
        break;
      }
      case 'url': {
        if (typeof v !== 'string') { errors[field] = `${label} must be a link`; break; }
        v = cleanText(v);
        if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
        if (v.length > 500 || !isHttpUrl(v)) errors[field] = `${label} must be a valid web address`;
        else out[field] = v;
        break;
      }
      case 'email': {
        v = typeof v === 'string' ? cleanText(v).toLowerCase() : '';
        if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[field] = `${label} must be a valid email`;
        else out[field] = v;
        break;
      }
      case 'int': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
        const min = rule.min === undefined ? 0 : rule.min;
        const max = rule.max === undefined ? 1e10 : rule.max;
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
          errors[field] = `${label} must be a whole number between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}`;
        } else out[field] = n;
        break;
      }
      case 'enum': {
        if (!rule.enum.includes(v)) errors[field] = `${label} is not a valid choice`;
        else out[field] = v;
        break;
      }
      case 'enumList': {
        if (!Array.isArray(v) || v.length > (rule.maxItems || 20) || !v.every((x) => rule.enum.includes(x))) {
          errors[field] = `${label} contains an invalid choice`;
        } else out[field] = [...new Set(v)];
        break;
      }
      default:
        throw new Error('Unknown validator type ' + rule.type);
    }
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}

module.exports = { clean, ValidationError, cleanText };
