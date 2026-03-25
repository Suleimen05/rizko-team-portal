const FilesModule = {
  files: [],
  folders: [],
  currentFolderId: null,
  breadcrumbPath: [],

  async init() {
    this.bindEvents();
  },

  async onPageEnter() {
    this.currentFolderId = null;
    this.breadcrumbPath = [];
    try { await this.loadFiles(); } catch(e) { console.error('Files load:', e); }
  },

  bindEvents() {
    const uploadBtn = document.getElementById('files-upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        const input = document.getElementById('files-input');
        if (input) input.click();
      });
    }

    const fileInput = document.getElementById('files-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.uploadFiles(e.target.files);
        }
      });
    }

    const newFolderBtn = document.getElementById('files-new-folder-btn');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', () => {
        this.showNewFolderModal();
      });
    }

    const grid = document.getElementById('files-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const openBtn = e.target.closest('[data-action="open-folder"]');
        if (openBtn) {
          e.stopPropagation();
          this.navigateToFolder(openBtn.dataset.folderId);
          return;
        }

        const deleteBtn = e.target.closest('[data-action="delete-folder"]');
        if (deleteBtn) {
          e.stopPropagation();
          this.deleteFolder(deleteBtn.dataset.folderId);
          return;
        }

        const openFileBtn = e.target.closest('[data-action="open-file"]');
        if (openFileBtn) {
          e.stopPropagation();
          this.openFile(openFileBtn.dataset.url);
          return;
        }

        const deleteFileBtn = e.target.closest('[data-action="delete-file"]');
        if (deleteFileBtn) {
          e.stopPropagation();
          this.deleteFile(deleteFileBtn.dataset.fileId);
          return;
        }

        const folderCard = e.target.closest('[data-action="folder-dblclick"]');
        if (folderCard && e.detail === 2) {
          this.navigateToFolder(folderCard.dataset.folderId);
        }
      });
    }

    const breadcrumb = document.getElementById('files-breadcrumb');
    if (breadcrumb) {
      breadcrumb.addEventListener('click', (e) => {
        const item = e.target.closest('[data-breadcrumb]');
        if (!item) return;
        const folderId = item.dataset.folderId || null;
        const idx = item.dataset.breadcrumbIndex;
        if (folderId === 'root') {
          this.navigateToFolder(null);
        } else {
          this.navigateToFolder(folderId, parseInt(idx, 10));
        }
      });
    }
  },

  async loadFiles() {
    try {
      let foldersQuery = supabase.from('folders').select('*');
      if (this.currentFolderId) {
        foldersQuery = foldersQuery.eq('parent_path', this.currentFolderId);
      } else {
        foldersQuery = foldersQuery.or('parent_path.is.null,parent_path.eq.');
      }
      const { data: folders, error: fErr } = await foldersQuery.order('name');
      if (fErr) throw fErr;
      this.folders = folders || [];

      let filesQuery = supabase.from('files').select('*');
      if (this.currentFolderId) {
        filesQuery = filesQuery.eq('folder_id', this.currentFolderId);
      } else {
        filesQuery = filesQuery.is('folder_id', null);
      }
      const { data: files, error: fiErr } = await filesQuery.order('created_at', { ascending: false });
      if (fiErr) throw fiErr;
      this.files = files || [];

      for (const folder of this.folders) {
        const { count } = await supabase
          .from('files')
          .select('*', { count: 'exact', head: true })
          .eq('folder_id', folder.id);
        folder._fileCount = count || 0;
      }

      this.renderFiles();
    } catch (err) {
      console.error('FilesModule.loadFiles error:', err);
      App.showToast('Ошибка загрузки файлов', 'error');
    }
  },

  renderBreadcrumb() {
    const el = document.getElementById('files-breadcrumb');
    if (!el) return;

    let html = '<span class="breadcrumb-item" data-breadcrumb data-folder-id="root">Файлы</span>';
    for (let i = 0; i < this.breadcrumbPath.length; i++) {
      const crumb = this.breadcrumbPath[i];
      const isLast = i === this.breadcrumbPath.length - 1;
      html += ' <span class="breadcrumb-sep">/</span> ';
      if (isLast) {
        html += '<span class="breadcrumb-item active">' + App.escapeHtml(crumb.name) + '</span>';
      } else {
        html += '<span class="breadcrumb-item" data-breadcrumb data-folder-id="' + crumb.id + '" data-breadcrumb-index="' + i + '">' + App.escapeHtml(crumb.name) + '</span>';
      }
    }
    el.innerHTML = html;
  },

  renderFiles() {
    this.renderBreadcrumb();

    const grid = document.getElementById('files-grid');
    if (!grid) return;

    if (this.folders.length === 0 && this.files.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Папка пуста</p><p>Создайте папку или загрузите файлы</p></div>';
      return;
    }

    let html = '';

    for (const folder of this.folders) {
      html += '<div class="file-folder" data-action="folder-dblclick" data-folder-id="' + folder.id + '">'
        + '<div class="folder-icon">'
        + '<svg width="40" height="40" fill="' + App.escapeHtml(folder.color || 'var(--primary)') + '" viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>'
        + '</div>'
        + '<div class="file-name" title="' + App.escapeHtml(folder.name) + '">' + App.escapeHtml(folder.name) + '</div>'
        + '<div class="file-meta">' + folder._fileCount + ' файл(ов)</div>'
        + '<div class="file-meta">'
        + '<button class="btn btn-sm btn-secondary" data-action="open-folder" data-folder-id="' + folder.id + '">Открыть</button>'
        + (Auth.isAdmin() ? ' <button class="btn btn-sm btn-danger" data-action="delete-folder" data-folder-id="' + folder.id + '">Удалить</button>' : '')
        + '</div>'
        + '</div>';
    }

    for (const file of this.files) {
      const iconClass = this.getFileIconClass(file.file_type);
      const size = this.formatFileSize(file.file_size);
      const date = App.formatDate(file.created_at);
      html += '<div class="file-item">'
        + '<div class="file-icon ' + iconClass + '">'
        + '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        + '</div>'
        + '<div class="file-name" title="' + App.escapeHtml(file.name) + '">' + App.escapeHtml(file.name) + '</div>'
        + '<div class="file-meta">' + size + ' &middot; ' + date + '</div>'
        + '<div class="file-meta">'
        + '<button class="btn btn-sm btn-secondary" data-action="open-file" data-url="' + App.escapeHtml(file.file_url) + '">Открыть</button>'
        + (Auth.isAdmin() || file.uploaded_by === Auth.userId() ? ' <button class="btn btn-sm btn-danger" data-action="delete-file" data-file-id="' + file.id + '">Удалить</button>' : '')
        + '</div>'
        + '</div>';
    }

    grid.innerHTML = html;
  },

  getFileIconClass(type) {
    const map = {
      image: 'img',
      video: 'vid',
      pdf: 'doc',
      document: 'doc',
      spreadsheet: 'doc',
      presentation: 'doc',
      archive: '',
      other: ''
    };
    return map[type] || '';
  },

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return size + ' ' + units[i];
  },

  openFile(url) {
    window.open(url, '_blank');
  },

  async uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const userId = Auth.userId();
    let uploaded = 0;
    const total = fileList.length;

    App.showToast('Загрузка ' + total + ' файл(ов)...', 'info');

    for (const file of fileList) {
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = userId + '/' + timestamp + '_' + safeName;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('files')
          .getPublicUrl(storagePath);

        const fileUrl = urlData.publicUrl;

        const ext = file.name.split('.').pop().toLowerCase();
        let fileType = 'other';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) fileType = 'image';
        else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) fileType = 'video';
        else if (['pdf'].includes(ext)) fileType = 'pdf';
        else if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) fileType = 'document';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'spreadsheet';
        else if (['ppt', 'pptx'].includes(ext)) fileType = 'presentation';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) fileType = 'archive';

        const { error: dbErr } = await supabase.from('files').insert({
          name: file.name,
          file_url: fileUrl,
          file_size: file.size,
          file_type: fileType,
          folder_id: this.currentFolderId || null,
          uploaded_by: userId
        });

        if (dbErr) throw dbErr;

        uploaded++;
        App.showToast('Загружено ' + uploaded + ' из ' + total, 'info');
      } catch (err) {
        console.error('Upload error for', file.name, err);
        App.showToast('Ошибка загрузки: ' + file.name, 'error');
      }
    }

    if (uploaded > 0) {
      App.showToast('Успешно загружено: ' + uploaded + ' файл(ов)', 'success');
      await this.loadFiles();
    }

    const input = document.getElementById('files-input');
    if (input) input.value = '';
  },

  showNewFolderModal() {
    const body = App.formGroup('Название', '<input type="text" id="folder-name-input" placeholder="Название папки" />')
      + App.formGroup('Цвет', '<input type="color" id="folder-color-input" value="#6366f1" />');

    const footer = '<button class="btn btn-secondary" id="folder-cancel-btn">Отмена</button>'
      + '<button class="btn btn-primary" id="folder-create-btn">Создать</button>';

    App.openModal('Новая папка', body, footer);

    document.getElementById('folder-cancel-btn').addEventListener('click', () => {
      App.closeModal();
    });

    document.getElementById('folder-create-btn').addEventListener('click', () => {
      const name = document.getElementById('folder-name-input').value;
      const color = document.getElementById('folder-color-input').value;
      this.createFolder(name, color);
    });
  },

  async createFolder(name, color) {
    if (!name || !name.trim()) {
      App.showToast('Введите название папки', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('folders').insert({
        name: name.trim(),
        parent_path: this.currentFolderId || null,
        color: color || '#6366f1',
        created_by: Auth.userId()
      });

      if (error) throw error;

      App.closeModal();
      App.showToast('Папка создана', 'success');
      await this.loadFiles();
    } catch (err) {
      console.error('createFolder error:', err);
      App.showToast('Ошибка создания папки', 'error');
    }
  },

  async deleteFile(id) {
    const confirmed = await App.confirm('Удалить файл', 'Удалить этот файл?');
    if (!confirmed) return;

    try {
      const { data: file, error: fetchErr } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;

      const baseUrl = CONFIG.supabase.url + '/storage/v1/object/public/files/';
      let storagePath = '';
      if (file.file_url && file.file_url.startsWith(baseUrl)) {
        storagePath = decodeURIComponent(file.file_url.replace(baseUrl, ''));
      }

      if (storagePath) {
        const { error: storageErr } = await supabase.storage
          .from('files')
          .remove([storagePath]);
        if (storageErr) console.error('Storage delete error:', storageErr);
      }

      const { error: dbErr } = await supabase.from('files').delete().eq('id', id);
      if (dbErr) throw dbErr;

      App.showToast('Файл удален', 'success');
      await this.loadFiles();
    } catch (err) {
      console.error('deleteFile error:', err);
      App.showToast('Ошибка удаления файла', 'error');
    }
  },

  async deleteFolder(id) {
    try {
      const { count: fileCount } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('folder_id', id);

      const { count: subfolderCount } = await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true })
        .eq('parent_path', id);

      const totalItems = (fileCount || 0) + (subfolderCount || 0);

      if (totalItems > 0) {
        const confirmed = await App.confirm('Удалить папку', 'Папка содержит ' + totalItems + ' элемент(ов). Удалить папку и все содержимое?');
        if (!confirmed) return;

        const { data: folderFiles } = await supabase
          .from('files')
          .select('*')
          .eq('folder_id', id);

        if (folderFiles && folderFiles.length > 0) {
          const baseUrl = CONFIG.supabase.url + '/storage/v1/object/public/files/';
          const storagePaths = folderFiles
            .filter(f => f.file_url && f.file_url.startsWith(baseUrl))
            .map(f => decodeURIComponent(f.file_url.replace(baseUrl, '')));

          if (storagePaths.length > 0) {
            await supabase.storage.from('files').remove(storagePaths);
          }

          await supabase.from('files').delete().eq('folder_id', id);
        }

        if (subfolderCount > 0) {
          const { data: subfolders } = await supabase
            .from('folders')
            .select('id')
            .eq('parent_path', id);

          if (subfolders) {
            for (const sub of subfolders) {
              await this.deleteFolder(sub.id);
            }
          }
        }
      } else {
        const confirmed = await App.confirm('Удалить папку', 'Удалить пустую папку?');
        if (!confirmed) return;
      }

      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;

      App.showToast('Папка удалена', 'success');
      await this.loadFiles();
    } catch (err) {
      console.error('deleteFolder error:', err);
      App.showToast('Ошибка удаления папки', 'error');
    }
  },

  async navigateToFolder(folderId, breadcrumbIndex) {
    if (folderId === null) {
      this.currentFolderId = null;
      this.breadcrumbPath = [];
    } else if (typeof breadcrumbIndex === 'number') {
      this.currentFolderId = folderId;
      this.breadcrumbPath = this.breadcrumbPath.slice(0, breadcrumbIndex + 1);
    } else {
      const folder = this.folders.find(f => f.id === folderId);
      let folderName = 'Папка';
      if (folder) {
        folderName = folder.name;
      } else {
        const { data } = await supabase.from('folders').select('name').eq('id', folderId).single();
        if (data) folderName = data.name;
      }
      this.currentFolderId = folderId;
      this.breadcrumbPath.push({ id: folderId, name: folderName });
    }

    await this.loadFiles();
  }
};
