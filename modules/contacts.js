// ===== CONTACTS MODULE (Mock Data + Cards/Table Toggle + Detail View) =====

const ContactsModule = {
  contacts: [],
  members: [],
  filter: 'all',
  searchQuery: '',
  viewMode: 'cards', // 'cards' or 'table'
  selectedContactId: null,

  // ===== MOCK DATA =====
  mockContacts: [
    { id: '1', name: 'Роял флауерс', company: 'Роял флауерс', type: 'client', phone: '87760920355', city: 'Тараз', niche: ['цветы'], position: 'админ', lead_source: 'Нурдос', social_platform: 'инста', deal_stage: 'contract', notes: '1 разовая услуга', tags: ['цветы'], interaction_history: [{ date: '2026-03-10', type: 'звонок', note: 'Обсудили условия' }, { date: '2026-03-05', type: 'встреча', note: 'Познакомились' }] },
    { id: '2', name: 'Аксултан', company: 'Байыпкет', type: 'client', phone: '87766460965', city: 'Алматы', niche: ['маркетинг'], position: 'директор', lead_source: 'Нуркен', social_platform: 'инста, тт', deal_stage: 'contract', notes: 'Ассистент Ляззат', tags: ['маркетинг'], interaction_history: [{ date: '2026-03-20', type: 'звонок', note: 'Подтвердил оплату' }, { date: '2026-03-12', type: 'сообщение', note: 'Отправил КП' }] },
    { id: '3', name: 'Ермек', company: 'Спонсор', type: 'investor', phone: '87012212888', city: 'Алматы', niche: ['инвестиции'], position: 'инвестор', lead_source: 'Ляззат', social_platform: '', deal_stage: 'meeting', notes: 'Передала данные', tags: ['инвестор'], interaction_history: [{ date: '2026-03-18', type: 'встреча', note: 'Встреча в офисе, обсудили инвестиции' }] },
    { id: '4', name: 'Улугбек', company: 'Шокан', type: 'client', phone: '87084101568', city: 'Алматы, Астана', niche: ['одежда', 'мода'], position: 'владелец', lead_source: 'Ляззат', social_platform: 'инста, тт', deal_stage: 'contacted', notes: 'Муж одежда, в процессе', tags: ['одежда'], interaction_history: [{ date: '2026-03-22', type: 'сообщение', note: 'Написали в инсту' }] },
    { id: '5', name: 'Азиз', company: 'Топ клининг сервис', type: 'client', phone: '87717999894', city: 'Алматы, Астана', niche: ['клининг', 'услуги'], position: 'исп директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'new', tags: ['клининг'], interaction_history: [] },
    { id: '6', name: 'Галымжан', company: 'AV clinic', type: 'client', phone: '87027804515', city: 'Алматы', niche: ['стоматология', 'медицина'], position: 'владелец', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'responded', tags: ['медицина'], interaction_history: [{ date: '2026-03-15', type: 'звонок', note: 'Заинтересован в видео-обзоре клиники' }] },
    { id: '7', name: 'Ершат', company: 'Нур Мубарак', type: 'client', phone: '87010159015', city: 'Алматы', niche: ['образование'], position: 'проректор', lead_source: 'Ляззат', social_platform: 'инста, тт', deal_stage: 'contract', notes: '1 разовая услуга', tags: ['образование'], interaction_history: [{ date: '2026-03-08', type: 'встреча', note: 'Подписали договор' }] },
    { id: '8', name: 'Женис', company: 'UniTIm', type: 'client', phone: '87772306060', city: 'Алматы, Астана, Шым', niche: ['авто', 'масло'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'meeting', tags: ['авто'], interaction_history: [{ date: '2026-03-19', type: 'встреча', note: 'Обсудили серию роликов для моторного масла' }] },
    { id: '9', name: 'Арман', company: 'АкадемСтрой', type: 'client', phone: '87001999909', city: 'Алматы, Орал, Астана', niche: ['вентиляция', 'строительство'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'new', tags: ['строительство'], interaction_history: [] },
    { id: '10', name: 'Арман', company: 'Best Climat', type: 'client', phone: '87076338581', city: 'Алматы', niche: ['вентиляция', 'строительство'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'new', tags: ['строительство'], interaction_history: [] },
    { id: '11', name: 'Нурия', company: 'Yasin Logistics', type: 'client', phone: '87027888653', city: 'Алматы, Гуанджоу', niche: ['логистика'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'contacted', tags: ['логистика'], interaction_history: [{ date: '2026-03-14', type: 'сообщение', note: 'Написали, ждём ответ' }] },
    { id: '12', name: 'Баха', company: 'Aimauyt Production', type: 'client', phone: '87713731919', city: 'Алматы', niche: ['кино', 'продакшн'], position: 'исп директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'responded', tags: ['кино'], interaction_history: [{ date: '2026-03-16', type: 'звонок', note: 'Заинтересован в коллаборации' }] },
    { id: '13', name: 'Аскар', company: 'Qalan kz', type: 'client', phone: '87081840086', city: 'КЗ, СНГ', niche: ['образование', 'EdTech'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста, тт', deal_stage: 'meeting', tags: ['образование'], interaction_history: [{ date: '2026-03-21', type: 'встреча', note: 'Обсудили партнёрство по образовательному контенту' }] },
    { id: '14', name: 'Баха', company: 'Бахапупер', type: 'blogger', phone: '87077078643', city: 'Алматы', niche: ['блогинг', 'развлечения'], position: 'блогер', lead_source: 'Ляззат', social_platform: 'инста, тт', deal_stage: 'contract', tags: ['блогер'], interaction_history: [{ date: '2026-03-20', type: 'встреча', note: 'Договорились о рекламной интеграции' }] },
    { id: '15', name: 'Азамат', company: 'Карак', type: 'client', phone: '87473389282', city: 'Алматы', niche: ['кофейня', 'общепит'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'responded', notes: 'Хочет видео-обзор кофейни, бюджет ~$500', tags: ['общепит'], interaction_history: [{ date: '2026-03-22', type: 'звонок', note: 'Обсудили цену, хочет видео' }, { date: '2026-03-18', type: 'сообщение', note: 'Написал в инсту, ответил' }, { date: '2026-03-10', type: 'встреча', note: 'Познакомились на ивенте' }] },
    { id: '16', name: 'Дана', company: 'Нму фонд', type: 'partner', phone: '87766760280', city: 'Алматы', niche: ['фонд', 'благотворительность'], position: 'РОМ', lead_source: 'Ляззат', social_platform: 'инста, тт', deal_stage: 'contract', tags: ['фонд'], interaction_history: [{ date: '2026-03-17', type: 'встреча', note: 'Подписали партнёрское соглашение' }] },
    { id: '17', name: 'Диана', company: 'Сенимгрупп', type: 'client', phone: '87071292700', city: 'Алматы', niche: ['недвижимость'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'new', tags: ['недвижимость'], interaction_history: [] },
    { id: '18', name: 'Владислав', company: 'Fun & Sun', type: 'client', phone: '87777551777', city: 'Алматы', niche: ['туризм', 'путешествия'], position: 'директор', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'contacted', tags: ['туризм'], interaction_history: [{ date: '2026-03-13', type: 'сообщение', note: 'Написали предложение' }] },
    { id: '19', name: 'Лаура', company: 'Эмирмед', type: 'client', phone: '87476033717', city: 'Алматы', niche: ['медицина', 'мед центр'], position: 'руководитель', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'meeting', tags: ['медицина'], interaction_history: [{ date: '2026-03-23', type: 'встреча', note: 'Обсудили серию видео для клиники' }] },
    { id: '20', name: 'Нурсултан', company: 'Нео Муслим', type: 'blogger', phone: '87472050312', city: 'Алматы', niche: ['блогинг', 'религия'], position: 'блогер', lead_source: 'Ляззат', social_platform: 'инста, ютуб', deal_stage: 'responded', tags: ['блогер'], interaction_history: [{ date: '2026-03-19', type: 'сообщение', note: 'Ответил, заинтересован' }] },
    { id: '21', name: 'Даке', company: 'Даке ззз', type: 'blogger', phone: '87021001683', city: 'Алматы', niche: ['блогинг', 'развлечения'], position: 'блогер', lead_source: 'Ляззат', social_platform: 'инста, тт', deal_stage: 'contract', tags: ['блогер'], interaction_history: [{ date: '2026-03-24', type: 'встреча', note: 'Снял контент для нас' }] },
    { id: '22', name: 'Шынгыс', company: 'Бирге кофе', type: 'client', phone: '87470103410', city: 'Алматы', niche: ['кофейня', 'общепит'], position: 'владелец', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'new', tags: ['общепит'], interaction_history: [] },
    { id: '23', name: 'Мерей', company: 'КМДБ', type: 'partner', phone: '87471926431', city: 'Астана, Алматы', niche: ['религия', 'муфтият'], position: 'маркетолог', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'meeting', tags: ['религия'], interaction_history: [{ date: '2026-03-20', type: 'встреча', note: 'Обсудили контент-стратегию' }] },
    { id: '24', name: 'Мадина', company: 'Соул', type: 'client', phone: '87004817381', city: 'Алматы', niche: ['красота', 'салон'], position: 'владелец', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'contacted', tags: ['красота'], interaction_history: [{ date: '2026-03-11', type: 'сообщение', note: 'Написали в директ' }] },
    { id: '25', name: 'Алишер', company: 'КНБ', type: 'partner', phone: '87760039595', city: 'Алматы', niche: ['госорган'], position: 'КНБ', lead_source: 'Ляззат', social_platform: 'инста', deal_stage: 'responded', tags: ['госорган'], interaction_history: [{ date: '2026-03-09', type: 'звонок', note: 'Обсудили информационное сотрудничество' }] },
  ],

  // ===== LIFECYCLE =====
  async init() {
    this.contacts = this.mockContacts;
    this.bindEvents();
    this.renderContacts();
  },

  async onPageEnter() {
    if (this.contacts.length === 0) this.contacts = this.mockContacts;
    this.renderContacts();
  },

  // ===== EVENT BINDING =====
  bindEvents() {
    const addBtn = document.getElementById('contacts-add-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.showAddModal());

    // View toggle
    const viewToggle = document.getElementById('contacts-view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-view]');
        if (!btn) return;
        this.viewMode = btn.dataset.view;
        viewToggle.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderContacts();
      });
    }

    // Filter tabs
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

    // Search
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

    // Cards container — click delegation
    const cardsContainer = document.getElementById('contacts-cards-container');
    if (cardsContainer) {
      cardsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('[data-contact-id]');
        if (card) this.showDetail(card.dataset.contactId);
      });
    }

    // Table rows — click delegation
    const tbody = document.getElementById('contacts-tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-contact-id]');
        if (row) this.showDetail(row.dataset.contactId);
      });
    }

    // Back button from detail
    const backBtn = document.getElementById('contacts-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.hideDetail());

    // Edit button in detail
    const editBtn = document.getElementById('contacts-edit-btn');
    if (editBtn) editBtn.addEventListener('click', () => this.showEditModal(this.selectedContactId));

    // Add interaction button
    const addInterBtn = document.getElementById('contacts-add-interaction-btn');
    if (addInterBtn) addInterBtn.addEventListener('click', () => this.showAddInteractionModal());

    // CSV export
    const csvBtn = document.getElementById('contacts-export-csv');
    if (csvBtn) csvBtn.addEventListener('click', () => this.exportCSV());

    // Excel export
    const xlsxBtn = document.getElementById('contacts-export-xlsx');
    if (xlsxBtn) xlsxBtn.addEventListener('click', () => this.exportExcel());
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
        (c.city || '').toLowerCase().includes(q) ||
        (c.niche || []).join(' ').toLowerCase().includes(q) ||
        (c.lead_source || '').toLowerCase().includes(q)
      );
    }
    return list;
  },

  // ===== RENDER =====
  renderContacts() {
    if (this.viewMode === 'cards') {
      this.renderCards();
    } else {
      this.renderTable();
    }
    // Toggle visibility
    const cardsEl = document.getElementById('contacts-cards-container');
    const tableEl = document.getElementById('contacts-table-wrap');
    if (cardsEl) cardsEl.classList.toggle('hidden', this.viewMode !== 'cards');
    if (tableEl) tableEl.classList.toggle('hidden', this.viewMode !== 'table');
  },

  // ===== CARDS RENDER =====
  renderCards() {
    const container = document.getElementById('contacts-cards-container');
    if (!container) return;
    const list = this.getFilteredContacts();

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="text-muted">Контакты не найдены</p></div>';
      return;
    }

    container.innerHTML = list.map(c => {
      const stageLabel = this.getDealStageLabel(c.deal_stage);
      const stageClass = this.getDealStageClass(c.deal_stage);
      const typeLabel = this.getTypeLabel(c.type);
      const typeBadgeClass = this.getTypeBadgeClass(c.type);
      const nicheTags = (c.niche || []).map(n => `<span class="contact-niche-tag">${App.escapeHtml(n)}</span>`).join('');
      const initials = (c.name || '??').substring(0, 2).toUpperCase();

      return `
        <div class="contact-card" data-contact-id="${c.id}">
          <div class="contact-card-top">
            <div class="contact-card-avatar">${App.escapeHtml(initials)}</div>
            <div class="contact-card-stage ${stageClass}">${App.escapeHtml(stageLabel)}</div>
          </div>
          <div class="contact-card-name">${App.escapeHtml(c.name)}</div>
          <div class="contact-card-company">${App.escapeHtml(c.company || '')} · ${App.escapeHtml(c.city || '')}</div>
          <div class="contact-card-meta">
            <span>📱 ${App.escapeHtml(c.phone || '—')}</span>
            ${c.social_platform ? `<span>📸 ${App.escapeHtml(c.social_platform)}</span>` : ''}
          </div>
          <div class="contact-card-meta">
            <span>👤 ${App.escapeHtml(c.position || '—')}</span>
            <span>🔗 ${App.escapeHtml(c.lead_source || '—')}</span>
          </div>
          <div class="contact-card-bottom">
            <span class="badge-tag ${typeBadgeClass}">${App.escapeHtml(typeLabel)}</span>
            <div class="contact-card-niches">${nicheTags}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ===== TABLE RENDER =====
  renderTable() {
    const tbody = document.getElementById('contacts-tbody');
    if (!tbody) return;
    const list = this.getFilteredContacts();

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p class="text-muted">Контакты не найдены</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => {
      const stageLabel = this.getDealStageLabel(c.deal_stage);
      const stageClass = this.getDealStageClass(c.deal_stage);
      const typeLabel = this.getTypeLabel(c.type);
      const typeBadgeClass = this.getTypeBadgeClass(c.type);
      const niches = (c.niche || []).join(', ');

      return `
        <tr data-contact-id="${c.id}">
          <td>
            <div class="contact-cell">
              <div class="avatar-sm">${App.escapeHtml((c.name || '??').substring(0, 2).toUpperCase())}</div>
              <div>
                <div class="kanban-card-title">${App.escapeHtml(c.name)}</div>
                <div class="text-muted">${App.escapeHtml(c.company || '')}</div>
              </div>
            </div>
          </td>
          <td>${App.escapeHtml(niches)}</td>
          <td>${App.escapeHtml(c.city || '—')}</td>
          <td>${App.escapeHtml(c.phone || '—')}</td>
          <td>${App.escapeHtml(c.social_platform || '—')}</td>
          <td><span class="deal-stage-badge ${stageClass}">${App.escapeHtml(stageLabel)}</span></td>
          <td>${App.escapeHtml(c.lead_source || '—')}</td>
          <td><span class="badge-tag ${typeBadgeClass}">${App.escapeHtml(typeLabel)}</span></td>
        </tr>
      `;
    }).join('');
  },

  // ===== DETAIL VIEW =====
  showDetail(id) {
    const contact = this.contacts.find(c => c.id === id);
    if (!contact) return;
    this.selectedContactId = id;

    document.getElementById('contacts-list-view').classList.add('hidden');
    document.getElementById('contacts-detail-view').classList.remove('hidden');

    const content = document.getElementById('contact-detail-content');
    const c = contact;
    const stageLabel = this.getDealStageLabel(c.deal_stage);
    const stageClass = this.getDealStageClass(c.deal_stage);
    const typeLabel = this.getTypeLabel(c.type);
    const typeBadgeClass = this.getTypeBadgeClass(c.type);
    const stages = ['new', 'contacted', 'responded', 'meeting', 'contract', 'rejected'];
    const stageLabels = { new: 'Новый', contacted: 'Написали', responded: 'Ответил', meeting: 'Встреча', contract: 'Договор', rejected: 'Отказ' };
    const currentStageIdx = stages.indexOf(c.deal_stage);

    const funnelHtml = stages.map((s, i) => {
      let cls = 'funnel-step';
      if (s === 'rejected' && c.deal_stage === 'rejected') cls += ' rejected';
      else if (i <= currentStageIdx && c.deal_stage !== 'rejected') cls += ' active';
      return `<div class="${cls}"><div class="funnel-dot"></div><div class="funnel-label">${stageLabels[s]}</div></div>`;
    }).join('<div class="funnel-line"></div>');

    const historyHtml = (c.interaction_history || []).length > 0
      ? (c.interaction_history || []).map(h => {
          const icon = h.type === 'звонок' ? '📞' : h.type === 'встреча' ? '🤝' : '💬';
          return `
            <div class="interaction-item">
              <div class="interaction-icon">${icon}</div>
              <div class="interaction-content">
                <div class="interaction-date">${App.escapeHtml(h.date)}</div>
                <div class="interaction-note">${App.escapeHtml(h.note)}</div>
              </div>
            </div>
          `;
        }).join('')
      : '<p class="text-muted">Нет записей</p>';

    const nicheTags = (c.niche || []).map(n => `<span class="contact-niche-tag">${App.escapeHtml(n)}</span>`).join(' ');

    content.innerHTML = `
      <div class="contact-detail-card">
        <div class="contact-detail-top">
          <div class="contact-detail-avatar">${App.escapeHtml((c.name || '??').substring(0, 2).toUpperCase())}</div>
          <div class="contact-detail-info">
            <h2>${App.escapeHtml(c.name)}</h2>
            <div class="contact-detail-sub">${App.escapeHtml(c.company || '')} · ${App.escapeHtml((c.niche || []).join(', '))} · ${App.escapeHtml(c.city || '')}</div>
          </div>
          <span class="deal-stage-badge ${stageClass}" style="font-size: 14px; padding: 6px 16px;">${App.escapeHtml(stageLabel)}</span>
        </div>

        <div class="contact-detail-grid">
          <div class="contact-detail-field">
            <span class="contact-detail-label">📱 Телефон</span>
            <span class="contact-detail-value">${App.escapeHtml(c.phone || '—')}</span>
          </div>
          <div class="contact-detail-field">
            <span class="contact-detail-label">📸 Соц сети</span>
            <span class="contact-detail-value">${App.escapeHtml(c.social_platform || '—')}</span>
          </div>
          <div class="contact-detail-field">
            <span class="contact-detail-label">👤 Должность</span>
            <span class="contact-detail-value">${App.escapeHtml(c.position || '—')}</span>
          </div>
          <div class="contact-detail-field">
            <span class="contact-detail-label">🔗 Привёл</span>
            <span class="contact-detail-value">${App.escapeHtml(c.lead_source || '—')}</span>
          </div>
          <div class="contact-detail-field">
            <span class="contact-detail-label">🏷️ Тип</span>
            <span class="badge-tag ${typeBadgeClass}">${App.escapeHtml(typeLabel)}</span>
          </div>
          <div class="contact-detail-field">
            <span class="contact-detail-label">🏷️ Ниши</span>
            <div>${nicheTags || '—'}</div>
          </div>
        </div>

        <div class="contact-detail-section">
          <h3>Воронка</h3>
          <div class="contact-funnel">${funnelHtml}</div>
        </div>

        <div class="contact-detail-section">
          <h3>История общения</h3>
          <div class="interaction-list">${historyHtml}</div>
        </div>

        ${c.notes ? `
        <div class="contact-detail-section">
          <h3>Заметки</h3>
          <div class="contact-notes-box">${App.escapeHtml(c.notes)}</div>
        </div>
        ` : ''}
      </div>
    `;
  },

  hideDetail() {
    document.getElementById('contacts-list-view').classList.remove('hidden');
    document.getElementById('contacts-detail-view').classList.add('hidden');
    this.selectedContactId = null;
  },

  // ===== ADD INTERACTION MODAL =====
  showAddInteractionModal() {
    const body = `
      ${App.formGroup('Тип', `
        <select id="inter-type">
          <option value="звонок">📞 Звонок</option>
          <option value="сообщение">💬 Сообщение</option>
          <option value="встреча">🤝 Встреча</option>
        </select>
      `)}
      ${App.formGroup('Дата', '<input type="date" id="inter-date" value="' + new Date().toISOString().substring(0, 10) + '" />')}
      ${App.formGroup('Заметка', '<textarea id="inter-note" rows="3" placeholder="Что обсудили..."></textarea>')}
    `;
    const footer = `
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save-inter">Добавить</button>
    `;
    App.openModal('Новый контакт с клиентом', body, footer);

    setTimeout(() => {
      const saveBtn = document.querySelector('[data-action="save-inter"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveInteraction());
      if (cancelBtn) cancelBtn.addEventListener('click', () => App.closeModal());
    }, 0);
  },

  saveInteraction() {
    const type = document.getElementById('inter-type').value;
    const date = document.getElementById('inter-date').value;
    const note = document.getElementById('inter-note').value.trim();
    if (!note) { App.showToast('Укажите заметку', 'error'); return; }

    const contact = this.contacts.find(c => c.id === this.selectedContactId);
    if (!contact) return;

    if (!contact.interaction_history) contact.interaction_history = [];
    contact.interaction_history.unshift({ date, type, note });

    App.closeModal();
    App.showToast('Контакт добавлен');
    this.showDetail(this.selectedContactId);
  },

  // ===== DEAL STAGE HELPERS =====
  getDealStageLabel(stage) {
    const map = { new: 'Новый', contacted: 'Написали', responded: 'Ответил', meeting: 'Встреча', contract: 'Договор', rejected: 'Отказ' };
    return map[stage] || stage || 'Новый';
  },

  getDealStageClass(stage) {
    const map = { new: 'stage-new', contacted: 'stage-contacted', responded: 'stage-responded', meeting: 'stage-meeting', contract: 'stage-contract', rejected: 'stage-rejected' };
    return map[stage] || 'stage-new';
  },

  // ===== TYPE HELPERS =====
  getTypeLabel(type) {
    const map = { blogger: 'Блогер', investor: 'Инвестор', partner: 'Партнёр', client: 'Клиент' };
    return map[type] || type || '—';
  },

  getTypeBadgeClass(type) {
    const map = { blogger: 'blogger', investor: 'investor', partner: 'partner', client: 'client' };
    return map[type] || '';
  },

  // ===== MODALS =====
  showAddModal() {
    const body = this.buildForm(null);
    const footer = `
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save">Создать</button>
    `;
    App.openModal('Новый контакт', body, footer);
    setTimeout(() => {
      const saveBtn = document.querySelector('[data-action="save"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveContact(null));
      if (cancelBtn) cancelBtn.addEventListener('click', () => App.closeModal());
    }, 0);
  },

  showEditModal(id) {
    const contact = this.contacts.find(c => c.id === id);
    if (!contact) return;
    const body = this.buildForm(contact);
    const footer = `
      <button class="btn btn-danger" data-action="delete">Удалить</button>
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="save">Сохранить</button>
    `;
    App.openModal('Редактировать контакт', body, footer);
    setTimeout(() => {
      const saveBtn = document.querySelector('[data-action="save"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      const deleteBtn = document.querySelector('[data-action="delete"]');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveContact(id));
      if (cancelBtn) cancelBtn.addEventListener('click', () => App.closeModal());
      if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteContact(id));
    }, 0);
  },

  buildForm(contact) {
    const c = contact || {};
    const typeOptions = App.selectOptions([
      { value: '', label: '— Выберите —' },
      { value: 'blogger', label: 'Блогер' },
      { value: 'investor', label: 'Инвестор' },
      { value: 'partner', label: 'Партнёр' },
      { value: 'client', label: 'Клиент' },
    ], c.type || '');
    const stageOptions = App.selectOptions([
      { value: 'new', label: 'Новый' },
      { value: 'contacted', label: 'Написали' },
      { value: 'responded', label: 'Ответил' },
      { value: 'meeting', label: 'Встреча' },
      { value: 'contract', label: 'Договор' },
      { value: 'rejected', label: 'Отказ' },
    ], c.deal_stage || 'new');

    return `
      <div class="form-group">
        <h4 class="text-muted">ОСНОВНАЯ ИНФОРМАЦИЯ</h4>
        ${App.formRow(
          App.formGroup('Имя *', `<input type="text" id="cf-name" value="${App.escapeHtml(c.name || '')}" />`),
          App.formGroup('Компания', `<input type="text" id="cf-company" value="${App.escapeHtml(c.company || '')}" />`)
        )}
        ${App.formRow(
          App.formGroup('Тип *', `<select id="cf-type">${typeOptions}</select>`),
          App.formGroup('Воронка', `<select id="cf-stage">${stageOptions}</select>`)
        )}
        <h4 class="text-muted">КОНТАКТЫ</h4>
        ${App.formRow(
          App.formGroup('Телефон', `<input type="text" id="cf-phone" value="${App.escapeHtml(c.phone || '')}" />`),
          App.formGroup('Город', `<input type="text" id="cf-city" value="${App.escapeHtml(c.city || '')}" />`)
        )}
        ${App.formRow(
          App.formGroup('Соц сети', `<input type="text" id="cf-social" value="${App.escapeHtml(c.social_platform || '')}" placeholder="инста, тт, ютуб" />`),
          App.formGroup('Должность', `<input type="text" id="cf-position" value="${App.escapeHtml(c.position || '')}" />`)
        )}
        <h4 class="text-muted">ДОПОЛНИТЕЛЬНО</h4>
        ${App.formRow(
          App.formGroup('Ниши (через запятую)', `<input type="text" id="cf-niche" value="${App.escapeHtml((c.niche || []).join(', '))}" />`),
          App.formGroup('Кто привёл (лид)', `<input type="text" id="cf-lead" value="${App.escapeHtml(c.lead_source || '')}" />`)
        )}
        ${App.formGroup('Заметки', `<textarea id="cf-notes" rows="3">${App.escapeHtml(c.notes || '')}</textarea>`)}
      </div>
    `;
  },

  saveContact(id) {
    const name = document.getElementById('cf-name').value.trim();
    const type = document.getElementById('cf-type').value;
    if (!name) { App.showToast('Укажите имя', 'error'); return; }
    if (!type) { App.showToast('Выберите тип', 'error'); return; }

    const nicheRaw = document.getElementById('cf-niche').value.trim();
    const niche = nicheRaw ? nicheRaw.split(',').map(n => n.trim()).filter(Boolean) : [];

    const data = {
      name,
      company: document.getElementById('cf-company').value.trim() || null,
      type,
      deal_stage: document.getElementById('cf-stage').value,
      phone: document.getElementById('cf-phone').value.trim() || null,
      city: document.getElementById('cf-city').value.trim() || null,
      social_platform: document.getElementById('cf-social').value.trim() || null,
      position: document.getElementById('cf-position').value.trim() || null,
      niche,
      lead_source: document.getElementById('cf-lead').value.trim() || null,
      notes: document.getElementById('cf-notes').value.trim() || null,
      tags: niche,
    };

    if (id) {
      const idx = this.contacts.findIndex(c => c.id === id);
      if (idx !== -1) {
        this.contacts[idx] = { ...this.contacts[idx], ...data };
      }
      App.showToast('Контакт обновлён');
    } else {
      data.id = Date.now().toString();
      data.interaction_history = [];
      this.contacts.push(data);
      App.showToast('Контакт создан');
    }

    App.closeModal();
    this.renderContacts();
    if (this.selectedContactId) this.showDetail(this.selectedContactId);
  },

  async deleteContact(id) {
    const confirmed = await App.confirm('Удалить контакт', 'Вы уверены?');
    if (!confirmed) return;
    this.contacts = this.contacts.filter(c => c.id !== id);
    App.closeModal();
    App.showToast('Контакт удалён');
    this.hideDetail();
    this.renderContacts();
  },

  // ===== EXPORT =====
  exportCSV() {
    const list = this.getFilteredContacts();
    if (list.length === 0) { App.showToast('Нет данных', 'error'); return; }
    const headers = ['Имя', 'Компания', 'Тип', 'Телефон', 'Город', 'Ниша', 'Должность', 'Соц сети', 'Лид', 'Воронка', 'Заметки'];
    const rows = list.map(c => [c.name, c.company, this.getTypeLabel(c.type), c.phone, c.city, (c.niche || []).join('; '), c.position, c.social_platform, c.lead_source, this.getDealStageLabel(c.deal_stage), c.notes]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => '"' + String(cell || '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    this._downloadFile(csvContent, 'contacts.csv', 'text/csv;charset=utf-8');
  },

  exportExcel() {
    App.showToast('Excel экспорт (мок)', 'info');
  },

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
