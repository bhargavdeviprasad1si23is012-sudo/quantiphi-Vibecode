/**
 * KANBAN FLOW — APPLICATION LOGIC
 * Manages Kanban drag-and-drop, state updates, custom CRUD API requests,
 * and the Workload Balancing burnout detection system.
 */

const state = {
  projects: [],
  currentProjectId: 1,
  tasks: [],
  users: [],
  projectMembers: [],
  filters: {
    priority: 'all',
    assignee: 'all',
    search: ''
  },
  draggedTaskId: null,
  isBurnoutActive: false
};

const el = {
  projectSelect: document.getElementById('projectSelect'),
  addMemberBtn: document.getElementById('addMemberBtn'),
  createTaskBtn: document.getElementById('createTaskBtn'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  priorityPills: document.querySelectorAll('.pill'),
  assigneeFilter: document.getElementById('assigneeFilter'),
  demoRebalanceBtn: document.getElementById('demoRebalanceBtn'),

  teamMembersList: document.getElementById('teamMembersList'),
  burnoutStatusBanner: document.getElementById('burnoutStatusBanner'),
  burnoutBannerNames: document.getElementById('burnoutBannerNames'),

  columns: {
    todo: document.getElementById('column-todo'),
    in_progress: document.getElementById('column-in_progress'),
    done: document.getElementById('column-done')
  },
  taskContainers: {
    todo: document.getElementById('tasks-todo'),
    in_progress: document.getElementById('tasks-in_progress'),
    done: document.getElementById('tasks-done')
  },
  counters: {
    todo: document.getElementById('counter-todo'),
    in_progress: document.getElementById('counter-in_progress'),
    done: document.getElementById('counter-done')
  },

  createTaskModal: document.getElementById('createTaskModal'),
  createTaskForm: document.getElementById('createTaskForm'),
  taskAssigneeSelect: document.getElementById('taskAssignee'),

  addMemberModal: document.getElementById('addMemberModal'),
  addMemberForm: document.getElementById('addMemberForm'),
  tabExistingMember: document.getElementById('tabExistingMember'),
  tabNewMember: document.getElementById('tabNewMember'),
  existingUserSection: document.getElementById('existingUserSection'),
  newUserSection: document.getElementById('newUserSection'),
  existingUserSelect: document.getElementById('existingUserSelect'),
  projectRoleSelect: document.getElementById('projectRoleSelect'),

  taskDetailModal: document.getElementById('taskDetailModal'),
  editTaskForm: document.getElementById('editTaskForm'),
  editTaskId: document.getElementById('editTaskId'),
  editTitle: document.getElementById('editTitle'),
  editDescription: document.getElementById('editDescription'),
  editPriority: document.getElementById('editPriority'),
  editStatus: document.getElementById('editStatus'),
  editAssignee: document.getElementById('editAssignee'),
  editDueDate: document.getElementById('editDueDate'),
  deleteTaskBtn: document.getElementById('deleteTaskBtn'),
  detailModalTaskId: document.getElementById('detailModalTaskId'),

  toastContainer: document.getElementById('toastContainer')
};

async function initApp() {
  setupEventListeners();
  setupDragAndDrop();
  await loadProjects();
  await loadBoardData();
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    state.projects = await res.json();
    renderProjectSelector();
  } catch (err) {
    showToast('Failed to load projects', 'error');
  }
}

async function loadBoardData() {
  try {
    const [tasksRes, usersRes, projectRes] = await Promise.all([
      fetch(`/api/tasks?project_id=${state.currentProjectId}`),
      fetch(`/api/users?project_id=${state.currentProjectId}`),
      fetch(`/api/projects/${state.currentProjectId}`)
    ]);

    if (!tasksRes.ok || !usersRes.ok || !projectRes.ok) {
      throw new Error('Failed to load board data');
    }

    state.tasks = await tasksRes.json();
    state.users = await usersRes.json();
    const projectDetails = await projectRes.json();
    state.projectMembers = projectDetails.members || [];

    renderTeamRoster();
    renderTasks();
    updateCounters();
    populateAssigneeDropdowns();
  } catch (err) {
    console.error(err);
    showToast('Failed to load project data', 'error');
  }
}

// ─── Rendering ───
function renderProjectSelector() {
  el.projectSelect.innerHTML = state.projects.map(p => `
    <option value="${p.id}" ${p.id === Number(state.currentProjectId) ? 'selected' : ''}>
      ${esc(p.name)} (${p.task_count} tasks)
    </option>
  `).join('');
}

function populateAssigneeDropdowns() {
  const filterOpts = `
    <option value="all">Everyone</option>
    ${state.users.map(u => `
      <option value="${u.id}" ${state.filters.assignee === String(u.id) ? 'selected' : ''}>
        ${esc(u.name)} (${u.in_progress_count} WIP)
      </option>
    `).join('')}
  `;
  el.assigneeFilter.innerHTML = filterOpts;

  const assigneeOpts = `
    <option value="">Unassigned</option>
    ${state.users.map(u => `
      <option value="${u.id}">${esc(u.name)} — ${esc(u.role)}</option>
    `).join('')}
  `;
  el.taskAssigneeSelect.innerHTML = assigneeOpts;
  el.editAssignee.innerHTML = assigneeOpts;

  el.existingUserSelect.innerHTML = state.users.map(u => `
    <option value="${u.id}">${esc(u.name)} (${esc(u.email)})</option>
  `).join('');
}


function renderTeamRoster() {
  const countsByUser = {};
  state.tasks.forEach(t => {
    if (t.user_id) {
      if (!countsByUser[t.user_id]) countsByUser[t.user_id] = { todo: 0, in_progress: 0, done: 0 };
      if (t.status in countsByUser[t.user_id]) countsByUser[t.user_id][t.status]++;
    }
  });

  const burnoutNames = [];

  el.teamMembersList.innerHTML = state.users.map(user => {
    const stats = countsByUser[user.id] || { todo: 0, in_progress: 0, done: 0 };
    const wipCount = stats.in_progress;
    const isBurnout = wipCount > 5;

    if (isBurnout) burnoutNames.push(user.name);
    const isSelected = state.filters.assignee === String(user.id);

    return `
      <div class="member-chip ${isSelected ? 'selected' : ''}" data-user-id="${user.id}"
           title="${esc(user.name)} — ${esc(user.role)} (${wipCount} in progress)">
        <div class="avatar-ring ${isBurnout ? 'burnout-pulse' : ''}">
          <img src="${esc(user.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.name)}"
               alt="${esc(user.name)}"
               class="avatar-img"
               onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}'" />
          ${isBurnout ? '<div class="burnout-dot">🔥</div>' : ''}
        </div>
        <div class="member-meta">
          <span class="member-name">${esc(user.name)}</span>
          <div class="member-detail">
            <span class="wip-badge ${isBurnout ? 'wip-danger' : ''}">${wipCount} WIP</span>
            <span>· ${esc(user.role)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Burnout Banner
  if (burnoutNames.length > 0) {
    el.burnoutStatusBanner.classList.remove('hidden');
    el.burnoutBannerNames.textContent = burnoutNames.join(', ');
    state.isBurnoutActive = true;
  } else {
    el.burnoutStatusBanner.classList.add('hidden');
    state.isBurnoutActive = false;
  }

  // Click member chip to toggle assignee filter
  el.teamMembersList.querySelectorAll('.member-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const uid = chip.dataset.userId;
      if (state.filters.assignee === uid) {
        state.filters.assignee = 'all';
        el.assigneeFilter.value = 'all';
      } else {
        state.filters.assignee = uid;
        el.assigneeFilter.value = uid;
      }
      renderTeamRoster();
      renderTasks();
    });
  });
}

/**
 * Filter & render tasks into the 3 Kanban columns
 */
function renderTasks() {
  const filtered = state.tasks.filter(task => {
    if (state.filters.priority !== 'all' && task.priority !== state.filters.priority) return false;
    if (state.filters.assignee !== 'all' && String(task.user_id) !== String(state.filters.assignee)) return false;
    if (state.filters.search) {
      const q = state.filters.search.toLowerCase();
      if (!(task.title || '').toLowerCase().includes(q) && !(task.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const cols = { todo: [], in_progress: [], done: [] };
  filtered.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });

  const emptyIcons = { todo: '📋', in_progress: '⚡', done: '✅' };
  const emptyText = { todo: 'to do', in_progress: 'in progress', done: 'done' };

  ['todo', 'in_progress', 'done'].forEach(status => {
    const container = el.taskContainers[status];
    const items = cols[status];
    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-col">
          <div class="empty-col-icon">${emptyIcons[status]}</div>
          <p>No tasks ${emptyText[status]}</p>
        </div>
      `;
    } else {
      container.innerHTML = items.map(t => cardHtml(t)).join('');
    }
  });

  // Click to edit
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('dragging')) return;
      openEditModal(card.dataset.taskId);
    });
  });
}

function cardHtml(task) {
  const due = fmtDue(task.due_date);
  const avatar = task.assignee_avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(task.assignee_name || 'User')}`;

  return `
    <div class="card" id="task-${task.id}" data-task-id="${task.id}" data-status="${task.status}" draggable="true">
      <div class="card-top">
        <span class="priority-chip priority-${task.priority || 'medium'}">${esc(task.priority || 'medium')}</span>
        <span class="card-id">#${task.id}</span>
      </div>
      <h4 class="card-title">${esc(task.title)}</h4>
      ${task.description ? `<p class="card-desc">${esc(task.description)}</p>` : ''}
      <div class="card-foot">
        <div class="card-date ${due.cls}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${due.text}</span>
        </div>
        <div class="card-assignee" title="${esc(task.assignee_name || 'Unassigned')}">
          ${task.user_id ? `
            <img src="${esc(avatar)}" alt="${esc(task.assignee_name)}" class="card-assignee-pic"
                 onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${task.user_id}'" />
            <span class="card-assignee-label">${esc(task.assignee_name.split(' ')[0])}</span>
          ` : `<span class="card-assignee-label" style="color:var(--t3)">Unassigned</span>`}
        </div>
      </div>
    </div>
  `;
}

function fmtDue(str) {
  if (!str) return { text: 'No date', cls: '' };
  const due = new Date(str);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due - now) / 86400000);
  const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diff < 0) return { text: `${formatted} (Overdue)`, cls: 'overdue' };
  if (diff <= 2) return { text: `${formatted} (Soon)`, cls: 'soon' };
  return { text: formatted, cls: '' };
}

function updateCounters() {
  const c = { todo: 0, in_progress: 0, done: 0 };
  state.tasks.forEach(t => { if (c[t.status] !== undefined) c[t.status]++; });
  el.counters.todo.textContent = c.todo;
  el.counters.in_progress.textContent = c.in_progress;
  el.counters.done.textContent = c.done;
}

// ─── Drag and Drop ───
function setupDragAndDrop() {
  document.addEventListener('dragstart', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    state.draggedTaskId = card.dataset.taskId;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', card.dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
  });

  document.addEventListener('dragend', e => {
    const card = e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    state.draggedTaskId = null;
    document.querySelectorAll('.col-body').forEach(c => c.classList.remove('drag-over'));
  });

  Object.entries(el.taskContainers).forEach(([status, container]) => {
    container.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', e => {
      if (e.relatedTarget && !container.contains(e.relatedTarget)) {
        container.classList.remove('drag-over');
      }
    });

    container.addEventListener('drop', async e => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || state.draggedTaskId;
      if (taskId) await moveTaskStatus(taskId, status);
    });
  });
}

async function moveTaskStatus(taskId, newStatus) {
  const idx = state.tasks.findIndex(t => String(t.id) === String(taskId));
  if (idx === -1) return;

  const task = state.tasks[idx];
  const oldStatus = task.status;
  if (oldStatus === newStatus) return;

  // Optimistic update
  task.status = newStatus;
  renderTasks();
  renderTeamRoster();
  updateCounters();

  try {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Status update failed');
    const updated = await res.json();
    state.tasks[idx] = updated;
    renderTasks();
    renderTeamRoster();
    updateCounters();

    if (task.assignee_name) {
      const wipCount = state.tasks.filter(t => t.user_id === task.user_id && t.status === 'in_progress').length;
      if (wipCount > 5 && newStatus === 'in_progress') {
        showToast(`⚠️ Burnout Alert: ${task.assignee_name} has ${wipCount} tasks in progress!`, 'error');
      } else {
        showToast(`Moved "${task.title.substring(0, 30)}…" to ${newStatus.replace('_', ' ')}`, 'success');
      }
    } else {
      showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'info');
    }
  } catch {
    task.status = oldStatus;
    renderTasks();
    renderTeamRoster();
    updateCounters();
    showToast('Failed to move task — reverting', 'error');
  }
}

// ─── Event Listeners ───
function setupEventListeners() {
  // Project switch
  el.projectSelect.addEventListener('change', async e => {
    state.currentProjectId = e.target.value;
    state.filters.assignee = 'all';
    await loadBoardData();
    showToast('Project switched', 'info');
  });

  // Priority pills
  el.priorityPills.forEach(pill => {
    pill.addEventListener('click', () => {
      el.priorityPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.priority = pill.dataset.priority;
      renderTasks();
    });
  });

  // Assignee filter
  el.assigneeFilter.addEventListener('change', e => {
    state.filters.assignee = e.target.value;
    renderTeamRoster();
    renderTasks();
  });

  // Search
  el.searchInput.addEventListener('input', e => {
    state.filters.search = e.target.value.trim();
    el.clearSearchBtn.classList.toggle('hidden', state.filters.search.length === 0);
    renderTasks();
  });

  el.clearSearchBtn.addEventListener('click', () => {
    el.searchInput.value = '';
    state.filters.search = '';
    el.clearSearchBtn.classList.add('hidden');
    renderTasks();
  });

  // Burnout Demo Toggle
  el.demoRebalanceBtn.addEventListener('click', async () => {
    const alex = state.users.find(u => u.name.includes('Alex'));
    if (!alex) { showToast('Alex Mercer not found', 'info'); return; }

    const alexInProgress = state.tasks.filter(t => t.user_id === alex.id && t.status === 'in_progress');

    if (alexInProgress.length > 5) {
      await moveTaskStatus(alexInProgress[0].id, 'done');
      showToast(`Alex WIP → ${alexInProgress.length - 1}. Burnout cleared!`, 'success');
    } else {
      const taskToMove = state.tasks.find(t => t.user_id === alex.id && t.status !== 'in_progress');
      if (taskToMove) {
        await moveTaskStatus(taskToMove.id, 'in_progress');
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: state.currentProjectId,
            user_id: alex.id,
            title: 'Audit Kafka Partitioning Throughput',
            description: 'Tune cluster brokers to handle 25k rps burst workloads.',
            priority: 'urgent',
            status: 'in_progress'
          })
        });
        if (res.ok) {
          const newTask = await res.json();
          state.tasks.push(newTask);
          renderTasks();
          renderTeamRoster();
          updateCounters();
          showToast('⚠️ Burnout Triggered! Alex has > 5 in-progress tasks', 'error');
        }
      }
    }
  });

  // Open modals
  el.createTaskBtn.addEventListener('click', () => {
    el.createTaskModal.classList.remove('hidden');
    document.getElementById('taskTitle').focus();
  });

  el.addMemberBtn.addEventListener('click', () => {
    el.addMemberModal.classList.remove('hidden');
  });

  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Tab switching
  el.tabExistingMember.addEventListener('click', () => {
    el.tabExistingMember.classList.add('active');
    el.tabNewMember.classList.remove('active');
    el.existingUserSection.classList.remove('hidden');
    el.newUserSection.classList.add('hidden');
  });

  el.tabNewMember.addEventListener('click', () => {
    el.tabNewMember.classList.add('active');
    el.tabExistingMember.classList.remove('active');
    el.newUserSection.classList.remove('hidden');
    el.existingUserSection.classList.add('hidden');
  });

  // Create Task Form
  el.createTaskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const status = document.getElementById('taskStatus').value;
    const userId = document.getElementById('taskAssignee').value;
    const dueDate = document.getElementById('taskDueDate').value;

    if (!title) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: state.currentProjectId,
          user_id: userId ? Number(userId) : null,
          title, description, priority, status,
          due_date: dueDate || null
        })
      });
      if (!res.ok) throw new Error('Create failed');
      const newTask = await res.json();
      state.tasks.unshift(newTask);
      el.createTaskModal.classList.add('hidden');
      el.createTaskForm.reset();
      renderTasks();
      renderTeamRoster();
      updateCounters();
      showToast('Task created!', 'success');
    } catch {
      showToast('Failed to create task', 'error');
    }
  });

  // Add Member Form
  el.addMemberForm.addEventListener('submit', async e => {
    e.preventDefault();
    const isNew = el.tabNewMember.classList.contains('active');
    const role = el.projectRoleSelect.value;

    try {
      let userId = null;
      if (isNew) {
        const name = document.getElementById('newUserName').value.trim();
        const email = document.getElementById('newUserEmail').value.trim();
        const roleTitle = document.getElementById('newUserRoleTitle').value.trim();
        if (!name || !email) { showToast('Name and email required', 'error'); return; }
        const r = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, role: roleTitle })
        });
        if (!r.ok) throw new Error('User creation failed');
        userId = (await r.json()).id;
      } else {
        userId = el.existingUserSelect.value;
      }

      const memberRes = await fetch(`/api/projects/${state.currentProjectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role })
      });
      if (!memberRes.ok) throw new Error('Add member failed');

      el.addMemberModal.classList.add('hidden');
      el.addMemberForm.reset();
      await loadBoardData();
      showToast('Member added!', 'success');
    } catch {
      showToast('Failed to add member', 'error');
    }
  });

  // Edit Task Form
  el.editTaskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const taskId = el.editTaskId.value;
    const title = el.editTitle.value.trim();
    const description = el.editDescription.value.trim();
    const priority = el.editPriority.value;
    const status = el.editStatus.value;
    const userId = el.editAssignee.value;
    const dueDate = el.editDueDate.value;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, priority, status,
          user_id: userId ? Number(userId) : null,
          due_date: dueDate || null
        })
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      const i = state.tasks.findIndex(t => String(t.id) === String(taskId));
      if (i !== -1) state.tasks[i] = updated;
      el.taskDetailModal.classList.add('hidden');
      renderTasks();
      renderTeamRoster();
      updateCounters();
      showToast('Task updated!', 'success');
    } catch {
      showToast('Failed to update task', 'error');
    }
  });

  // Delete Task
  el.deleteTaskBtn.addEventListener('click', async () => {
    const taskId = el.editTaskId.value;
    if (!confirm('Delete this task permanently?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      state.tasks = state.tasks.filter(t => String(t.id) !== String(taskId));
      el.taskDetailModal.classList.add('hidden');
      renderTasks();
      renderTeamRoster();
      updateCounters();
      showToast('Task deleted', 'info');
    } catch {
      showToast('Failed to delete task', 'error');
    }
  });
}

function openEditModal(taskId) {
  const task = state.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  el.editTaskId.value = task.id;
  el.detailModalTaskId.textContent = `#${task.id} · ${esc(task.project_name || 'Project')}`;
  el.editTitle.value = task.title || '';
  el.editDescription.value = task.description || '';
  el.editPriority.value = task.priority || 'medium';
  el.editStatus.value = task.status || 'todo';
  el.editAssignee.value = task.user_id ? String(task.user_id) : '';
  el.editDueDate.value = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '';

  el.taskDetailModal.classList.remove('hidden');
}

// ─── Utilities ───
function showToast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${esc(message)}</span>`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', initApp);
