// ===== CONTACTS MODULE =====

const ContactsModule = {
  contacts: [],
  members: [],
  filter: 'all',
  searchQuery: '',
  sortColumn: 'created_at',
  sortDir: 'desc',

  // ===== LIFECYCLE =====
  async init() {
    this.bindEvents();
    try { await this.loadContacts(); } catch(e) { console.error('Contacts load error:', e); }
  },

  async onPageEnter() {
    await this.loadContacts();
  },

  // ===== EVENT BINDING (delegated, no inline handlers) =====
  bindEvents() {
    // Add button
    const addBtn = document.getElementById('contacts-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddModal());
    }

    // Filter tabs — event delegation
    const filterTabs = document.getElementById('contacts-filter-tabs');
    if (filterTabs) {
      filterTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab[data-filter]');
        if (!tab) return;
        this.filter = tab.dataset.filter;
        filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderContacts();
      });
    }

    // Search — debounced
    const searchInput = document.getElementById('contacts-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.renderContacts();
        }, 300);
      });
    }

    // CSV export
    const csvBtn = document.getElementById('contacts-export-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => this.exportCSV());
    }

    // Excel export
    const xlsxBtn = document.getElementById('contacts-export-xlsx');
    if (xlsxBtn) {
      xlsxBtn.addEventListener('click', () => this.exportExcel());
    }

    // Column sorting — delegation on thead
    const tbody = document.getElementById('contacts-tbody');
    if (tbody && tbody.closest('table')) {
      const table = tbody.closest('table');
      const thead = table.querySelector('thead');
      if (thead) {
        thead.addEventListener('click', (e) => {
          const th = e.target.closest('[data-sort]');
          if (th) this.sortBy(th.dataset.sort);
        });
      }
    }

    // Table row clicks — delegation on tbody
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-contact-id]');
        if (row) {
          this.showEditModal(row.dataset.contactId);
        }
      });
    }
  },

  // ===== DATA LOADING =====
  async loadContacts() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, responsible:profiles!responsible_id(id, full_name, initials)')
        .order(this.sortColumn, { ascending: this.sortDir === 'asc' });

      if (error) throw error;
      this.contacts = data || [];
      this.members = await App.getTeamMembers();
      this.renderContacts();
    } catch (err) {
      console.error('ContactsModule.loadContacts:', err);
      App.showToast('Ошибка загрузки контактов', 'error');
    }
  },

  // ===== FILTERING =====
  getFilteredContacts() {
    let list = this.contacts;

    if (this.filter !== 'all') {
      list = list.filter(c => c.type === this.filter);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    }

    return list;
  },

  // ===== RENDERING =====
  renderContacts() {
    const tbody = document.getElementById('contacts-tbody');
    if (!tbody) return;

    const list = this.getFilteredContacts();

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p class="text-muted">Контакты не найдены</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => {
      const statusLabel = this.getStatusLabel(c.status);
      const statusClass = this.getStatusDotClass(c.status);
      const typeLabel = this.getTypeLabel(c.type);
      const typeBadgeClass = this.getTypeBadgeClass(c.type);
      const responsible = c.responsible ? App.escapeHtml(c.responsible.full_name) : '—';
      const dealStr = c.deal_amount ? App.formatCurrency(c.deal_amount, c.deal_currency) : '—';
      const initials = (c.name || '??').substring(0, 2).toUpperCase();

      return `
        <tr data-contact-id="${c.id}">
          <td>
            <div class="contact-cell">
              <div class="avatar-sm">${App.escapeHtml(initials)}</div>
              <div>
                <div class="kanban-card-title">${App.escapeHtml(c.name)}</div>
                <div class="text-muted">${App.escapeHtml(c.company || '')}</div>
              </div>
            </div>
          </td>
          <td><span class="badge-tag ${typeBadgeClass}">${App.escapeHtml(typeLabel)}</span></td>
          <td>${App.escapeHtml(c.email || '—')}</td>
          <td>${App.escapeHtml(c.phone || '—')}</td>
          <td>
            <span class="status-dot ${statusClass}"></span>
            ${App.escapeHtml(statusLabel)}
          </td>
          <td>${dealStr}</td>
          <td>${responsible}</td>
          <td>${c.last_contact_date ? App.formatDate(c.last_contact_date) : '—'}</td>
        </tr>
      `;
    }).join('');
  },

  // ===== STATUS & TYPE HELPERS =====
  getStatusDotClass(status) {
    const map = {
      active: 'active',
      negotiation: 'pending',
      closed: 'inactive',
      archived: 'inactive',
    };
    return map[status] || '';
  },

  getStatusLabel(status) {
    const map = {
      active: 'Активный',
      negotiation: 'Переговоры',
      closed: 'Закрыт',
      archived: 'Архив',
    };
    return map[status] || status || '—';
  },

  getTypeLabel(type) {
    const map = {
      blogger: 'Блогер',
      investor: 'Инвестор',
      partner: 'Партнёр',
      client: 'Клиент',
    };
    return map[type] || type || '—';
  },

  getTypeBadgeClass(type) {
    const map = {
      blogger: 'blogger',
      investor: 'investor',
      partner: 'partner',
      client: 'client',
    };
    return map[type] || '';
  },

  // ===== FORM BUILDER =====
  buildForm(contact) {
    const c = contact || {};
    const tagsStr = (c.tags || []).join(', ');

    const typeOptions = App.selectOptions([
      { value: '', label: '— Выберите —' },
      { value: 'blogger', label: 'Блогер' },
      { value: 'investor', label: 'Инвестор' },
      { value: 'partner', label: 'Партнёр' },
      { value: 'client', label: 'Клиент' },
    ], c.type || '');

    const statusOptions = App.selectOptions([
      { value: 'active', label: 'Активный' },
      { value: 'negotiation', label: 'Переговоры' },
      { value: 'closed', label: 'Закрыт' },
      { value: 'archived', label: 'Архив' },
    ], c.status || 'active');

    const memberOptions = '<option value="">— Не назначен —</option>' +
      this.members.map(m =>
        `<option value="${m.id}" ${m.id === c.responsible_id ? 'selected' : ''}>${App.escapeHtml(m.full_name)}</option>`
      ).join('');

    const currencyOptions = App.selectOptions(
      Object.keys(CONFIG.currencies).map(k => ({ value: k, label: k + ' (' + CONFIG.currencies[k].symbol + ')' })),
      c.deal_currency || CONFIG.defaultCurrency
    );

    const socialPlatformOptions = App.selectOptions([
      { value: '', label: '— Платформа —' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'telegram', label: 'Telegram' },
      { value: 'twitter', label: 'Twitter/X' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'other', label: 'Другое' },
    ], c.social_platform || '');

    return `
      <div class="form-group">
        <h4 class="text-muted">ОСНОВНАЯ ИНФОРМАЦИЯ</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Имя / Название *</label>
            <input type="text" id="cf-name" value="${App.escapeHtml(c.name || '')}" placeholder="Полное имя контакта" />
          </div>
          <div class="form-group">
            <label>Компания</label>
            <input type="text" id="cf-company" value="${App.escapeHtml(c.company || '')}" placeholder="Название компании" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Тип *</label>
            <select id="cf-type">${typeOptions}</select>
          </div>
          <div class="form-group">
            <label>Статус</label>
            <select id="cf-status">${statusOptions}</select>
          </div>
        </div>

        <h4 class="text-muted">КОНТАКТЫ</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="cf-email" value="${App.escapeHtml(c.email || '')}" placeholder="email@example.com" />
          </div>
          <div class="form-group">
            <label>Телефон</label>
            <input type="text" id="cf-phone" value="${App.escapeHtml(c.phone || '')}" placeholder="+7 XXX XXX XXXX" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Город</label>
            <input type="text" id="cf-city" value="${App.escapeHtml(c.city || '')}" placeholder="Город" />
          </div>
          <div class="form-group">
            <label>Страна</label>
            <input type="text" id="cf-country" value="${App.escapeHtml(c.country || '')}" placeholder="Страна" />
          </div>
        </div>
        <div class="form-group">
          <label>Источник</label>
          <input type="text" id="cf-source" value="${App.escapeHtml(c.source || '')}" placeholder="Откуда пришёл контакт" />
        </div>

        <h4 class="text-muted">СОЦСЕТИ</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Платформа</label>
            <select id="cf-social-platform">${socialPlatformOptions}</select>
          </div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="cf-social-username" value="${App.escapeHtml(c.social_username || '')}" placeholder="@username" />
          </div>
        </div>
        <div class="form-group">
          <label>Подписчики</label>
          <input type="text" id="cf-social-followers" value="${App.escapeHtml(c.social_followers || '')}" placeholder="Кол-во подписчиков" />
        </div>

        <h4 class="text-muted">СДЕЛКА</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Сумма сделки</label>
            <input type="number" id="cf-deal-amount" value="${c.deal_amount || ''}" placeholder="0" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label>Валюта</label>
            <select id="cf-deal-currency">${currencyOptions}</select>
          </div>
        </div>

        <h4 class="text-muted">ДОПОЛНИТЕЛЬНО</h4>
        <div class="form-group">
          <label>Ответственный</label>
          <select id="cf-responsible">${memberOptions}</select>
        </div>
        <div class="form-group">
          <label>Теги</label>
          <input type="text" id="cf-tags" value="${App.escapeHtml(tagsStr)}" placeholder="Теги через запятую" />
        </div>
        <div class="form-group">
          <label>Дата последнего контакта</label>
          <input type="date" id="cf-last-contact" value="${c.last_contact_date ? c.last_contact_date.substring(0, 10) : ''}" />
        </div>
        <div class="form-group">
          <label>Заметки</label>
          <textarea id="cf-notes" rows="3" placeholder="Заметки о контакте...">${App.escapeHtml(c.notes || '')}</textarea>
        </div>
      </div>
    `;
  },

  // ===== COLLECT FORM DATA =====
  collectFormData() {
    const name = document.getElementById('cf-name').value.trim();
    const type = document.getElementById('cf-type').value;

    if (!name) {
      App.showToast('Укажите имя контакта', 'error');
      return null;
    }
    if (!type) {
      App.showToast('Выберите тип контакта', 'error');
      return null;
    }

    const tagsRaw = document.getElementById('cf-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const responsibleId = document.getElementById('cf-responsible').value || null;
    const dealAmount = parseFloat(document.getElementById('cf-deal-amount').value) || null;
    const lastContact = document.getElementById('cf-last-contact').value || null;

    return {
      name,
      company: document.getElementById('cf-company').value.trim() || null,
      type,
      status: document.getElementById('cf-status').value,
      email: document.getElementById('cf-email').value.trim() || null,
      phone: document.getElementById('cf-phone').value.trim() || null,
      city: document.getElementById('cf-city').value.trim() || null,
      country: document.getElementById('cf-country').value.trim() || null,
      source: document.getElementById('cf-source').value.trim() || null,
      social_platform: document.getElementById('cf-social-platform').value || null,
      social_username: document.getElementById('cf-social-username').value.trim() || null,
      social_followers: document.getElementById('cf-social-followers').value.trim() || null,
      deal_amount: dealAmount,
      deal_currency: document.getElementById('cf-deal-currency').value,
      responsible_id: responsibleId,
      tags,
      notes: document.getElementById('cf-notes').value.trim() || null,
      last_contact_date: lastContact ? new Date(lastContact).toISOString() : null,
    };
  },

  // ===== MODALS (buttons use addEventListener, not onclick) =====
  showAddModal() {
    const body = this.buildForm(null);
    const footer = `
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save">Создать</button>
    `;
    App.openModal('Новый контакт', body, footer);

    // Bind modal footer buttons via delegation
    this._bindModalFooterActions(null);
  },

  showEditModal(id) {
    const contact = this.contacts.find(c => c.id === id);
    if (!contact) {
      App.showToast('Контакт не найден', 'error');
      return;
    }

    const body = this.buildForm(contact);
    const footer = `
      <button class="btn btn-danger" data-action="delete">Удалить</button>
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save">Сохранить</button>
    `;
    App.openModal('Редактировать контакт', body, footer);

    this._bindModalFooterActions(id);
  },

  _bindModalFooterActions(contactId) {
    // Use setTimeout to ensure modal DOM is ready
    setTimeout(() => {
      const modal = document.querySelector('.modal-footer, .modal');
      if (!modal) return;

      // Find all action buttons in the modal
      const saveBtn = document.querySelector('[data-action="save"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      const deleteBtn = document.querySelector('[data-action="delete"]');

      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveContact(contactId));
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => App.closeModal());
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteContact(contactId));
      }
    }, 0);
  },

  // ===== CRUD =====
  async saveContact(id) {
    const data = this.collectFormData();
    if (!data) return;

    try {
      if (id) {
        data.updated_at = new Date().toISOString();
        const { error } = await supabase.from('contacts').update(data).eq('id', id);
        if (error) throw error;
        App.showToast('Контакт обновлён');
      } else {
        data.created_by = Auth.userId();
        const { error } = await supabase.from('contacts').insert(data);
        if (error) throw error;
        App.showToast('Контакт создан');
      }

      App.closeModal();
      await this.loadContacts();
    } catch (err) {
      console.error('ContactsModule.saveContact:', err);
      App.showToast('Ошибка сохранения: ' + err.message, 'error');
    }
  },

  async deleteContact(id) {
    const confirmed = await App.confirm('Удалить контакт', 'Вы уверены, что хотите удалить этот контакт? Это действие необратимо.');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      App.showToast('Контакт удалён');
      App.closeModal();
      await this.loadContacts();
    } catch (err) {
      console.error('ContactsModule.deleteContact:', err);
      App.showToast('Ошибка удаления: ' + err.message, 'error');
    }
  },

  // ===== SORTING =====
  sortBy(column) {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
    this.loadContacts();
  },

  // ===== EXPORT: CSV =====
  exportCSV() {
    const list = this.getFilteredContacts();
    if (list.length === 0) {
      App.showToast('Нет данных для экспорта', 'error');
      return;
    }

    const headers = [
      'Имя', 'Компания', 'Тип', 'Email', 'Телефон', 'Город', 'Страна',
      'Источник', 'Соцсеть', 'Username', 'Подписчики', 'Статус',
      'Сумма сделки', 'Валюта', 'Ответственный', 'Теги', 'Заметки',
      'Последний контакт', 'Создан',
    ];

    const rows = list.map(c => [
      c.name || '',
      c.company || '',
      this.getTypeLabel(c.type),
      c.email || '',
      c.phone || '',
      c.city || '',
      c.country || '',
      c.source || '',
      c.social_platform || '',
      c.social_username || '',
      c.social_followers || '',
      this.getStatusLabel(c.status),
      c.deal_amount || '',
      c.deal_currency || '',
      c.responsible ? c.responsible.full_name : '',
      (c.tags || []).join('; '),
      c.notes || '',
      c.last_contact_date ? c.last_contact_date.substring(0, 10) : '',
      c.created_at ? c.created_at.substring(0, 10) : '',
    ]);

    const csvContent = '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(cell => {
          const str = String(cell).replace(/"/g, '""');
          return '"' + str + '"';
        }).join(','))
        .join('\r\n');

    this._downloadFile(csvContent, 'contacts.csv', 'text/csv;charset=utf-8');
  },

  // ===== EXPORT: EXCEL (XML Spreadsheet) =====
  exportExcel() {
    const list = this.getFilteredContacts();
    if (list.length === 0) {
      App.showToast('Нет данных для экспорта', 'error');
      return;
    }

    const headers = [
      'Имя', 'Компания', 'Тип', 'Email', 'Телефон', 'Город', 'Страна',
      'Источник', 'Соцсеть', 'Username', 'Подписчики', 'Статус',
      'Сумма сделки', 'Валюта', 'Ответственный', 'Теги', 'Заметки',
      'Последний контакт', 'Создан',
    ];

    const escXml = (str) => {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const headerRow = '<Row>' + headers.map(h =>
      `<Cell ss:StyleID="header"><Data ss:Type="String">${escXml(h)}</Data></Cell>`
    ).join('') + '</Row>';

    const dataRows = list.map(c => {
      const values = [
        { v: c.name, t: 'String' },
        { v: c.company, t: 'String' },
        { v: this.getTypeLabel(c.type), t: 'String' },
        { v: c.email, t: 'String' },
        { v: c.phone, t: 'String' },
        { v: c.city, t: 'String' },
        { v: c.country, t: 'String' },
        { v: c.source, t: 'String' },
        { v: c.social_platform, t: 'String' },
        { v: c.social_username, t: 'String' },
        { v: c.social_followers, t: 'String' },
        { v: this.getStatusLabel(c.status), t: 'String' },
        { v: c.deal_amount, t: 'Number' },
        { v: c.deal_currency, t: 'String' },
        { v: c.responsible ? c.responsible.full_name : '', t: 'String' },
        { v: (c.tags || []).join('; '), t: 'String' },
        { v: c.notes, t: 'String' },
        { v: c.last_contact_date ? c.last_contact_date.substring(0, 10) : '', t: 'String' },
        { v: c.created_at ? c.created_at.substring(0, 10) : '', t: 'String' },
      ];

      return '<Row>' + values.map(cell => {
        const val = cell.v != null && cell.v !== '' ? cell.v : '';
        if (val === '' || val == null) {
          return '<Cell><Data ss:Type="String"></Data></Cell>';
        }
        return `<Cell><Data ss:Type="${cell.t}">${escXml(val)}</Data></Cell>`;
      }).join('') + '</Row>';
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Contacts">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

    this._downloadFile(xml, 'contacts.xls', 'application/vnd.ms-excel');
  },

  // ===== DOWNLOAD HELPER =====
  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
