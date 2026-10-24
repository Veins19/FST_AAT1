const $ = (id) => document.getElementById(id);
let status = '';

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Escape user text before inserting into HTML (prevents XSS).
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function render() {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if ($('search').value) params.set('q', $('search').value);
  const [tasks, stats] = await Promise.all([api('/tasks?' + params), api('/stats')]);

  $('stats').innerHTML = ['total', 'active', 'done']
    .map((k) => `<div class="stat"><b>${stats[k]}</b><span>${k}</span></div>`).join('');

  const today = new Date().toISOString().slice(0, 10);
  $('list').innerHTML = tasks.length
    ? tasks.map((t) => `
      <li class="${t.done ? 'done' : ''}">
        <input type="checkbox" data-id="${t.id}" ${t.done ? 'checked' : ''}>
        <div class="body">
          <div class="title">${esc(t.title)}</div>
          <div class="meta">${t.dueDate ? `<span class="${!t.done && t.dueDate < today ? 'overdue' : ''}">Due ${t.dueDate}</span>` : 'No due date'}</div>
        </div>
        <span class="badge ${t.priority}">${t.priority}</span>
        <button class="del" data-del="${t.id}">Delete</button>
      </li>`).join('')
    : '<li class="empty">No tasks to show.</li>';
}

$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/tasks', 'POST', { title: $('title').value, priority: $('priority').value, dueDate: $('due').value });
    $('error').textContent = '';
    e.target.reset();
    render();
  } catch (err) {
    $('error').textContent = err.message;
  }
});

$('list').addEventListener('click', async (e) => {
  if (e.target.dataset.del) { await api('/tasks/' + e.target.dataset.del, 'DELETE'); render(); }
  else if (e.target.dataset.id) { await api('/tasks/' + e.target.dataset.id, 'PUT', { done: e.target.checked }); render(); }
});

$('tabs').addEventListener('click', (e) => {
  if (!e.target.dataset.hasOwnProperty('status')) return;
  status = e.target.dataset.status;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === e.target));
  render();
});

$('search').addEventListener('input', render);
render();
