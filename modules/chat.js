const ChatModule = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isStreaming: false,

  SYSTEM_PROMPT: 'Ты — AI-ассистент команды Rizko AI. Отвечай на русском языке, кратко и по делу. Помогай с маркетингом, контентом, стратегиями и бизнес-задачами.\n\nУ тебя есть доступ к CRM базе контактов компании. Когда пользователь спрашивает про контакты, клиентов, блогеров, инвесторов, партнёров — используй данные из базы которые приложены ниже. Отвечай конкретно с именами, компаниями, телефонами и городами.',

  // RAG: fetch contacts from Supabase and build context
  async getContactsContext() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('name, company, type, email, phone, city, country, source, social_platform, social_username, status, responsible_id, tags, notes, last_contact_date, created_at');
      if (error) throw error;
      if (!data || data.length === 0) return '';

      const summary = data.map(c => {
        const tags = (c.tags || []).join(', ');
        const statusMap = { active: 'Активный', negotiation: 'Переговоры', closed: 'Закрыт', archived: 'Архив' };
        const statusLabel = statusMap[c.status] || c.status || 'Новый';
        const lastContact = c.last_contact_date ? c.last_contact_date.substring(0, 10) : '—';
        const created = c.created_at ? c.created_at.substring(0, 10) : '—';
        return `• ${c.name} | ${c.company || '—'} | тип: ${c.type} | email: ${c.email || '—'} | город: ${c.city || '—'} | страна: ${c.country || 'KZ'} | тел: ${c.phone || '—'} | ниши: ${tags} | соцсети: ${c.social_platform || '—'} | username: ${c.social_username || '—'} | лид: ${c.source || '—'} | воронка: ${statusLabel} | посл.контакт: ${lastContact} | добавлен: ${created} | заметки: ${c.notes || '—'}`;
      }).join('\n');

      return `\n\n=== БАЗА КОНТАКТОВ (${data.length} записей) ===\n${summary}\n=== КОНЕЦ БАЗЫ ===`;
    } catch (err) {
      console.error('RAG: failed to load contacts:', err);
      return '';
    }
  },

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { await this.loadConversations(); } catch(e) { console.error('Chat load:', e); }
    this.renderConversations();
    if (!this.currentConversation) {
      this.showWelcome();
    }
  },

  async showWelcome() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Load suggestions from Supabase
    let buttons = '';
    try {
      const { data } = await supabase
        .from('chat_suggestions')
        .select('emoji, text, prompt')
        .eq('is_active', true)
        .order('sort_order');
      if (data && data.length > 0) {
        buttons = data.map(s =>
          `<button class="chat-suggestion-btn" data-prompt="${App.escapeHtml(s.prompt)}">${App.escapeHtml(s.emoji)} ${App.escapeHtml(s.text)}</button>`
        ).join('');
      }
    } catch (e) {
      console.error('Failed to load suggestions:', e);
    }

    // Fallback if no suggestions
    if (!buttons) {
      buttons = `
        <button class="chat-suggestion-btn" data-prompt="Найди всех блогеров в Алматы">🔍 Найди блогеров в Алматы</button>
        <button class="chat-suggestion-btn" data-prompt="Кого привела Ляззат?">👥 Кого привела Ляззат?</button>
      `;
    }

    container.innerHTML = `
      <div class="chat-welcome" id="chat-welcome">
        <div class="chat-welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <h2>Чем могу помочь?</h2>
        <p class="text-muted">AI-ассистент с доступом к вашей CRM базе контактов</p>
        <div class="chat-suggestions" id="chat-suggestions">${buttons}</div>
      </div>`;
  },

  bindEvents() {
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    const newBtn = document.getElementById('chat-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.newChat());
    }

    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      input.addEventListener('input', () => {
        input.classList.remove('chat-input-expanded');
        const h = Math.min(input.scrollHeight, 120);
        input.classList.add('chat-input-expanded');
        input.style.height = 'auto';
        input.style.height = h + 'px';
      });
    }

    // Chat history — delegation
    const history = document.getElementById('chat-history');
    if (history) {
      history.addEventListener('click', (e) => {
        // Delete button
        const deleteBtn = e.target.closest('.chat-hist-delete');
        if (deleteBtn) {
          e.stopPropagation();
          this.deleteConversation(deleteBtn.dataset.id);
          return;
        }

        // Rename button
        const renameBtn = e.target.closest('.chat-hist-rename');
        if (renameBtn) {
          e.stopPropagation();
          this.renameConversation(renameBtn.dataset.id);
          return;
        }

        // Click on item
        const item = e.target.closest('.chat-history-item');
        if (item) {
          const convId = item.dataset.id;
          if (convId !== this.currentConversation) {
            this.loadMessages(convId);
          }
        }
      });
    }

    // Chat search
    const chatSearch = document.getElementById('chat-search');
    if (chatSearch) {
      chatSearch.addEventListener('input', (e) => {
        this.searchChats = e.target.value.trim().toLowerCase();
        this.renderConversations();
      });
    }

    // Suggestion buttons + Copy button — delegated on chat-messages container
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.addEventListener('click', (e) => {
        // Suggestion buttons
        const sugBtn = e.target.closest('.chat-suggestion-btn');
        if (sugBtn) {
          const input = document.getElementById('chat-input');
          if (input) {
            input.value = sugBtn.dataset.prompt;
            this.sendMessage();
          }
          return;
        }

        // Copy button
        const copyBtn = e.target.closest('.chat-copy-btn');
        if (copyBtn) {
          const bubble = copyBtn.closest('.chat-message').querySelector('.chat-bubble');
          if (bubble) {
            navigator.clipboard.writeText(bubble.innerText).then(() => {
              copyBtn.textContent = '✓ Скопировано';
              setTimeout(() => { copyBtn.innerHTML = '📋 Копировать'; }, 2000);
            });
          }
        }
      });
    }
  },

  async loadConversations() {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      this.conversations = data || [];
    } catch (err) {
      console.error('Failed to load conversations:', err);
      App.showToast('Ошибка загрузки чатов', 'error');
    }
  },

  async loadMessages(convId) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.messages = data || [];
      this.currentConversation = convId;
      this.renderMessages();
      this.highlightActiveConversation();
    } catch (err) {
      console.error('Failed to load messages:', err);
      App.showToast('Ошибка загрузки сообщений', 'error');
    }
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || this.isStreaming) return;

    if (!this.currentConversation) {
      await this.newChat();
    }

    input.value = '';
    input.style.height = 'auto';

    const userMessage = {
      conversation_id: this.currentConversation,
      role: 'user',
      content: content
    };

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(userMessage)
        .select()
        .single();

      if (error) throw error;
      this.messages.push(data);
    } catch (err) {
      console.error('Failed to save user message:', err);
      App.showToast('Ошибка отправки сообщения', 'error');
      return;
    }

    this.appendMessage('user', content);
    this.scrollToBottom();

    if (this.messages.filter(m => m.role === 'user').length === 1) {
      const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
      await this.updateConversationTitle(title);
    }

    // RAG: сервер сам делает поиск по embeddings и добавляет контекст
    const apiMessages = this.messages.map(m => ({ role: m.role, content: m.content }));

    await this.streamResponse(apiMessages, this.SYSTEM_PROMPT);
  },

  async streamResponse(apiMessages, systemPrompt) {
    this.isStreaming = true;
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    const loadingDiv = this.appendMessage('assistant', '<span class="chat-typing">Думаю...</span>');
    this.scrollToBottom();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(SERVER_URL + '/api/ai/chat', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: apiMessages, system_prompt: systemPrompt || '' })
      });

      if (!response.ok) {
        throw new Error('API error: ' + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';

      const bubble = loadingDiv.querySelector('.chat-bubble');
      bubble.innerHTML = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              bubble.innerHTML = this.formatMarkdown(fullContent);
              this.scrollToBottom();
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }

      if (!fullContent) {
        bubble.innerHTML = '<p><em>Пустой ответ от AI</em></p>';
        return;
      }

      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            conversation_id: this.currentConversation,
            role: 'assistant',
            content: fullContent
          })
          .select()
          .single();

        if (error) throw error;
        this.messages.push(data);
      } catch (err) {
        console.error('Failed to save assistant message:', err);
      }

      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', this.currentConversation);

    } catch (err) {
      console.error('Streaming error:', err);
      const bubble = loadingDiv.querySelector('.chat-bubble');
      bubble.innerHTML = '<p><em>Ошибка получения ответа от AI</em></p>';
      App.showToast('Ошибка AI: ' + err.message, 'error');
    } finally {
      this.isStreaming = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  },

  searchChats: '',

  renderConversations() {
    const container = document.getElementById('chat-history');
    if (!container) return;

    let convs = this.conversations;

    // Filter by search
    if (this.searchChats) {
      convs = convs.filter(c => (c.title || '').toLowerCase().includes(this.searchChats));
    }

    if (convs.length === 0) {
      container.innerHTML = '<div class="chat-history-empty">' + (this.searchChats ? 'Ничего не найдено' : 'Нет чатов') + '</div>';
      return;
    }

    // Group by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = { today: [], yesterday: [], week: [], older: [] };

    convs.forEach(conv => {
      const d = new Date(conv.updated_at || conv.created_at);
      if (d >= today) groups.today.push(conv);
      else if (d >= yesterday) groups.yesterday.push(conv);
      else if (d >= weekAgo) groups.week.push(conv);
      else groups.older.push(conv);
    });

    const renderGroup = (label, items) => {
      if (items.length === 0) return '';
      return `
        <div class="chat-history-group">
          <div class="chat-history-group-label">${label}</div>
          ${items.map(conv => `
            <div class="chat-history-item ${conv.id === this.currentConversation ? 'active' : ''}" data-id="${conv.id}">
              <div class="chat-history-info">
                <div class="chat-history-title">${App.escapeHtml(conv.title || 'Новый чат')}</div>
                <div class="chat-history-date">${App.timeAgo(conv.updated_at || conv.created_at)}</div>
              </div>
              <div class="chat-history-actions">
                <button class="chat-history-action-btn chat-hist-rename" data-id="${conv.id}" title="Переименовать">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="chat-history-action-btn delete chat-hist-delete" data-id="${conv.id}" title="Удалить">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    container.innerHTML =
      renderGroup('Сегодня', groups.today) +
      renderGroup('Вчера', groups.yesterday) +
      renderGroup('За неделю', groups.week) +
      renderGroup('Ранее', groups.older);
  },

  renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (this.messages.length === 0) {
      this.showWelcome();
      return;
    }

    container.innerHTML = this.messages.map(msg => {
      const avatarText = msg.role === 'user' ? this.getUserInitials() : 'AI';
      const formatted = msg.role === 'assistant' ? this.formatMarkdown(msg.content) : '<p>' + App.escapeHtml(msg.content) + '</p>';
      const copyBtn = msg.role === 'assistant' ? '<div class="chat-msg-actions"><button class="chat-msg-action-btn chat-copy-btn">📋 Копировать</button></div>' : '';
      return `
        <div class="chat-message ${msg.role}">
          <div class="chat-avatar">${avatarText}</div>
          <div>
            <div class="chat-bubble">${formatted}</div>
            ${copyBtn}
          </div>
        </div>
      `;
    }).join('');

    this.scrollToBottom();
  },

  appendMessage(role, content) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    // Hide welcome & empty
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.style.display = 'none';
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const avatarText = role === 'user' ? this.getUserInitials() : 'AI';
    const formatted = role === 'assistant' ? content : '<p>' + App.escapeHtml(content) + '</p>';
    const copyBtn = role === 'assistant' ? '<div class="chat-msg-actions"><button class="chat-msg-action-btn chat-copy-btn">📋 Копировать</button></div>' : '';

    const div = document.createElement('div');
    div.className = 'chat-message ' + role;
    div.innerHTML = `
      <div class="chat-avatar">${avatarText}</div>
      <div>
        <div class="chat-bubble">${formatted}</div>
        ${copyBtn}
      </div>
    `;

    container.appendChild(div);
    return div;
  },

  formatMarkdown(text) {
    if (!text) return '';

    let html = App.escapeHtml(text);

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
      return '<pre><code class="language-' + lang + '">' + code.trim() + '</code></pre>';
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  },

  async newChat() {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          title: 'Новый чат',
          user_id: Auth.userId()
        })
        .select()
        .single();

      if (error) throw error;

      this.currentConversation = data.id;
      this.messages = [];
      this.conversations.unshift(data);
      this.renderConversations();
      this.renderMessages();

      const input = document.getElementById('chat-input');
      if (input) input.focus();
    } catch (err) {
      console.error('Failed to create conversation:', err);
      App.showToast('Ошибка создания чата', 'error');
    }
  },

  async deleteConversation(convId) {
    const confirmed = await App.confirm('Удалить чат', 'Удалить этот чат и все сообщения?');
    if (!confirmed) return;

    try {
      await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', convId);

      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', convId);

      if (error) throw error;

      this.conversations = this.conversations.filter(c => c.id !== convId);
      if (this.currentConversation === convId) {
        this.currentConversation = null;
        this.messages = [];
        this.showWelcome();
      }
      this.renderConversations();
      App.showToast('Чат удален', 'success');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      App.showToast('Ошибка удаления чата', 'error');
    }
  },

  async renameConversation(convId) {
    const conv = this.conversations.find(c => c.id === convId);
    if (!conv) return;
    const body = App.formGroup('Название', `<input type="text" id="rename-title" value="${App.escapeHtml(conv.title || '')}" />`);
    const footer = `
      <button class="btn btn-secondary" data-action="cancel">Отмена</button>
      <button class="btn btn-primary" data-action="rename-save">Сохранить</button>
    `;
    App.openModal('Переименовать чат', body, footer);
    setTimeout(() => {
      const input = document.getElementById('rename-title');
      if (input) input.focus();
      const saveBtn = document.querySelector('[data-action="rename-save"]');
      const cancelBtn = document.querySelector('[data-action="cancel"]');
      if (saveBtn) saveBtn.addEventListener('click', async () => {
        const newTitle = document.getElementById('rename-title').value.trim();
        if (newTitle) {
          await this.updateConversationTitle(newTitle, convId);
          App.closeModal();
          App.showToast('Чат переименован');
        }
      });
      if (cancelBtn) cancelBtn.addEventListener('click', () => App.closeModal());
    }, 0);
  },

  async updateConversationTitle(title, convId) {
    const id = convId || this.currentConversation;
    try {
      await supabase
        .from('chat_conversations')
        .update({ title: title })
        .eq('id', id);

      const conv = this.conversations.find(c => c.id === id);
      if (conv) conv.title = title;
      this.renderConversations();
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  highlightActiveConversation() {
    const items = document.querySelectorAll('.chat-history-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.id === this.currentConversation);
    });
  },

  getUserInitials() {
    if (Auth.currentProfile) {
      const name = Auth.currentProfile.full_name || Auth.currentProfile.username || '';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase() || 'U';
    }
    return 'U';
  }
};
