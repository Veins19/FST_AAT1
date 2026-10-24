const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const { createApp } = require('../app');

let server, base;
test.before(async () => {
  const file = path.join(os.tmpdir(), `taskflow-${Date.now()}.json`);
  server = createApp(file).listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
test.after(() => server.close());

const call = (p, method = 'GET', body) =>
  fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

test('create, list, update, filter and delete a task', async () => {
  let res = await call('/tasks', 'POST', { title: 'Write report', priority: 'high' });
  assert.strictEqual(res.status, 201);
  const task = await res.json();
  assert.strictEqual(task.priority, 'high');
  assert.strictEqual(task.done, false);

  res = await call(`/tasks/${task.id}`, 'PUT', { done: true });
  assert.strictEqual((await res.json()).done, true);

  assert.strictEqual((await (await call('/tasks?status=done')).json()).length, 1);
  assert.strictEqual((await (await call('/tasks?status=active')).json()).length, 0);
  assert.deepStrictEqual(await (await call('/stats')).json(), { total: 1, done: 1, active: 0 });

  assert.strictEqual((await call(`/tasks/${task.id}`, 'DELETE')).status, 204);
  assert.strictEqual((await call(`/tasks/${task.id}`, 'DELETE')).status, 404);
});

test('rejects invalid input', async () => {
  assert.strictEqual((await call('/tasks', 'POST', { title: '   ' })).status, 400);
  assert.strictEqual((await call('/tasks', 'POST', { title: 'x', priority: 'urgent' })).status, 400);
  assert.strictEqual((await call('/tasks', 'POST', { title: 'x', dueDate: 'nope' })).status, 400);
  assert.strictEqual((await call('/tasks/missing', 'PUT', { done: true })).status, 404);
});
