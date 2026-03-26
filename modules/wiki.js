const WikiModule = {
  categories: [],
  articles: [],
  currentArticle: null,

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { await this.loadData(); } catch(e) { console.error('Wiki load:', e); }
    this.renderNav();
    if (this.articles.length > 0 && !this.currentArticle) {
      try { await this.showArticle(this.articles[0].id); } catch(e) { console.error('Wiki article:', e); }
    }
  },

  bindEvents() {
    const addBtn = document.getElementById('wiki-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddArticle());
    }

    const addCatBtn = document.getElementById('wiki-add-cat-btn');
    if (addCatBtn) {
      addCatBtn.addEventListener('click', () => this.showAddCategory());
    }

    // Event delegation on nav for article links and category actions
    const nav = document.getElementById('wiki-nav');
    if (nav) {
      nav.addEventListener('click', (e) => {
        // Article link
        const link = e.target.closest('.wiki-link');
        if (link) {
          e.preventDefault();
          const articleId = link.dataset.articleId;
          if (articleId) this.showArticle(articleId);
          return;
        }

        // Category edit button
        const editCatBtn = e.target.closest('[data-action="edit-cat"]');
        if (editCatBtn) {
          e.stopPropagation();
          const catId = editCatBtn.dataset.catId;
          if (catId) this.showEditCategory(catId);
          return;
        }

        // Category delete button
        const delCatBtn = e.target.closest('[data-action="delete-cat"]');
        if (delCatBtn) {
          e.stopPropagation();
          const catId = delCatBtn.dataset.catId;
          if (catId) this.deleteCategory(catId);
          return;
        }
      });
    }

    // Event delegation on content area for article action buttons
    const content = document.getElementById('wiki-content');
    if (content) {
      content.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-article"]');
        if (editBtn) {
          const artId = editBtn.dataset.articleId;
          if (artId) this.showEditArticle(artId);
          return;
        }

        const delBtn = e.target.closest('[data-action="delete-article"]');
        if (delBtn) {
          const artId = delBtn.dataset.articleId;
          if (artId) this.deleteArticle(artId);
          return;
        }
      });
    }
  },

  async loadData() {
    const [catRes, artRes] = await Promise.all([
      supabase.from('wiki_categories').select('*').order('position', { ascending: true }),
      supabase.from('wiki_articles').select('*, author:author_id(id, full_name, avatar_url)').order('title', { ascending: true })
    ]);

    if (catRes.error) {
      console.error('Error loading wiki categories:', catRes.error);
      App.showToast('Ошибка загрузки категорий', 'error');
    }
    if (artRes.error) {
      console.error('Error loading wiki articles:', artRes.error);
      App.showToast('Ошибка загрузки статей', 'error');
    }

    this.categories = catRes.data || [];
    this.articles = artRes.data || [];
  },

  renderNav() {
    const nav = document.getElementById('wiki-nav');
    if (!nav) return;

    if (this.categories.length === 0) {
      nav.innerHTML = '<p class="empty-state">Нет категорий</p>';
      return;
    }

    nav.innerHTML = this.categories.map(cat => {
      const catArticles = this.articles.filter(a => a.category_id === cat.id);
      const articlesHtml = catArticles.map(a => {
        const isActive = this.currentArticle && this.currentArticle.id === a.id;
        return '<a href="#" class="wiki-link' + (isActive ? ' active' : '') + '" data-article-id="' + a.id + '">'
          + App.escapeHtml(a.title)
          + '</a>';
      }).join('');

      let adminActions = '';
      if (Auth.isAdmin()) {
        adminActions = '<span class="wiki-cat-actions">'
          + '<button class="btn-icon btn-xs" data-action="edit-cat" data-cat-id="' + cat.id + '" title="Редактировать">&#9998;</button>'
          + '<button class="btn-icon btn-xs" data-action="delete-cat" data-cat-id="' + cat.id + '" title="Удалить">&times;</button>'
          + '</span>';
      }

      return '<div class="wiki-category">'
        + '<div class="wiki-cat-title">'
          + '<span>' + App.escapeHtml(cat.title) + '</span>'
          + adminActions
        + '</div>'
        + '<div class="wiki-sidebar-nav">' + articlesHtml + '</div>'
      + '</div>';
    }).join('');
  },

  async showArticle(articleId) {
    const content = document.getElementById('wiki-content');
    if (!content) return;

    const article = this.articles.find(a => a.id === articleId);
    if (!article) {
      content.innerHTML = '<div class="empty-state"><p>Статья не найдена</p></div>';
      return;
    }

    this.currentArticle = article;

    // Update active state in nav
    const nav = document.getElementById('wiki-nav');
    if (nav) {
      nav.querySelectorAll('.wiki-link').forEach(el => {
        el.classList.toggle('active', el.dataset.articleId === articleId);
      });
    }

    const authorName = article.author ? App.escapeHtml(article.author.full_name || 'Без имени') : 'Неизвестно';
    const canEdit = (article.author_id === Auth.userId()) || Auth.isAdmin();

    const renderedContent = this.renderMarkdown(article.content || '');

    let actionsHtml = '';
    if (canEdit) {
      actionsHtml = '<div class="wiki-article-header">'
        + '<button class="btn btn-sm btn-primary" data-action="edit-article" data-article-id="' + article.id + '">Редактировать</button>'
        + '<button class="btn btn-sm btn-danger" data-action="delete-article" data-article-id="' + article.id + '">Удалить</button>'
        + '</div>';
    }

    content.innerHTML = '<div class="wiki-article-header">'
      + '<h2>' + App.escapeHtml(article.title) + '</h2>'
      + '<div class="wiki-meta">'
        + '<span>Обновлено: ' + App.formatDate(article.updated_at || article.created_at) + '</span>'
        + '<span>Автор: ' + authorName + '</span>'
      + '</div>'
      + actionsHtml
      + '</div>'
      + '<div class="wiki-body">' + renderedContent + '</div>';
  },

  showAddArticle() {
    const categoryOptions = App.selectOptions(
      this.categories.map(c => ({ value: c.id, label: c.title })),
      ''
    );

    const body = `
      <form id="wiki-article-form">
        ${App.formGroup('Название', '<input type="text" id="wiki-article-title" class="form-control" required>')}
        ${App.formGroup('Категория', '<select id="wiki-article-category" class="form-control" required>' + categoryOptions + '</select>')}
        ${App.formGroup('Содержимое (Markdown)', '<textarea id="wiki-article-content" class="form-control" rows="12" required></textarea>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Создать</button>
    `;

    App.openModal('Новая статья', body, footer);
    this._bindArticleFormFooter(null);
  },

  showEditArticle(id) {
    const article = this.articles.find(a => a.id === id);
    if (!article) return;

    const categoryOptions = App.selectOptions(
      this.categories.map(c => ({ value: c.id, label: c.title })),
      article.category_id || ''
    );

    const body = `
      <form id="wiki-article-form">
        ${App.formGroup('Название', '<input type="text" id="wiki-article-title" class="form-control" value="' + App.escapeHtml(article.title || '') + '" required>')}
        ${App.formGroup('Категория', '<select id="wiki-article-category" class="form-control" required>' + categoryOptions + '</select>')}
        ${App.formGroup('Содержимое (Markdown)', '<textarea id="wiki-article-content" class="form-control" rows="12" required>' + App.escapeHtml(article.content || '') + '</textarea>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
    `;

    App.openModal('Редактировать статью', body, footer);
    this._bindArticleFormFooter(id);
  },

  _bindArticleFormFooter(articleId) {
    const modalFooter = document.getElementById('modal-footer');
    if (modalFooter) {
      modalFooter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'cancel') App.closeModal();
        if (btn.dataset.action === 'save') this.saveArticle(articleId);
      });
    }

    const form = document.getElementById('wiki-article-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveArticle(articleId);
      });
    }
  },

  showAddCategory() {
    if (!Auth.isAdmin()) {
      App.showToast('Только администраторы могут создавать категории', 'error');
      return;
    }

    const body = `
      <form id="wiki-category-form">
        ${App.formGroup('Название категории', '<input type="text" id="wiki-category-title" class="form-control" required>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Создать</button>
    `;

    App.openModal('Новая категория', body, footer);
    this._bindCategoryFormFooter(null);
  },

  showEditCategory(id) {
    if (!Auth.isAdmin()) {
      App.showToast('Только администраторы могут редактировать категории', 'error');
      return;
    }

    const cat = this.categories.find(c => c.id === id);
    if (!cat) return;

    const body = `
      <form id="wiki-category-form">
        ${App.formGroup('Название категории', '<input type="text" id="wiki-category-title" class="form-control" value="' + App.escapeHtml(cat.title || '') + '" required>')}
      </form>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
    `;

    App.openModal('Редактировать категорию', body, footer);
    this._bindCategoryFormFooter(id);
  },

  _bindCategoryFormFooter(catId) {
    const modalFooter = document.getElementById('modal-footer');
    if (modalFooter) {
      modalFooter.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'cancel') App.closeModal();
        if (btn.dataset.action === 'save') this.saveCategory(catId);
      });
    }

    const form = document.getElementById('wiki-category-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCategory(catId);
      });
    }
  },

  async saveArticle(id) {
    const title = document.getElementById('wiki-article-title').value.trim();
    const categoryId = document.getElementById('wiki-article-category').value;
    const content = document.getElementById('wiki-article-content').value.trim();

    if (!title || !categoryId || !content) {
      App.showToast('Заполните все поля', 'error');
      return;
    }

    const payload = {
      title,
      category_id: categoryId,
      content,
      updated_at: new Date().toISOString()
    };

    let error;

    if (id) {
      const res = await supabase.from('wiki_articles').update(payload).eq('id', id);
      error = res.error;
    } else {
      payload.author_id = Auth.userId();
      const res = await supabase.from('wiki_articles').insert(payload);
      error = res.error;
    }

    if (error) {
      console.error('Error saving article:', error);
      App.showToast('Ошибка сохранения статьи', 'error');
      return;
    }

    App.closeModal();
    App.showToast(id ? 'Статья обновлена' : 'Статья создана', 'success');
    await this.loadData();
    this.renderNav();

    if (id) {
      await this.showArticle(id);
    } else {
      const newArticle = this.articles.find(a => a.title === title);
      if (newArticle) {
        await this.showArticle(newArticle.id);
      }
    }
  },

  async saveCategory(id) {
    if (!Auth.isAdmin()) {
      App.showToast('Только администраторы могут управлять категориями', 'error');
      return;
    }

    const title = document.getElementById('wiki-category-title').value.trim();
    if (!title) {
      App.showToast('Введите название категории', 'error');
      return;
    }

    let error;

    if (id) {
      const res = await supabase.from('wiki_categories').update({ title }).eq('id', id);
      error = res.error;
    } else {
      const maxPos = this.categories.reduce((max, c) => Math.max(max, c.position || 0), 0);
      const res = await supabase.from('wiki_categories').insert({ title, position: maxPos + 1 });
      error = res.error;
    }

    if (error) {
      console.error('Error saving category:', error);
      App.showToast('Ошибка сохранения категории', 'error');
      return;
    }

    App.closeModal();
    App.showToast(id ? 'Категория обновлена' : 'Категория создана', 'success');
    await this.loadData();
    this.renderNav();
  },

  async deleteArticle(id) {
    const confirmed = await App.confirm('Удалить статью', 'Вы уверены, что хотите удалить эту статью?');
    if (!confirmed) return;

    const { error } = await supabase.from('wiki_articles').delete().eq('id', id);

    if (error) {
      console.error('Error deleting article:', error);
      App.showToast('Ошибка удаления статьи', 'error');
      return;
    }

    App.showToast('Статья удалена', 'success');

    if (this.currentArticle && this.currentArticle.id === id) {
      this.currentArticle = null;
      const content = document.getElementById('wiki-content');
      if (content) {
        content.innerHTML = '<div class="empty-state"><p>Выберите статью из навигации</p></div>';
      }
    }

    await this.loadData();
    this.renderNav();
  },

  async deleteCategory(id) {
    if (!Auth.isAdmin()) {
      App.showToast('Только администраторы могут удалять категории', 'error');
      return;
    }

    const catArticles = this.articles.filter(a => a.category_id === id);
    const message = catArticles.length > 0
      ? 'В этой категории ' + catArticles.length + ' статей. Они тоже будут удалены. Продолжить?'
      : 'Вы уверены, что хотите удалить эту категорию?';

    const confirmed = await App.confirm('Удалить категорию', message);
    if (!confirmed) return;

    if (catArticles.length > 0) {
      const { error: artError } = await supabase
        .from('wiki_articles')
        .delete()
        .eq('category_id', id);
      if (artError) {
        console.error('Error deleting category articles:', artError);
        App.showToast('Ошибка удаления статей категории', 'error');
        return;
      }
    }

    const { error } = await supabase.from('wiki_categories').delete().eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      App.showToast('Ошибка удаления категории', 'error');
      return;
    }

    App.showToast('Категория удалена', 'success');

    if (this.currentArticle && this.currentArticle.category_id === id) {
      this.currentArticle = null;
      const content = document.getElementById('wiki-content');
      if (content) {
        content.innerHTML = '<div class="empty-state"><p>Выберите статью из навигации</p></div>';
      }
    }

    await this.loadData();
    this.renderNav();
  },

  renderMarkdown(text) {
    if (!text) return '';

    let html = App.escapeHtml(text);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs
    html = html.split(/\n\n+/).map(block => {
      const trimmed = block.trim();
      if (
        trimmed.startsWith('<h2>') ||
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<pre>') ||
        trimmed.startsWith('<ul>') ||
        trimmed.startsWith('<ol>') ||
        trimmed.startsWith('<li>')
      ) {
        return trimmed;
      }
      if (trimmed.length === 0) return '';
      return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    return html;
  }
};
