const ChatModule = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isStreaming: false,

  SYSTEM_PROMPT: 'Ты — AI-ассистент команды Rizko. Отвечай на русском языке, кратко и по делу. Помогай с маркетингом, контентом, стратегиями и бизнес-задачами.',

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    try { await this.loadConversations(); } catch(e) { console.error('Chat load:', e); }
    this.renderConversations();
    if (!this.currentConversation) {
      const container = document.getElementById('chat-messages');
      if (container) {
        container.innerHTML = '<div class="chat-empty">Начните новый чат или выберите существующий</div>';
      }
    }
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

    const history = document.getElementById('chat-history');
    if (history) {
      history.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.chat-history-delete');
        if (deleteBtn) {
          e.stopPropagation();
          const convId = deleteBtn.dataset.deleteId;
          this.deleteConversation(convId);
          return;
        }

        const item = e.target.closest('.chat-history-item');
        if (item) {
          const convId = item.dataset.id;
          if (convId !== this.currentConversation) {
            this.loadMessages(convId);
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

    const apiMessages = [
      { role: 'system', content: this.SYSTEM_PROMPT },
      ...this.messages.map(m => ({ role: m.role, content: m.content }))
    ];

    await this.streamResponse(apiMessages);
  },

  async streamResponse(apiMessages) {
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
        body: JSON.stringify({ messages: apiMessages })
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

  renderConversations() {
    const container = document.getElementById('chat-history');
    if (!container) return;

    if (this.conversations.length === 0) {
      container.innerHTML = '<div class="chat-history-empty">Нет чатов</div>';
      return;
    }

    container.innerHTML = this.conversations.map(conv => `
      <div class="chat-history-item ${conv.id === this.currentConversation ? 'active' : ''}" data-id="${conv.id}">
        <div class="chat-history-title">${App.escapeHtml(conv.title || 'Новый чат')}</div>
        <div class="chat-history-date">${App.timeAgo(conv.created_at)}</div>
        <button class="chat-history-delete" data-delete-id="${conv.id}" title="Удалить">&times;</button>
      </div>
    `).join('');

    this.highlightActiveConversation();
  },

  renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = '<div class="chat-empty">Начните диалог</div>';
      return;
    }

    container.innerHTML = this.messages.map(msg => {
      const avatarText = msg.role === 'user' ? this.getUserInitials() : 'AI';
      const formatted = msg.role === 'assistant' ? this.formatMarkdown(msg.content) : '<p>' + App.escapeHtml(msg.content) + '</p>';
      return `
        <div class="chat-message ${msg.role}">
          <div class="chat-avatar">${avatarText}</div>
          <div class="chat-bubble">${formatted}</div>
        </div>
      `;
    }).join('');

    this.scrollToBottom();
  },

  appendMessage(role, content) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const avatarText = role === 'user' ? this.getUserInitials() : 'AI';
    const formatted = role === 'assistant' ? content : '<p>' + App.escapeHtml(content) + '</p>';

    const div = document.createElement('div');
    div.className = 'chat-message ' + role;
    div.innerHTML = `
      <div class="chat-avatar">${avatarText}</div>
      <div class="chat-bubble">${formatted}</div>
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
        const container = document.getElementById('chat-messages');
        if (container) {
          container.innerHTML = '<div class="chat-empty">Начните новый чат или выберите существующий</div>';
        }
      }
      this.renderConversations();
      App.showToast('Чат удален', 'success');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      App.showToast('Ошибка удаления чата', 'error');
    }
  },

  async updateConversationTitle(title) {
    try {
      await supabase
        .from('chat_conversations')
        .update({ title: title })
        .eq('id', this.currentConversation);

      const conv = this.conversations.find(c => c.id === this.currentConversation);
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
