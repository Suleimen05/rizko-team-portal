const TeamModule = {
  members: [],
  timeEntries: [],
  timerInterval: null,
  runningTimers: {},
  chartColors: ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'],

  async init() {
    this.bindEvents();
  },

  bindEvents() {
    const periodEl = document.getElementById('team-period');
    if (periodEl) {
      periodEl.addEventListener('change', () => this.onPeriodChange());
    }

    const cardsContainer = document.getElementById('team-cards');
    if (cardsContainer) {
      cardsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const userId = btn.dataset.userId;
        if (!userId) return;

        // Permission check: only own timer or admin
        const isOwn = userId === Auth.userId();
        if (!isOwn && !Auth.isSuperAdmin()) {
          App.showToast('Вы можете управлять только своим таймером', 'error');
          return;
        }

        if (action === 'start') {
          this.startTimer(userId);
        } else if (action === 'stop') {
          this.stopTimer(userId);
        }
      });
    }
  },

  async onPageEnter() {
    try { await this.loadData(); } catch(e) { console.error('Team load:', e); }
    this.render();
    this.startTickInterval();
  },

  onPageLeave() {
    this.stopTickInterval();
  },

  startTickInterval() {
    this.stopTickInterval();
    this.timerInterval = setInterval(() => this.tickTimers(), 1000);
  },

  stopTickInterval() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  async loadData() {
    const { data: members, error: mErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name');

    if (mErr) {
      console.error('Error loading members:', mErr);
      this.members = [];
    } else {
      this.members = members || [];
    }

    const period = this.getSelectedPeriod();
    const startDate = this.getPeriodStart(period);

    const { data: entries, error: eErr } = await supabase
      .from('time_entries')
      .select('*')
      .gte('start_time', startDate.toISOString())
      .order('start_time', { ascending: false });

    if (eErr) {
      console.error('Error loading time entries:', eErr);
      this.timeEntries = [];
    } else {
      this.timeEntries = entries || [];
    }

    // Build running timers map — only keep ONE running entry per user
    // If duplicates exist, close the older ones
    this.runningTimers = {};
    const runningByUser = {};
    for (const entry of this.timeEntries) {
      if (!entry.is_running) continue;
      if (!runningByUser[entry.user_id]) {
        runningByUser[entry.user_id] = [];
      }
      runningByUser[entry.user_id].push(entry);
    }

    for (const userId in runningByUser) {
      const entries = runningByUser[userId];
      // Keep only the newest, close the rest
      entries.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      this.runningTimers[userId] = entries[0];

      for (let i = 1; i < entries.length; i++) {
        const stale = entries[i];
        const dur = Math.floor((Date.now() - new Date(stale.start_time).getTime()) / 1000);
        stale.is_running = false;
        stale.duration_seconds = dur;
        stale.end_time = new Date().toISOString();
        // Fire-and-forget DB cleanup
        supabase
          .from('time_entries')
          .update({ end_time: stale.end_time, duration_seconds: dur, is_running: false })
          .eq('id', stale.id)
          .then();
      }
    }
  },

  getSelectedPeriod() {
    const el = document.getElementById('team-period');
    return el ? el.value : 'week';
  },

  getPeriodStart(period) {
    const now = new Date();
    const start = new Date(now);
    if (period === 'month') {
      start.setDate(1);
    } else {
      start.setDate(now.getDate() - 6);
    }
    start.setHours(0, 0, 0, 0);
    return start;
  },

  async onPeriodChange() {
    await this.loadData();
    this.render();
  },

  render() {
    this.renderCards();
    this.renderSummary();
    this.renderChart();
    this.renderLog();
  },

  // --- Get accumulated seconds for a member TODAY ---
  getTodaySeconds(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalSec = 0;

    for (const entry of this.timeEntries) {
      if (entry.user_id !== userId) continue;
      const entryDate = new Date(entry.start_time);
      if (entryDate < today) continue;

      if (entry.is_running) {
        totalSec += Math.floor((Date.now() - entryDate.getTime()) / 1000);
      } else {
        totalSec += entry.duration_seconds || 0;
      }
    }
    return totalSec;
  },

  // --- CARDS ---
  renderCards() {
    const container = document.getElementById('team-cards');
    if (!container) return;

    container.innerHTML = this.members.map(member => {
      const running = this.runningTimers[member.id];
      const isOnline = !!running;
      const isOwn = member.id === Auth.userId();
      const canControl = isOwn || Auth.isSuperAdmin();
      const monthStats = this.getMemberMonthStats(member);
      const todaySec = this.getTodaySeconds(member.id);
      const timerDisplay = this.formatSecondsHMS(todaySec);
      const currency = member.currency || 'USD';
      const rate = member.hourly_rate || 0;

      return `
        <div class="team-member-card ${isOnline ? 'online' : ''}" data-user-id="${member.id}">
          <div class="member-header">
            <div class="avatar-sm member-avatar">${App.escapeHtml(member.initials || '??')}</div>
            <div class="member-info">
              <div class="member-name">${App.escapeHtml(member.full_name || 'Unknown')}</div>
              <span class="member-role-tag">${App.escapeHtml(member.role || '')}</span>
            </div>
            <span class="${isOnline ? 'online-badge' : 'offline-badge'}">
              ${isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div class="member-timer">
            <span class="timer-value ${isOnline ? '' : 'off'}" id="timer-${member.id}">${timerDisplay}</span>
          </div>
          ${canControl ? `
            <div style="margin-bottom: 12px;">
              ${isOnline
                ? `<button class="btn-sm btn-stop" data-action="stop" data-user-id="${member.id}">Пауза</button>`
                : `<button class="btn-sm btn-start" data-action="start" data-user-id="${member.id}">Старт</button>`
              }
            </div>
          ` : ''}
          <div class="member-stats-row">
            <div class="member-stat">
              <div class="member-stat-val">${monthStats.hours.toFixed(1)}h</div>
              <div class="member-stat-lbl">За месяц</div>
            </div>
            <div class="member-stat">
              <div class="member-stat-val">${App.formatCurrency(monthStats.earnings, currency)}</div>
              <div class="member-stat-lbl">Заработок</div>
            </div>
            <div class="member-stat">
              <div class="member-stat-val">${App.formatCurrency(rate, currency)}/ч</div>
              <div class="member-stat-lbl">Ставка</div>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  getMemberMonthStats(member) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalSeconds = 0;

    for (const entry of this.timeEntries) {
      if (entry.user_id !== member.id) continue;
      const entryDate = new Date(entry.start_time);
      if (entryDate < monthStart) continue;

      if (entry.is_running) {
        totalSeconds += Math.floor((Date.now() - new Date(entry.start_time).getTime()) / 1000);
      } else {
        totalSeconds += entry.duration_seconds || 0;
      }
    }

    const hours = totalSeconds / 3600;
    const rate = member.hourly_rate || 0;
    return { hours, earnings: hours * rate };
  },

  formatSecondsHMS(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  },

  // --- TIMER ACTIONS ---

  async startTimer(userId) {
    // Permission check
    if (userId !== Auth.userId() && !Auth.isSuperAdmin()) {
      App.showToast('Нет прав для управления этим таймером', 'error');
      return;
    }

    // Don't start if already running
    if (this.runningTimers[userId]) {
      App.showToast('Таймер уже запущен', 'info');
      return;
    }

    // Close any stale running entries in DB for this user
    const now = new Date();
    const { data: staleEntries } = await supabase
      .from('time_entries')
      .select('id, start_time')
      .eq('user_id', userId)
      .eq('is_running', true);

    if (staleEntries && staleEntries.length > 0) {
      for (const stale of staleEntries) {
        const dur = Math.floor((now.getTime() - new Date(stale.start_time).getTime()) / 1000);
        await supabase
          .from('time_entries')
          .update({ end_time: now.toISOString(), duration_seconds: dur, is_running: false })
          .eq('id', stale.id);
      }
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: userId,
        start_time: now.toISOString(),
        is_running: true
      })
      .select()
      .single();

    if (error) {
      App.showToast('Ошибка запуска: ' + error.message, 'error');
      return;
    }

    // Reload to get clean state
    await this.loadData();
    App.showToast('Таймер запущен', 'success');
    this.render();
  },

  async stopTimer(userId) {
    // Permission check
    if (userId !== Auth.userId() && !Auth.isSuperAdmin()) {
      App.showToast('Нет прав для управления этим таймером', 'error');
      return;
    }

    const running = this.runningTimers[userId];
    if (!running) return;

    const now = new Date();
    const start = new Date(running.start_time);
    const durationSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: now.toISOString(),
        duration_seconds: durationSeconds,
        is_running: false
      })
      .eq('id', running.id);

    if (error) {
      App.showToast('Ошибка паузы: ' + error.message, 'error');
      return;
    }

    const idx = this.timeEntries.findIndex(e => e.id === running.id);
    if (idx !== -1) {
      this.timeEntries[idx].end_time = now.toISOString();
      this.timeEntries[idx].duration_seconds = durationSeconds;
      this.timeEntries[idx].is_running = false;
    }
    delete this.runningTimers[userId];

    App.showToast('Таймер на паузе', 'success');
    this.render();
  },

  tickTimers() {
    // Update ALL timer displays (including paused — show accumulated today time)
    for (const member of this.members) {
      const timerEl = document.getElementById('timer-' + member.id);
      if (timerEl) {
        const todaySec = this.getTodaySeconds(member.id);
        timerEl.textContent = this.formatSecondsHMS(todaySec);
      }
    }
  },

  // --- SUMMARY ---

  renderSummary() {
    const container = document.getElementById('team-summary');
    if (!container) return;

    let totalSeconds = 0;
    let totalPay = 0;
    const memberCount = this.members.length;

    for (const entry of this.timeEntries) {
      let sec = 0;
      if (entry.is_running) {
        sec = Math.floor((Date.now() - new Date(entry.start_time).getTime()) / 1000);
      } else {
        sec = entry.duration_seconds || 0;
      }
      totalSeconds += sec;

      const member = this.members.find(m => m.id === entry.user_id);
      if (member) {
        totalPay += (sec / 3600) * (member.hourly_rate || 0);
      }
    }

    const totalHours = totalSeconds / 3600;
    const period = this.getSelectedPeriod();
    const days = period === 'month' ? 30 : 7;
    const avgPerDay = memberCount > 0 ? totalHours / days : 0;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${totalHours.toFixed(1)}h</div>
        <div class="stat-label">Всего часов</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${App.formatCurrency(totalPay, 'USD')}</div>
        <div class="stat-label">Всего к оплате</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${memberCount}</div>
        <div class="stat-label">Участников</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgPerDay.toFixed(1)}h</div>
        <div class="stat-label">Ср. часов/день</div>
      </div>
    `;
  },

  // --- CHART ---

  renderChart() {
    const container = document.getElementById('team-chart');
    const legendContainer = document.getElementById('team-chart-legend');
    if (!container) return;

    const period = this.getSelectedPeriod();
    const dayCount = period === 'month' ? 9 : 7;
    const days = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    const data = {};
    for (const day of days) {
      const key = day.toISOString().slice(0, 10);
      data[key] = {};
    }

    for (const entry of this.timeEntries) {
      const entryDate = new Date(entry.start_time);
      const key = entryDate.toISOString().slice(0, 10);
      if (!(key in data)) continue;

      let sec = 0;
      if (entry.is_running) {
        sec = Math.floor((Date.now() - entryDate.getTime()) / 1000);
      } else {
        sec = entry.duration_seconds || 0;
      }
      const hours = sec / 3600;
      data[key][entry.user_id] = (data[key][entry.user_id] || 0) + hours;
    }

    let maxHours = 0;
    for (const key in data) {
      let dayTotal = 0;
      for (const uid in data[key]) {
        dayTotal += data[key][uid];
      }
      if (dayTotal > maxHours) maxHours = dayTotal;
    }
    if (maxHours === 0) maxHours = 8;

    const memberColors = {};
    this.members.forEach((m, i) => {
      memberColors[m.id] = this.chartColors[i % this.chartColors.length];
    });

    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    container.innerHTML = days.map(day => {
      const key = day.toISOString().slice(0, 10);
      const dayData = data[key] || {};
      const dayLabel = dayNames[day.getDay()] + ' ' + day.getDate();

      const bars = this.members.map(m => {
        const hours = dayData[m.id] || 0;
        const pct = Math.max(0, (hours / maxHours) * 100);
        if (hours === 0) return '';
        return '<div class="chart-bar" style="height:' + pct + '%;background:' + memberColors[m.id] + '" title="' + App.escapeHtml(m.full_name) + ': ' + hours.toFixed(1) + 'h"></div>';
      }).join('');

      return `
        <div class="chart-bar-group">
          <div class="chart-bars">${bars}</div>
          <div class="chart-day">${dayLabel}</div>
        </div>`;
    }).join('');

    if (legendContainer) {
      legendContainer.innerHTML = this.members.map(m => {
        const color = memberColors[m.id];
        return '<span class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' + App.escapeHtml(m.full_name) + '</span>';
      }).join('');
    }
  },

  // --- LOG TABLE ---

  renderLog() {
    const tbody = document.getElementById('team-log-tbody');
    if (!tbody) return;

    if (this.timeEntries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Нет записей</td></tr>';
      return;
    }

    tbody.innerHTML = this.timeEntries.map(entry => {
      const member = this.members.find(m => m.id === entry.user_id);
      const memberName = member ? App.escapeHtml(member.full_name) : 'Неизвестен';
      const date = App.formatDate(entry.start_time);
      const startTime = new Date(entry.start_time);
      const startStr = String(startTime.getHours()).padStart(2, '0') + ':' + String(startTime.getMinutes()).padStart(2, '0');

      let endStr = '—';
      let sec = 0;
      if (entry.is_running) {
        endStr = '<span class="online-badge">Активен</span>';
        sec = Math.floor((Date.now() - startTime.getTime()) / 1000);
      } else if (entry.end_time) {
        const endTime = new Date(entry.end_time);
        endStr = String(endTime.getHours()).padStart(2, '0') + ':' + String(endTime.getMinutes()).padStart(2, '0');
        sec = entry.duration_seconds || 0;
      }

      const hours = sec / 3600;
      const rate = member ? (member.hourly_rate || 0) : 0;
      const earnings = hours * rate;
      const currency = member ? (member.currency || 'USD') : 'USD';

      return `
        <tr>
          <td>${memberName}</td>
          <td>${date}</td>
          <td>${startStr}</td>
          <td>${endStr}</td>
          <td>${hours.toFixed(2)}h</td>
          <td>${App.formatCurrency(earnings, currency)}</td>
        </tr>`;
    }).join('');
  }
};
