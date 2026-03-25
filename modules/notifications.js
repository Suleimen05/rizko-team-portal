const NotificationsModule = {
  notifications: [],
  pollInterval: null,

  async init() {
    this.bindEvents();
    try { await this.loadNotifications(); } catch(e) { console.error('Notif init load:', e); }
    this.updateBadges();
    this.startPolling();
  },

  async onPageEnter() {
    try { await this.loadNotifications(); } catch(e) { console.error('Notif load:', e); }
    this.renderNotifications();
    this.updateBadges();
  },

  bindEvents() {
    const readAllBtn = document.getElementById('notif-read-all');
    if (readAllBtn) {
      readAllBtn.addEventListener('click', () => this.markAllRead());
    }

    const tgBtn = document.getElementById('notif-telegram-link');
    if (tgBtn) {
      tgBtn.addEventListener('click', () => this.showTelegramModal());
    }

    const list = document.getElementById('notif-list');
    if (list) {
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.notif-item');
        if (!item) return;
        const id = item.dataset.id;
        const link = item.dataset.linkPage;
        this.markAsRead(id).then(() => {
          if (link) App.navigateTo(link);
        });
      });
    }
  },

  async loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', Auth.userId())
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.notifications = data || [];
    } catch (err) {
      console.error('Failed to load notifications:', err);
      App.showToast('Ошибка загрузки уведомлений', 'error');
    }
  },

  getIconClass(type) {
    const map = {
      task: 'task-icon',
      deadline: 'warning-icon',
      contact: 'contact-icon',
      money: 'money-icon',
      ai: 'ai-icon',
      calendar: 'calendar-icon',
      team: 'team-icon',
      warning: 'warning-icon',
      info: 'info-icon'
    };
    return map[type] || 'info-icon';
  },

  getIconSvg(type) {
    const svgs = {
      task: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
      deadline: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      contact: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      money: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
      ai: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
      calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    };
    return svgs[type] || svgs.task;
  },

  renderNotifications() {
    const container = document.getElementById('notif-list');
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Нет уведомлений</p></div>';
      return;
    }

    let html = '';
    for (const n of this.notifications) {
      const iconClass = this.getIconClass(n.type);
      const iconSvg = this.getIconSvg(n.type);
      const unreadClass = n.is_read ? '' : ' unread';
      const timeStr = App.timeAgo ? App.timeAgo(n.created_at) : App.formatDate(n.created_at);

      html += '<div class="notif-item' + unreadClass + '" data-id="' + n.id + '" data-link-page="' + App.escapeHtml(n.link_page || '') + '">'
        + '<div class="notif-icon ' + iconClass + '">' + iconSvg + '</div>'
        + '<div class="notif-content">'
        + '<p><strong>' + App.escapeHtml(n.title) + '</strong></p>'
        + (n.message ? '<p>' + App.escapeHtml(n.message) + '</p>' : '')
        + '<span class="notif-time">' + timeStr + '</span>'
        + '</div>'
        + '</div>';
    }

    container.innerHTML = html;
  },

  async markAsRead(id) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', Auth.userId());

      if (error) throw error;

      const notif = this.notifications.find(n => n.id === id);
      if (notif) notif.is_read = true;

      this.renderNotifications();
      this.updateBadges();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  async markAllRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', Auth.userId())
        .eq('is_read', false);

      if (error) throw error;

      this.notifications.forEach(n => (n.is_read = true));
      this.renderNotifications();
      this.updateBadges();
      App.showToast('Все уведомления прочитаны', 'success');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      App.showToast('Ошибка при обновлении', 'error');
    }
  },

  updateBadges() {
    const unreadCount = this.notifications.filter(n => !n.is_read).length;

    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = unreadCount > 0 ? unreadCount : '';
      badge.classList.toggle('hidden', unreadCount === 0);
    }

    const headerBadge = document.getElementById('header-notif-count');
    if (headerBadge) {
      headerBadge.textContent = unreadCount > 0 ? unreadCount : '';
      headerBadge.classList.toggle('hidden', unreadCount === 0);
    }
  },

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      await this.loadNotifications();
      this.updateBadges();
      if (document.getElementById('notif-list')) {
        this.renderNotifications();
      }
    }, 30000);
  },

  async showTelegramModal() {
    const linked = Auth.currentProfile?.telegram_chat_id;

    if (linked) {
      App.openModal('Telegram', '<p>Telegram уже привязан!</p><p class="text-muted">Вы получаете уведомления в Telegram.</p>', '<button class="btn btn-secondary" onclick="App.closeModal()">OK</button>');
      return;
    }

    const body = '<p>Нажмите кнопку ниже — откроется бот в Telegram. Нажмите <strong>Start</strong> и аккаунт привяжется автоматически.</p>'
      + '<div id="tg-link-area"><div class="spinner"></div></div>';

    App.openModal('Привязка Telegram', body, '<button class="btn btn-secondary" onclick="App.closeModal()">Отмена</button>');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(SERVER_URL + '/api/telegram/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      const area = document.getElementById('tg-link-area');
      if (area) {
        area.innerHTML = '<a href="' + App.escapeHtml(data.bot_link) + '" target="_blank" class="btn btn-primary btn-full" style="text-align:center;padding:14px;font-size:16px;">Открыть бота в Telegram</a>'
          + '<p class="text-muted" style="text-align:center;margin-top:12px;">Ссылка действует 15 минут</p>';
      }
    } catch (err) {
      console.error('Telegram link error:', err);
      const area = document.getElementById('tg-link-area');
      if (area) area.innerHTML = '<p style="color:var(--red)">Ошибка. Убедитесь что сервер запущен.</p>';
    }
  }
};
