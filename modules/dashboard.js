const DashboardModule = {
  async init() {},

  async onPageEnter() {
    await Promise.allSettled([this.loadStats(), this.loadRecentTasks(), this.loadActivity()]);
  },

  async loadStats() {
    try {
      const [contacts, tasks, reports, messages] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
        supabase.from('video_reports').select('id', { count: 'exact', head: true }),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
      ]);
      const el = document.getElementById('dashboard-stats');
      if (!el) return;
      el.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="stat-info"><span class="stat-value">${contacts.count||0}</span><span class="stat-label">Контакты</span></div></div>
        <div class="stat-card"><div class="stat-icon green"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><div class="stat-info"><span class="stat-value">${tasks.count||0}</span><span class="stat-label">Активных задач</span></div></div>
        <div class="stat-card"><div class="stat-icon purple"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></div><div class="stat-info"><span class="stat-value">${reports.count||0}</span><span class="stat-label">Видео отчётов</span></div></div>
        <div class="stat-card"><div class="stat-icon orange"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="stat-info"><span class="stat-value">${messages.count||0}</span><span class="stat-label">AI сообщений</span></div></div>`;
    } catch(e) { console.error('Dashboard stats:', e); }
  },

  async loadRecentTasks() {
    try {
      const { data } = await supabase.from('tasks').select('*').order('created_at',{ascending:false}).limit(5);
      const el = document.getElementById('dashboard-tasks');
      if (!el) return;
      if (!data?.length) { el.innerHTML = '<p class="text-muted">Нет задач</p>'; return; }
      const dots = { backlog:'blue', in_progress:'green', review:'yellow', done:'green' };
      el.innerHTML = data.map(t => `<div class="task-mini"><span class="task-dot ${dots[t.status]||'blue'}"></span><span>${App.escapeHtml(t.title)}</span>${t.category?`<span class="task-tag">${App.escapeHtml(t.category)}</span>`:''}</div>`).join('');
    } catch(e) { console.error(e); }
  },

  async loadActivity() {
    try {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', Auth.userId()).order('created_at',{ascending:false}).limit(5);
      const el = document.getElementById('dashboard-activity');
      if (!el) return;
      if (!data?.length) { el.innerHTML = '<p class="text-muted">Нет активности</p>'; return; }
      el.innerHTML = data.map(n => `<div class="activity-item"><div class="activity-avatar">${Auth.currentProfile?.initials||'U'}</div><div class="activity-text"><strong>${App.escapeHtml(n.title)}</strong> ${App.escapeHtml(n.message||'')}<span class="activity-time">${App.timeAgo(n.created_at)}</span></div></div>`).join('');
    } catch(e) { console.error(e); }
  },
};
