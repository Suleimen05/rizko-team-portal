/* ============================================================
   TasksModule — Kanban board with drag-&-drop, detail overlay,
   comments, subtasks, and file attachments.
   ============================================================ */
const TasksModule = {
  tasks: [],
  members: [],
  draggedCard: null,
  dropIndicator: null,

  STATUSES: ['backlog', 'in_progress', 'review', 'done'],
  STATUS_LABELS: {
    backlog: 'Backlog',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  },
  CATEGORIES: ['Маркетинг', 'Контент', 'Outreach', 'Разработка', 'Стратегия'],
  PRIORITIES: ['low', 'normal', 'urgent'],
  PRIORITY_LABELS: { low: 'Низкий', normal: 'Средний', urgent: 'Срочный' },

  /* --------------------------------------------------------
     Lifecycle
     -------------------------------------------------------- */
  async init() {
    this.bindEvents();
    try { this.members = await App.getTeamMembers(); } catch(e) { this.members = []; }
  },

  async onPageEnter() {
    try { await this.loadTasks(); } catch(e) { console.error('Tasks load:', e); }
    this.renderBoard();
  },

  /* --------------------------------------------------------
     Event binding — all in one place, delegation-first
     -------------------------------------------------------- */
  bindEvents() {
    // Add task button
    const addBtn = document.getElementById('tasks-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this._openCreateModal());
    }

    // Kanban board — drag & drop + card clicks
    const board = document.getElementById('kanban-board');
    if (board) {
      // Create reusable drop indicator
      this.dropIndicator = document.createElement('div');
      this.dropIndicator.className = 'kanban-drop-indicator';

      board.addEventListener('dragstart', (e) => this._onDragStart(e));
      board.addEventListener('dragover', (e) => this._onDragOver(e));
      board.addEventListener('dragleave', (e) => this._onDragLeave(e));
      board.addEventListener('drop', (e) => this._onDrop(e));
      board.addEventListener('dragend', (e) => this._onDragEnd(e));

      // Card click — delegation
      board.addEventListener('click', (e) => {
        const card = e.target.closest('.kanban-card[data-task-id]');
        if (!card || card.classList.contains('dragging')) return;
        this.showTaskDetail(card.dataset.taskId);
      });
    }

    // Detail overlay — close button and delegated events
    const overlay = document.getElementById('task-detail-overlay');
    if (overlay) {
      // Close when clicking overlay background (not content)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this._closeDetail();
      });

      // Delegated events inside the overlay body
      const bodyEl = document.getElementById('task-detail-body');
      if (bodyEl) {
        bodyEl.addEventListener('click', (e) => this._handleDetailClick(e));
        bodyEl.addEventListener('change', (e) => this._handleDetailChange(e));
        bodyEl.addEventListener('keydown', (e) => this._handleDetailKeydown(e));
      }
    }
  },

  /* --------------------------------------------------------
     Data
     -------------------------------------------------------- */
  async loadTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles:assignee_id(id, full_name, avatar_url)')
        .order('position', { ascending: true });

      if (error) throw error;
      this.tasks = data || [];
    } catch (err) {
      App.showToast('Ошибка загрузки задач', 'error');
      console.error('TasksModule.loadTasks:', err);
    }
  },

  /* --------------------------------------------------------
     Board rendering
     -------------------------------------------------------- */
  renderBoard() {
    this.STATUSES.forEach(status => {
      const container = document.querySelector(`.kanban-cards[data-status="${status}"]`);
      if (!container) return;
      container.innerHTML = '';

      const columnTasks = this.tasks
        .filter(t => t.status === status)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      columnTasks.forEach(task => {
        container.appendChild(this._createCard(task));
      });

      // Update count badge
      const badge = document.querySelector(`.kanban-count[data-count][data-status="${status}"]`) ||
                    document.querySelector(`.kanban-column[data-status="${status}"] .kanban-count[data-count]`);
      if (badge) {
        badge.textContent = columnTasks.length;
        badge.setAttribute('data-count', columnTasks.length);
      }
    });
  },

  _createCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-task-id', task.id);
    card.draggable = true;

    const prioLabel = this.PRIORITY_LABELS[task.priority] || task.priority;
    const assigneeName = task.profiles?.full_name || 'Не назначен';
    const assigneeInitial = assigneeName.charAt(0).toUpperCase();
    const avatarUrl = task.profiles?.avatar_url;

    const dueDateHtml = task.due_date
      ? `<span class="kanban-date">${App.formatDate(task.due_date)}</span>`
      : '';

    const avatarInner = avatarUrl
      ? `<img src="${App.escapeHtml(avatarUrl)}" alt="${App.escapeHtml(assigneeName)}" class="avatar-xs">`
      : `<span class="avatar-xs">${App.escapeHtml(assigneeInitial)}</span>`;

    card.innerHTML = `
      <div class="kanban-card-tags">
        <span class="badge-tag">${App.escapeHtml(task.category || '')}</span>
        <span class="badge-tag">${App.escapeHtml(prioLabel)}</span>
      </div>
      <div class="kanban-card-title">${App.escapeHtml(task.title)}</div>
      <div class="kanban-card-footer">
        <div class="contact-cell">
          ${avatarInner}
          <span class="text-muted">${App.escapeHtml(assigneeName)}</span>
        </div>
        ${dueDateHtml}
      </div>
    `;

    return card;
  },

  /* --------------------------------------------------------
     Drag & Drop
     -------------------------------------------------------- */
  _onDragStart(e) {
    const card = e.target.closest('.kanban-card');
    if (!card) return;

    this.draggedCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
  },

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const column = e.target.closest('.kanban-cards[data-status]');
    if (!column) return;

    column.closest('.kanban-column')?.classList.add('drag-over');

    const afterCard = this._getCardAfterCursor(column, e.clientY);

    if (this.dropIndicator.parentNode !== column) {
      column.appendChild(this.dropIndicator);
    }
    this.dropIndicator.classList.add('visible');

    if (afterCard) {
      column.insertBefore(this.dropIndicator, afterCard);
    } else {
      column.appendChild(this.dropIndicator);
    }
  },

  _onDragLeave(e) {
    const column = e.target.closest('.kanban-column');
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('drag-over');
    }
  },

  async _onDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.kanban-cards[data-status]');
    if (!column || !this.draggedCard) return;

    const newStatus = column.getAttribute('data-status');

    // Insert card at the right position
    const afterCard = this._getCardAfterCursor(column, e.clientY);
    if (afterCard) {
      column.insertBefore(this.draggedCard, afterCard);
    } else {
      column.appendChild(this.draggedCard);
    }

    // Hide indicator
    this.dropIndicator.classList.remove('visible');

    // Compute new positions for all cards in this column
    const cards = [...column.querySelectorAll('.kanban-card')];
    const updates = cards.map((c, idx) => ({
      id: c.getAttribute('data-task-id'),
      position: idx,
      status: newStatus,
    }));

    // Optimistic local update
    updates.forEach(u => {
      const t = this.tasks.find(tk => tk.id === u.id);
      if (t) {
        t.status = u.status;
        t.position = u.position;
      }
    });

    this._updateCounts();

    // Persist
    for (const u of updates) {
      await supabase.from('tasks').update({ status: u.status, position: u.position }).eq('id', u.id);
    }

    document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
  },

  _onDragEnd() {
    if (this.draggedCard) {
      this.draggedCard.classList.remove('dragging');
      this.draggedCard = null;
    }
    if (this.dropIndicator) {
      this.dropIndicator.classList.remove('visible');
    }
    document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
  },

  _getCardAfterCursor(column, y) {
    const cards = [...column.querySelectorAll('.kanban-card:not(.dragging)')];
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;

    cards.forEach(card => {
      const box = card.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = card;
      }
    });
    return closest;
  },

  _updateCounts() {
    this.STATUSES.forEach(status => {
      const count = this.tasks.filter(t => t.status === status).length;
      const badge = document.querySelector(`.kanban-count[data-count][data-status="${status}"]`) ||
                    document.querySelector(`.kanban-column[data-status="${status}"] .kanban-count[data-count]`);
      if (badge) {
        badge.textContent = count;
        badge.setAttribute('data-count', count);
      }
    });
  },

  /* --------------------------------------------------------
     Create Task Modal
     -------------------------------------------------------- */
  _openCreateModal() {
    const memberOpts = this.members.map(m =>
      `<option value="${m.id}">${App.escapeHtml(m.full_name || m.email)}</option>`
    ).join('');

    const categoryOpts = this.CATEGORIES.map(c =>
      `<option value="${c}">${App.escapeHtml(c)}</option>`
    ).join('');

    const priorityOpts = this.PRIORITIES.map(p =>
      `<option value="${p}">${App.escapeHtml(this.PRIORITY_LABELS[p])}</option>`
    ).join('');

    const body = `
      <div class="form-group">
        <label>Название *</label>
        <input type="text" id="ct-title" required>
      </div>
      <div class="form-group">
        <label>Описание</label>
        <textarea id="ct-desc" rows="3"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Категория</label>
          <select id="ct-category">${categoryOpts}</select>
        </div>
        <div class="form-group">
          <label>Приоритет</label>
          <select id="ct-priority">${priorityOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Исполнитель</label>
          <select id="ct-assignee"><option value="">Не назначен</option>${memberOpts}</select>
        </div>
        <div class="form-group">
          <label>Срок</label>
          <input type="date" id="ct-due">
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="create-task">Создать задачу</button>
    `;

    App.openModal('Новая задача', body, footer);

    // Bind modal buttons
    setTimeout(() => {
      const createBtn = document.querySelector('[data-action="create-task"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      if (createBtn) createBtn.addEventListener('click', () => this._createTask());
      if (cancelBtn) cancelBtn.addEventListener('click', () => App.closeModal());
    }, 0);
  },

  async _createTask() {
    const title = document.getElementById('ct-title').value.trim();
    if (!title) {
      App.showToast('Введите название задачи', 'error');
      return;
    }

    const maxPos = this.tasks
      .filter(t => t.status === 'backlog')
      .reduce((m, t) => Math.max(m, t.position ?? 0), -1);

    const payload = {
      title,
      description: document.getElementById('ct-desc').value.trim(),
      category: document.getElementById('ct-category').value,
      priority: document.getElementById('ct-priority').value || 'normal',
      assignee_id: document.getElementById('ct-assignee').value || null,
      due_date: document.getElementById('ct-due').value || null,
      status: 'backlog',
      position: maxPos + 1,
      created_by: Auth.userId(),
    };

    try {
      const { error } = await supabase.from('tasks').insert([payload]);
      if (error) throw error;

      App.closeModal();
      App.showToast('Задача создана');
      await this.loadTasks();
      this.renderBoard();
    } catch (err) {
      App.showToast('Ошибка создания задачи', 'error');
      console.error('TasksModule._createTask:', err);
    }
  },

  /* --------------------------------------------------------
     Delete Task
     -------------------------------------------------------- */
  async deleteTask(taskId) {
    const ok = await App.confirm('Удалить задачу?', 'Это действие нельзя отменить.');
    if (!ok) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      App.showToast('Задача удалена');
      this._closeDetail();
      await this.loadTasks();
      this.renderBoard();
    } catch (err) {
      App.showToast('Ошибка удаления', 'error');
      console.error('TasksModule.deleteTask:', err);
    }
  },

  /* --------------------------------------------------------
     Task Detail Overlay
     -------------------------------------------------------- */
  async showTaskDetail(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Fetch subtasks, comments, attachments in parallel
    const [subtasksRes, commentsRes, attachmentsRes] = await Promise.all([
      supabase.from('task_subtasks').select('*').eq('task_id', taskId).order('created_at'),
      supabase.from('task_comments').select('*, profiles:author_id(id, full_name, avatar_url)').eq('task_id', taskId).order('created_at'),
      supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at'),
    ]);

    const subtasks = subtasksRes.data || [];
    const comments = commentsRes.data || [];
    const attachments = attachmentsRes.data || [];

    const overlay = document.getElementById('task-detail-overlay');
    const titleEl = document.getElementById('task-detail-title');
    const bodyEl = document.getElementById('task-detail-body');
    if (!overlay || !bodyEl) return;

    if (titleEl) titleEl.textContent = task.title;

    const memberOpts = this.members.map(m =>
      `<option value="${m.id}" ${m.id === task.assignee_id ? 'selected' : ''}>${App.escapeHtml(m.full_name || m.email)}</option>`
    ).join('');

    const categoryOpts = this.CATEGORIES.map(c =>
      `<option value="${c}" ${c === task.category ? 'selected' : ''}>${App.escapeHtml(c)}</option>`
    ).join('');

    const priorityOpts = this.PRIORITIES.map(p =>
      `<option value="${p}" ${p === task.priority ? 'selected' : ''}>${App.escapeHtml(this.PRIORITY_LABELS[p])}</option>`
    ).join('');

    const statusOpts = this.STATUSES.map(s =>
      `<option value="${s}" ${s === task.status ? 'selected' : ''}>${App.escapeHtml(this.STATUS_LABELS[s])}</option>`
    ).join('');

    // Subtasks HTML
    const subtasksHtml = subtasks.map(st => `
      <div class="subtask-item" data-subtask-id="${st.id}">
        <input type="checkbox" class="subtask-check" data-id="${st.id}" ${st.completed ? 'checked' : ''}>
        <span class="${st.completed ? 'text-muted' : ''}">${App.escapeHtml(st.title)}</span>
        <button class="btn btn-sm btn-danger subtask-del-btn" data-id="${st.id}" title="Удалить">&times;</button>
      </div>
    `).join('');

    // Comments HTML
    const commentsHtml = comments.map(c => {
      const authorName = c.profiles?.full_name || 'Аноним';
      return `
        <div class="card comment-item">
          <div class="kanban-card-footer">
            <strong>${App.escapeHtml(authorName)}</strong>
            <span class="text-muted">${App.formatDate(c.created_at)}</span>
          </div>
          <p>${App.escapeHtml(c.content)}</p>
        </div>
      `;
    }).join('');

    // Attachments HTML
    const attachmentsHtml = attachments.map(a => {
      const sizeKb = a.file_size ? (a.file_size / 1024).toFixed(1) + ' KB' : '';
      return `
        <div class="attachment-item">
          <a href="${App.escapeHtml(a.file_url)}" target="_blank" rel="noopener">${App.escapeHtml(a.file_name)}</a>
          <span class="text-muted">${sizeKb}</span>
        </div>
      `;
    }).join('');

    const completedCount = subtasks.filter(s => s.completed).length;
    const subtaskProgress = subtasks.length
      ? Math.round(completedCount / subtasks.length * 100)
      : 0;

    // Store current task id on the body element for delegation
    bodyEl.setAttribute('data-current-task', taskId);

    bodyEl.innerHTML = `
      <div class="task-detail-content">
        <div class="form-row">
          <div class="form-group">
            <label>Статус</label>
            <select id="td-status">${statusOpts}</select>
          </div>
          <div class="form-group">
            <label>Категория</label>
            <select id="td-category">${categoryOpts}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Приоритет</label>
            <select id="td-priority">${priorityOpts}</select>
          </div>
          <div class="form-group">
            <label>Исполнитель</label>
            <select id="td-assignee"><option value="">Не назначен</option>${memberOpts}</select>
          </div>
        </div>
        <div class="form-group">
          <label>Срок</label>
          <input type="date" id="td-due" value="${task.due_date || ''}">
        </div>
        <div class="form-group">
          <label>Описание</label>
          <textarea id="td-desc" rows="3">${App.escapeHtml(task.description || '')}</textarea>
        </div>

        <button class="btn btn-primary" data-detail-action="save">Сохранить изменения</button>

        <hr>

        <div class="task-detail-section">
          <h4>Подзадачи ${subtasks.length ? '(' + completedCount + '/' + subtasks.length + ' — ' + subtaskProgress + '%)' : ''}</h4>
          <div id="subtasks-list">${subtasksHtml || '<p class="text-muted">Нет подзадач</p>'}</div>
          <div class="form-row">
            <input type="text" id="new-subtask" placeholder="Новая подзадача...">
            <button class="btn btn-sm btn-primary" data-detail-action="add-subtask">Добавить</button>
          </div>
        </div>

        <hr>

        <div class="task-detail-section">
          <h4>Комментарии (${comments.length})</h4>
          <div id="comments-list">${commentsHtml || '<p class="text-muted">Нет комментариев</p>'}</div>
          <div class="form-row">
            <input type="text" id="new-comment" placeholder="Написать комментарий...">
            <button class="btn btn-sm btn-primary" data-detail-action="add-comment">Отправить</button>
          </div>
        </div>

        <hr>

        <div class="task-detail-section">
          <h4>Файлы (${attachments.length})</h4>
          <div id="attachments-list">${attachmentsHtml || '<p class="text-muted">Нет файлов</p>'}</div>
          <div class="form-group">
            <label class="btn btn-sm btn-secondary upload-label">
              Загрузить файл
              <input type="file" id="upload-attachment" hidden>
            </label>
          </div>
        </div>

        <hr>

        <button class="btn btn-sm btn-danger" data-detail-action="delete">Удалить задачу</button>
      </div>
    `;

    // Show overlay
    overlay.classList.add('open');
  },

  /* --------------------------------------------------------
     Detail overlay — delegated event handlers
     -------------------------------------------------------- */
  _handleDetailClick(e) {
    const bodyEl = document.getElementById('task-detail-body');
    if (!bodyEl) return;
    const taskId = bodyEl.getAttribute('data-current-task');
    if (!taskId) return;

    // Save button
    const saveBtn = e.target.closest('[data-detail-action="save"]');
    if (saveBtn) {
      this._saveTaskDetail(taskId);
      return;
    }

    // Delete task
    const deleteBtn = e.target.closest('[data-detail-action="delete"]');
    if (deleteBtn) {
      this.deleteTask(taskId);
      return;
    }

    // Add subtask
    const addSubBtn = e.target.closest('[data-detail-action="add-subtask"]');
    if (addSubBtn) {
      this._addSubtask(taskId);
      return;
    }

    // Add comment
    const addComBtn = e.target.closest('[data-detail-action="add-comment"]');
    if (addComBtn) {
      this._addComment(taskId);
      return;
    }

    // Delete subtask
    const delSubBtn = e.target.closest('.subtask-del-btn[data-id]');
    if (delSubBtn) {
      this._deleteSubtask(delSubBtn.getAttribute('data-id'), taskId);
      return;
    }
  },

  _handleDetailChange(e) {
    const bodyEl = document.getElementById('task-detail-body');
    if (!bodyEl) return;
    const taskId = bodyEl.getAttribute('data-current-task');
    if (!taskId) return;

    // Subtask checkbox toggle
    if (e.target.classList.contains('subtask-check')) {
      this._toggleSubtask(e.target.getAttribute('data-id'), e.target.checked, taskId);
      return;
    }

    // File upload
    if (e.target.id === 'upload-attachment' && e.target.files.length) {
      this._uploadAttachment(taskId, e.target.files[0]);
      return;
    }
  },

  _handleDetailKeydown(e) {
    const bodyEl = document.getElementById('task-detail-body');
    if (!bodyEl) return;
    const taskId = bodyEl.getAttribute('data-current-task');
    if (!taskId || e.key !== 'Enter') return;

    if (e.target.id === 'new-subtask') {
      e.preventDefault();
      this._addSubtask(taskId);
    } else if (e.target.id === 'new-comment') {
      e.preventDefault();
      this._addComment(taskId);
    }
  },

  async _saveTaskDetail(taskId) {
    const updates = {
      status: document.getElementById('td-status').value,
      category: document.getElementById('td-category').value,
      priority: document.getElementById('td-priority').value,
      assignee_id: document.getElementById('td-assignee').value || null,
      due_date: document.getElementById('td-due').value || null,
      description: document.getElementById('td-desc').value.trim(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
      if (error) throw error;

      App.showToast('Задача обновлена');
      await this.loadTasks();
      this.renderBoard();
      this.showTaskDetail(taskId);
    } catch (err) {
      App.showToast('Ошибка сохранения', 'error');
      console.error('TasksModule._saveTaskDetail:', err);
    }
  },

  _closeDetail() {
    const overlay = document.getElementById('task-detail-overlay');
    if (overlay) overlay.classList.remove('open');
  },

  /* --------------------------------------------------------
     Subtasks
     -------------------------------------------------------- */
  async _addSubtask(taskId) {
    const input = document.getElementById('new-subtask');
    const title = input?.value.trim();
    if (!title) return;

    try {
      const { error } = await supabase.from('task_subtasks').insert([{ task_id: taskId, title, completed: false }]);
      if (error) throw error;
      input.value = '';
      this.showTaskDetail(taskId);
    } catch (err) {
      App.showToast('Ошибка добавления подзадачи', 'error');
      console.error('TasksModule._addSubtask:', err);
    }
  },

  async _toggleSubtask(subtaskId, completed, taskId) {
    try {
      await supabase.from('task_subtasks').update({ completed }).eq('id', subtaskId);
      this.showTaskDetail(taskId);
    } catch (err) {
      console.error('TasksModule._toggleSubtask:', err);
    }
  },

  async _deleteSubtask(subtaskId, taskId) {
    try {
      await supabase.from('task_subtasks').delete().eq('id', subtaskId);
      this.showTaskDetail(taskId);
    } catch (err) {
      console.error('TasksModule._deleteSubtask:', err);
    }
  },

  /* --------------------------------------------------------
     Comments
     -------------------------------------------------------- */
  async _addComment(taskId) {
    const input = document.getElementById('new-comment');
    const content = input?.value.trim();
    if (!content) return;

    try {
      const { error } = await supabase.from('task_comments').insert([{
        task_id: taskId,
        author_id: Auth.userId(),
        content,
      }]);
      if (error) throw error;
      input.value = '';
      this.showTaskDetail(taskId);
    } catch (err) {
      App.showToast('Ошибка добавления комментария', 'error');
      console.error('TasksModule._addComment:', err);
    }
  },

  /* --------------------------------------------------------
     Attachments (Supabase Storage)
     -------------------------------------------------------- */
  async _uploadAttachment(taskId, file) {
    const filePath = `${taskId}/${Date.now()}_${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      const fileUrl = urlData?.publicUrl || '';

      const { error: dbError } = await supabase.from('task_attachments').insert([{
        task_id: taskId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        uploaded_by: Auth.userId(),
      }]);

      if (dbError) throw dbError;

      App.showToast('Файл загружен');
      this.showTaskDetail(taskId);
    } catch (err) {
      App.showToast('Ошибка загрузки файла', 'error');
      console.error('TasksModule._uploadAttachment:', err);
    }
  },
};
