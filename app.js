// ===== MAIN APPLICATION =====

const App = {
  currentPage: 'dashboard',
  modules: {},

  async init() {
    this.bindNavigation();
    this.bindModals();
    this.bindMobileMenu();
    try {
      await Auth.init();
    } catch (e) {
      console.error('Auth init failed:', e);
      Auth.showLogin();
    }
  },

  // Called after successful auth
  async onAuth(profile) {
    // Initialize all modules — direct references (const doesn't create window properties)
    const moduleList = [
      ['dashboard', typeof DashboardModule !== 'undefined' ? DashboardModule : null],
      ['contacts', typeof ContactsModule !== 'undefined' ? ContactsModule : null],
      ['tasks', typeof TasksModule !== 'undefined' ? TasksModule : null],
      ['strategy', typeof StrategyModule !== 'undefined' ? StrategyModule : null],
      ['reports', typeof ReportsModule !== 'undefined' ? ReportsModule : null],
      ['chat', typeof ChatModule !== 'undefined' ? ChatModule : null],
      ['team', typeof TeamModule !== 'undefined' ? TeamModule : null],
      ['calendar', typeof CalendarModule !== 'undefined' ? CalendarModule : null],
      ['scripts', typeof ScriptsModule !== 'undefined' ? ScriptsModule : null],
      ['wiki', typeof WikiModule !== 'undefined' ? WikiModule : null],
      ['files', typeof FilesModule !== 'undefined' ? FilesModule : null],
      ['finance', typeof FinanceModule !== 'undefined' ? FinanceModule : null],
      ['notifications', typeof NotificationsModule !== 'undefined' ? NotificationsModule : null],
      ['platforms', typeof PlatformsModule !== 'undefined' ? PlatformsModule : null],
    ];

    for (const [name, mod] of moduleList) {
      if (!mod) continue;
      try {
        this.modules[name] = mod;
        await mod.init();
      } catch (e) {
        console.error(`Module ${name} init failed:`, e);
      }
    }

    // Init admin module if admin
    if (Auth.isAdmin() && typeof AdminModule !== 'undefined') {
      try {
        this.modules.admin = AdminModule;
        await AdminModule.init();
      } catch (e) {
        console.error('AdminModule init failed:', e);
      }
    }

    // Load dashboard
    this.navigateTo('dashboard');
  },

  // ===== NAVIGATION =====
  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) this.navigateTo(page);
      });
    });
  },

  navigateTo(page) {
    this.currentPage = page;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // Notify module
    const moduleName = page.replace('-', '');
    const mod = page === 'ai-chat' ? this.modules.chat :
                page === 'ai_chat' ? this.modules.chat :
                this.modules[moduleName];
    if (mod && mod.onPageEnter) {
      Promise.resolve(mod.onPageEnter()).catch(e => console.error('onPageEnter error for', page, e));
    }

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  },

  // ===== MOBILE MENU =====
  bindMobileMenu() {
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('sidebar');
      const toggle = document.getElementById('menuToggle');
      if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  },

  // ===== UNIVERSAL MODAL =====
  bindModals() {
    document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        document.getElementById('task-detail-overlay').classList.remove('open');
        document.getElementById('confirm-overlay').classList.remove('open');
      }
    });
  },

  openModal(titleOrHtml, bodyHtml, footerHtml, opts) {
    // Support multiple call signatures:
    // openModal(bodyHtml) — 1 arg
    // openModal(title, bodyHtml) — 2 args
    // openModal(title, bodyHtml, footerHtml) — 3 args
    // openModal(title, bodyHtml, opts) — 3 args where 3rd is object
    // openModal(title, bodyHtml, footerHtml, opts) — 4 args
    if (bodyHtml === undefined) {
      // 1 arg: treat as body
      bodyHtml = titleOrHtml;
      titleOrHtml = '';
      footerHtml = '';
      opts = {};
    } else if (footerHtml === undefined) {
      // 2 args: title + body
      footerHtml = '';
      opts = {};
    } else if (typeof footerHtml === 'object' && footerHtml !== null) {
      // 3 args where 3rd is options
      opts = footerHtml;
      footerHtml = '';
    } else {
      opts = opts || {};
    }
    document.getElementById('modal-title').textContent = titleOrHtml;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml || '';
    const container = document.getElementById('modal-container');
    container.className = 'modal' + (opts.large ? ' modal-lg' : '');
    document.getElementById('modal-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  },

  // ===== CONFIRM DIALOG =====
  // Supports both callback and Promise patterns:
  // App.confirm(title, message, callback) — callback style
  // await App.confirm(message) — promise style (1 arg)
  // await App.confirm(title, message) — promise style (2 args)
  confirm(title, message, onConfirm, confirmText = 'Удалить') {
    // Handle different call signatures
    if (typeof message === 'function') {
      onConfirm = message;
      message = title;
      title = 'Подтверждение';
    } else if (typeof message === 'undefined') {
      message = title;
      title = 'Подтверждение';
    }

    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-ok-btn');
    btn.textContent = confirmText;
    btn.className = confirmText === 'Удалить' ? 'btn btn-danger' : 'btn btn-primary';

    if (typeof onConfirm === 'function') {
      // Callback style
      btn.onclick = () => {
        document.getElementById('confirm-overlay').classList.remove('open');
        onConfirm();
      };
      document.getElementById('confirm-overlay').classList.add('open');
    } else {
      // Promise style
      return new Promise((resolve) => {
        btn.onclick = () => {
          document.getElementById('confirm-overlay').classList.remove('open');
          resolve(true);
        };
        // Cancel button
        const cancelBtn = document.querySelector('#confirm-overlay .btn-secondary');
        const origCancel = cancelBtn.onclick;
        cancelBtn.onclick = () => {
          document.getElementById('confirm-overlay').classList.remove('open');
          resolve(false);
        };
        document.getElementById('confirm-overlay').classList.add('open');
      });
    }
  },

  // ===== TOAST NOTIFICATIONS =====
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // ===== HELPERS =====
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${this.formatDate(dateStr)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  formatCurrency(amount, currency) {
    currency = currency || CONFIG.defaultCurrency;
    const sym = CONFIG.currencies[currency]?.symbol || '$';
    return `${sym}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  },

  timeAgo(dateStr) {
    const now = Date.now();
    const d = new Date(dateStr).getTime();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад';
    if (diff < 604800) return Math.floor(diff / 86400) + ' д назад';
    return this.formatDate(dateStr);
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Build form group HTML helper
  formGroup(label, inputHtml, id) {
    return `<div class="form-group"><label>${label}</label>${inputHtml}</div>`;
  },

  formRow(...groups) {
    return `<div class="form-row">${groups.join('')}</div>`;
  },

  selectOptions(options, selected) {
    return options.map(o => {
      const val = typeof o === 'string' ? o : o.value;
      const text = typeof o === 'string' ? o : (o.text || o.label || o.value);
      return `<option value="${val}" ${val === selected ? 'selected' : ''}>${text}</option>`;
    }).join('');
  },

  // Get all team members for selects
  async getTeamMembers() {
    const { data } = await supabase.from('profiles').select('id, full_name, initials').eq('is_active', true);
    return data || [];
  },
};

// Admin Module (inline since it's small)
const AdminModule = {
  async init() {
    document.getElementById('admin-add-user-btn')?.addEventListener('click', () => this.showCreateUser());
    await this.loadUsers();
  },

  async loadUsers() {
    const users = await Auth.getUsers();
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><div class="contact-cell"><div class="avatar-sm">${App.escapeHtml(u.initials)}</div><span>${App.escapeHtml(u.full_name)}</span></div></td>
        <td>${App.escapeHtml(u.email)}</td>
        <td><span class="badge-tag ${u.role}">${u.role}</span></td>
        <td>${App.formatCurrency(u.hourly_rate, u.currency)}/ч</td>
        <td><span class="status-dot ${u.is_active ? 'active' : 'inactive'}"></span> ${u.is_active ? 'Активен' : 'Неактивен'}</td>
        <td>${u.telegram_chat_id ? 'Привязан' : '—'}</td>
        <td>
          <button class="btn-icon" onclick="AdminModule.showEditUser('${u.id}')">Edit</button>
        </td>
      </tr>
    `).join('');
  },

  showCreateUser() {
    const body = `
      ${App.formGroup('Полное имя', '<input type="text" id="admin-name" placeholder="Имя Фамилия" />')}
      ${App.formRow(
        App.formGroup('Инициалы', '<input type="text" id="admin-initials" placeholder="AK" maxlength="3" />'),
        App.formGroup('Роль', `<select id="admin-role">${App.selectOptions([
          {value:'member',text:'Сотрудник'},{value:'admin',text:'Админ'},{value:'viewer',text:'Наблюдатель'}
        ])}</select>`)
      )}
      ${App.formGroup('Email', '<input type="email" id="admin-email" placeholder="user@rizko.ai" />')}
      ${App.formGroup('Пароль', '<input type="password" id="admin-pass" placeholder="Минимум 6 символов" />')}
      ${App.formRow(
        App.formGroup('Ставка ($/час)', '<input type="number" id="admin-rate" value="0" min="0" />'),
        App.formGroup('Валюта', `<select id="admin-currency">${App.selectOptions([
          {value:'USD',text:'USD ($)'},{value:'KZT',text:'KZT (₸)'}
        ])}</select>`)
      )}
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Отмена</button>
      <button class="btn btn-primary" onclick="AdminModule.createUser()">Создать</button>
    `;
    App.openModal('Создать пользователя', body, footer);
  },

  async createUser() {
    const userData = {
      email: document.getElementById('admin-email').value.trim(),
      password: document.getElementById('admin-pass').value,
      full_name: document.getElementById('admin-name').value.trim(),
      initials: document.getElementById('admin-initials').value.trim().toUpperCase(),
      role: document.getElementById('admin-role').value,
      hourly_rate: parseFloat(document.getElementById('admin-rate').value) || 0,
      currency: document.getElementById('admin-currency').value,
    };

    if (!userData.email || !userData.password || !userData.full_name) {
      App.showToast('Заполните все обязательные поля', 'error');
      return;
    }
    if (userData.password.length < 6) {
      App.showToast('Пароль минимум 6 символов', 'error');
      return;
    }

    try {
      await Auth.createUser(userData);
      App.showToast('Пользователь создан');
      App.closeModal();
      await this.loadUsers();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async showEditUser(userId) {
    const { data: user } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!user) return;

    const body = `
      ${App.formGroup('Полное имя', `<input type="text" id="edit-name" value="${App.escapeHtml(user.full_name)}" />`)}
      ${App.formRow(
        App.formGroup('Инициалы', `<input type="text" id="edit-initials" value="${App.escapeHtml(user.initials)}" maxlength="3" />`),
        App.formGroup('Роль', `<select id="edit-role">${App.selectOptions([
          {value:'member',text:'Сотрудник'},{value:'admin',text:'Админ'},{value:'viewer',text:'Наблюдатель'},{value:'super_admin',text:'Супер-админ'}
        ], user.role)}</select>`)
      )}
      ${App.formRow(
        App.formGroup('Ставка', `<input type="number" id="edit-rate" value="${user.hourly_rate}" min="0" />`),
        App.formGroup('Валюта', `<select id="edit-currency">${App.selectOptions([
          {value:'USD',text:'USD ($)'},{value:'KZT',text:'KZT (₸)'}
        ], user.currency)}</select>`)
      )}
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Отмена</button>
      ${user.is_active
        ? `<button class="btn btn-danger" onclick="AdminModule.toggleActive('${userId}', false)">Деактивировать</button>`
        : `<button class="btn btn-primary" onclick="AdminModule.toggleActive('${userId}', true)">Активировать</button>`
      }
      <button class="btn btn-primary" onclick="AdminModule.saveUser('${userId}')">Сохранить</button>
    `;
    App.openModal('Редактировать пользователя', body, footer);
  },

  async saveUser(userId) {
    try {
      await Auth.updateUser(userId, {
        full_name: document.getElementById('edit-name').value.trim(),
        initials: document.getElementById('edit-initials').value.trim().toUpperCase(),
        role: document.getElementById('edit-role').value,
        hourly_rate: parseFloat(document.getElementById('edit-rate').value) || 0,
        currency: document.getElementById('edit-currency').value,
      });
      App.showToast('Пользователь обновлён');
      App.closeModal();
      await this.loadUsers();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async toggleActive(userId, active) {
    try {
      await Auth.updateUser(userId, { is_active: active });
      App.showToast(active ? 'Пользователь активирован' : 'Пользователь деактивирован');
      App.closeModal();
      await this.loadUsers();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => App.init());
