// ===== AUTHENTICATION MODULE =====

const Auth = {
  currentUser: null,
  currentProfile: null,

  async init() {
    // Bind UI events first so buttons work even if Supabase is slow/down
    document.getElementById('login-btn').addEventListener('click', () => this.login());
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.login();
    });
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await this.onLogin(session.user);
      } else {
        this.showLogin();
      }
    } catch (e) {
      console.error('Session check failed:', e);
      this.showLogin();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await this.onLogin(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.showLogin();
      }
    });
  },

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (!email || !password) {
      errorEl.textContent = 'Введите email и пароль';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Входим...';
    errorEl.style.display = 'none';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      errorEl.textContent = 'Неверный email или пароль';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Войти';
      return;
    }

    await this.onLogin(data.user);
  },

  async onLogin(user) {
    this.currentUser = user;

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      App.showToast('Профиль не найден', 'error');
      await this.logout();
      return;
    }

    if (!profile.is_active) {
      App.showToast('Аккаунт деактивирован', 'error');
      await this.logout();
      return;
    }

    this.currentProfile = profile;

    // Update sidebar
    document.getElementById('sidebar-avatar').textContent = profile.initials || 'U';
    document.getElementById('sidebar-username').textContent = profile.full_name || user.email;
    const roleNames = { super_admin: 'Супер-админ', admin: 'Админ', member: 'Сотрудник', viewer: 'Наблюдатель' };
    document.getElementById('sidebar-role').textContent = roleNames[profile.role] || profile.role;

    // Show admin nav if admin
    if (profile.role === 'super_admin' || profile.role === 'admin') {
      document.getElementById('admin-nav').style.display = 'block';
    }

    // Show app
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    // Init app
    if (typeof App !== 'undefined' && App.onAuth) {
      try {
        await App.onAuth(profile);
      } catch (e) {
        console.error('App.onAuth failed:', e);
      }
    }
  },

  showLogin() {
    this.currentUser = null;
    this.currentProfile = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('admin-nav').style.display = 'none';
  },

  async logout() {
    await supabase.auth.signOut();
    this.showLogin();
  },

  isAdmin() {
    return this.currentProfile && (this.currentProfile.role === 'super_admin' || this.currentProfile.role === 'admin');
  },

  isSuperAdmin() {
    return this.currentProfile && this.currentProfile.role === 'super_admin';
  },

  userId() {
    return this.currentUser ? this.currentUser.id : null;
  },

  // ===== ADMIN: User Management =====
  async getUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    return data || [];
  },

  async createUser(userData) {
    // Uses Supabase admin API through our server
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch((window.SERVER_URL || 'http://localhost:3000') + '/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: JSON.stringify(userData),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create user');
    return result;
  },

  async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deactivateUser(userId) {
    return this.updateUser(userId, { is_active: false });
  },

  async activateUser(userId) {
    return this.updateUser(userId, { is_active: true });
  },
};
