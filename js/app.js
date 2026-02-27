/* ═══════════════════════════════════════════════════════════════════
   TASKS APP - APPLICATION LOGIC
   Main JavaScript file for the to-do application
═══════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
let tasks = [];
let currentFilter = 'all';
let authMode = 'login';

// ─────────────────────────────────────────
// DOM Elements - Auth
// ─────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authTabs = document.querySelectorAll('.auth-tab');
const authEmail = document.getElementById('auth-email');
const authPass = document.getElementById('auth-password');
const authSubmit = document.getElementById('auth-submit');
const googleBtn = document.getElementById('google-btn');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

// ─────────────────────────────────────────
// DOM Elements - App
// ─────────────────────────────────────────
const taskInput = document.getElementById('task-input');
const deadlineInput = document.getElementById('deadline-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const remaining = document.getElementById('remaining');
const clearBtn = document.getElementById('clear-btn');
const filterBtns = document.querySelectorAll('.filter-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const themeBtn = document.getElementById('theme-btn');
const logoutBtn = document.getElementById('logout-btn');
const userLabel = document.getElementById('user-email-label');
const toastEl = document.getElementById('toast');

// Set minimum date for deadline input
deadlineInput.min = new Date().toISOString().split('T')[0];

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Toast Notification
// ─────────────────────────────────────────
let toastTimer = null;

function showToast(msg, duration = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// ─────────────────────────────────────────
// Theme Management
// ─────────────────────────────────────────
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  themeBtn.textContent = light ? '☾ Dark' : '☀ Light';
  localStorage.setItem('theme', light ? 'light' : 'dark');
}

// Initialize theme
applyTheme(localStorage.getItem('theme') === 'light');

// Theme toggle event
themeBtn.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('light'));
});

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Auth UI Helpers
// ─────────────────────────────────────────
function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.add('show');
  authSuccess.classList.remove('show');
}

function showAuthSuccess(msg) {
  authSuccess.textContent = msg;
  authSuccess.classList.add('show');
  authError.classList.remove('show');
}

function hideAuthMessages() {
  authError.classList.remove('show');
  authSuccess.classList.remove('show');
}

// ─────────────────────────────────────────
// Auth Tabs
// ─────────────────────────────────────────
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    authMode = tab.dataset.tab;
    authSubmit.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    authPass.autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
    hideAuthMessages();
  });
});

// ─────────────────────────────────────────
// Email/Password Auth
// ─────────────────────────────────────────
authSubmit.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPass.value;
  
  if (!email || !password) {
    showAuthError('Please enter email and password.');
    return;
  }

  authSubmit.disabled = true;
  authSubmit.innerHTML = '<span class="spinner"></span>' + 
    (authMode === 'login' ? 'Signing in…' : 'Creating account…');
  hideAuthMessages();

  try {
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
      showAuthSuccess('Account created! You are now signed in.');
    }
  } catch (e) {
    showAuthError(e.message);
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
  }
});

// Keyboard navigation for auth form
authEmail.addEventListener('keydown', e => {
  if (e.key === 'Enter') authPass.focus();
});

authPass.addEventListener('keydown', e => {
  if (e.key === 'Enter') authSubmit.click();
});

// ─────────────────────────────────────────
// Google Auth
// ─────────────────────────────────────────
googleBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    showAuthError(e.message);
  }
});

// ─────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  await auth.signOut();
});

// ─────────────────────────────────────────
// Auth State Observer
// ─────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  // Hide loading screen
  loadingScreen.classList.add('hidden');
  
  if (user) {
    authView.style.display = 'none';
    appView.style.display = '';
    userLabel.textContent = user.email;
    await loadTasks();
    render();
  } else {
    authView.style.display = '';
    appView.style.display = 'none';
    tasks = [];
    // Reset auth form
    authEmail.value = '';
    authPass.value = '';
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    hideAuthMessages();
  }
});

// ═══════════════════════════════════════════════════════════════════
// FIRESTORE OPERATIONS
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Get User's Tasks Collection Reference
// ─────────────────────────────────────────
function getUserTasksRef() {
  const user = auth.currentUser;
  return db.collection('users').doc(user.uid).collection('tasks');
}

// ─────────────────────────────────────────
// Load Tasks
// ─────────────────────────────────────────
async function loadTasks() {
  try {
    const snapshot = await getUserTasksRef().orderBy('created_at').get();
    tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    showToast('Failed to load tasks.');
  }
}

// ─────────────────────────────────────────
// Add Task
// ─────────────────────────────────────────
async function addTask() {
  const text = taskInput.value.trim();
  const deadline = deadlineInput.value || null;
  
  if (!text) return;

  addBtn.disabled = true;
  
  try {
    const docRef = await getUserTasksRef().add({
      text,
      deadline,
      done: false,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    const newTask = { 
      id: docRef.id, 
      text, 
      deadline, 
      done: false, 
      created_at: new Date() 
    };
    
    tasks.push(newTask);
    taskInput.value = '';
    deadlineInput.value = '';
    render();
  } catch (e) {
    showToast('Could not add task.');
  }
  
  addBtn.disabled = false;
}

// ─────────────────────────────────────────
// Toggle Task Done
// ─────────────────────────────────────────
async function toggle(id) {
  const task = tasks.find(t => t.id === id);
  const newDone = !task.done;
  
  try {
    await getUserTasksRef().doc(id).update({ done: newDone });
    tasks = tasks.map(t => t.id === id ? { ...t, done: newDone } : t);
    render();
  } catch (e) {
    showToast('Could not update task.');
  }
}

// ─────────────────────────────────────────
// Remove Task
// ─────────────────────────────────────────
async function remove(id) {
  try {
    await getUserTasksRef().doc(id).delete();
    tasks = tasks.filter(t => t.id !== id);
    render();
  } catch (e) {
    showToast('Could not delete task.');
  }
}

// ─────────────────────────────────────────
// Update Task
// ─────────────────────────────────────────
async function updateTask(id, newText, newDeadline) {
  try {
    await getUserTasksRef().doc(id).update({ 
      text: newText, 
      deadline: newDeadline 
    });
    tasks = tasks.map(t => t.id === id ? { ...t, text: newText, deadline: newDeadline } : t);
    render();
  } catch (e) {
    showToast('Could not save changes.');
  }
}

// ─────────────────────────────────────────
// Clear Completed Tasks
// ─────────────────────────────────────────
async function clearCompleted() {
  const doneIds = tasks.filter(t => t.done).map(t => t.id);
  
  if (!doneIds.length) return;
  
  try {
    const batch = db.batch();
    doneIds.forEach(id => batch.delete(getUserTasksRef().doc(id)));
    await batch.commit();
    tasks = tasks.filter(t => !t.done);
    render();
  } catch (e) {
    showToast('Could not clear completed tasks.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// TASK RENDERING
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Deadline Status Helper
// ─────────────────────────────────────────
function deadlineStatus(deadline) {
  if (!deadline) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(deadline + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  
  if (diff < 0) {
    return { label: 'Overdue by ' + Math.abs(diff) + 'd', cls: 'overdue' };
  }
  if (diff === 0) {
    return { label: 'Due today', cls: 'today' };
  }
  if (diff <= 2) {
    return { label: 'Due in ' + diff + 'd', cls: 'soon' };
  }
  
  return { 
    label: 'Due ' + due.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }), 
    cls: 'upcoming' 
  };
}

// ─────────────────────────────────────────
// Main Render Function
// ─────────────────────────────────────────
function render() {
  taskList.innerHTML = '';
  
  const filtered = tasks.filter(t => {
    if (currentFilter === 'active') return !t.done;
    if (currentFilter === 'done') return t.done;
    if (currentFilter === 'has-deadline') return !!t.deadline;
    if (currentFilter === 'no-deadline') return !t.deadline;
    return true;
  });

  if (filtered.length === 0) {
    taskList.innerHTML = '<p class="empty-msg">— no tasks —</p>';
  } else {
    filtered.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' done' : '');

      // Checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.addEventListener('change', () => toggle(task.id));

      // Meta container
      const meta = document.createElement('div');
      meta.className = 'task-meta';

      // Task text
      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;
      meta.appendChild(span);

      // Deadline badge
      if (task.deadline) {
        const st = deadlineStatus(task.deadline);
        if (st) {
          const badge = document.createElement('span');
          badge.className = 'deadline-badge ' + st.cls;
          badge.textContent = st.label;
          meta.appendChild(badge);
        }
      }

      // Actions container
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '✎';
      editBtn.title = 'Edit';
      editBtn.addEventListener('click', () => startEdit(task, li, meta, actions, checkbox));

      // Delete button
      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.textContent = '✕';
      del.title = 'Delete';
      del.addEventListener('click', () => showConfirm(task.id, actions));

      actions.appendChild(editBtn);
      actions.appendChild(del);

      li.appendChild(checkbox);
      li.appendChild(meta);
      li.appendChild(actions);
      taskList.appendChild(li);
    });
  }

  // Update remaining count
  const activeCount = tasks.filter(t => !t.done).length;
  remaining.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''} left`;
}

// ─────────────────────────────────────────
// Inline Delete Confirmation
// ─────────────────────────────────────────
function showConfirm(id, actions) {
  actions.innerHTML = '';
  
  const row = document.createElement('div');
  row.className = 'confirm-row';

  const label = document.createElement('span');
  label.textContent = 'Delete?';

  const yes = document.createElement('button');
  yes.className = 'confirm-yes-btn';
  yes.textContent = 'Yes';
  yes.addEventListener('click', () => remove(id));

  const no = document.createElement('button');
  no.className = 'confirm-no-btn';
  no.textContent = 'No';
  no.addEventListener('click', () => render());

  row.appendChild(label);
  row.appendChild(yes);
  row.appendChild(no);
  actions.appendChild(row);
}

// ─────────────────────────────────────────
// Inline Edit
// ─────────────────────────────────────────
function startEdit(task, li, meta, actions, checkbox) {
  checkbox.style.display = 'none';
  actions.style.display = 'none';
  meta.innerHTML = '';

  // Text input
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'edit-input';
  textInput.value = task.text;
  textInput.maxLength = 120;

  // Date input
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'edit-deadline';
  dateInput.value = task.deadline || '';
  dateInput.min = new Date().toISOString().split('T')[0];

  // Edit actions
  const editActions = document.createElement('div');
  editActions.className = 'edit-actions';

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'edit-save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const newText = textInput.value.trim();
    if (!newText) {
      textInput.focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    await updateTask(task.id, newText, dateInput.value || null);
  });

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'edit-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => render());

  // Keyboard shortcuts
  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  editActions.appendChild(saveBtn);
  editActions.appendChild(cancelBtn);
  meta.appendChild(textInput);
  meta.appendChild(dateInput);
  meta.appendChild(editActions);
  textInput.focus();
  textInput.select();
}

// ═══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════

// Add task
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

// Filter buttons
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// Clear completed
clearBtn.addEventListener('click', clearCompleted);

// ═══════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Export Tasks
// ─────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ─────────────────────────────────────────
// Import Tasks
// ─────────────────────────────────────────
importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  
  importFile.value = '';
  
  let imported;
  try {
    imported = JSON.parse(await file.text());
  } catch {
    showToast('Invalid file.');
    return;
  }
  
  if (!Array.isArray(imported)) {
    showToast('Invalid backup format.');
    return;
  }

  const rows = imported
    .filter(t => t.text)
    .map(t => ({ 
      text: t.text, 
      done: !!t.done, 
      deadline: t.deadline || null 
    }));

  if (!rows.length) {
    showToast('No valid tasks found.');
    return;
  }

  try {
    const batch = db.batch();
    const newTasks = [];
    
    rows.forEach(row => {
      const docRef = getUserTasksRef().doc();
      batch.set(docRef, { 
        ...row, 
        created_at: firebase.firestore.FieldValue.serverTimestamp() 
      });
      newTasks.push({ id: docRef.id, ...row, created_at: new Date() });
    });
    
    await batch.commit();
    tasks = [...tasks, ...newTasks];
    render();
    showToast(`Imported ${newTasks.length} task(s).`);
  } catch (e) {
    showToast('Import failed: ' + e.message);
  }
});
