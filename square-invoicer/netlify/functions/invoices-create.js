const crypto = require('crypto');
const { isValidSession } = require('./lib/session');
const { squareFetch } = require('./lib/square');

const MAX_LINE_ITEMS = 25;
const MAX_STRING_LEN = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message) {
  return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

function cleanString(value, maxLen = MAX_STRING_LEN) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function validateBody(body) {
  const customerName = cleanString(body.customerName);
  const customerEmail = cleanString(body.customerEmail, 254).toLowerCase();
  const title = cleanString(body.title, 120) || 'Invoice';
  const description = cleanString(body.description, 1000);
  const dueDate = cleanString(body.dueDate, 10);

  if (!customerName) return { error: 'Customer name is required' };
  if (!customerEmail || !EMAIL_RE.test(customerEmail)) return { error: 'A valid customer email is required' };
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: 'Due date must be in YYYY-MM-DD format' };

  const lineItemsRaw = Array.isArray(body.lineItems) ? body.lineItems : [];
  if (lineItemsRaw.length === 0) return { error: 'At least one line item is required' };
  if (lineItemsRaw.length > MAX_LINE_ITEMS) return { error: `No more than ${MAX_LINE_ITEMS} line items allowed` };

  const lineItems = [];
  for (const raw of lineItemsRaw) {
    const name = cleanString(raw && raw.description, 200);
    const quantity = Number(raw && raw.quantity);
    const amount = Number(raw && raw.amount);
    if (!name) return { error: 'Each line item needs a description' };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      return { error: `Invalid quantity for "${name}"` };
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return { error: `Invalid unit price for "${name}"` };
    }
    lineItems.push({ name, quantity, amountCents: Math.round(amount * 100) });
  }

  return {
    value: { customerName, customerEmail, title, description, dueDate, lineItems }
  };
}

async function findOrCreateCustomer(customerName, customerEmail) {
  const search = await squareFetch('/v2/customers/search', {
    method: 'POST',
    body: JSON.stringify({
      query: { filter: { email_address: { exact: customerEmail } } },
      limit: 1
    })
  });

  if (search.customers && search.customers.length > 0) {
    return search.customers[0].id;
  }

  const [givenName, ...rest] = customerName.split(' ');
  const created = await squareFetch('/v2/customers', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      given_name: givenName,
      family_name: rest.join(' ') || undefined,
      email_address: customerEmail
    })
  });

  return created.customer.id;
}

async function createOrder(locationId, lineItems) {
  const order = await squareFetch('/v2/orders', {
    method: 'POST',
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: locationId,
        line_items: lineItems.map((item) => ({
          name: item.name,
          quantity: String(item.quantity),
          base_price_money: { amount: item.amountCents, currency: 'USD' }
        }))
      }
    })
  });
  return order.order.id;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!isValidSession(event.headers.cookie)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) {
    console.error('SQUARE_LOCATION_ID env var is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return badRequest('Invalid request body');
  }

  const validated = validateBody(body);
  if (validated.error) return badRequest(validated.error);
  const { customerName, customerEmail, title, description, dueDate, lineItems } = validated.value;

  try {
    const customerId = await findOrCreateCustomer(customerName, customerEmail);
    const orderId = await createOrder(locationId, lineItems);

    const invoiceCreate = await squareFetch('/v2/invoices', {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        invoice: {
          location_id: locationId,
          order_id: orderId,
          primary_recipient: { customer_id: customerId },
          payment_requests: [{ request_type: 'BALANCE', due_date: dueDate }],
          delivery_method: 'EMAIL',
          title,
          description: description || undefined,
          accepted_payment_methods: { card: true, square_gift_card: false, bank_account: false, buy_now_pay_later: false }
        }
      })
    });

    const invoice = invoiceCreate.invoice;
    const published = await squareFetch(`/v2/invoices/${invoice.id}/publish`, {
      method: 'POST',
      body: JSON.stringify({
        version: invoice.version,
        idempotency_key: crypto.randomUUID()
      })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        invoiceId: published.invoice.id,
        status: published.invoice.status,
        publicUrl: published.invoice.public_url
      })
    };
  } catch (err) {
    console.error('Invoice creation failed', err);
    return {
      statusCode: err.statusCode && err.statusCode < 500 ? 502 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to create invoice' })
    };
  }
};
