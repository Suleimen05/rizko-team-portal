const PlatformsModule = {
  platforms: [],

  categories: [
    'Продукт & Разработка',
    'AI & Данные',
    'Маркетинг & Соцсети',
    'Коммуникация & CRM',
    'Дизайн & Контент'
  ],

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { await this.loadPlatforms(); } catch(e) { console.error('Platforms load:', e); }
  },

  bindEvents() {
    const addBtn = document.getElementById('platforms-add-btn');
    if (addBtn) {
      if (Auth.isAdmin()) {
        addBtn.classList.remove('hidden');
        addBtn.addEventListener('click', () => this.showAddModal());
      } else {
        addBtn.classList.add('hidden');
      }
    }

    const content = document.getElementById('platforms-content');
    if (content) {
      content.addEventListener('click', (e) => {
        const card = e.target.closest('.platform-card');
        if (!card) return;
        const link = e.target.closest('.platform-link');
        if (link) return;

        const platformId = card.dataset.platformId;
        if (!platformId) return;

        if (Auth.isAdmin()) {
          this.showEditModal(platformId);
        } else {
          const platform = this.platforms.find(p => p.id === platformId);
          if (platform && platform.link) {
            window.open(platform.link, '_blank');
          }
        }
      });
    }
  },

  async loadPlatforms() {
    try {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      this.platforms = data || [];
      this.renderPlatforms();
      this.renderCosts();
    } catch (err) {
      console.error('PlatformsModule.loadPlatforms error:', err);
      App.showToast('Ошибка загрузки платформ', 'error');
    }
  },

  renderPlatforms() {
    const container = document.getElementById('platforms-content');
    if (!container) return;

    const grouped = {};
    for (const cat of this.categories) {
      grouped[cat] = [];
    }
    for (const p of this.platforms) {
      const cat = p.category || 'Продукт & Разработка';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    let html = '';

    for (const cat of this.categories) {
      const items = grouped[cat];
      if (!items || items.length === 0) continue;

      html += '<div class="platform-section">'
        + '<div class="platform-section-title">' + App.escapeHtml(cat) + '</div>'
        + '<div class="platforms-grid">';

      for (const p of items) {
        const isConnected = p.status === 'connected';
        const statusLabel = isConnected ? 'Подключено' : 'Не подключено';
        const statusClass = isConnected ? 'connected' : 'inactive';
        const cardClass = 'platform-card' + (isConnected ? ' connected' : '');
        const iconBg = p.icon_bg || '#3b82f6';
        const iconText = App.escapeHtml(p.icon_text || '??');

        let detailsHtml = '';
        if (p.details && typeof p.details === 'object') {
          const entries = Object.entries(p.details);
          if (entries.length > 0) {
            detailsHtml = '<div class="platform-details">';
            for (const [key, val] of entries) {
              detailsHtml += '<span>' + App.escapeHtml(key) + ': ' + App.escapeHtml(String(val)) + '</span>';
            }
            detailsHtml += '</div>';
          }
        }

        html += '<div class="' + cardClass + '" data-platform-id="' + p.id + '">'
          + '<div class="platform-icon" data-bg="' + App.escapeHtml(iconBg) + '">' + iconText + '</div>'
          + '<div class="platform-info">'
          + '<span class="platform-name">' + App.escapeHtml(p.name) + '</span>'
          + (p.description ? '<span class="platform-desc">' + App.escapeHtml(p.description) + '</span>' : '')
          + '</div>'
          + '<span class="platform-status ' + statusClass + '">' + statusLabel + '</span>'
          + detailsHtml
          + (p.monthly_cost ? '<span class="platform-desc">' + (p.cost_label || 'Стоимость') + ': ' + App.formatCurrency(p.monthly_cost) + '/мес</span>' : '')
          + (p.link ? '<a href="' + App.escapeHtml(p.link) + '" target="_blank" class="platform-link">Открыть &#8599;</a>' : '')
          + '</div>';
      }

      html += '</div></div>';
    }

    if (html === '') {
      html = '<div class="empty-state"><p>Нет платформ</p></div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('.platform-icon[data-bg]').forEach(el => {
      el.style.background = el.dataset.bg;
    });
  },

  renderCosts() {
    const el = document.getElementById('platforms-costs');
    if (!el) return;

    const withCost = this.platforms.filter(p => p.monthly_cost && parseFloat(p.monthly_cost) > 0);
    if (withCost.length === 0) {
      el.innerHTML = '';
      return;
    }

    let total = 0;
    let rows = '';
    for (const p of withCost) {
      const cost = parseFloat(p.monthly_cost) || 0;
      total += cost;
      rows += '<div class="cost-row">'
        + '<span class="cost-name">' + App.escapeHtml(p.name) + '</span>'
        + '<span class="cost-amount">' + App.formatCurrency(cost) + '/мес</span>'
        + '</div>';
    }

    rows += '<div class="cost-row total">'
      + '<span class="cost-name">Итого</span>'
      + '<span class="cost-amount">' + App.formatCurrency(total) + '/мес</span>'
      + '</div>';

    el.innerHTML = '<div class="platform-costs">' + rows + '</div>';
  },

  showAddModal() {
    this._showPlatformModal(null);
  },

  async showEditModal(id) {
    if (!Auth.isAdmin()) return;
    const platform = this.platforms.find(p => p.id === id);
    if (!platform) return;
    this._showPlatformModal(platform);
  },

  _showPlatformModal(platform) {
    const isEdit = !!platform;
    const title = isEdit ? 'Редактировать платформу' : 'Добавить платформу';

    const categoryOptions = App.selectOptions(
      this.categories.map(c => ({ value: c, label: c })),
      platform ? platform.category : undefined
    );

    const statusOptions = App.selectOptions(
      [{ value: 'connected', label: 'Подключено' }, { value: 'inactive', label: 'Не подключено' }],
      platform ? platform.status : 'inactive'
    );

    let detailsHtml = '';
    if (platform && platform.details && typeof platform.details === 'object') {
      const entries = Object.entries(platform.details);
      entries.forEach(([key, val]) => {
        detailsHtml += '<div class="form-row" data-detail-row>'
          + '<div class="form-group"><input type="text" class="detail-key" value="' + App.escapeHtml(key) + '" placeholder="Ключ" /></div>'
          + '<div class="form-group"><input type="text" class="detail-val" value="' + App.escapeHtml(String(val)) + '" placeholder="Значение" /></div>'
          + '<button type="button" class="btn btn-sm btn-danger" data-action="remove-detail">&times;</button>'
          + '</div>';
      });
    }

    const body = App.formRow(
        App.formGroup('Название *', '<input type="text" id="plat-name" value="' + (platform ? App.escapeHtml(platform.name) : '') + '" placeholder="Название" />'),
        App.formGroup('Категория', '<select id="plat-category">' + categoryOptions + '</select>')
      )
      + App.formGroup('Описание', '<textarea id="plat-description" placeholder="Описание платформы">' + (platform ? App.escapeHtml(platform.description || '') : '') + '</textarea>')
      + App.formRow(
        App.formGroup('Текст иконки (2-3 символа)', '<input type="text" id="plat-icon-text" value="' + (platform ? App.escapeHtml(platform.icon_text || '') : '') + '" maxlength="3" placeholder="AI" />'),
        App.formGroup('Цвет иконки', '<input type="color" id="plat-icon-bg" value="' + (platform ? platform.icon_bg || '#3b82f6' : '#3b82f6') + '" />')
      )
      + App.formRow(
        App.formGroup('Статус', '<select id="plat-status">' + statusOptions + '</select>'),
        App.formGroup('Ссылка', '<input type="url" id="plat-link" value="' + (platform ? App.escapeHtml(platform.link || '') : '') + '" placeholder="https://..." />')
      )
      + App.formRow(
        App.formGroup('Стоимость (мес.)', '<input type="number" id="plat-cost" value="' + (platform ? platform.monthly_cost || '' : '') + '" step="0.01" min="0" placeholder="0.00" />'),
        App.formGroup('Подпись стоимости', '<input type="text" id="plat-cost-label" value="' + (platform ? App.escapeHtml(platform.cost_label || '') : '') + '" placeholder="Стоимость" />')
      )
      + '<div class="form-group"><label>Детали (ключ-значение)</label>'
      + '<div id="plat-details-list">' + detailsHtml + '</div>'
      + '<button type="button" class="btn btn-sm btn-secondary" id="plat-add-detail-btn">+ Добавить поле</button>'
      + '</div>';

    let footer = '';
    if (isEdit) {
      footer += '<button class="btn btn-danger" id="plat-delete-btn">Удалить</button>';
    }
    footer += '<button class="btn btn-secondary" id="plat-cancel-btn">Отмена</button>';
    footer += '<button class="btn btn-primary" id="plat-save-btn">Сохранить</button>';

    App.openModal(title, body, footer);

    document.getElementById('plat-cancel-btn').addEventListener('click', () => {
      App.closeModal();
    });

    document.getElementById('plat-save-btn').addEventListener('click', () => {
      this.savePlatform(isEdit ? platform.id : null);
    });

    if (isEdit) {
      document.getElementById('plat-delete-btn').addEventListener('click', () => {
        this.deletePlatform(platform.id);
      });
    }

    document.getElementById('plat-add-detail-btn').addEventListener('click', () => {
      this._addDetailRow();
    });

    const detailsList = document.getElementById('plat-details-list');
    if (detailsList) {
      detailsList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-action="remove-detail"]');
        if (removeBtn) {
          removeBtn.closest('[data-detail-row]').remove();
        }
      });
    }
  },

  _addDetailRow() {
    const list = document.getElementById('plat-details-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'form-row';
    row.dataset.detailRow = '';
    row.innerHTML = '<div class="form-group"><input type="text" class="detail-key" placeholder="Ключ" /></div>'
      + '<div class="form-group"><input type="text" class="detail-val" placeholder="Значение" /></div>'
      + '<button type="button" class="btn btn-sm btn-danger" data-action="remove-detail">&times;</button>';
    list.appendChild(row);
  },

  _collectDetails() {
    const details = {};
    const rows = document.querySelectorAll('#plat-details-list [data-detail-row]');
    rows.forEach(row => {
      const key = row.querySelector('.detail-key')?.value?.trim();
      const val = row.querySelector('.detail-val')?.value?.trim();
      if (key) {
        details[key] = val || '';
      }
    });
    return Object.keys(details).length > 0 ? details : null;
  },

  async savePlatform(id) {
    const name = document.getElementById('plat-name')?.value?.trim();
    if (!name) {
      App.showToast('Введите название платформы', 'error');
      return;
    }

    const record = {
      name,
      description: document.getElementById('plat-description')?.value?.trim() || null,
      category: document.getElementById('plat-category')?.value || this.categories[0],
      icon_text: document.getElementById('plat-icon-text')?.value?.trim() || name.substring(0, 2).toUpperCase(),
      icon_bg: document.getElementById('plat-icon-bg')?.value || '#3b82f6',
      status: document.getElementById('plat-status')?.value || 'inactive',
      link: document.getElementById('plat-link')?.value?.trim() || null,
      monthly_cost: parseFloat(document.getElementById('plat-cost')?.value) || null,
      cost_label: document.getElementById('plat-cost-label')?.value?.trim() || null,
      details: this._collectDetails(),
      updated_at: new Date().toISOString()
    };

    try {
      if (id) {
        const { error } = await supabase.from('platforms').update(record).eq('id', id);
        if (error) throw error;
        App.showToast('Платформа обновлена', 'success');
      } else {
        const maxPos = this.platforms.reduce((max, p) => Math.max(max, p.position || 0), 0);
        record.position = maxPos + 1;
        const { error } = await supabase.from('platforms').insert(record);
        if (error) throw error;
        App.showToast('Платформа добавлена', 'success');
      }

      App.closeModal();
      await this.loadPlatforms();
    } catch (err) {
      console.error('savePlatform error:', err);
      App.showToast('Ошибка сохранения платформы', 'error');
    }
  },

  async deletePlatform(id) {
    const confirmed = await App.confirm('Удалить платформу', 'Удалить эту платформу?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('platforms').delete().eq('id', id);
      if (error) throw error;

      App.closeModal();
      App.showToast('Платформа удалена', 'success');
      await this.loadPlatforms();
    } catch (err) {
      console.error('deletePlatform error:', err);
      App.showToast('Ошибка удаления платформы', 'error');
    }
  }
};
