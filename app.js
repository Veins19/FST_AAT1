const express = require('express');
const fs = require('fs');
const path = require('path');

const PRIORITIES = ['low', 'medium', 'high'];

// Creates the Express app. `dataFile` is injectable so tests use a temp file.
function createApp(dataFile = path.join(__dirname, 'data', 'tasks.json')) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch {
      return [];
    }
  };
  const save = (tasks) => {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(tasks, null, 2));
  };

  // Validate and normalise user input; returns { error } or { value }.
  const validate = (body, partial = false) => {
    const out = {};
    if (!partial || body.title !== undefined) {
      const title = String(body.title ?? '').trim();
      if (!title) return { error: 'Title is required' };
      if (title.length > 120) return { error: 'Title must be 120 characters or fewer' };
      out.title = title;
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority)) return { error: 'Priority must be low, medium or high' };
      out.priority = body.priority;
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate !== '' && Number.isNaN(Date.parse(body.dueDate))) return { error: 'Invalid due date' };
      out.dueDate = body.dueDate;
    }
    if (body.done !== undefined) out.done = Boolean(body.done);
    return { value: out };
  };

  app.get('/api/tasks', (req, res) => {
    let tasks = load();
    const { status, q } = req.query;
    if (status === 'done') tasks = tasks.filter((t) => t.done);
    if (status === 'active') tasks = tasks.filter((t) => !t.done);
    if (q) tasks = tasks.filter((t) => t.title.toLowerCase().includes(String(q).toLowerCase()));
    res.json(tasks);
  });

  app.post('/api/tasks', (req, res) => {
    const { error, value } = validate(req.body);
    if (error) return res.status(400).json({ error });
    const tasks = load();
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      priority: 'medium',
      dueDate: '',
      done: false,
      createdAt: new Date().toISOString(),
      ...value,
    };
    tasks.unshift(task);
    save(tasks);
    res.status(201).json(task);
  });

  app.put('/api/tasks/:id', (req, res) => {
    const { error, value } = validate(req.body, true);
    if (error) return res.status(400).json({ error });
    const tasks = load();
    const task = tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    Object.assign(task, value);
    save(tasks);
    res.json(task);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const tasks = load();
    const remaining = tasks.filter((t) => t.id !== req.params.id);
    if (remaining.length === tasks.length) return res.status(404).json({ error: 'Task not found' });
    save(remaining);
    res.status(204).end();
  });

  app.get('/api/stats', (req, res) => {
    const tasks = load();
    const done = tasks.filter((t) => t.done).length;
    res.json({ total: tasks.length, done, active: tasks.length - done });
  });

  return app;
}

module.exports = { createApp };
