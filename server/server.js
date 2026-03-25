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
// AI Chat Proxy (hides API key from client)
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'google/gemini-2.5-flash-preview';

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rizko.ai',
        'X-Title': 'Rizko Team Portal',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    // Stream the response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
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
