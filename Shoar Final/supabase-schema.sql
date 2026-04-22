-- =============================================
-- قيّم — Supabase Schema (نسخة محدّثة)
-- =============================================

-- جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  display_name text NOT NULL DEFAULT 'مستخدم مجهول',
  phone        text
);

-- أضف الأعمدة لو الجدول موجود بدونها
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'مستخدم مجهول';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone        text;

-- جدول المتاجر
CREATE TABLE IF NOT EXISTS stores (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  name         text NOT NULL,
  category     text NOT NULL,
  city         text,
  description  text,
  ig_handle    text,
  website      text,
  status       text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  verified     boolean DEFAULT false,
  submitted_by text,
  admin_note   text,
  trust_score      int,
  trust_data       jsonb,
  trust_updated_at timestamptz
);

-- أضف أعمدة المصداقية لو الجدول موجود مسبقاً
ALTER TABLE stores ADD COLUMN IF NOT EXISTS trust_score      int;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS trust_data       jsonb;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS trust_updated_at timestamptz;

-- جدول التقييمات
CREATE TABLE IF NOT EXISTS reviews (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  store_id    uuid REFERENCES stores(id) ON DELETE CASCADE,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  delivery    int CHECK (delivery BETWEEN 1 AND 5),
  quality     int CHECK (quality BETWEEN 1 AND 5),
  support     int CHECK (support BETWEEN 1 AND 5),
  value       int CHECK (value BETWEEN 1 AND 5),
  body        text NOT NULL,
  author_name text DEFAULT 'مستخدم مجهول',
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text DEFAULT 'approved' CHECK (status IN ('approved','hidden'))
);

-- View للمتاجر مع إحصائيات التقييمات
CREATE OR REPLACE VIEW stores_with_stats AS
SELECT
  s.*,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
  COUNT(r.id) AS review_count,
  COALESCE(COUNT(CASE WHEN r.rating = 5 THEN 1 END) * 100 / NULLIF(COUNT(r.id),0), 0) AS pct_5,
  COALESCE(COUNT(CASE WHEN r.rating = 4 THEN 1 END) * 100 / NULLIF(COUNT(r.id),0), 0) AS pct_4,
  COALESCE(COUNT(CASE WHEN r.rating = 3 THEN 1 END) * 100 / NULLIF(COUNT(r.id),0), 0) AS pct_3,
  COALESCE(COUNT(CASE WHEN r.rating = 2 THEN 1 END) * 100 / NULLIF(COUNT(r.id),0), 0) AS pct_2,
  COALESCE(COUNT(CASE WHEN r.rating = 1 THEN 1 END) * 100 / NULLIF(COUNT(r.id),0), 0) AS pct_1
FROM stores s
LEFT JOIN reviews r ON r.store_id = s.id AND r.status = 'approved'
GROUP BY s.id;

-- =============================================
-- RLS: الصلاحيات
-- =============================================
ALTER TABLE stores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- حذف القديم أولاً لتجنب التكرار
DROP POLICY IF EXISTS "public read approved stores"   ON stores;
DROP POLICY IF EXISTS "public insert store requests"  ON stores;
DROP POLICY IF EXISTS "public read approved reviews"  ON reviews;
DROP POLICY IF EXISTS "public insert reviews"         ON reviews;
DROP POLICY IF EXISTS "public read display_name"      ON profiles;
DROP POLICY IF EXISTS "owner insert profile"          ON profiles;
DROP POLICY IF EXISTS "owner update profile"          ON profiles;

-- إنشاء الصلاحيات
CREATE POLICY "public read approved stores"  ON stores  FOR SELECT USING (status = 'approved');
CREATE POLICY "public insert store requests" ON stores  FOR INSERT WITH CHECK (true);
CREATE POLICY "public read approved reviews" ON reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "public insert reviews"        ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "public read display_name"     ON profiles FOR SELECT USING (true);
CREATE POLICY "owner insert profile"         ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "owner update profile"         ON profiles FOR UPDATE USING (auth.uid() = id);
