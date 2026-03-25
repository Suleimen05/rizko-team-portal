const ScriptsModule = {
  scripts: [],
  filter: 'all',
  searchQuery: '',

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { await this.loadScripts(); } catch(e) { console.error('Scripts load:', e); }
    this.renderScripts();
  },

  bindEvents() {
    const addBtn = document.getElementById('scripts-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddModal());
    }

    const filterTabs = document.getElementById('scripts-filter-tabs');
    if (filterTabs) {
      filterTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab[data-filter]');
        if (!tab) return;
        this.filter = tab.dataset.filter;
        filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderScripts();
      });
    }

    const searchInput = document.getElementById('scripts-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderScripts();
      });
    }

    // Event delegation on grid for card clicks
    const grid = document.getElementById('scripts-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const card = e.target.closest('.script-card');
        if (card && card.dataset.id) {
          this.showViewModal(card.dataset.id);
        }
      });
    }
  },

  async loadScripts() {
    const { data, error } = await supabase
      .from('scripts')
      .select('*, creator:created_by(id, full_name, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading scripts:', error);
      App.showToast('Ошибка загрузки скриптов', 'error');
      return;
    }

    this.scripts = data || [];
  },

  renderScripts() {
    const grid = document.getElementById('scripts-grid');
    if (!grid) return;

    let filtered = this.scripts;

    if (this.filter !== 'all') {
      filtered = filtered.filter(s => s.category === this.filter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.content && s.content.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Скрипты не найдены</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(script => {
      const preview = script.content
        ? App.escapeHtml(script.content.length > 120 ? script.content.substring(0, 120) + '...' : script.content)
        : '';
      const tagsHtml = (script.tags || []).map(t =>
        '<span class="script-tag">' + App.escapeHtml(t) + '</span>'
      ).join('');

      return '<div class="script-card" data-id="' + script.id + '">'
        + '<div class="script-header">'
          + '<span class="badge-tag">' + App.escapeHtml(script.category || '') + '</span>'
          + '<span class="script-platform">' + App.escapeHtml(script.platform || '') + '</span>'
          + '<span class="script-date">' + App.formatDate(script.created_at) + '</span>'
        + '</div>'
        + '<div class="script-title">' + App.escapeHtml(script.title || '') + '</div>'
        + '<p class="script-preview">' + preview + '</p>'
        + '<div class="script-footer">'
          + '<div class="script-tags">' + tagsHtml + '</div>'
          + '<div class="script-meta">'
            + '<span title="Использовано раз">' + (script.times_used || 0) + ' исп.</span>'
          + '</div>'
        + '</div>'
      + '</div>';
    }).join('');
  },

  showAddModal() {
    const categoryOptions = App.selectOptions([
      { value: 'AI/Tech', label: 'AI/Tech' },
      { value: 'Стартап', label: 'Стартап' },
      { value: 'Маркетинг', label: 'Маркетинг' },
      { value: 'Лайфстайл', label: 'Лайфстайл' }
    ], '');

    const platformOptions = App.selectOptions([
      { value: 'TikTok', label: 'TikTok' },
      { value: 'YouTube Shorts', label: 'YouTube Shorts' },
      { value: 'Instagram Reels', label: 'Instagram Reels' }
    ], '');

    const body = `
      <form id="script-form">
        ${App.formGroup('Название', '<input type="text" id="script-title" class="form-control" required>')}
        ${App.formRow(
          App.formGroup('Категория', '<select id="script-category" class="form-control" required>' + categoryOptions + '</select>'),
          App.formGroup('Платформа', '<select id="script-platform" class="form-control" required>' + platformOptions + '</select>')
        )}
        ${App.formGroup('Текст скрипта', '<textarea id="script-content" class="form-control" rows="8" required></textarea>')}
        ${App.formGroup('Теги (через запятую)', '<input type="text" id="script-tags" class="form-control" placeholder="тег1, тег2, тег3">')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Создать</button>
    `;

    App.openModal('Новый скрипт', body, footer);
    this._bindModalFooter(null);

    const form = document.getElementById('script-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveScript(null);
      });
    }
  },

  showViewModal(id) {
    const script = this.scripts.find(s => s.id === id);
    if (!script) return;

    const isOwner = script.created_by === Auth.userId();
    const canEdit = isOwner || Auth.isAdmin();

    const authorName = script.creator ? App.escapeHtml(script.creator.full_name || 'Без имени') : 'Неизвестно';
    const tagsHtml = (script.tags || []).map(t => '<span class="script-tag">' + App.escapeHtml(t) + '</span>').join('');

    const body = `
      <div class="script-header">
        <span class="badge-tag">${App.escapeHtml(script.category || '')}</span>
        <span class="script-platform">${App.escapeHtml(script.platform || '')}</span>
        <span class="script-date">${App.formatDate(script.created_at)}</span>
      </div>
      <div class="script-preview">
        <pre>${App.escapeHtml(script.content || '')}</pre>
      </div>
      <div class="script-footer">
        <div class="script-tags">${tagsHtml}</div>
        <div class="script-meta">
          <span>Автор: ${authorName}</span>
          <span>Использовано: ${script.times_used || 0} раз</span>
        </div>
      </div>
    `;

    let footer = '<button type="button" class="btn btn-secondary" data-action="cancel">Закрыть</button>'
      + '<button type="button" class="btn btn-success" data-action="use">Использовать</button>';
    if (canEdit) {
      footer += '<button type="button" class="btn btn-primary" data-action="edit">Редактировать</button>'
        + '<button type="button" class="btn btn-danger" data-action="delete">Удалить</button>';
    }

    App.openModal(App.escapeHtml(script.title || 'Скрипт'), body, footer);

    const modalFooter = document.getElementById('modal-footer');
    if (modalFooter) {
      modalFooter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'cancel') App.closeModal();
        if (action === 'use') this.incrementUsage(id);
        if (action === 'edit') this.showEditFormModal(id);
        if (action === 'delete') this.deleteScript(id);
      });
    }
  },

  showEditFormModal(id) {
    const script = this.scripts.find(s => s.id === id);
    if (!script) return;

    const categoryOptions = App.selectOptions([
      { value: 'AI/Tech', label: 'AI/Tech' },
      { value: 'Стартап', label: 'Стартап' },
      { value: 'Маркетинг', label: 'Маркетинг' },
      { value: 'Лайфстайл', label: 'Лайфстайл' }
    ], script.category || '');

    const platformOptions = App.selectOptions([
      { value: 'TikTok', label: 'TikTok' },
      { value: 'YouTube Shorts', label: 'YouTube Shorts' },
      { value: 'Instagram Reels', label: 'Instagram Reels' }
    ], script.platform || '');

    const tagsStr = (script.tags || []).join(', ');

    const body = `
      <form id="script-form">
        ${App.formGroup('Название', '<input type="text" id="script-title" class="form-control" value="' + App.escapeHtml(script.title || '') + '" required>')}
        ${App.formRow(
          App.formGroup('Категория', '<select id="script-category" class="form-control" required>' + categoryOptions + '</select>'),
          App.formGroup('Платформа', '<select id="script-platform" class="form-control" required>' + platformOptions + '</select>')
        )}
        ${App.formGroup('Текст скрипта', '<textarea id="script-content" class="form-control" rows="8" required>' + App.escapeHtml(script.content || '') + '</textarea>')}
        ${App.formGroup('Теги (через запятую)', '<input type="text" id="script-tags" class="form-control" value="' + App.escapeHtml(tagsStr) + '">')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
    `;

    App.openModal('Редактировать скрипт', body, footer);
    this._bindModalFooter(id);

    const form = document.getElementById('script-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveScript(id);
      });
    }
  },

  _bindModalFooter(scriptId) {
    const modalFooter = document.getElementById('modal-footer');
    if (modalFooter) {
      modalFooter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'cancel') App.closeModal();
        if (btn.dataset.action === 'save') this.saveScript(scriptId);
      });
    }
  },

  async saveScript(id) {
    const title = document.getElementById('script-title').value.trim();
    const content = document.getElementById('script-content').value.trim();
    const category = document.getElementById('script-category').value;
    const platform = document.getElementById('script-platform').value;
    const tagsRaw = document.getElementById('script-tags').value;
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    if (!title || !content) {
      App.showToast('Заполните обязательные поля', 'error');
      return;
    }

    const payload = {
      title,
      content,
      category,
      platform,
      tags,
      updated_at: new Date().toISOString()
    };

    let error;

    if (id) {
      const res = await supabase.from('scripts').update(payload).eq('id', id);
      error = res.error;
    } else {
      payload.created_by = Auth.userId();
      payload.times_used = 0;
      const res = await supabase.from('scripts').insert(payload);
      error = res.error;
    }

    if (error) {
      console.error('Error saving script:', error);
      App.showToast('Ошибка сохранения скрипта', 'error');
      return;
    }

    App.closeModal();
    App.showToast(id ? 'Скрипт обновлен' : 'Скрипт создан', 'success');
    await this.loadScripts();
    this.renderScripts();
  },

  async deleteScript(id) {
    const confirmed = await App.confirm('Удалить скрипт', 'Вы уверены, что хотите удалить этот скрипт?');
    if (!confirmed) return;

    const { error } = await supabase.from('scripts').delete().eq('id', id);

    if (error) {
      console.error('Error deleting script:', error);
      App.showToast('Ошибка удаления скрипта', 'error');
      return;
    }

    App.closeModal();
    App.showToast('Скрипт удален', 'success');
    await this.loadScripts();
    this.renderScripts();
  },

  async incrementUsage(id) {
    const script = this.scripts.find(s => s.id === id);
    if (!script) return;

    const newCount = (script.times_used || 0) + 1;
    const { error } = await supabase
      .from('scripts')
      .update({ times_used: newCount })
      .eq('id', id);

    if (error) {
      console.error('Error incrementing usage:', error);
      App.showToast('Ошибка обновления счетчика', 'error');
      return;
    }

    App.showToast('Счетчик использования обновлен', 'success');
    await this.loadScripts();
    this.renderScripts();
    App.closeModal();
  }
};
