// ===== PAGE NAVIGATION =====
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  });
});

// ===== MOBILE MENU =====
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menuToggle');
  if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ===== FILTER TABS =====
document.querySelectorAll('.filter-tabs').forEach(tabs => {
  tabs.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
});

// ===== TEAM TIMERS =====
const timers = {
  akyl: { seconds: 4 * 3600 + 32 * 60 + 15, running: true },
  lujan: { seconds: 2 * 3600 + 17 * 60 + 43, running: true },
  nurdos: { seconds: 0, running: false },
};

function formatTime(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateTimerDisplays() {
  Object.keys(timers).forEach(name => {
    const el = document.getElementById('timer-' + name);
    if (el) el.textContent = formatTime(timers[name].seconds);
  });
}

function toggleTimer(name) {
  const timer = timers[name];
  timer.running = !timer.running;

  const card = document.getElementById('timer-' + name)?.closest('.team-member-card');
  const btn = card?.querySelector('.btn-sm');
  const timerVal = document.getElementById('timer-' + name);

  if (timer.running) {
    card?.classList.add('online');
    if (btn) { btn.textContent = 'Пауза'; btn.className = 'btn btn-sm btn-stop'; }
    timerVal?.classList.remove('off');
    const badge = card?.querySelector('.offline-badge');
    if (badge) { badge.textContent = 'Online'; badge.className = 'online-badge'; }
  } else {
    card?.classList.remove('online');
    if (btn) { btn.textContent = 'Начать'; btn.className = 'btn btn-sm btn-start'; }
    const badge = card?.querySelector('.online-badge');
    if (badge) { badge.textContent = 'Offline'; badge.className = 'offline-badge'; }
  }
}

setInterval(() => {
  Object.keys(timers).forEach(name => {
    if (timers[name].running) {
      timers[name].seconds++;
    }
  });
  updateTimerDisplays();
}, 1000);

// ===== CHAT INPUT AUTO-RESIZE =====
const chatTextarea = document.querySelector('.chat-input-wrap textarea');
if (chatTextarea) {
  chatTextarea.addEventListener('input', () => {
    chatTextarea.style.height = 'auto';
    chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 120) + 'px';
  });
}
