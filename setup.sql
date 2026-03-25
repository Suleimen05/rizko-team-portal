-- ============================================
-- RIZKO TEAM PORTAL - DATABASE SETUP
-- Run this SQL in Supabase Dashboard > SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  initials TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('super_admin', 'admin', 'member', 'viewer')),
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  telegram_chat_id TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CONTACTS (CRM) =====
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  type TEXT CHECK (type IN ('blogger', 'investor', 'partner', 'client')),
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT,
  source TEXT,
  social_platform TEXT,
  social_username TEXT,
  social_followers TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'negotiation', 'closed', 'archived')),
  deal_amount DECIMAL(12,2) DEFAULT 0,
  deal_currency TEXT DEFAULT 'USD',
  responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_contact_date TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== TASKS =====
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'in_progress', 'review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  category TEXT,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  position INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_subtasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== STRATEGIES =====
CREATE TABLE IF NOT EXISTS strategies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  period TEXT,
  metrics JSONB DEFAULT '[]',
  team_members UUID[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== VIDEO REPORTS =====
CREATE TABLE IF NOT EXISTS video_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  published_date TIMESTAMPTZ,
  thumbnail_url TEXT,
  video_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== AI CHAT =====
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT DEFAULT 'Новый чат',
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== TIME TRACKING =====
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  is_running BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CONTENT CALENDAR =====
CREATE TABLE IF NOT EXISTS calendar_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT,
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'filming', 'editing', 'published')),
  scheduled_date DATE,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== SCRIPTS =====
CREATE TABLE IF NOT EXISTS scripts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  platform TEXT,
  tags TEXT[] DEFAULT '{}',
  times_used INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== WIKI =====
CREATE TABLE IF NOT EXISTS wiki_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wiki_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES wiki_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== FILES =====
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_path TEXT DEFAULT '',
  color TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== FINANCE =====
CREATE TABLE IF NOT EXISTS finance_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES finance_categories(id) ON DELETE SET NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_budget (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  amount DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  period TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PLATFORMS =====
CREATE TABLE IF NOT EXISTS platforms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon_text TEXT DEFAULT '',
  icon_bg TEXT DEFAULT '#6366f1',
  status TEXT DEFAULT 'inactive' CHECK (status IN ('connected', 'inactive')),
  details JSONB DEFAULT '{}',
  link TEXT,
  monthly_cost DECIMAL(10,2) DEFAULT 0,
  cost_label TEXT,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'info',
  icon TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  link_page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, initials, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'initials', UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 2))),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','contacts','tasks','strategies','chat_conversations','calendar_posts','scripts','wiki_articles','platforms','finance_transactions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END;
$$;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_icon TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link_page TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, icon, title, message, link_page)
  VALUES (p_user_id, p_type, p_icon, p_title, p_message, p_link_page)
  RETURNING id INTO notif_id;
  RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify on task assignment
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id) THEN
    PERFORM create_notification(
      NEW.assignee_id,
      'task',
      'task',
      'Новая задача',
      'Вам назначена задача: ' || NEW.title,
      'tasks'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_assigned ON tasks;
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- Notify on task deadline (called by cron or manual check)
CREATE OR REPLACE FUNCTION check_task_deadlines()
RETURNS void AS $$
DECLARE
  task_rec RECORD;
BEGIN
  FOR task_rec IN
    SELECT t.id, t.title, t.assignee_id
    FROM tasks t
    WHERE t.due_date IS NOT NULL
      AND t.due_date::date = CURRENT_DATE
      AND t.status != 'done'
      AND t.assignee_id IS NOT NULL
  LOOP
    PERFORM create_notification(
      task_rec.assignee_id,
      'deadline',
      'warning',
      'Дедлайн сегодня!',
      'Задача "' || task_rec.title || '" — дедлайн сегодня',
      'tasks'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PROFILES: everyone reads, only self or admin updates
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);

-- SHARED DATA: all authenticated users can read, members+ can write
-- Contacts
CREATE POLICY "contacts_select" ON contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contacts_update" ON contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "contacts_delete" ON contacts FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- Tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- Task comments
CREATE POLICY "task_comments_select" ON task_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE USING (author_id = auth.uid() OR is_admin());

-- Task subtasks
CREATE POLICY "task_subtasks_select" ON task_subtasks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "task_subtasks_insert" ON task_subtasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "task_subtasks_update" ON task_subtasks FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "task_subtasks_delete" ON task_subtasks FOR DELETE USING (auth.uid() IS NOT NULL);

-- Task attachments
CREATE POLICY "task_attachments_select" ON task_attachments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "task_attachments_insert" ON task_attachments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "task_attachments_delete" ON task_attachments FOR DELETE USING (uploaded_by = auth.uid() OR is_admin());

-- Strategies
CREATE POLICY "strategies_select" ON strategies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "strategies_insert" ON strategies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "strategies_update" ON strategies FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "strategies_delete" ON strategies FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- Video reports
CREATE POLICY "video_reports_select" ON video_reports FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "video_reports_insert" ON video_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "video_reports_update" ON video_reports FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "video_reports_delete" ON video_reports FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- Chat: users see only their own conversations
CREATE POLICY "chat_conv_select" ON chat_conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "chat_conv_insert" ON chat_conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_conv_update" ON chat_conversations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "chat_conv_delete" ON chat_conversations FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "chat_msg_select" ON chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));
CREATE POLICY "chat_msg_insert" ON chat_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid()));

-- Time entries: users see own, admins see all
CREATE POLICY "time_entries_select" ON time_entries FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "time_entries_insert" ON time_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_entries_update" ON time_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "time_entries_delete" ON time_entries FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- Calendar, Scripts, Wiki, Files, Finance, Platforms: all authenticated
CREATE POLICY "calendar_select" ON calendar_posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "calendar_insert" ON calendar_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "calendar_update" ON calendar_posts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "calendar_delete" ON calendar_posts FOR DELETE USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "scripts_select" ON scripts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "scripts_insert" ON scripts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "scripts_update" ON scripts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "scripts_delete" ON scripts FOR DELETE USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "wiki_cat_select" ON wiki_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_cat_insert" ON wiki_categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_cat_update" ON wiki_categories FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_cat_delete" ON wiki_categories FOR DELETE USING (is_admin());

CREATE POLICY "wiki_art_select" ON wiki_articles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_art_insert" ON wiki_articles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_art_update" ON wiki_articles FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "wiki_art_delete" ON wiki_articles FOR DELETE USING (is_admin() OR author_id = auth.uid());

CREATE POLICY "folders_select" ON folders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "folders_insert" ON folders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "folders_update" ON folders FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "folders_delete" ON folders FOR DELETE USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "files_select" ON files FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "files_insert" ON files FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "files_update" ON files FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "files_delete" ON files FOR DELETE USING (is_admin() OR uploaded_by = auth.uid());

CREATE POLICY "fin_cat_select" ON finance_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_cat_insert" ON finance_categories FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "fin_cat_update" ON finance_categories FOR UPDATE USING (is_admin());
CREATE POLICY "fin_cat_delete" ON finance_categories FOR DELETE USING (is_admin());

CREATE POLICY "fin_trans_select" ON finance_transactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fin_trans_insert" ON finance_transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "fin_trans_update" ON finance_transactions FOR UPDATE USING (is_admin() OR created_by = auth.uid());
CREATE POLICY "fin_trans_delete" ON finance_transactions FOR DELETE USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "mktg_budget_select" ON marketing_budget FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mktg_budget_insert" ON marketing_budget FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "mktg_budget_update" ON marketing_budget FOR UPDATE USING (is_admin());

CREATE POLICY "platforms_select" ON platforms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "platforms_insert" ON platforms FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "platforms_update" ON platforms FOR UPDATE USING (is_admin());
CREATE POLICY "platforms_delete" ON platforms FOR DELETE USING (is_admin());

-- Notifications: users see only their own
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_delete" ON notifications FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "files_storage_select" ON storage.objects FOR SELECT USING (bucket_id IN ('files', 'avatars', 'task-attachments'));
CREATE POLICY "files_storage_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('files', 'avatars', 'task-attachments') AND auth.uid() IS NOT NULL);
CREATE POLICY "files_storage_update" ON storage.objects FOR UPDATE USING (bucket_id IN ('files', 'avatars', 'task-attachments') AND auth.uid() IS NOT NULL);
CREATE POLICY "files_storage_delete" ON storage.objects FOR DELETE USING (bucket_id IN ('files', 'avatars', 'task-attachments') AND auth.uid() IS NOT NULL);
