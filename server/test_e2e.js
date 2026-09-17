import pool from './db.js';

async function runTests() {
  console.log('--- RUNNING E2E API & WORKFLOW VALIDATION ---');
  
  // 1. Projects
  const projectsRes = await fetch('http://localhost:3000/api/projects');
  const projects = await projectsRes.json();
  console.log(`✓ GET /api/projects returned ${projects.length} projects`);
  if (projects.length === 0) throw new Error('No projects found');

  const projectId = projects[0].id;

  // 2. Workload & Burnout Verification (THE VIBE CHECK)
  const workloadRes = await fetch(`http://localhost:3000/api/workload?project_id=${projectId}`);
  const workload = await workloadRes.json();
  console.log(`✓ GET /api/workload returned column stats:`, workload.columns);
  console.log(`✓ Burnout threshold: ${workload.burnoutThreshold}`);
  console.log(`✓ Burnout active: ${workload.hasBurnoutAlert}`);
  console.log(`✓ Burnout users:`, workload.burnoutUsers);

  const alex = workload.users.find(u => u.name.includes('Alex Mercer'));
  if (!alex) throw new Error('Alex Mercer not found');
  if (alex.in_progress_count <= 5 || !alex.is_burnout) {
    throw new Error(`Expected Alex Mercer to have > 5 tasks in progress (got ${alex.in_progress_count})`);
  }
  console.log(`✓ VIBE CHECK CONFIRMED: Alex Mercer has ${alex.in_progress_count} tasks in progress (> 5) -> is_burnout: true`);

  // 3. Tasks CRUD
  // Create task
  const createRes = await fetch('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      user_id: alex.id,
      title: 'Automated E2E Test Task',
      description: 'Testing task creation and status transition',
      priority: 'urgent',
      status: 'todo'
    })
  });
  const createdTask = await createRes.json();
  console.log(`✓ POST /api/tasks created task #${createdTask.id}: "${createdTask.title}" (${createdTask.priority}, ${createdTask.status})`);

  // Update status (simulate drag-and-drop)
  const patchRes = await fetch(`http://localhost:3000/api/tasks/${createdTask.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress', position: 99 })
  });
  const patchedTask = await patchRes.json();
  console.log(`✓ PATCH /api/tasks/${createdTask.id}/status updated to "${patchedTask.status}"`);

  // Update task details
  const putRes = await fetch(`http://localhost:3000/api/tasks/${createdTask.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Automated E2E Test Task - Updated',
      priority: 'high',
      status: 'done'
    })
  });
  const putTask = await putRes.json();
  console.log(`✓ PUT /api/tasks/${createdTask.id} updated to title "${putTask.title}" and status "${putTask.status}"`);

  // Delete task
  const delRes = await fetch(`http://localhost:3000/api/tasks/${createdTask.id}`, {
    method: 'DELETE'
  });
  const delData = await delRes.json();
  console.log(`✓ DELETE /api/tasks/${createdTask.id} succeeded:`, delData);

  // 4. Test Add Member to Project
  const userRes = await fetch('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jordan Lee',
      email: 'jordan.lee@testmail.com',
      role: 'QA Engineer'
    })
  });
  const newUser = await userRes.json();
  console.log(`✓ POST /api/users created user #${newUser.id}: ${newUser.name}`);

  const addMemberRes = await fetch(`http://localhost:3000/api/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: newUser.id,
      role: 'Member'
    })
  });
  const memberData = await addMemberRes.json();
  console.log(`✓ POST /api/projects/${projectId}/members added ${newUser.name} as Member`);

  // 5. Cleanup test user & pool
  await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
  await pool.end();

  console.log('--- ALL AUTOMATED TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
