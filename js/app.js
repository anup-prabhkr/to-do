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
let selectedTasks = new Set();
let notificationsEnabled = false;
let reminderInterval = null;

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
const authThemeBtn = document.getElementById('auth-theme-btn');

// ─────────────────────────────────────────
// DOM Elements - Logout Modal
// ─────────────────────────────────────────
const logoutModal = document.getElementById('logout-modal');
const logoutCancel = document.getElementById('logout-cancel');
const logoutConfirm = document.getElementById('logout-confirm');

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

// ─────────────────────────────────────────
// DOM Elements - Bulk Actions
// ─────────────────────────────────────────
const bulkBar = document.getElementById('bulk-bar');
const selectAllCb = document.getElementById('select-all-cb');
const selectedCount = document.getElementById('selected-count');
const bulkCompleteBtn = document.getElementById('bulk-complete-btn');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const notifyBtn = document.getElementById('notify-btn');

// Set minimum datetime for deadline input (current time)
function updateDeadlineMin() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  deadlineInput.min = now.toISOString().slice(0, 16);
}
updateDeadlineMin();

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
  const label = light ? '☾ Dark' : '☀ Light';
  themeBtn.textContent = label;
  authThemeBtn.textContent = label;
  localStorage.setItem('theme', light ? 'light' : 'dark');
}

// Initialize theme
applyTheme(localStorage.getItem('theme') === 'light');

// Theme toggle events (both auth and app)
themeBtn.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('light'));
});

authThemeBtn.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('light'));
});

// ─────────────────────────────────────────
// Logout Modal
// ─────────────────────────────────────────
function showLogoutModal() {
  logoutModal.classList.add('show');
}

function hideLogoutModal() {
  logoutModal.classList.remove('show');
}

logoutCancel.addEventListener('click', hideLogoutModal);

logoutConfirm.addEventListener('click', async () => {
  hideLogoutModal();
  await auth.signOut();
  showToast('Signed out');
});

// Close modal on overlay click
logoutModal.addEventListener('click', (e) => {
  if (e.target === logoutModal) {
    hideLogoutModal();
  }
});

// ─────────────────────────────────────────
// Due Date Reminders (Notifications)
// ─────────────────────────────────────────
const notifiedTasks = new Set(); // Track which tasks have been notified

function checkDeadlineReminders() {
  if (!notificationsEnabled || Notification.permission !== 'granted') return;
  
  const now = new Date();
  
  tasks.forEach(task => {
    if (task.done || !task.deadline || notifiedTasks.has(task.id)) return;
    
    // Parse deadline (supports both date and datetime)
    let dueDate;
    if (task.deadline.includes('T')) {
      dueDate = new Date(task.deadline);
    } else {
      dueDate = new Date(task.deadline + 'T23:59:59');
    }
    
    const diff = dueDate - now;
    const hoursLeft = diff / (1000 * 60 * 60);
    
    // Notify if within 1 hour or overdue
    if (hoursLeft <= 1 && hoursLeft > -24) {
      notifiedTasks.add(task.id);
      
      let message;
      if (hoursLeft <= 0) {
        message = `"${task.text}" is overdue!`;
      } else if (hoursLeft <= 1) {
        message = `"${task.text}" is due in less than an hour!`;
      }
      
      new Notification('Task Reminder', {
        body: message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✓</text></svg>',
        tag: task.id
      });
    }
  });
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported');
    return;
  }
  
  if (Notification.permission === 'granted') {
    notificationsEnabled = !notificationsEnabled;
    updateNotifyBtn();
    if (notificationsEnabled) {
      startReminderCheck();
      showToast('Reminders enabled');
    } else {
      stopReminderCheck();
      showToast('Reminders disabled');
    }
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notificationsEnabled = true;
      updateNotifyBtn();
      startReminderCheck();
      showToast('Reminders enabled');
    } else {
      showToast('Notification permission denied');
    }
  } else {
    showToast('Notifications blocked by browser');
  }
}

function updateNotifyBtn() {
  notifyBtn.classList.toggle('enabled', notificationsEnabled);
  notifyBtn.textContent = notificationsEnabled ? '🔔 On' : '🔔 Reminders';
}

function startReminderCheck() {
  checkDeadlineReminders();
  reminderInterval = setInterval(checkDeadlineReminders, 60000); // Check every minute
}

function stopReminderCheck() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

notifyBtn.addEventListener('click', enableNotifications);

// ─────────────────────────────────────────
// Bulk Actions
// ─────────────────────────────────────────
function updateBulkBar() {
  const hasSelection = selectedTasks.size > 0;
  bulkBar.style.display = hasSelection ? 'flex' : 'none';
  selectedCount.textContent = `${selectedTasks.size} selected`;
  
  // Update select all checkbox
  const visibleTasks = getFilteredTasks();
  selectAllCb.checked = visibleTasks.length > 0 && 
    visibleTasks.every(t => selectedTasks.has(t.id));
  selectAllCb.indeterminate = selectedTasks.size > 0 && 
    !visibleTasks.every(t => selectedTasks.has(t.id));
}

function getFilteredTasks() {
  return tasks.filter(t => {
    if (currentFilter === 'active') return !t.done;
    if (currentFilter === 'done') return t.done;
    if (currentFilter === 'has-deadline') return !!t.deadline;
    if (currentFilter === 'no-deadline') return !t.deadline;
    return true;
  });
}

function toggleTaskSelection(id) {
  if (selectedTasks.has(id)) {
    selectedTasks.delete(id);
  } else {
    selectedTasks.add(id);
  }
  updateBulkBar();
  render();
}

selectAllCb.addEventListener('change', () => {
  const visibleTasks = getFilteredTasks();
  if (selectAllCb.checked) {
    visibleTasks.forEach(t => selectedTasks.add(t.id));
  } else {
    visibleTasks.forEach(t => selectedTasks.delete(t.id));
  }
  updateBulkBar();
  render();
});

bulkCompleteBtn.addEventListener('click', async () => {
  if (selectedTasks.size === 0) return;
  
  const ids = [...selectedTasks];
  bulkCompleteBtn.disabled = true;
  bulkCompleteBtn.textContent = 'Updating…';
  
  try {
    const batch = db.batch();
    ids.forEach(id => {
      batch.update(getUserTasksRef().doc(id), { done: true });
    });
    await batch.commit();
    
    tasks = tasks.map(t => ids.includes(t.id) ? { ...t, done: true } : t);
    selectedTasks.clear();
    updateBulkBar();
    render();
    showToast(`Completed ${ids.length} task(s)`);
  } catch (e) {
    showToast('Could not complete tasks');
  }
  
  bulkCompleteBtn.disabled = false;
  bulkCompleteBtn.textContent = '✓ Complete';
});

bulkDeleteBtn.addEventListener('click', async () => {
  if (selectedTasks.size === 0) return;
  
  const ids = [...selectedTasks];
  bulkDeleteBtn.disabled = true;
  bulkDeleteBtn.textContent = 'Deleting…';
  
  try {
    const batch = db.batch();
    ids.forEach(id => {
      batch.delete(getUserTasksRef().doc(id));
    });
    await batch.commit();
    
    tasks = tasks.filter(t => !ids.includes(t.id));
    selectedTasks.clear();
    updateBulkBar();
    render();
    showToast(`Deleted ${ids.length} task(s)`);
  } catch (e) {
    showToast('Could not delete tasks');
  }
  
  bulkDeleteBtn.disabled = false;
  bulkDeleteBtn.textContent = '✕ Delete';
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
logoutBtn.addEventListener('click', () => {
  showLogoutModal();
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
  
  const now = new Date();
  let due;
  let hasTime = false;
  
  // Check if deadline includes time
  if (deadline.includes('T')) {
    due = new Date(deadline);
    hasTime = true;
  } else {
    due = new Date(deadline + 'T23:59:59');
  }
  
  const diffMs = due - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);
  
  // Format time if present
  const timeStr = hasTime ? ' at ' + due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  
  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 0) {
      return { label: 'Overdue' + timeStr, cls: 'overdue' };
    }
    return { label: 'Overdue by ' + overdueDays + 'd', cls: 'overdue' };
  }
  
  if (diffHours <= 1) {
    return { label: 'Due in < 1hr', cls: 'today' };
  }
  
  if (diffHours <= 24) {
    const hrs = Math.ceil(diffHours);
    return { label: 'Due in ' + hrs + 'hr' + (hrs > 1 ? 's' : '') + timeStr, cls: 'today' };
  }
  
  if (diffDays <= 2) {
    return { label: 'Due in ' + diffDays + 'd' + timeStr, cls: 'soon' };
  }
  
  return { 
    label: 'Due ' + due.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: due.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }) + timeStr, 
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
      li.className = 'task-item' + (task.done ? ' done' : '') + (selectedTasks.has(task.id) ? ' selected' : '');
      li.dataset.taskId = task.id;

      // Selection checkbox
      const selectCb = document.createElement('input');
      selectCb.type = 'checkbox';
      selectCb.className = 'select-cb';
      selectCb.checked = selectedTasks.has(task.id);
      selectCb.title = 'Select for bulk action';
      selectCb.addEventListener('change', () => toggleTaskSelection(task.id));

      // Done checkbox
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
      actions.appendChild(selectCb);

      li.appendChild(checkbox);
      li.appendChild(meta);
      li.appendChild(actions);
      taskList.appendChild(li);
    });
  }

  // Update remaining count
  const activeCount = tasks.filter(t => !t.done).length;
  remaining.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''} left`;
  
  // Update bulk bar state
  updateBulkBar();
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
  // Hide selection checkbox during edit
  const selectCb = li.querySelector('.select-cb');
  if (selectCb) selectCb.style.display = 'none';
  meta.innerHTML = '';

  // Text input
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'edit-input';
  textInput.value = task.text;
  textInput.maxLength = 120;
  textInput.autocomplete = 'off';

  // Datetime input
  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.className = 'edit-deadline';
  dateInput.value = task.deadline || '';
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  dateInput.min = now.toISOString().slice(0, 16);
  dateInput.autocomplete = 'off';

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

// ─────────────────────────────────────────
// Info Modal
// ─────────────────────────────────────────
const infoModal = document.getElementById('info-modal');
const infoModalTitle = document.getElementById('info-modal-title');
const infoModalMessage = document.getElementById('info-modal-message');
const infoModalClose = document.getElementById('info-modal-close');

function showInfoModal(title, message) {
  infoModalTitle.textContent = title;
  infoModalMessage.textContent = message;
  infoModal.classList.add('show');
}

infoModalClose.addEventListener('click', () => infoModal.classList.remove('show'));
infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) infoModal.classList.remove('show');
});

// ─────────────────────────────────────────
// Voice Input
// ─────────────────────────────────────────
const micBtn = document.getElementById('mic-btn');
const voicePreview = document.getElementById('voice-preview');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  micBtn.addEventListener('click', () => {
    showInfoModal(
      '🎤 Not Supported',
      'Voice input is not supported in your current browser. Please use Google Chrome or Microsoft Edge to use this feature.'
    );
  });
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = true;       // keep listening until user stops
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let isListening = false;
  let finalTranscript = '';

  function startListening() {
    finalTranscript = taskInput.value.trim();
    isListening = true;
    micBtn.classList.add('listening');
    taskInput.placeholder = 'Listening… click mic to stop';
    voicePreview.textContent = '';
    voicePreview.style.display = 'block';
    recognition.start();
  }

  function stopListening() {
    recognition.stop();
    isListening = false;
    micBtn.classList.remove('listening');
    taskInput.placeholder = 'Add a new task…';
    voicePreview.style.display = 'none';
    voicePreview.textContent = '';
    if (finalTranscript) {
      taskInput.value = finalTranscript;
      taskInput.focus();
    }
  }

  recognition.onresult = (e) => {
    let interim = '';
    finalTranscript = taskInput.value.trim();

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalTranscript += (finalTranscript ? ' ' : '') + t.trim();
      } else {
        interim += t;
      }
    }

    // Show confirmed text in input, live preview of unconfirmed below
    taskInput.value = finalTranscript;
    voicePreview.textContent = interim ? `Hearing: "${interim}"` : '';
  };

  recognition.onerror = (e) => {
    // no-speech just means silence — stop quietly without alarming the user
    if (e.error === 'no-speech') {
      stopListening();
      return;
    }
    const msgs = {
      'not-allowed':   'Microphone access denied. Please allow mic permission and try again.',
      'audio-capture': 'No microphone found. Please connect a mic and try again.',
      'network':       'Network error during voice recognition.',
    };
    stopListening();
    showInfoModal('🎤 Voice Error', msgs[e.error] || `Voice error: ${e.error}`);
  };

  recognition.onend = () => {
    // onend fires after stop() — clean up if still marked as listening
    if (isListening) {
      stopListening();
    }
  };

  micBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
}

// ─────────────────────────────────────────
// Global Keyboard Shortcuts
// ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Don't trigger shortcuts when typing in inputs
  const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  
  // Delete key - remove selected tasks
  if (e.key === 'Delete' && !isInput) {
    if (selectedTasks.size > 0) {
      bulkDeleteBtn.click();
    }
  }
  
  // Escape - clear selection
  if (e.key === 'Escape' && !isInput) {
    if (selectedTasks.size > 0) {
      selectedTasks.clear();
      updateBulkBar();
      render();
    }
  }
  
  // Ctrl+A / Cmd+A - select all visible tasks
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInput) {
    e.preventDefault();
    const visibleTasks = getFilteredTasks();
    visibleTasks.forEach(t => selectedTasks.add(t.id));
    updateBulkBar();
    render();
  }
  
  // / or Ctrl+K - focus task input
  if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !isInput) {
    e.preventDefault();
    taskInput.focus();
  }
  
  // Ctrl+M - toggle voice input
  if (e.ctrlKey && e.key === 'm' && !isInput) {
    e.preventDefault();
    micBtn.click();
  }
});

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
