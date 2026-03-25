/* ============================================================
   StrategyModule — Strategy cards with CRUD, dynamic metrics,
   and team member assignment.
   ============================================================ */
const StrategyModule = {
  strategies: [],
  members: [],

  STATUS_LABELS: {
    draft: 'Черновик',
    active: 'Активная',
    completed: 'Завершена',
    archived: 'Архив',
  },

  /* --------------------------------------------------------
     Lifecycle
     -------------------------------------------------------- */
  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { this.members = await App.getTeamMembers(); } catch(e) { this.members = []; }
    try { await this.loadStrategies(); } catch(e) { console.error('Strategy load:', e); }
    this.renderStrategies();
  },

  /* --------------------------------------------------------
     Event binding — delegation, no inline handlers
     -------------------------------------------------------- */
  bindEvents() {
    // Add button
    const addBtn = document.getElementById('strategy-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddModal());
    }

    // Card clicks — delegation on grid
    const grid = document.getElementById('strategy-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const card = e.target.closest('.strategy-card[data-id]');
        if (card) {
          this.showEditModal(card.dataset.id);
        }
      });
    }
  },

  /* --------------------------------------------------------
     Data
     -------------------------------------------------------- */
  async loadStrategies() {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.strategies = data || [];
    } catch (err) {
      console.error('StrategyModule.loadStrategies:', err);
      App.showToast('Ошибка загрузки стратегий', 'error');
    }
  },

  /* --------------------------------------------------------
     Rendering
     -------------------------------------------------------- */
  renderStrategies() {
    const container = document.getElementById('strategy-grid');
    if (!container) return;

    if (this.strategies.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="text-muted">Нет стратегий. Создайте первую!</p></div>';
      return;
    }

    container.innerHTML = this.strategies.map(s => {
      const statusLabel = this.STATUS_LABELS[s.status] || s.status;
      const statusClass = s.status || 'draft';
      const metrics = Array.isArray(s.metrics) ? s.metrics : [];
      const teamIds = Array.isArray(s.team_members) ? s.team_members : [];

      const metricsHtml = metrics.length > 0
        ? `<div class="strategy-metrics">
            ${metrics.map(m => `
              <div class="metric">
                <span class="metric-label">${App.escapeHtml(m.label)}</span>
                <span class="metric-value">${App.escapeHtml(String(m.value))}</span>
              </div>
            `).join('')}
           </div>`
        : '';

      const avatarsHtml = teamIds.length > 0
        ? `<div class="strategy-team">
            ${teamIds.slice(0, 5).map(uid => {
              const member = this.members.find(m => m.id === uid);
              const initials = member
                ? (member.full_name || '??').substring(0, 2).toUpperCase()
                : '??';
              return `<span class="avatar-xs" title="${App.escapeHtml(member?.full_name || '')}">${initials}</span>`;
            }).join('')}
            ${teamIds.length > 5 ? `<span class="avatar-xs text-muted">+${teamIds.length - 5}</span>` : ''}
           </div>`
        : '';

      return `
        <div class="strategy-card" data-id="${s.id}">
          <div class="strategy-header">
            <span class="strategy-status ${statusClass}">${App.escapeHtml(statusLabel)}</span>
            ${s.period ? `<span class="strategy-date">${App.escapeHtml(s.period)}</span>` : ''}
          </div>
          <h3 class="card-title">${App.escapeHtml(s.title)}</h3>
          <p class="text-muted">${App.escapeHtml(s.description || '')}</p>
          ${metricsHtml}
          ${avatarsHtml}
        </div>
      `;
    }).join('');
  },

  /* --------------------------------------------------------
     Form builder
     -------------------------------------------------------- */
  _buildFormContent(strategy) {
    const s = strategy || {};
    const metrics = Array.isArray(s.metrics) ? s.metrics : [{ label: '', value: '' }];
    const selectedMembers = Array.isArray(s.team_members) ? s.team_members : [];

    const statusOptions = App.selectOptions([
      { value: 'draft', label: 'Черновик' },
      { value: 'active', label: 'Активная' },
      { value: 'completed', label: 'Завершена' },
      { value: 'archived', label: 'Архив' },
    ], s.status || 'draft');

    const metricsHtml = metrics.map((m, i) => `
      <div class="metric-row form-row" data-metric-index="${i}">
        <div class="form-group">
          <input type="text" class="metric-label-input" placeholder="Метрика" value="${App.escapeHtml(m.label || '')}">
        </div>
        <div class="form-group">
          <input type="text" class="metric-value-input" placeholder="Значение" value="${App.escapeHtml(String(m.value || ''))}">
        </div>
        <button type="button" class="btn btn-sm btn-danger btn-remove-metric" title="Удалить">&times;</button>
      </div>
    `).join('');

    const membersHtml = this.members.map(m => {
      const checked = selectedMembers.includes(m.id) ? 'checked' : '';
      const name = App.escapeHtml(m.full_name || m.email || m.id);
      return `
        <label class="form-group">
          <input type="checkbox" class="strategy-member-cb" value="${m.id}" ${checked}>
          <span>${name}</span>
        </label>
      `;
    }).join('');

    return `
      <div class="strategy-form-content">
        <div class="form-group">
          <label>Название *</label>
          <input type="text" id="strat-title" value="${App.escapeHtml(s.title || '')}" placeholder="Название стратегии">
        </div>
        <div class="form-group">
          <label>Описание</label>
          <textarea id="strat-desc" rows="3" placeholder="Описание стратегии">${App.escapeHtml(s.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Статус</label>
            <select id="strat-status">${statusOptions}</select>
          </div>
          <div class="form-group">
            <label>Период</label>
            <input type="text" id="strat-period" value="${App.escapeHtml(s.period || '')}" placeholder="Март 2026">
          </div>
        </div>
        <div class="form-group">
          <label>Метрики</label>
          <div id="strat-metrics-container">${metricsHtml}</div>
          <button type="button" class="btn btn-sm btn-secondary" data-action="add-metric">+ Добавить метрику</button>
        </div>
        <div class="form-group">
          <label>Команда</label>
          <div class="strategy-members-list">${membersHtml || '<span class="text-muted">Нет участников</span>'}</div>
        </div>
      </div>
    `;
  },

  /* --------------------------------------------------------
     Collect form data
     -------------------------------------------------------- */
  _collectFormData() {
    const title = document.getElementById('strat-title')?.value?.trim();
    const description = document.getElementById('strat-desc')?.value?.trim();
    const status = document.getElementById('strat-status')?.value;
    const period = document.getElementById('strat-period')?.value?.trim();

    const metrics = [];
    document.querySelectorAll('#strat-metrics-container .metric-row').forEach(row => {
      const label = row.querySelector('.metric-label-input')?.value?.trim();
      const value = row.querySelector('.metric-value-input')?.value?.trim();
      if (label || value) {
        metrics.push({ label: label || '', value: value || '' });
      }
    });

    const team_members = [];
    document.querySelectorAll('.strategy-member-cb:checked').forEach(cb => {
      team_members.push(cb.value);
    });

    return { title, description, status, period, metrics, team_members };
  },

  /* --------------------------------------------------------
     Modal — add metric row (no inline styles)
     -------------------------------------------------------- */
  _addMetricRow() {
    const container = document.getElementById('strat-metrics-container');
    if (!container) return;

    const idx = container.querySelectorAll('.metric-row').length;
    const row = document.createElement('div');
    row.className = 'metric-row form-row';
    row.setAttribute('data-metric-index', idx);
    row.innerHTML = `
      <div class="form-group">
        <input type="text" class="metric-label-input" placeholder="Метрика">
      </div>
      <div class="form-group">
        <input type="text" class="metric-value-input" placeholder="Значение">
      </div>
      <button type="button" class="btn btn-sm btn-danger btn-remove-metric" title="Удалить">&times;</button>
    `;
    container.appendChild(row);
  },

  _removeMetricRow(btn) {
    const container = document.getElementById('strat-metrics-container');
    if (!container) return;
    const rows = container.querySelectorAll('.metric-row');
    if (rows.length > 1) {
      btn.closest('.metric-row').remove();
    }
  },

  /* --------------------------------------------------------
     Modal — bind events via delegation on modal content
     -------------------------------------------------------- */
  _bindModalActions(strategyId) {
    // Use setTimeout to ensure modal DOM is rendered
    setTimeout(() => {
      const saveBtn = document.querySelector('[data-action="save-strategy"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      const deleteBtn = document.querySelector('[data-action="delete-strategy"]');
      const addMetricBtn = document.querySelector('[data-action="add-metric"]');
      const metricsContainer = document.getElementById('strat-metrics-container');

      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveStrategy(strategyId));
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => App.closeModal());
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteStrategy(strategyId));
      }
      if (addMetricBtn) {
        addMetricBtn.addEventListener('click', () => this._addMetricRow());
      }

      // Delegate remove-metric clicks
      if (metricsContainer) {
        metricsContainer.addEventListener('click', (e) => {
          const rmBtn = e.target.closest('.btn-remove-metric');
          if (rmBtn) this._removeMetricRow(rmBtn);
        });
      }
    }, 0);
  },

  /* --------------------------------------------------------
     Show modals
     -------------------------------------------------------- */
  showAddModal() {
    const body = this._buildFormContent(null);
    const footer = `
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save-strategy">Создать</button>
    `;
    App.openModal('Новая стратегия', body, footer);
    this._bindModalActions(null);
  },

  showEditModal(id) {
    const strategy = this.strategies.find(s => s.id === id);
    if (!strategy) return;

    const body = this._buildFormContent(strategy);
    const footer = `
      <button class="btn btn-danger" data-action="delete-strategy">Удалить</button>
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save-strategy">Сохранить</button>
    `;
    App.openModal('Редактировать стратегию', body, footer);
    this._bindModalActions(id);
  },

  /* --------------------------------------------------------
     CRUD
     -------------------------------------------------------- */
  async saveStrategy(id) {
    const formData = this._collectFormData();

    if (!formData.title) {
      App.showToast('Введите название стратегии', 'error');
      return;
    }

    try {
      if (id) {
        const { error } = await supabase
          .from('strategies')
          .update({
            title: formData.title,
            description: formData.description,
            status: formData.status,
            period: formData.period,
            metrics: formData.metrics,
            team_members: formData.team_members,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;
        App.showToast('Стратегия обновлена');
      } else {
        const { error } = await supabase
          .from('strategies')
          .insert({
            title: formData.title,
            description: formData.description,
            status: formData.status,
            period: formData.period,
            metrics: formData.metrics,
            team_members: formData.team_members,
            created_by: Auth.userId(),
          });

        if (error) throw error;
        App.showToast('Стратегия создана');
      }

      App.closeModal();
      await this.loadStrategies();
      this.renderStrategies();
    } catch (err) {
      console.error('StrategyModule.saveStrategy:', err);
      App.showToast('Ошибка сохранения стратегии', 'error');
    }
  },

  async deleteStrategy(id) {
    const confirmed = await App.confirm('Удалить стратегию?', 'Это действие нельзя отменить.');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      App.closeModal();
      App.showToast('Стратегия удалена');
      await this.loadStrategies();
      this.renderStrategies();
    } catch (err) {
      console.error('StrategyModule.deleteStrategy:', err);
      App.showToast('Ошибка удаления', 'error');
    }
  },
};
