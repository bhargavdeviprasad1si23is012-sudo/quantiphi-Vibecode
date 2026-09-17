import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Helper for error responses
const handleError = (res, err, message = 'Internal Server Error') => {
  console.error(message, err);
  res.status(500).json({ error: message, details: err.message });
};

// ==========================================
// PROJECTS API
// ==========================================

// Get all projects with summary stats
router.get('/projects', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.color, 
        p.created_at,
        COUNT(DISTINCT pm.user_id)::int AS member_count,
        COUNT(DISTINCT t.id)::int AS task_count
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.id ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err, 'Failed to fetch projects');
  }
});

// Create a project
router.post('/projects', async (req, res) => {
  const { name, description, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO projects (name, description, color) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', color || '#6366f1']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, 'Failed to create project');
  }
});

// Get single project with assigned members
router.get('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const membersRes = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.avatar_url, 
        u.role AS user_role,
        pm.role AS project_role,
        pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY u.name ASC;
    `, [id]);

    res.json({
      ...projectRes.rows[0],
      members: membersRes.rows
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch project');
  }
});

// Add user to project
router.post('/projects/:id/members', async (req, res) => {
  const { id } = req.params;
  const { user_id, role } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  try {
    const memberRole = role || 'Member';
    const insertRes = await pool.query(`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, user_id) 
      DO UPDATE SET role = EXCLUDED.role
      RETURNING *;
    `, [id, user_id, memberRole]);

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    res.status(201).json({
      ...insertRes.rows[0],
      user: userRes.rows[0]
    });
  } catch (err) {
    handleError(res, err, 'Failed to add user to project');
  }
});

// ==========================================
// USERS & TEAM API
// ==========================================

// Get all users with their task counts and burnout flags
router.get('/users', async (req, res) => {
  const { project_id } = req.query;
  try {
    let query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.avatar_url, 
        u.role,
        COUNT(t.id)::int AS total_tasks,
        COUNT(CASE WHEN t.status = 'todo' THEN 1 END)::int AS todo_count,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END)::int AS in_progress_count,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END)::int AS done_count,
        CASE WHEN COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) > 5 THEN true ELSE false END AS is_burnout
      FROM users u
      LEFT JOIN tasks t ON u.id = t.user_id ${project_id ? 'AND t.project_id = $1' : ''}
    `;

    const params = [];
    if (project_id) {
      query += `
        WHERE u.id IN (SELECT user_id FROM project_members WHERE project_id = $1)
      `;
      params.push(project_id);
    }

    query += `
      GROUP BY u.id
      ORDER BY in_progress_count DESC, u.name ASC;
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err, 'Failed to fetch users');
  }
});

// Create new user
router.post('/users', async (req, res) => {
  const { name, email, avatar_url, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  try {
    const avatar = avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    const result = await pool.query(
      'INSERT INTO users (name, email, avatar_url, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, avatar, role || 'Developer']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, 'Failed to create user');
  }
});

// ==========================================
// TASKS CRUD API
// ==========================================

// Get tasks with filtering (project, priority, status, assignee, search)
router.get('/tasks', async (req, res) => {
  const { project_id, priority, status, assignee_id, search } = req.query;
  try {
    let whereClauses = [];
    let params = [];

    if (project_id) {
      params.push(project_id);
      whereClauses.push(`t.project_id = $${params.length}`);
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      whereClauses.push(`t.priority = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      whereClauses.push(`t.status = $${params.length}`);
    }

    if (assignee_id && assignee_id !== 'all') {
      params.push(assignee_id);
      whereClauses.push(`t.user_id = $${params.length}`);
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        t.id, 
        t.project_id, 
        t.user_id, 
        t.title, 
        t.description, 
        t.priority, 
        t.status, 
        t.position, 
        t.due_date, 
        t.created_at, 
        t.updated_at,
        u.name AS assignee_name,
        u.email AS assignee_email,
        u.avatar_url AS assignee_avatar,
        u.role AS assignee_role,
        p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      ${whereSql}
      ORDER BY t.position ASC, t.id DESC;
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    handleError(res, err, 'Failed to fetch tasks');
  }
});

// Create task
router.post('/tasks', async (req, res) => {
  const { project_id, user_id, title, description, priority, status, due_date } = req.body;
  if (!project_id || !title) {
    return res.status(400).json({ error: 'project_id and title are required' });
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
  const taskStatus = ['todo', 'in_progress', 'done'].includes(status) ? status : 'todo';

  try {
    // Get max position for this status column
    const posRes = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [project_id, taskStatus]
    );
    const nextPos = posRes.rows[0].next_pos;

    const insertRes = await pool.query(`
      INSERT INTO tasks (project_id, user_id, title, description, priority, status, position, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `, [project_id, user_id || null, title, description || '', taskPriority, taskStatus, nextPos, due_date || null]);

    const createdTask = insertRes.rows[0];

    // Fetch full task with assignee info
    const fullTaskRes = await pool.query(`
      SELECT 
        t.*,
        u.name AS assignee_name,
        u.email AS assignee_email,
        u.avatar_url AS assignee_avatar,
        u.role AS assignee_role,
        p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1
    `, [createdTask.id]);

    res.status(201).json(fullTaskRes.rows[0]);
  } catch (err) {
    handleError(res, err, 'Failed to create task');
  }
});

// Update task
router.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status, user_id, due_date } = req.body;

  try {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const taskPriority = validPriorities.includes(priority) ? priority : undefined;

    const result = await pool.query(`
      UPDATE tasks
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        priority = COALESCE($3, priority),
        status = COALESCE($4, status),
        user_id = $5,
        due_date = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `, [title, description, taskPriority, status, user_id === undefined ? null : user_id, due_date || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const fullTaskRes = await pool.query(`
      SELECT 
        t.*,
        u.name AS assignee_name,
        u.email AS assignee_email,
        u.avatar_url AS assignee_avatar,
        u.role AS assignee_role,
        p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1
    `, [id]);

    res.json(fullTaskRes.rows[0]);
  } catch (err) {
    handleError(res, err, 'Failed to update task');
  }
});

// PATCH task status & position (Drag and Drop Handler)
router.patch('/tasks/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, position } = req.body;

  if (!status || !['todo', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid or missing status' });
  }

  try {
    const taskCheck = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTaskRes = await pool.query(`
      UPDATE tasks
      SET 
        status = $1,
        position = COALESCE($2, position),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `, [status, position !== undefined ? position : null, id]);

    const fullTaskRes = await pool.query(`
      SELECT 
        t.*,
        u.name AS assignee_name,
        u.email AS assignee_email,
        u.avatar_url AS assignee_avatar,
        u.role AS assignee_role,
        p.name AS project_name
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1
    `, [id]);

    res.json(fullTaskRes.rows[0]);
  } catch (err) {
    handleError(res, err, 'Failed to update task status');
  }
});

// Delete task
router.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true, deletedId: id });
  } catch (err) {
    handleError(res, err, 'Failed to delete task');
  }
});

// ==========================================
// WORKLOAD BALANCING & STATS API
// ==========================================
router.get('/workload', async (req, res) => {
  const { project_id } = req.query;
  try {
    // 1. Column counts
    let columnStatsQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'todo' THEN 1 END)::int AS todo_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int AS in_progress_count,
        COUNT(CASE WHEN status = 'done' THEN 1 END)::int AS done_count,
        COUNT(*)::int AS total_count
      FROM tasks
    `;
    const colParams = [];
    if (project_id) {
      columnStatsQuery += ' WHERE project_id = $1';
      colParams.push(project_id);
    }
    const columnStatsRes = await pool.query(columnStatsQuery, colParams);

    // 2. User workload & burnout calculation
    let userWorkloadQuery = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.avatar_url, 
        u.role,
        COUNT(t.id)::int AS total_assigned,
        COUNT(CASE WHEN t.status = 'todo' THEN 1 END)::int AS todo_count,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END)::int AS in_progress_count,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END)::int AS done_count,
        CASE WHEN COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) > 5 THEN true ELSE false END AS is_burnout
      FROM users u
      LEFT JOIN tasks t ON u.id = t.user_id ${project_id ? 'AND t.project_id = $1' : ''}
    `;

    const userParams = [];
    if (project_id) {
      userWorkloadQuery += ` WHERE u.id IN (SELECT user_id FROM project_members WHERE project_id = $1) `;
      userParams.push(project_id);
    }

    userWorkloadQuery += `
      GROUP BY u.id
      ORDER BY in_progress_count DESC, u.name ASC;
    `;

    const userWorkloadRes = await pool.query(userWorkloadQuery, userParams);

    // Identify burnout candidates
    const burnoutUsers = userWorkloadRes.rows.filter(u => u.is_burnout);

    res.json({
      columns: columnStatsRes.rows[0] || { todo_count: 0, in_progress_count: 0, done_count: 0, total_count: 0 },
      users: userWorkloadRes.rows,
      burnoutThreshold: 5,
      hasBurnoutAlert: burnoutUsers.length > 0,
      burnoutUsers: burnoutUsers.map(u => ({
        id: u.id,
        name: u.name,
        in_progress_count: u.in_progress_count
      }))
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch workload statistics');
  }
});

export default router;
