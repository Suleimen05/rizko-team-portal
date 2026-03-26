const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 3000;
const SUPABASE_URL = 'https://romawqyfqlnmgwakgnkn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbWF3cXlmcWxubWd3YWtnbmtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ1NzYwMywiZXhwIjoyMDkwMDMzNjAzfQ.f2g6LITOdqsGJVycEcjCPbrv0GILVAuirRVE-bEPBmc';
const TELEGRAM_BOT_TOKEN = '8747271103:AAFaFudsrR-RcpZy4rWBSerYgUP-Q2-36Ao';

// ---------------------------------------------------------------------------
// Supabase client (service-role – full admin access)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Telegram Bot (polling mode for development)
// ---------------------------------------------------------------------------

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// In-memory store for linking codes: code -> { userId, telegramUsername, createdAt }
const linkingCodes = new Map();

// Clean up expired linking codes every 10 minutes (codes expire after 15 min)
const LINKING_CODE_TTL_MS = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of linkingCodes.entries()) {
    if (now - data.createdAt > LINKING_CODE_TTL_MS) {
      linkingCodes.delete(code);
    }
  }
}, 10 * 60 * 1000);

bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const param = (match[1] || '').trim();

  // Deep link: /start TOKEN — auto-link account
  if (param && linkingCodes.has(param)) {
    const linkData = linkingCodes.get(param);

    if (Date.now() - linkData.createdAt > LINKING_CODE_TTL_MS) {
      linkingCodes.delete(param);
      bot.sendMessage(chatId, 'Ссылка устарела. Попробуйте заново в портале.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ telegram_chat_id: String(chatId) })
      .eq('id', linkData.userId);

    linkingCodes.delete(param);

    if (error) {
      console.error('Auto-link error:', error);
      bot.sendMessage(chatId, 'Ошибка привязки. Попробуйте ещё раз.');
    } else {
      bot.sendMessage(chatId, 'Telegram успешно привязан к Rizko Team Portal! Теперь вы будете получать уведомления здесь.');
    }
    return;
  }

  bot.sendMessage(
    chatId,
    'Добро пожаловать в Rizko Team Bot!\n\n' +
      'Чтобы привязать аккаунт, нажмите кнопку "Telegram" в портале — ссылка сгенерируется автоматически.\n\n' +
      'Или отправьте команду: /link <код>',
  );
});

bot.onText(/\/link\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const code = (match[1] || '').trim();

  if (!code) {
    bot.sendMessage(chatId, 'Please provide a linking code. Usage: /link <code>');
    return;
  }

  const linkData = linkingCodes.get(code);

  if (!linkData) {
    bot.sendMessage(
      chatId,
      'Invalid or expired linking code. Please generate a new one from the portal.',
    );
    return;
  }

  // Check expiry
  if (Date.now() - linkData.createdAt > LINKING_CODE_TTL_MS) {
    linkingCodes.delete(code);
    bot.sendMessage(chatId, 'This linking code has expired. Please generate a new one.');
    return;
  }

  // Save the chat_id to the user's profile
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: String(chatId) })
    .eq('id', linkData.userId);

  if (error) {
    console.error('Error linking Telegram account:', error);
    bot.sendMessage(chatId, 'An error occurred while linking your account. Please try again.');
    return;
  }

  // Remove used code
  linkingCodes.delete(code);

  bot.sendMessage(
    chatId,
    'Your Telegram account has been successfully linked to the Rizko Team Portal! You will now receive notifications here.',
  );
});

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Auth middleware – extracts and verifies Supabase JWT
// ---------------------------------------------------------------------------

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// ---------------------------------------------------------------------------
// Role-check helpers
// ---------------------------------------------------------------------------

async function getCallerProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new Error('Could not fetch caller profile');
  return data;
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const profile = await getCallerProfile(req.user.id);
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.callerProfile = profile;
      next();
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({ error: 'Failed to verify permissions' });
    }
  };
}

// ---------------------------------------------------------------------------
// Routes – Admin User Management
// ---------------------------------------------------------------------------

// POST /api/admin/create-user
app.post(
  '/api/admin/create-user',
  authMiddleware,
  requireRole('super_admin', 'admin'),
  async (req, res) => {
    try {
      const { email, password, full_name, initials, role, hourly_rate, currency } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          initials,
          role,
          hourly_rate,
          currency,
        },
      });

      if (error) {
        console.error('Create user error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(201).json({ user: data.user });
    } catch (err) {
      console.error('Create user unexpected error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// POST /api/admin/update-user/:id
app.post(
  '/api/admin/update-user/:id',
  authMiddleware,
  requireRole('super_admin', 'admin'),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { full_name, initials, role, hourly_rate, currency, is_active } = req.body;

      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (initials !== undefined) updates.initials = initials;
      if (role !== undefined) updates.role = role;
      if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate;
      if (currency !== undefined) updates.currency = currency;
      if (is_active !== undefined) updates.is_active = is_active;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Update user error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ profile: data });
    } catch (err) {
      console.error('Update user unexpected error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// POST /api/admin/delete-user/:id
app.post(
  '/api/admin/delete-user/:id',
  authMiddleware,
  requireRole('super_admin'),
  async (req, res) => {
    try {
      const userId = req.params.id;

      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Delete (deactivate) user error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ message: 'User deactivated successfully', profile: data });
    } catch (err) {
      console.error('Delete user unexpected error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /api/admin/users
app.get(
  '/api/admin/users',
  authMiddleware,
  requireRole('super_admin', 'admin'),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('List users error:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.json({ users: data });
    } catch (err) {
      console.error('List users unexpected error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// Routes – Telegram
// ---------------------------------------------------------------------------

// POST /api/telegram/link
app.post('/api/telegram/link', authMiddleware, async (req, res) => {
  try {
    // Generate a unique token for deep-link
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    linkingCodes.set(code, {
      userId: req.user.id,
      telegramUsername: req.body.telegram_username || '',
      createdAt: Date.now(),
    });

    const botLink = `https://t.me/rizko_task_bot?start=${code}`;

    return res.json({
      code,
      bot_link: botLink,
      message: `Откройте ссылку и нажмите Start для привязки.`,
      expires_in_seconds: LINKING_CODE_TTL_MS / 1000,
    });
  } catch (err) {
    console.error('Telegram link error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telegram/send
app.post('/api/telegram/send', authMiddleware, async (req, res) => {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id and message are required' });
    }

    // Look up the user's telegram_chat_id
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', user_id)
      .single();

    if (error) {
      console.error('Telegram send – profile lookup error:', error);
      return res.status(400).json({ error: 'User not found' });
    }

    if (!profile.telegram_chat_id) {
      return res.status(400).json({ error: 'User has not linked a Telegram account' });
    }

    await bot.sendMessage(profile.telegram_chat_id, message, { parse_mode: 'HTML' });

    return res.json({ message: 'Notification sent successfully' });
  } catch (err) {
    console.error('Telegram send error:', err);
    return res.status(500).json({ error: 'Failed to send Telegram message' });
  }
});

// ---------------------------------------------------------------------------
// RAG System — Voyage AI Embeddings + pgvector Search + Re-ranking
// ---------------------------------------------------------------------------

const VOYAGE_API_KEY = 'pa-1D5LwTsiTDx0hv21SdJqsjflSSmRDpXvJe0DKlakFLb';
const VOYAGE_MODEL = 'voyage-3-lite';
const ANTHROPIC_API_KEY = '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';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// --- Chunking functions: convert records to searchable text ---

function chunkContact(c) {
  const tags = (c.tags || []).join(', ');
  const text = [
    `Контакт: ${c.name || ''}`,
    c.company ? `Компания: ${c.company}` : '',
    c.type ? `Тип: ${c.type}` : '',
    c.city ? `Город: ${c.city}` : '',
    c.country ? `Страна: ${c.country}` : '',
    c.phone ? `Телефон: ${c.phone}` : '',
    c.email ? `Email: ${c.email}` : '',
    c.social_platform ? `Соцсети: ${c.social_platform}` : '',
    c.social_username ? `Username: ${c.social_username}` : '',
    tags ? `Ниши: ${tags}` : '',
    c.source ? `Привёл: ${c.source}` : '',
    c.status ? `Статус: ${c.status}` : '',
    c.notes ? `Заметки: ${c.notes}` : '',
  ].filter(Boolean).join('\n');

  return [{
    text,
    metadata: { type: c.type, city: c.city, tags: c.tags, source: c.source, status: c.status }
  }];
}

function chunkTask(t) {
  const text = [
    `Задача: ${t.title || ''}`,
    t.description ? `Описание: ${t.description}` : '',
    t.status ? `Статус: ${t.status}` : '',
    t.priority ? `Приоритет: ${t.priority}` : '',
    t.category ? `Категория: ${t.category}` : '',
    t.due_date ? `Дедлайн: ${t.due_date}` : '',
  ].filter(Boolean).join('\n');

  return [{ text, metadata: { status: t.status, priority: t.priority, category: t.category } }];
}

function chunkCalendar(p) {
  const text = [
    `Контент: ${p.title || ''}`,
    p.platform ? `Платформа: ${p.platform}` : '',
    p.status ? `Статус: ${p.status}` : '',
    p.scheduled_date ? `Дата: ${p.scheduled_date}` : '',
    p.description ? `Описание: ${p.description}` : '',
  ].filter(Boolean).join('\n');

  return [{ text, metadata: { platform: p.platform, status: p.status } }];
}

function chunkScript(s) {
  const content = s.content || '';
  const tags = (s.tags || []).join(', ');
  const header = [
    `Скрипт: ${s.title || ''}`,
    s.category ? `Категория: ${s.category}` : '',
    s.platform ? `Платформа: ${s.platform}` : '',
    tags ? `Теги: ${tags}` : '',
  ].filter(Boolean).join('\n');

  // Multi-chunk for long scripts
  const chunks = [];
  const chunkSize = 500;
  const overlap = 50;
  if (content.length <= chunkSize) {
    chunks.push({ text: header + '\n' + content, metadata: { category: s.category, platform: s.platform, tags: s.tags } });
  } else {
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const slice = content.substring(i, i + chunkSize);
      chunks.push({
        text: (i === 0 ? header + '\n' : `Скрипт: ${s.title} (продолжение)\n`) + slice,
        metadata: { category: s.category, platform: s.platform, tags: s.tags }
      });
    }
  }
  return chunks;
}

function chunkWiki(a, categoryTitle) {
  const content = a.content || '';
  const header = `Wiki: ${a.title || ''}\nКатегория: ${categoryTitle || ''}`;
  const chunks = [];
  const chunkSize = 500;
  const overlap = 50;

  if (content.length <= chunkSize) {
    chunks.push({ text: header + '\n' + content, metadata: { category: categoryTitle } });
  } else {
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const slice = content.substring(i, i + chunkSize);
      chunks.push({
        text: (i === 0 ? header + '\n' : `Wiki: ${a.title} (продолжение)\n`) + slice,
        metadata: { category: categoryTitle }
      });
    }
  }
  return chunks;
}

function chunkStrategy(s) {
  const metrics = s.metrics ? JSON.stringify(s.metrics) : '';
  const text = [
    `Стратегия: ${s.title || ''}`,
    s.status ? `Статус: ${s.status}` : '',
    s.period ? `Период: ${s.period}` : '',
    s.description ? `Описание: ${s.description}` : '',
    metrics ? `Метрики: ${metrics}` : '',
  ].filter(Boolean).join('\n');

  return [{ text, metadata: { status: s.status, period: s.period } }];
}

// --- Voyage AI: generate embeddings ---

async function generateEmbeddings(texts) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: 'document',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data.map(d => d.embedding);
}

async function generateQueryEmbedding(query) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [query],
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// --- Re-ranking: keyword overlap ---

function rerank(results, query) {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  return results.map(r => {
    const contentLower = r.content_text.toLowerCase();
    let keywordHits = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) keywordHits++;
    }
    const keywordScore = queryWords.length > 0 ? keywordHits / queryWords.length : 0;
    const finalScore = 0.7 * r.similarity + 0.3 * keywordScore;
    return { ...r, final_score: finalScore };
  }).sort((a, b) => b.final_score - a.final_score);
}

// --- RAG Endpoints ---

// Full sync: embed all records from all tables
app.post('/api/rag/sync', authMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    const stats = { total: 0, created: 0, updated: 0, unchanged: 0, deleted: 0, errors: 0 };

    // Collect all chunks from all tables
    const allChunks = []; // { source_table, source_id, chunk_index, text, metadata }

    // Contacts
    const { data: contacts } = await supabase.from('contacts').select('*');
    for (const c of (contacts || [])) {
      const chunks = chunkContact(c);
      chunks.forEach((ch, i) => allChunks.push({ source_table: 'contacts', source_id: c.id, chunk_index: i, ...ch }));
    }

    // Tasks
    const { data: tasks } = await supabase.from('tasks').select('*');
    for (const t of (tasks || [])) {
      const chunks = chunkTask(t);
      chunks.forEach((ch, i) => allChunks.push({ source_table: 'tasks', source_id: t.id, chunk_index: i, ...ch }));
    }

    // Calendar posts
    const { data: calendar } = await supabase.from('calendar_posts').select('*');
    for (const p of (calendar || [])) {
      const chunks = chunkCalendar(p);
      chunks.forEach((ch, i) => allChunks.push({ source_table: 'calendar_posts', source_id: p.id, chunk_index: i, ...ch }));
    }

    // Scripts
    const { data: scripts } = await supabase.from('scripts').select('*');
    for (const s of (scripts || [])) {
      const chunks = chunkScript(s);
      chunks.forEach((ch, i) => allChunks.push({ source_table: 'scripts', source_id: s.id, chunk_index: i, ...ch }));
    }

    // Wiki articles
    const { data: wikiArticles } = await supabase.from('wiki_articles').select('*, category:wiki_categories(title)');
    for (const a of (wikiArticles || [])) {
      const catTitle = a.category?.title || '';
      const chunks = chunkWiki(a, catTitle);
      chunks.forEach((ch, i) => allChunks.push({ source_table: 'wiki_articles', source_id: a.id, chunk_index: i, ...ch }));
    }

    // Strategies
    const { data: strategies } = await supabase.from('strategies').select('*');
    for (const s of (strategies || [])) {
      const chunks = chunkStrategy(s);
      chunks.forEach((ch, i) => allChunks.push({ source_table: 'strategies', source_id: s.id, chunk_index: i, ...ch }));
    }

    stats.total = allChunks.length;
    console.log(`RAG sync: ${stats.total} chunks to process`);

    // Get existing embeddings hashes
    const { data: existing } = await supabase.from('embeddings').select('source_table, source_id, chunk_index, content_hash');
    const existingMap = new Map();
    for (const e of (existing || [])) {
      existingMap.set(`${e.source_table}:${e.source_id}:${e.chunk_index}`, e.content_hash);
    }

    // Filter chunks that need embedding (new or changed)
    const toEmbed = [];
    const unchanged = [];
    for (const chunk of allChunks) {
      const hash = crypto.createHash('md5').update(chunk.text).digest('hex');
      const key = `${chunk.source_table}:${chunk.source_id}:${chunk.chunk_index}`;
      chunk.content_hash = hash;

      if (existingMap.get(key) === hash) {
        unchanged.push(key);
        stats.unchanged++;
      } else {
        toEmbed.push(chunk);
      }
    }

    console.log(`RAG sync: ${toEmbed.length} new/changed, ${stats.unchanged} unchanged`);

    // Batch embed (max 128 per Voyage API call)
    const batchSize = 128;
    for (let i = 0; i < toEmbed.length; i += batchSize) {
      const batch = toEmbed.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);

      try {
        const embeddings = await generateEmbeddings(texts);

        // Upsert into Supabase
        const rows = batch.map((c, j) => ({
          source_table: c.source_table,
          source_id: c.source_id,
          chunk_index: c.chunk_index,
          content_text: c.text,
          content_hash: c.content_hash,
          embedding: JSON.stringify(embeddings[j]),
          metadata: c.metadata || {},
        }));

        const { error } = await supabase.from('embeddings').upsert(rows, {
          onConflict: 'source_table,source_id,chunk_index',
        });

        if (error) {
          console.error('Upsert error:', error.message);
          stats.errors += batch.length;
        } else {
          stats.created += batch.length;
        }
      } catch (err) {
        console.error('Embedding batch error:', err.message);
        stats.errors += batch.length;
      }
    }

    // Delete orphaned embeddings
    const activeKeys = new Set(allChunks.map(c => `${c.source_table}:${c.source_id}:${c.chunk_index}`));
    const toDelete = [];
    for (const e of (existing || [])) {
      const key = `${e.source_table}:${e.source_id}:${e.chunk_index}`;
      if (!activeKeys.has(key)) toDelete.push(key);
    }

    if (toDelete.length > 0) {
      for (const key of toDelete) {
        const [table, id, idx] = key.split(':');
        await supabase.from('embeddings').delete()
          .eq('source_table', table).eq('source_id', id).eq('chunk_index', parseInt(idx));
      }
      stats.deleted = toDelete.length;
    }

    stats.latency_ms = Date.now() - startTime;
    console.log(`RAG sync complete:`, stats);
    res.json(stats);
  } catch (err) {
    console.error('RAG sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search: semantic search with re-ranking
app.post('/api/rag/search', authMiddleware, async (req, res) => {
  try {
    const { query, sources, metadata_filter, limit = 10 } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });

    const startTime = Date.now();

    // Step 1: Embed query
    const queryEmbedding = await generateQueryEmbedding(query);

    // Step 2: Search via pgvector
    const { data: results, error } = await supabase.rpc('search_embeddings', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.25,
      match_count: 15,
      filter_source: sources && sources.length === 1 ? sources[0] : null,
      filter_metadata: metadata_filter || null,
    });

    if (error) throw error;

    // Step 3: Re-rank
    const reranked = rerank(results || [], query).slice(0, limit);

    const latency = Date.now() - startTime;

    // Log
    await supabase.from('rag_logs').insert({
      user_id: req.user.id,
      query,
      retrieved_count: reranked.length,
      avg_similarity: reranked.length > 0 ? reranked.reduce((s, r) => s + r.similarity, 0) / reranked.length : 0,
      sources_used: [...new Set(reranked.map(r => r.source_table))],
      latency_ms: latency,
    });

    res.json({ results: reranked, latency_ms: latency });
  } catch (err) {
    console.error('RAG search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sync single record
app.post('/api/rag/sync-record', authMiddleware, async (req, res) => {
  try {
    const { source_table, source_id } = req.body;
    if (!source_table || !source_id) return res.status(400).json({ error: 'source_table and source_id required' });

    // Fetch record
    const { data: record, error: fetchErr } = await supabase.from(source_table).select('*').eq('id', source_id).single();

    if (fetchErr || !record) {
      // Record deleted — remove embedding
      await supabase.from('embeddings').delete().eq('source_table', source_table).eq('source_id', source_id);
      return res.json({ action: 'deleted' });
    }

    // Generate chunks based on table type
    let chunks = [];
    switch (source_table) {
      case 'contacts': chunks = chunkContact(record); break;
      case 'tasks': chunks = chunkTask(record); break;
      case 'calendar_posts': chunks = chunkCalendar(record); break;
      case 'scripts': chunks = chunkScript(record); break;
      case 'strategies': chunks = chunkStrategy(record); break;
      case 'wiki_articles': {
        const { data: cat } = await supabase.from('wiki_categories').select('title').eq('id', record.category_id).single();
        chunks = chunkWiki(record, cat?.title || '');
        break;
      }
      default: return res.status(400).json({ error: 'unsupported table' });
    }

    // Generate embeddings
    const texts = chunks.map(c => c.text);
    const embeddings = await generateEmbeddings(texts);

    // Upsert
    const rows = chunks.map((c, i) => ({
      source_table,
      source_id,
      chunk_index: i,
      content_text: c.text,
      content_hash: crypto.createHash('md5').update(c.text).digest('hex'),
      embedding: JSON.stringify(embeddings[i]),
      metadata: c.metadata || {},
    }));

    const { error } = await supabase.from('embeddings').upsert(rows, {
      onConflict: 'source_table,source_id,chunk_index',
    });

    if (error) throw error;
    res.json({ action: 'synced', chunks: rows.length });
  } catch (err) {
    console.error('RAG sync-record error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI Chat Proxy with RAG (production)
// ---------------------------------------------------------------------------

const RAG_SYSTEM_PROMPT = `Ты — AI-ассистент команды Rizko AI. Отвечай на русском языке, кратко и по делу. Помогай с маркетингом, контентом, стратегиями и бизнес-задачами.

У тебя есть доступ к CRM базе данных компании. Ниже приведены релевантные данные найденные по запросу пользователя. Используй их для ответа. Если данных недостаточно, скажи об этом.`;

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { messages, system_prompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Extract last user message for RAG
    const chatMessages = messages.filter(m => m.role !== 'system');
    const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');

    // RAG: search for relevant context
    let ragContext = '';
    if (lastUserMsg) {
      try {
        const queryEmbedding = await generateQueryEmbedding(lastUserMsg.content);
        const { data: results } = await supabase.rpc('search_embeddings', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.25,
          match_count: 15,
        });

        if (results && results.length > 0) {
          const reranked = rerank(results, lastUserMsg.content).slice(0, 8);
          ragContext = '\n\n=== НАЙДЕННЫЕ ДАННЫЕ ===\n' +
            reranked.map((r, i) => `[${r.source_table}] (совпадение: ${(r.final_score * 100).toFixed(0)}%)\n${r.content_text}`).join('\n\n') +
            '\n=== КОНЕЦ ДАННЫХ ===';

          // Log
          await supabase.from('rag_logs').insert({
            user_id: req.user.id,
            query: lastUserMsg.content,
            retrieved_count: reranked.length,
            avg_similarity: reranked.reduce((s, r) => s + r.similarity, 0) / reranked.length,
            sources_used: [...new Set(reranked.map(r => r.source_table))],
            latency_ms: 0,
          }).catch(() => {});
        }
      } catch (ragErr) {
        console.error('RAG search failed, continuing without context:', ragErr.message);
      }
    }

    // Build system prompt with RAG context
    const basePrompt = system_prompt || RAG_SYSTEM_PROMPT;
    const fullSystem = basePrompt + ragContext;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: fullSystem,
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(response.status).json({ error: err });
    }

    // Stream SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const openaiChunk = {
              choices: [{ delta: { content: parsed.delta.text } }]
            };
            res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
          }
        } catch (e) {
          // skip
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('AI proxy error:', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Telegram notification dispatcher — polls for unsent notifications
// ---------------------------------------------------------------------------

let lastNotifCheck = new Date().toISOString();

async function dispatchTelegramNotifications() {
  try {
    // Get new notifications since last check
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, created_at')
      .gt('created_at', lastNotifCheck)
      .eq('is_read', false)
      .order('created_at', { ascending: true });

    if (error || !notifs || notifs.length === 0) return;

    // Update checkpoint
    lastNotifCheck = notifs[notifs.length - 1].created_at;

    // Get unique user IDs
    const userIds = [...new Set(notifs.map(n => n.user_id))];

    // Fetch their telegram_chat_ids
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, telegram_chat_id')
      .in('id', userIds)
      .not('telegram_chat_id', 'is', null);

    if (!profiles || profiles.length === 0) return;

    const chatMap = {};
    profiles.forEach(p => { chatMap[p.id] = p.telegram_chat_id; });

    // Send to Telegram
    for (const notif of notifs) {
      const chatId = chatMap[notif.user_id];
      if (!chatId) continue;
      const text = `📌 <b>${notif.title || 'Уведомление'}</b>\n${notif.message || ''}`;
      try {
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('TG dispatch error for notif', notif.id, e.message);
      }
    }
  } catch (e) {
    console.error('dispatchTelegramNotifications error:', e.message);
  }
}

// Check every 10 seconds
setInterval(dispatchTelegramNotifications, 10000);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Rizko Team server running on http://localhost:${PORT}`);
  console.log('Telegram bot is active (polling mode)');
});
