# Rizko Team Portal — Project Documentation

## Overview

Rizko Team Portal — это внутренний корпоративный портал для команды Rizko (AI-стартап). Веб-приложение (SPA) для управления командой, задачами, контактами, финансами, контентом и AI-ассистентом.

- **Стек**: Vanilla HTML + CSS + JavaScript (без фреймворков, без сборщиков)
- **БД**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Бэкенд**: Node.js/Express (admin-операции, Telegram бот, AI proxy)
- **AI**: OpenRouter API (Google Gemini) через серверный proxy
- **Деплой**: Статические файлы (Cloudflare Pages / Vercel) + бэкенд (Railway / Render)

---

## Project Structure

```
rizko_team-main/
  index.html          — Главный HTML: логин-экран + 15 страниц (SPA) + модальные окна
  styles.css           — Все стили (3667 строк): тёмная тема, CSS-переменные, компоненты
  config.js            — Конфигурация: Supabase URL/ключ, валюты, SERVER_URL
  auth.js              — Авторизация: login, logout, session, admin user CRUD
  app.js               — Ядро: навигация, модалки, тосты, confirm, module loader, AdminModule
  setup.sql            — SQL-миграция: 22 таблицы, RLS-политики, триггеры, Storage buckets

  modules/
    dashboard.js       — Dashboard: статистика, последние задачи, активность
    contacts.js        — CRM: контакты с фильтрами, поиском, CSV/Excel экспортом
    tasks.js           — Канбан: drag & drop, комментарии, подзадачи, вложения
    strategy.js        — Стратегии: карточки с метриками, CRUD
    reports.js          — Отчёты по видео: статистика, список, CRUD
    chat.js            — AI Чат: OpenRouter через серверный proxy, стриминг, Markdown
    team.js            — Команда: тайм-трекер (live timer), график работы, журнал
    calendar.js        — Контент-календарь: авто-генерация месяца, посты, пайплайн
    scripts.js         — Скрипт-банк: карточки, фильтры, категории, счётчик использования
    wiki.js            — Wiki: категории, статьи, Markdown-рендеринг
    files.js           — Файлы: загрузка в Supabase Storage, папки, breadcrumbs
    finance.js         — Финансы: мульти-валюта (USD/KZT), категории, транзакции, бюджет
    notifications.js   — Уведомления: polling 30с, badges, Telegram-привязка
    platforms.js       — Платформы: карточки сервисов, расходы, категории

  server/
    package.json       — Node.js зависимости: express, cors, @supabase/supabase-js, node-telegram-bot-api
    server.js          — Express сервер: admin API, Telegram бот, AI chat proxy
```

---

## Architecture

### Frontend (index.html + scripts)

SPA-навигация через `data-page` атрибуты на навигационных ссылках:
```
nav-item[data-page="dashboard"] → #page-dashboard
nav-item[data-page="contacts"]  → #page-contacts
... и так далее для всех 15 страниц
```

**Поток инициализации:**
1. Загрузка CDN: `@supabase/supabase-js@2` → `window.supabase` (библиотека)
2. `config.js` → `var supabase = supabase.createClient(url, key)` (клиент)
3. `auth.js` → определяет `Auth` объект
4. `app.js` → определяет `App` + `AdminModule`, на DOMContentLoaded вызывает `App.init()`
5. `App.init()` → `Auth.init()` → проверка сессии → если есть, `Auth.onLogin()` → `App.onAuth()`
6. `App.onAuth()` → инициализирует все 14 модулей через `window[Name+'Module'].init()`
7. Каждый модуль: `init()` → `bindEvents()` (addEventListener), `onPageEnter()` при навигации

### Backend (server/server.js)

Express на порту 3000:
- `POST /api/admin/create-user` — создание пользователя (admin+, service_role key)
- `POST /api/admin/update-user/:id` — обновление профиля (admin+)
- `POST /api/admin/delete-user/:id` — деактивация (super_admin only)
- `GET /api/admin/users` — список пользователей (admin+)
- `POST /api/telegram/link` — привязка Telegram (auth)
- `POST /api/telegram/send` — отправка уведомления (auth)
- `POST /api/ai/chat` — proxy к OpenRouter API (auth, стриминг SSE)
- `GET /api/health` — healthcheck

Auth middleware: извлекает Bearer token, верифицирует через `supabase.auth.getUser(token)`.

### Database (Supabase)

**Project:** `romawqyfqlnmgwakgnkn.supabase.co`

**22 таблицы:**

| Таблица | Назначение |
|---------|-----------|
| `profiles` | Профили пользователей (extends auth.users via trigger) |
| `contacts` | CRM контакты |
| `tasks` | Задачи (канбан) |
| `task_comments` | Комментарии к задачам |
| `task_subtasks` | Подзадачи |
| `task_attachments` | Вложения к задачам |
| `strategies` | Стратегии с метриками (JSONB) |
| `video_reports` | Отчёты по видео |
| `chat_conversations` | AI чат — разговоры |
| `chat_messages` | AI чат — сообщения |
| `time_entries` | Тайм-трекинг |
| `calendar_posts` | Контент-календарь |
| `scripts` | Скрипт-банк |
| `wiki_categories` | Wiki категории |
| `wiki_articles` | Wiki статьи |
| `folders` | Папки для файлов |
| `files` | Метаданные файлов |
| `finance_categories` | Категории доходов/расходов |
| `finance_transactions` | Финансовые транзакции |
| `marketing_budget` | Маркетинговый бюджет |
| `platforms` | Подключённые платформы |
| `notifications` | Уведомления пользователей |

**RLS (Row Level Security):** Включен на всех таблицах. Правила:
- Profiles: все читают, только self или admin обновляет
- Contacts, Tasks, Strategies и т.д.: все authenticated читают/пишут, удаляют только создатель или admin
- Chat: только свои разговоры и сообщения
- Time entries: свои + admin видит все
- Finance categories, Platforms: только admin создаёт/редактирует
- Notifications: только свои

**Storage buckets:** `files`, `avatars`, `task-attachments` — публичные, запись только для authenticated.

**Триггеры:**
- `handle_new_user` — автоматически создаёт профиль при регистрации пользователя
- `update_updated_at` — обновляет `updated_at` при изменении записи
- `notify_task_assigned` — создаёт уведомление при назначении задачи
- `check_task_deadlines` — функция для проверки дедлайнов (вызывается по cron)

---

## Auth System

**Роли:** `super_admin`, `admin`, `member`, `viewer`

- **super_admin** (Akyl): полный доступ, создание/деактивация пользователей, управление всем
- **admin**: управление пользователями (кроме super_admin), все CRUD операции
- **member**: CRUD своих данных, просмотр общих данных
- **viewer**: только просмотр

**Суперадмин:** `akyl@rizko.ai` / `sulinurdos2026`

Пользователи создаются ТОЛЬКО через админ-панель (страница "Управление" в sidebar).

---

## Module Pattern

Каждый модуль — глобальный объект:

```javascript
const ExampleModule = {
  data: [],

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    await this.loadData();
    this.render();
  },

  bindEvents() {
    // addEventListener на кнопки и контейнеры (event delegation)
    document.getElementById('example-btn')?.addEventListener('click', () => this.showModal());

    // Event delegation для динамического контента
    document.getElementById('example-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-id]');
      if (item) this.handleClick(item.dataset.id);
    });
  },

  async loadData() {
    const { data, error } = await supabase.from('example').select('*');
    if (error) { App.showToast('Ошибка', 'error'); return; }
    this.data = data || [];
  },

  render() {
    const el = document.getElementById('example-list');
    el.innerHTML = this.data.map(item => `
      <div class="card" data-id="${item.id}">
        <h3 class="card-title">${App.escapeHtml(item.title)}</h3>
      </div>
    `).join('');
  },

  showModal() {
    const body = `${App.formGroup('Название', '<input type="text" id="ex-title" />')}`;
    const footer = `
      <button class="btn btn-secondary" id="ex-cancel">Отмена</button>
      <button class="btn btn-primary" id="ex-save">Сохранить</button>
    `;
    App.openModal('Новый элемент', body, footer);
    document.getElementById('ex-cancel').addEventListener('click', () => App.closeModal());
    document.getElementById('ex-save').addEventListener('click', () => this.save());
  },

  async save() { /* ... */ },
};
```

---

## App Helpers (app.js)

```javascript
App.openModal(title, bodyHtml, footerHtml, opts)  // opts: {large: true}
App.closeModal()
App.showToast(message, type)            // type: 'success'|'error'|'info'
App.confirm(title, message)             // returns Promise<boolean>
App.escapeHtml(str)                     // XSS protection
App.formatDate(dateStr)                 // "25 мар"
App.formatDateTime(dateStr)             // "25 мар 14:30"
App.formatCurrency(amount, currency)    // "$1,234" or "₸1,234"
App.timeAgo(dateStr)                    // "5 мин назад"
App.formGroup(label, inputHtml)         // <div class="form-group">...
App.formRow(...groups)                  // <div class="form-row">...
App.selectOptions(options, selected)    // options: [{value,label}] or strings
App.getTeamMembers()                    // Promise<[{id, full_name, initials}]>
App.navigateTo(page)                    // navigate to page
```

---

## CSS Design System

**Тема:** Тёмная (bg: #0a0a0f)
**Шрифт:** Inter (Google Fonts)
**Accent:** #6366f1 (indigo/purple)

**CSS-переменные:**
```css
--bg: #0a0a0f          --bg-card: #12121a      --bg-hover: #1a1a28
--bg-sidebar: #0d0d14  --border: #1e1e2e       --text: #e4e4e7
--text-muted: #71717a  --primary: #6366f1      --primary-hover: #818cf8
--green: #22c55e       --yellow: #eab308       --red: #ef4444
--blue: #3b82f6        --purple: #a855f7       --orange: #f97316
--radius: 12px         --radius-sm: 8px        --sidebar-w: 260px
```

**Ключевые CSS-классы:**
- Layout: `.sidebar`, `.main`, `.header`, `.content`, `.page`, `.page.active`
- Cards: `.card`, `.card-title`, `.stat-card`, `.stat-icon.blue/.green/.purple/.orange`
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`, `.btn-full`
- Forms: `.form-group`, `.form-row`, `.filter-tabs`, `.filter-tab`, `.filter-search`
- Tables: `.data-table`, `.table-wrap`, `.contact-cell`, `.avatar-sm`, `.avatar-xs`
- Tags: `.badge-tag.blogger/.investor/.partner/.client/.marketing/.dev/.urgent`
- Status: `.status-dot.active/.pending/.inactive`, `.online-badge`, `.offline-badge`
- Kanban: `.kanban-board`, `.kanban-column`, `.kanban-card`, `.kanban-card-tags`
- Strategy: `.strategy-grid`, `.strategy-card`, `.strategy-status.active/.draft`
- Calendar: `.calendar-grid`, `.cal-day`, `.cal-post.idea/.filming/.editing/.published`
- Chat: `.chat-layout`, `.chat-message.user/.assistant`, `.chat-bubble`
- Files: `.files-grid`, `.file-folder`, `.file-item`, `.file-icon.img/.vid/.doc`
- Finance: `.finance-breakdown`, `.finance-row`, `.transaction-item`
- Notifications: `.notif-item`, `.notif-item.unread`, `.notif-icon`
- Platforms: `.platform-card`, `.platform-status.connected/.inactive`
- Modals: `.modal-overlay.open`, `.modal`, `.modal-lg`, `.modal-sm`
- Toast: `.toast-container`, `.toast.toast-success/.toast-error/.toast-info`
- Utility: `.text-muted`, `.empty-state`, `.hidden`, `.spinner`

---

## API Keys & Secrets

**Клиентская сторона (config.js):**
- Supabase Anon Key — публичный, защищён RLS

**Серверная сторона (server/server.js):**
- Supabase Service Role Key — полный доступ к БД
- OpenRouter API Key — AI генерация
- Telegram Bot Token — уведомления

**Supabase Project:**
- URL: `https://romawqyfqlnmgwakgnkn.supabase.co`
- Ref: `romawqyfqlnmgwakgnkn`

---

## How to Run Locally

```bash
# 1. SQL миграция (один раз)
# Скопировать setup.sql в Supabase Dashboard > SQL Editor > Run

# 2. Бэкенд сервер
cd server
npm install
node server.js    # http://localhost:3000

# 3. Фронтенд (нужен HTTP-сервер, file:// не работает из-за CORS)
npx http-server -p 8080 -c-1 --cors    # http://localhost:8080
```

---

## Key Conventions

1. **Нет фреймворков** — чистый JS, все модули как глобальные объекты
2. **Нет inline стилей** — только CSS классы из styles.css
3. **Нет onclick=""** — только addEventListener и event delegation
4. **Supabase RLS** — безопасность на уровне БД, anon key публичный
5. **Секреты на сервере** — API keys только в server.js
6. **Event delegation** — для динамического контента используем data-* атрибуты
7. **App.openModal(title, body, footer)** — 3 аргумента, footer может быть пустой строкой
8. **App.confirm(title, msg)** — возвращает Promise<boolean>, используется с await
9. **Модули не зависят друг от друга** — каждый работает автономно
10. **Валюты** — USD ($) и KZT (₸), курс 1 USD = 475 KZT

---

## Team

- **Akyl** — Founder/Dev, super_admin
- **Lujan** — Marketing
- **Nurdos** — Content Creator
