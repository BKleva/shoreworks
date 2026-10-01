(function () {
  const app = document.getElementById('app');
  const form = document.getElementById('invoice-form');
  const lineItemsWrap = document.getElementById('line-items');
  const template = document.getElementById('line-item-template');
  const errorBanner = document.getElementById('error-banner');
  const successBanner = document.getElementById('success-banner');
  const submitBtn = document.getElementById('submit-btn');

  function addLineItem() {
    const node = template.content.cloneNode(true);
    node.querySelector('.remove-btn').addEventListener('click', (e) => {
      const row = e.target.closest('.line-item');
      if (lineItemsWrap.children.length > 1) row.remove();
    });
    lineItemsWrap.appendChild(node);
  }

  document.getElementById('add-line-btn').addEventListener('click', addLineItem);

  function defaultDueDate() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth-check', { credentials: 'same-origin' });
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      app.classList.remove('hidden');
      addLineItem();
      document.getElementById('dueDate').value = defaultDueDate();
    } catch (err) {
      window.location.href = '/login';
    }
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth-logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';
    successBanner.style.display = 'none';

    const lineItems = Array.from(lineItemsWrap.querySelectorAll('.line-item')).map((row) => ({
      description: row.querySelector('.li-description').value.trim(),
      quantity: Number(row.querySelector('.li-quantity').value),
      amount: Number(row.querySelector('.li-amount').value)
    }));

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      customerEmail: document.getElementById('customerEmail').value.trim(),
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      dueDate: document.getElementById('dueDate').value,
      lineItems
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/invoices-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!res.ok) {
        errorBanner.textContent = data.error || 'Failed to send invoice';
        errorBanner.style.display = 'block';
        return;
      }

      successBanner.innerHTML = data.publicUrl
        ? `Invoice sent (status: ${data.status}). <a href="${data.publicUrl}" target="_blank" rel="noopener">View invoice</a>`
        : `Invoice created (status: ${data.status}).`;
      successBanner.style.display = 'block';
      form.reset();
      lineItemsWrap.innerHTML = '';
      addLineItem();
      document.getElementById('dueDate').value = defaultDueDate();
    } catch (err) {
      errorBanner.textContent = 'Network error. Please try again.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create & send invoice';
    }
  });

  checkAuth();
})();
