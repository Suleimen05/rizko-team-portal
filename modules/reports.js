const ReportsModule = {
  reports: [],

  async init() {
    this.bindEvents();
  },

  bindEvents() {
    const addBtn = document.getElementById('reports-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showReportModal(null));
    }

    const listContainer = document.getElementById('reports-list');
    if (listContainer) {
      listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.video-report-item[data-id]');
        if (item) {
          this.showReportModal(item.dataset.id);
        }
      });
    }
  },

  async onPageEnter() {
    try { await this.loadReports(); } catch(e) { console.error('Reports load:', e); }
    this.renderSummary();
    this.renderReports();
  },

  async loadReports() {
    const { data, error } = await supabase
      .from('video_reports')
      .select('*')
      .order('published_date', { ascending: false });

    if (error) {
      console.error('Error loading reports:', error);
      App.showToast('Error loading reports', 'error');
      return;
    }

    this.reports = data || [];
  },

  renderSummary() {
    const container = document.getElementById('reports-summary');
    if (!container) return;

    const totalVideos = this.reports.length;
    const totalViews = this.reports.reduce((s, r) => s + (r.views || 0), 0);
    const totalLikes = this.reports.reduce((s, r) => s + (r.likes || 0), 0);
    const totalComments = this.reports.reduce((s, r) => s + (r.comments_count || 0), 0);
    const avgEngagement = totalViews > 0
      ? ((totalLikes / totalViews) * 100).toFixed(1)
      : '0.0';

    container.innerHTML = `
      <div class="reports-summary">
        <div class="report-stat">
          <div class="report-stat-value">${totalVideos}</div>
          <div class="report-stat-label">Videos Published</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">${this._formatNumber(totalViews)}</div>
          <div class="report-stat-label">Total Views</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">${avgEngagement}%</div>
          <div class="report-stat-label">Avg Engagement</div>
          <div class="report-stat-change">${this._formatNumber(totalLikes)} likes</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-value">${this._formatNumber(totalComments)}</div>
          <div class="report-stat-label">Total Comments</div>
        </div>
      </div>
    `;
  },

  renderReports() {
    const container = document.getElementById('reports-list');
    if (!container) return;

    if (this.reports.length === 0) {
      container.innerHTML = '<div class="empty-state">No reports</div>';
      return;
    }

    container.innerHTML = '<div class="video-reports-list">' + this.reports.map(r => {
      const dateStr = r.published_date ? App.formatDate(r.published_date) : '-';

      return `
        <div class="video-report-item" data-id="${r.id}">
          <div class="video-thumb">
            ${r.thumbnail_url
              ? '<img src="' + App.escapeHtml(r.thumbnail_url) + '" alt="">'
              : '<span>&#9654;</span>'
            }
          </div>
          <div class="video-report-info">
            <div class="video-report-title">${App.escapeHtml(r.title || '')}</div>
            <span class="video-platform">${App.escapeHtml(r.platform || '')}</span>
            <div class="video-report-date">${dateStr}</div>
          </div>
          <div class="video-report-stats">
            <span title="Views"><i class="fas fa-eye"></i> ${this._formatNumber(r.views || 0)}</span>
            <span title="Likes"><i class="fas fa-heart"></i> ${this._formatNumber(r.likes || 0)}</span>
            <span title="Comments"><i class="fas fa-comment"></i> ${this._formatNumber(r.comments_count || 0)}</span>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  },

  showReportModal(reportId) {
    const report = reportId ? this.reports.find(r => r.id === reportId) : null;
    const isEdit = !!report;
    const title = isEdit ? 'Edit Report' : 'New Report';

    const platformOptions = [
      { value: 'TikTok', label: 'TikTok' },
      { value: 'YouTube Shorts', label: 'YouTube Shorts' },
      { value: 'Instagram Reels', label: 'Instagram Reels' }
    ];

    const today = new Date().toISOString().split('T')[0];

    const body = `
      <form id="report-form">
        ${App.formGroup('Title', '<input type="text" id="rp-title" class="form-control" value="' + App.escapeHtml(report?.title || '') + '" required>')}
        ${App.formGroup('Platform', '<select id="rp-platform" class="form-control">' + App.selectOptions(platformOptions, report?.platform || '') + '</select>')}
        ${App.formRow(
          App.formGroup('Views', '<input type="number" id="rp-views" class="form-control" min="0" value="' + (report?.views || 0) + '">'),
          App.formGroup('Likes', '<input type="number" id="rp-likes" class="form-control" min="0" value="' + (report?.likes || 0) + '">')
        )}
        ${App.formRow(
          App.formGroup('Comments', '<input type="number" id="rp-comments" class="form-control" min="0" value="' + (report?.comments_count || 0) + '">'),
          App.formGroup('Published Date', '<input type="date" id="rp-date" class="form-control" value="' + (report?.published_date || today) + '" required>')
        )}
        ${App.formGroup('Thumbnail URL', '<input type="url" id="rp-thumb" class="form-control" placeholder="https://..." value="' + App.escapeHtml(report?.thumbnail_url || '') + '">')}
        ${App.formGroup('Video URL', '<input type="url" id="rp-url" class="form-control" placeholder="https://..." value="' + App.escapeHtml(report?.video_url || '') + '">')}
      </form>
    `;

    let footerHtml = '';
    if (isEdit) {
      footerHtml = `
        <button type="button" class="btn btn-danger" id="report-delete-btn">Delete</button>
        <button type="button" class="btn btn-secondary" id="report-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="report-save-btn">Save</button>
      `;
    } else {
      footerHtml = `
        <button type="button" class="btn btn-secondary" id="report-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="report-save-btn">Save</button>
      `;
    }

    App.openModal(title, body, footerHtml);

    const saveBtn = document.getElementById('report-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveReport(report?.id || null));
    }

    const cancelBtn = document.getElementById('report-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => App.closeModal());
    }

    if (isEdit) {
      const deleteBtn = document.getElementById('report-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteReport(report.id));
      }
    }
  },

  async saveReport(id) {
    const title = document.getElementById('rp-title')?.value?.trim();
    const platform = document.getElementById('rp-platform')?.value;
    const views = parseInt(document.getElementById('rp-views')?.value) || 0;
    const likes = parseInt(document.getElementById('rp-likes')?.value) || 0;
    const comments_count = parseInt(document.getElementById('rp-comments')?.value) || 0;
    const published_date = document.getElementById('rp-date')?.value;
    const thumbnail_url = document.getElementById('rp-thumb')?.value?.trim() || null;
    const video_url = document.getElementById('rp-url')?.value?.trim() || null;

    if (!title || !published_date) {
      App.showToast('Please fill in all required fields', 'error');
      return;
    }

    const payload = {
      title,
      platform,
      views,
      likes,
      comments_count,
      published_date,
      thumbnail_url,
      video_url
    };

    let error;

    if (id) {
      ({ error } = await supabase
        .from('video_reports')
        .update(payload)
        .eq('id', id));
    } else {
      payload.created_by = Auth.userId();
      ({ error } = await supabase
        .from('video_reports')
        .insert(payload));
    }

    if (error) {
      console.error('Error saving report:', error);
      App.showToast('Error saving report', 'error');
      return;
    }

    App.closeModal();
    App.showToast(id ? 'Report updated' : 'Report created', 'success');
    await this.loadReports();
    this.renderSummary();
    this.renderReports();
  },

  async deleteReport(id) {
    const confirmed = await App.confirm('Delete Report', 'Are you sure you want to delete this report?');
    if (!confirmed) return;

    const { error } = await supabase
      .from('video_reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting report:', error);
      App.showToast('Error deleting report', 'error');
      return;
    }

    App.closeModal();
    App.showToast('Report deleted', 'success');
    await this.loadReports();
    this.renderSummary();
    this.renderReports();
  },

  _formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }
};
