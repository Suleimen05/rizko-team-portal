const FinanceModule = {
  transactions: [],
  categories: [],
  displayCurrency: 'USD',
  budget: null,

  RATE_USD_KZT: 475,

  async init() {
    this.bindEvents();
  },

  bindEvents() {
    const currencySelect = document.getElementById('finance-currency');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        this.displayCurrency = e.target.value;
        this.renderAll();
      });
    }

    const addBtn = document.getElementById('finance-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddModal());
    }

    const catBtn = document.getElementById('finance-categories-btn');
    if (catBtn && Auth.isAdmin()) {
      catBtn.addEventListener('click', () => this.showCategoriesModal());
    }

    const statsContainer = document.getElementById('finance-stats');
    if (statsContainer) {
      statsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="edit-budget"]');
        if (btn) this.showBudgetModal();
      });
    }

    const txContainer = document.getElementById('finance-transactions');
    if (txContainer) {
      txContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-action="delete-tx"]');
        if (deleteBtn) {
          e.stopPropagation();
          const txId = deleteBtn.dataset.txId;
          if (txId) this.deleteTransaction(txId);
          return;
        }

        const txItem = e.target.closest('.transaction-item[data-id]');
        if (txItem) {
          this.showEditModal(txItem.dataset.id);
        }
      });
    }
  },

  async onPageEnter() {
    try { await this.loadData(); } catch(e) { console.error('Finance load:', e); }
    this.renderAll();
  },

  renderAll() {
    this.renderStats();
    this.renderBreakdown();
    this.renderTransactions();
  },

  async loadData() {
    try {
      const [txRes, catRes, budgetRes] = await Promise.all([
        supabase
          .from('finance_transactions')
          .select('*, finance_categories(name, color)')
          .order('date', { ascending: false }),
        supabase
          .from('finance_categories')
          .select('*')
          .order('name'),
        supabase
          .from('marketing_budget')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
      ]);

      if (txRes.error) throw txRes.error;
      if (catRes.error) throw catRes.error;
      if (budgetRes.error) throw budgetRes.error;

      this.transactions = txRes.data || [];
      this.categories = catRes.data || [];
      this.budget = budgetRes.data && budgetRes.data.length > 0 ? budgetRes.data[0] : null;
    } catch (err) {
      console.error('Finance loadData error:', err);
      App.showToast('Error loading finance data', 'error');
    }
  },

  convertAmount(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    if (fromCurrency === 'USD' && toCurrency === 'KZT') return amount * this.RATE_USD_KZT;
    if (fromCurrency === 'KZT' && toCurrency === 'USD') return amount / this.RATE_USD_KZT;
    return amount;
  },

  getDisplayAmount(amount, originalCurrency) {
    return this.convertAmount(Number(amount), originalCurrency, this.displayCurrency);
  },

  formatDisplay(amount, originalCurrency) {
    const converted = this.getDisplayAmount(amount, originalCurrency);
    return App.formatCurrency(converted, this.displayCurrency);
  },

  renderStats() {
    const container = document.getElementById('finance-stats');
    if (!container) return;

    let totalIncome = 0;
    let totalExpense = 0;

    this.transactions.forEach(tx => {
      const amt = this.getDisplayAmount(tx.amount, tx.currency);
      if (tx.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
    });

    const balance = totalIncome - totalExpense;

    let budgetDisplay = '-';
    if (this.budget) {
      budgetDisplay = this.formatDisplay(this.budget.amount, this.budget.currency);
    }

    const balanceClass = balance >= 0 ? 'income' : 'expense';

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon income">
          <i class="fas fa-arrow-up"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value income">${App.formatCurrency(totalIncome, this.displayCurrency)}</div>
          <div class="stat-label">Income</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon expense">
          <i class="fas fa-arrow-down"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value expense">${App.formatCurrency(totalExpense, this.displayCurrency)}</div>
          <div class="stat-label">Expenses</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon balance">
          <i class="fas fa-wallet"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value ${balanceClass}">${App.formatCurrency(balance, this.displayCurrency)}</div>
          <div class="stat-label">Balance</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon budget">
          <i class="fas fa-bullhorn"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value">${budgetDisplay}</div>
          <div class="stat-label">Marketing Budget</div>
        </div>
        ${Auth.isAdmin() ? '<button class="btn-icon" data-action="edit-budget" title="Edit budget"><i class="fas fa-edit"></i></button>' : ''}
      </div>
    `;
  },

  renderBreakdown() {
    const container = document.getElementById('finance-breakdown');
    if (!container) return;

    const expensesByCategory = {};

    this.transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const catName = tx.finance_categories?.name || 'Uncategorized';
      const catColor = tx.finance_categories?.color || '#999';
      const amt = this.getDisplayAmount(tx.amount, tx.currency);

      if (!expensesByCategory[catName]) {
        expensesByCategory[catName] = { amount: 0, color: catColor };
      }
      expensesByCategory[catName].amount += amt;
    });

    const sorted = Object.entries(expensesByCategory)
      .sort((a, b) => b[1].amount - a[1].amount);

    let maxAmount = 0;
    if (sorted.length > 0) {
      maxAmount = sorted[0][1].amount;
    }

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state">No expense data</div>';
      return;
    }

    container.innerHTML = '<div class="finance-breakdown">' + sorted.map(([name, data]) => {
      const pct = maxAmount > 0 ? (data.amount / maxAmount) * 100 : 0;
      return `
        <div class="finance-row">
          <div class="finance-cat">
            <span class="legend-dot" style="background:${data.color}"></span>
            <span>${App.escapeHtml(name)}</span>
          </div>
          <div class="finance-bar-wrap">
            <div class="finance-bar" style="width:${pct}%;background:${data.color}"></div>
          </div>
          <div class="finance-amount">${App.formatCurrency(data.amount, this.displayCurrency)}</div>
        </div>
      `;
    }).join('') + '</div>';
  },

  renderTransactions() {
    const container = document.getElementById('finance-transactions');
    if (!container) return;

    if (this.transactions.length === 0) {
      container.innerHTML = '<div class="empty-state">No transactions</div>';
      return;
    }

    container.innerHTML = '<div class="transactions-list">' + this.transactions.map(tx => {
      const isIncome = tx.type === 'income';
      const typeClass = isIncome ? 'income' : 'expense';
      const icon = isIncome ? 'fa-arrow-up' : 'fa-arrow-down';
      const sign = isIncome ? '+' : '-';
      const displayAmt = this.getDisplayAmount(tx.amount, tx.currency);

      return `
        <div class="transaction-item" data-id="${tx.id}">
          <div class="transaction-icon ${typeClass}">
            <i class="fas ${icon}"></i>
          </div>
          <div class="transaction-info">
            <div class="transaction-name">${App.escapeHtml(tx.name)}</div>
            <div class="transaction-date">${App.formatDate(tx.date)}</div>
          </div>
          <div class="transaction-amount ${typeClass}">
            ${sign}${App.formatCurrency(displayAmt, this.displayCurrency)}
          </div>
          <button class="btn-icon" data-action="delete-tx" data-tx-id="${tx.id}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    }).join('') + '</div>';
  },

  showAddModal() {
    this.showTransactionModal(null);
  },

  showEditModal(id) {
    const tx = this.transactions.find(t => t.id === id);
    if (!tx) return;
    this.showTransactionModal(tx);
  },

  showTransactionModal(tx) {
    const isEdit = !!tx;
    const title = isEdit ? 'Edit Transaction' : 'New Transaction';
    const selectedType = tx ? tx.type : 'expense';

    const currencyOptions = Object.entries(CONFIG.currencies)
      .map(([code, info]) => ({ value: code, label: info.symbol + ' ' + info.name }));

    const typeOptions = [
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' }
    ];

    const categoryOptions = this.buildCategoryOptions(selectedType, tx?.category_id);

    const today = new Date().toISOString().split('T')[0];

    const body = `
      <form id="finance-tx-form">
        ${App.formGroup('Name', '<input type="text" id="tx-name" class="form-control" value="' + App.escapeHtml(tx?.name || '') + '" required>')}
        ${App.formRow(
          App.formGroup('Amount', '<input type="number" id="tx-amount" class="form-control" step="0.01" min="0.01" value="' + (tx?.amount || '') + '" required>'),
          App.formGroup('Currency', '<select id="tx-currency" class="form-control">' + App.selectOptions(currencyOptions, tx?.currency || 'USD') + '</select>')
        )}
        ${App.formRow(
          App.formGroup('Type', '<select id="tx-type" class="form-control">' + App.selectOptions(typeOptions, selectedType) + '</select>'),
          App.formGroup('Category', '<select id="tx-category" class="form-control">' + categoryOptions + '</select>')
        )}
        ${App.formGroup('Date', '<input type="date" id="tx-date" class="form-control" value="' + (tx?.date || today) + '" required>')}
        ${App.formGroup('Notes', '<textarea id="tx-notes" class="form-control" rows="2">' + App.escapeHtml(tx?.notes || '') + '</textarea>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
      <button type="button" class="btn btn-primary" id="modal-save-btn">${isEdit ? 'Save' : 'Add'}</button>
    `;

    App.openModal(title, body, footer);

    const txId = tx?.id || '';

    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveTransaction(txId));
    }

    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => App.closeModal());
    }

    const typeSelect = document.getElementById('tx-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => this.onTypeChange());
    }
  },

  buildCategoryOptions(type, selectedId) {
    const filtered = this.categories.filter(c => c.type === type);
    if (filtered.length === 0) {
      return '<option value="">No categories</option>';
    }
    return filtered.map(c =>
      '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + App.escapeHtml(c.name) + '</option>'
    ).join('');
  },

  onTypeChange() {
    const type = document.getElementById('tx-type')?.value;
    const catSelect = document.getElementById('tx-category');
    if (!type || !catSelect) return;
    catSelect.innerHTML = this.buildCategoryOptions(type, null);
  },

  async saveTransaction(id) {
    const name = document.getElementById('tx-name')?.value?.trim();
    const amount = parseFloat(document.getElementById('tx-amount')?.value);
    const currency = document.getElementById('tx-currency')?.value;
    const type = document.getElementById('tx-type')?.value;
    const categoryId = document.getElementById('tx-category')?.value || null;
    const date = document.getElementById('tx-date')?.value;
    const notes = document.getElementById('tx-notes')?.value?.trim() || null;

    if (!name || isNaN(amount) || amount <= 0 || !date) {
      App.showToast('Please fill in all required fields', 'error');
      return;
    }

    const data = {
      name,
      amount,
      currency,
      type,
      category_id: categoryId || null,
      date,
      notes
    };

    try {
      if (id) {
        const { error } = await supabase
          .from('finance_transactions')
          .update(data)
          .eq('id', id);
        if (error) throw error;
        App.showToast('Transaction updated', 'success');
      } else {
        data.created_by = Auth.userId();
        const { error } = await supabase
          .from('finance_transactions')
          .insert(data);
        if (error) throw error;
        App.showToast('Transaction added', 'success');
      }

      App.closeModal();
      await this.loadData();
      this.renderAll();
    } catch (err) {
      console.error('Save transaction error:', err);
      App.showToast('Error saving transaction', 'error');
    }
  },

  async deleteTransaction(id) {
    const confirmed = await App.confirm('Delete Transaction', 'Are you sure you want to delete this transaction?');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
      if (error) throw error;
      App.showToast('Transaction deleted', 'success');
      await this.loadData();
      this.renderAll();
    } catch (err) {
      console.error('Delete transaction error:', err);
      App.showToast('Error deleting transaction', 'error');
    }
  },

  // --- Marketing Budget ---

  showBudgetModal() {
    if (!Auth.isAdmin()) return;

    const currencyOptions = Object.entries(CONFIG.currencies)
      .map(([code, info]) => ({ value: code, label: info.symbol + ' ' + info.name }));

    const body = `
      <form id="finance-budget-form">
        ${App.formRow(
          App.formGroup('Budget Amount', '<input type="number" id="budget-amount" class="form-control" step="0.01" min="0" value="' + (this.budget?.amount || '') + '" required>'),
          App.formGroup('Currency', '<select id="budget-currency" class="form-control">' + App.selectOptions(currencyOptions, this.budget?.currency || 'USD') + '</select>')
        )}
        ${App.formGroup('Period', '<input type="text" id="budget-period" class="form-control" placeholder="e.g. 2026-03" value="' + App.escapeHtml(this.budget?.period || '') + '">')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" id="budget-cancel-btn">Cancel</button>
      <button type="button" class="btn btn-primary" id="budget-save-btn">Save</button>
    `;

    App.openModal('Marketing Budget', body, footer);

    const saveBtn = document.getElementById('budget-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveBudget());
    }

    const cancelBtn = document.getElementById('budget-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => App.closeModal());
    }
  },

  async saveBudget() {
    const amount = parseFloat(document.getElementById('budget-amount')?.value);
    const currency = document.getElementById('budget-currency')?.value;
    const period = document.getElementById('budget-period')?.value?.trim() || null;

    if (isNaN(amount) || amount < 0) {
      App.showToast('Please enter a valid amount', 'error');
      return;
    }

    const data = {
      amount,
      currency,
      period,
      updated_by: Auth.userId(),
      updated_at: new Date().toISOString()
    };

    try {
      if (this.budget?.id) {
        const { error } = await supabase
          .from('marketing_budget')
          .update(data)
          .eq('id', this.budget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketing_budget')
          .insert(data);
        if (error) throw error;
      }

      App.showToast('Budget saved', 'success');
      App.closeModal();
      await this.loadData();
      this.renderStats();
    } catch (err) {
      console.error('Save budget error:', err);
      App.showToast('Error saving budget', 'error');
    }
  },

  // --- Category Management ---

  showCategoriesModal() {
    if (!Auth.isAdmin()) return;

    const rows = this.categories.map(c => `
      <div class="finance-row" data-id="${c.id}">
        <span class="legend-dot" style="background:${c.color}"></span>
        <span class="finance-cat">${App.escapeHtml(c.name)}</span>
        <span class="member-role-tag">${c.type === 'income' ? 'Income' : 'Expense'}</span>
        <button class="btn-icon" data-action="edit-cat" data-cat-id="${c.id}" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="btn-icon" data-action="delete-cat" data-cat-id="${c.id}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    const body = `
      <div class="categories-list">${rows || '<div class="empty-state">No categories</div>'}</div>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" id="cat-close-btn">Close</button>
      <button type="button" class="btn btn-primary" id="cat-add-btn">
        <i class="fas fa-plus"></i> Add Category
      </button>
    `;

    App.openModal('Categories', body, footer);

    const closeBtn = document.getElementById('cat-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => App.closeModal());
    }

    const addCatBtn = document.getElementById('cat-add-btn');
    if (addCatBtn) {
      addCatBtn.addEventListener('click', () => this.showEditCategoryModal(null));
    }

    const modalBody = document.querySelector('.categories-list');
    if (modalBody) {
      modalBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-cat"]');
        if (editBtn) {
          this.showEditCategoryModal(editBtn.dataset.catId);
          return;
        }
        const deleteBtn = e.target.closest('[data-action="delete-cat"]');
        if (deleteBtn) {
          this.deleteCategory(deleteBtn.dataset.catId);
        }
      });
    }
  },

  showEditCategoryModal(id) {
    const cat = id ? this.categories.find(c => c.id === id) : null;
    const isEdit = !!cat;

    const typeOptions = [
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' }
    ];

    const body = `
      <form id="finance-cat-form">
        ${App.formGroup('Name', '<input type="text" id="cat-name" class="form-control" value="' + App.escapeHtml(cat?.name || '') + '" required>')}
        ${App.formRow(
          App.formGroup('Type', '<select id="cat-type" class="form-control">' + App.selectOptions(typeOptions, cat?.type || 'expense') + '</select>'),
          App.formGroup('Color', '<input type="color" id="cat-color" class="form-control" value="' + (cat?.color || '#2196f3') + '">')
        )}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" id="cat-back-btn">Back</button>
      <button type="button" class="btn btn-primary" id="cat-save-btn">${isEdit ? 'Save' : 'Add'}</button>
    `;

    App.openModal(isEdit ? 'Edit Category' : 'New Category', body, footer);

    const catId = id || '';

    const saveBtn = document.getElementById('cat-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveCategory(catId));
    }

    const backBtn = document.getElementById('cat-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showCategoriesModal());
    }
  },

  async saveCategory(id) {
    const name = document.getElementById('cat-name')?.value?.trim();
    const type = document.getElementById('cat-type')?.value;
    const color = document.getElementById('cat-color')?.value;

    if (!name) {
      App.showToast('Please enter a category name', 'error');
      return;
    }

    const data = { name, type, color };

    try {
      if (id) {
        const { error } = await supabase
          .from('finance_categories')
          .update(data)
          .eq('id', id);
        if (error) throw error;
        App.showToast('Category updated', 'success');
      } else {
        const { error } = await supabase
          .from('finance_categories')
          .insert(data);
        if (error) throw error;
        App.showToast('Category added', 'success');
      }

      await this.loadData();
      this.showCategoriesModal();
    } catch (err) {
      console.error('Save category error:', err);
      App.showToast('Error saving category', 'error');
    }
  },

  async deleteCategory(id) {
    const confirmed = await App.confirm('Delete Category', 'All transactions in this category will lose their association.');
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('finance_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      App.showToast('Category deleted', 'success');
      await this.loadData();
      this.showCategoriesModal();
    } catch (err) {
      console.error('Delete category error:', err);
      App.showToast('Error deleting category', 'error');
    }
  }
};
