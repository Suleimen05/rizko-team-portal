const CalendarModule = {
  currentDate: new Date(),
  posts: [],
  members: [],

  MONTHS_RU: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ],

  STATUS_LABELS: {
    idea: 'Идея',
    filming: 'Снято',
    editing: 'Монтаж',
    published: 'Опубликовано'
  },

  PLATFORM_ICONS: {
    'TikTok': '♪',
    'YouTube Shorts': '▶',
    'Instagram Reels': '◎'
  },

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { this.members = await App.getTeamMembers(); } catch(e) { this.members = []; }
    try { await this.loadPosts(); } catch(e) { console.error('Calendar load error:', e); }
    this.renderCalendar();
    this.renderPipeline();
  },

  bindEvents() {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendar();
      this.loadPosts();
    });

    document.getElementById('cal-next')?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendar();
      this.loadPosts();
    });

    document.getElementById('calendar-add-btn')?.addEventListener('click', () => {
      this.showAddModal(new Date().toISOString().slice(0, 10));
    });

    // Event delegation on grid for day clicks and post clicks
    const grid = document.getElementById('cal-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const post = e.target.closest('.cal-post');
        if (post) {
          e.stopPropagation();
          const postId = post.dataset.postId;
          if (postId) this.showEditModal(postId);
          return;
        }

        const day = e.target.closest('.cal-day');
        if (day && day.dataset.date) {
          this.showAddModal(day.dataset.date);
        }
      });
    }
  },

  async loadPosts() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startStr = firstDay.toISOString().slice(0, 10);
    const endStr = lastDay.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('calendar_posts')
      .select('*, assignee:profiles!assignee_id(id, full_name)')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error loading posts:', error);
      App.showToast('Ошибка загрузки постов', 'error');
      return;
    }

    this.posts = data || [];
    this.renderCalendar();
    this.renderPipeline();
  },

  renderCalendar() {
    const grid = document.getElementById('cal-grid');
    const label = document.getElementById('cal-month-label');
    if (!grid || !label) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    label.textContent = this.MONTHS_RU[month] + ' ' + year;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    let startDow = firstDayOfMonth.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const prevMonthLast = new Date(year, month, 0).getDate();

    // PREPEND day-of-week headers
    let html = '';
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayNames.forEach(name => {
      html += '<div class="cal-header">' + name + '</div>';
    });

    // Previous month fill
    for (let i = startDow - 1; i >= 0; i--) {
      const day = prevMonthLast - i;
      html += '<div class="cal-day next-month"><span class="cal-date">' + day + '</span></div>';
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const dow = new Date(year, month, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;

      const dayPosts = this.posts.filter(p => p.scheduled_date === dateStr);

      let classes = 'cal-day';
      if (isWeekend) classes += ' weekend';
      if (isToday) classes += ' today';
      if (isPast && !isToday) classes += ' past';

      let postsHtml = '';
      dayPosts.forEach(post => {
        const icon = this.PLATFORM_ICONS[post.platform] || '';
        const initials = this._getInitials(post.assignee?.full_name);
        const truncTitle = App.escapeHtml((post.title || '').length > 12
          ? post.title.slice(0, 12) + '...'
          : post.title || '');

        postsHtml += '<div class="cal-post ' + (post.status || '') + '" data-post-id="' + post.id + '" title="' + App.escapeHtml(post.title || '') + '">'
          + '<span class="cal-post-platform">' + icon + '</span>'
          + '<span class="cal-post-title">' + truncTitle + '</span>'
          + '<span class="cal-post-assignee">' + App.escapeHtml(initials) + '</span>'
          + '</div>';
      });

      html += '<div class="' + classes + '" data-date="' + dateStr + '">'
        + '<span class="cal-date">' + d + '</span>'
        + postsHtml
        + '</div>';
    }

    // Next month fill
    const totalCells = startDow + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      html += '<div class="cal-day next-month"><span class="cal-date">' + i + '</span></div>';
    }

    grid.innerHTML = html;
  },

  renderPipeline() {
    const pipeline = document.getElementById('cal-pipeline');
    if (!pipeline) return;

    const counts = { idea: 0, filming: 0, editing: 0, published: 0 };
    this.posts.forEach(p => {
      if (counts.hasOwnProperty(p.status)) counts[p.status]++;
    });

    let html = '<div class="pipeline-bar">';
    for (const [status, label] of Object.entries(this.STATUS_LABELS)) {
      html += '<div class="pipeline-step">'
        + '<span class="pipeline-dot ' + status + '"></span>'
        + '<strong>' + label + '</strong>: ' + counts[status]
        + '</div>';
      if (status !== 'published') {
        html += '<span class="pipeline-arrow">&rarr;</span>';
      }
    }
    html += '</div>';

    pipeline.innerHTML = html;
  },

  showAddModal(date) {
    const membersOptions = App.selectOptions(
      this.members.map(m => ({ value: m.id, label: m.full_name })),
      ''
    );

    const platformOptions = App.selectOptions([
      { value: 'TikTok', label: 'TikTok' },
      { value: 'YouTube Shorts', label: 'YouTube Shorts' },
      { value: 'Instagram Reels', label: 'Instagram Reels' }
    ], '');

    const statusOptions = App.selectOptions([
      { value: 'idea', label: 'Идея' },
      { value: 'filming', label: 'Снято' },
      { value: 'editing', label: 'Монтаж' },
      { value: 'published', label: 'Опубликовано' }
    ], 'idea');

    const body = `
      <form id="cal-post-form">
        ${App.formGroup('Заголовок', '<input type="text" id="cp-title" class="form-control" required />')}
        ${App.formGroup('Платформа', '<select id="cp-platform" class="form-control">' + platformOptions + '</select>')}
        ${App.formGroup('Статус', '<select id="cp-status" class="form-control">' + statusOptions + '</select>')}
        ${App.formRow(
          App.formGroup('Ответственный', '<select id="cp-assignee" class="form-control"><option value="">-- Выбрать --</option>' + membersOptions + '</select>'),
          App.formGroup('Дата', '<input type="date" id="cp-date" class="form-control" value="' + (date || '') + '" required />')
        )}
        ${App.formGroup('Описание', '<textarea id="cp-description" class="form-control" rows="3"></textarea>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
    `;

    App.openModal('Новый пост', body, footer);

    const modalFooter = document.getElementById('modal-footer');
    if (modalFooter) {
      modalFooter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'cancel') App.closeModal();
        if (btn.dataset.action === 'save') this.savePost(null);
      });
    }

    const form = document.getElementById('cal-post-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePost(null);
      });
    }
  },

  showEditModal(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const membersOptions = App.selectOptions(
      this.members.map(m => ({ value: m.id, label: m.full_name })),
      post.assignee_id || ''
    );

    const platformOptions = App.selectOptions([
      { value: 'TikTok', label: 'TikTok' },
      { value: 'YouTube Shorts', label: 'YouTube Shorts' },
      { value: 'Instagram Reels', label: 'Instagram Reels' }
    ], post.platform || '');

    const statusOptions = App.selectOptions([
      { value: 'idea', label: 'Идея' },
      { value: 'filming', label: 'Снято' },
      { value: 'editing', label: 'Монтаж' },
      { value: 'published', label: 'Опубликовано' }
    ], post.status || 'idea');

    const body = `
      <form id="cal-post-form">
        ${App.formGroup('Заголовок', '<input type="text" id="cp-title" class="form-control" value="' + App.escapeHtml(post.title || '') + '" required />')}
        ${App.formGroup('Платформа', '<select id="cp-platform" class="form-control">' + platformOptions + '</select>')}
        ${App.formGroup('Статус', '<select id="cp-status" class="form-control">' + statusOptions + '</select>')}
        ${App.formRow(
          App.formGroup('Ответственный', '<select id="cp-assignee" class="form-control"><option value="">-- Выбрать --</option>' + membersOptions + '</select>'),
          App.formGroup('Дата', '<input type="date" id="cp-date" class="form-control" value="' + (post.scheduled_date || '') + '" required />')
        )}
        ${App.formGroup('Описание', '<textarea id="cp-description" class="form-control" rows="3">' + App.escapeHtml(post.description || '') + '</textarea>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-danger" data-action="delete">Удалить</button>
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
    `;

    App.openModal('Редактировать пост', body, footer);

    const modalFooter = document.getElementById('modal-footer');
    if (modalFooter) {
      modalFooter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'cancel') App.closeModal();
        if (btn.dataset.action === 'save') this.savePost(post.id);
        if (btn.dataset.action === 'delete') this.deletePost(post.id);
      });
    }

    const form = document.getElementById('cal-post-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePost(post.id);
      });
    }
  },

  async savePost(id) {
    const title = document.getElementById('cp-title')?.value?.trim();
    const platform = document.getElementById('cp-platform')?.value;
    const status = document.getElementById('cp-status')?.value;
    const assignee_id = document.getElementById('cp-assignee')?.value || null;
    const scheduled_date = document.getElementById('cp-date')?.value;
    const description = document.getElementById('cp-description')?.value?.trim();

    if (!title || !scheduled_date) {
      App.showToast('Заполните обязательные поля', 'error');
      return;
    }

    const payload = {
      title,
      platform,
      status,
      assignee_id,
      scheduled_date,
      description,
      updated_at: new Date().toISOString()
    };

    let error;

    if (id) {
      ({ error } = await supabase
        .from('calendar_posts')
        .update(payload)
        .eq('id', id));
    } else {
      payload.created_by = Auth.userId();
      payload.created_at = new Date().toISOString();
      ({ error } = await supabase
        .from('calendar_posts')
        .insert(payload));
    }

    if (error) {
      console.error('Error saving post:', error);
      App.showToast('Ошибка сохранения', 'error');
      return;
    }

    App.closeModal();
    App.showToast(id ? 'Пост обновлён' : 'Пост создан', 'success');
    await this.loadPosts();
  },

  async deletePost(id) {
    const confirmed = await App.confirm('Удалить пост', 'Удалить этот пост?');
    if (!confirmed) return;

    const { error } = await supabase
      .from('calendar_posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting post:', error);
      App.showToast('Ошибка удаления', 'error');
      return;
    }

    App.closeModal();
    App.showToast('Пост удалён', 'success');
    await this.loadPosts();
  },

  _getInitials(fullName) {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    return parts.map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2);
  }
};
