-- ========================================================================
-- SKEMA DATABASE E-RAPORT SMP AL IRSYAD SURAKARTA UNTUK SUPABASE (POSTGRESQL)
-- ========================================================================
-- Petunjuk Penggunaan:
-- 1. Buka dashboard Supabase Anda di https://supabase.com
-- 2. Pilih project Anda > Menu "SQL Editor" di bilah sisi kiri
-- 3. Klik "New Query", salin seluruh isi skrip SQL ini, lalu klik "RUN"
-- 4. Semua tabel, relasi, security policies (RLS), dan Realtime akan aktif!
-- ========================================================================

-- 1. TABEL CONFIG (Pengaturan Sistem & Admin)
CREATE TABLE IF NOT EXISTS public.config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    admin_username TEXT NOT NULL DEFAULT 'admin',
    admin_password_key TEXT NOT NULL DEFAULT 'alirsyadsolo',
    active_period_id TEXT DEFAULT 'p1',
    is_seed_initialized BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABEL KELAS
CREATE TABLE IF NOT EXISTS public.kelas (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    wali_kelas_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABEL MAPEL (Mata Pelajaran)
CREATE TABLE IF NOT EXISTS public.mapel (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    urutan INTEGER DEFAULT 0,
    kategori TEXT DEFAULT 'umum',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABEL SISWA
CREATE TABLE IF NOT EXISTS public.siswa (
    id TEXT PRIMARY KEY,
    nisn TEXT,
    nis TEXT,
    nama TEXT NOT NULL,
    jenis_kelamin TEXT DEFAULT 'L',
    kelas_id TEXT,
    no_absen INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABEL GURU
CREATE TABLE IF NOT EXISTS public.guru (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_key TEXT NOT NULL,
    is_wali_kelas BOOLEAN DEFAULT false,
    wali_kelas_kelas_id TEXT DEFAULT '',
    mapel1_id TEXT DEFAULT '',
    mapel1_kelas_id TEXT DEFAULT '',
    mapel1_kelas_ids JSONB DEFAULT '[]'::jsonb,
    mapel2_id TEXT DEFAULT '',
    mapel2_kelas_id TEXT DEFAULT '',
    mapel2_kelas_ids JSONB DEFAULT '[]'::jsonb,
    mapel3_id TEXT DEFAULT '',
    mapel3_kelas_id TEXT DEFAULT '',
    mapel3_kelas_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABEL PERIOD_LIST (Tahun Ajaran & Semester Rilis)
CREATE TABLE IF NOT EXISTS public.period_list (
    id TEXT PRIMARY KEY,
    tahun_ajaran TEXT NOT NULL,
    semester TEXT NOT NULL,
    tipe_ujian TEXT NOT NULL,
    is_published BOOLEAN DEFAULT false,
    published_at TEXT,
    tanggal_raport TEXT,
    snapshot_kelas JSONB DEFAULT '[]'::jsonb,
    snapshot_siswa JSONB DEFAULT '[]'::jsonb,
    snapshot_guru JSONB DEFAULT '[]'::jsonb,
    snapshot_mapel JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABEL TUJUAN_PEMBELAJARAN (TP Guru)
CREATE TABLE IF NOT EXISTS public.tujuan_pembelajaran (
    id TEXT PRIMARY KEY,
    periode_id TEXT NOT NULL,
    guru_id TEXT NOT NULL,
    mapel_id TEXT NOT NULL,
    kelas_id TEXT NOT NULL,
    tp1 TEXT NOT NULL,
    tp2 TEXT NOT NULL,
    tp3 TEXT,
    tp4 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABEL NILAI_SISWA
CREATE TABLE IF NOT EXISTS public.nilai_siswa (
    id TEXT PRIMARY KEY,
    periode_id TEXT NOT NULL,
    siswa_id TEXT NOT NULL,
    mapel_id TEXT NOT NULL,
    guru_id TEXT NOT NULL,
    tp1_nilai_asli NUMERIC,
    tp1_nilai NUMERIC,
    tp2_nilai_asli NUMERIC,
    tp2_nilai NUMERIC,
    tp3_nilai_asli NUMERIC,
    tp3_nilai NUMERIC,
    tp4_nilai_asli NUMERIC,
    tp4_nilai NUMERIC,
    nilai_ujian_asli NUMERIC,
    nilai_ujian NUMERIC,
    nilai_akhir NUMERIC NOT NULL DEFAULT 0,
    capaian_kompetensi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABEL ABSENSI_DAN_CATATAN (Wali Kelas)
CREATE TABLE IF NOT EXISTS public.absensi_dan_catatan (
    id TEXT PRIMARY KEY,
    periode_id TEXT NOT NULL,
    siswa_id TEXT NOT NULL,
    kelas_id TEXT NOT NULL,
    sakit INTEGER DEFAULT 0,
    izin INTEGER DEFAULT 0,
    alfa INTEGER DEFAULT 0,
    catatan_wali_kelas TEXT,
    kelakuan TEXT,
    kerajinan TEXT,
    kerapihan TEXT,
    ekstrakurikuler JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================================
-- KEAMANAN: ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC ANON POLICIES
-- ========================================================================
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tujuan_pembelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_dan_catatan ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses: Mengizinkan akses penuh (SELECT, INSERT, UPDATE, DELETE) untuk anon key aplikasi e-Raport
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public access on config" ON public.config;
    CREATE POLICY "Public access on config" ON public.config FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on kelas" ON public.kelas;
    CREATE POLICY "Public access on kelas" ON public.kelas FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on mapel" ON public.mapel;
    CREATE POLICY "Public access on mapel" ON public.mapel FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on siswa" ON public.siswa;
    CREATE POLICY "Public access on siswa" ON public.siswa FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on guru" ON public.guru;
    CREATE POLICY "Public access on guru" ON public.guru FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on period_list" ON public.period_list;
    CREATE POLICY "Public access on period_list" ON public.period_list FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on tujuan_pembelajaran" ON public.tujuan_pembelajaran;
    CREATE POLICY "Public access on tujuan_pembelajaran" ON public.tujuan_pembelajaran FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on nilai_siswa" ON public.nilai_siswa;
    CREATE POLICY "Public access on nilai_siswa" ON public.nilai_siswa FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access on absensi_dan_catatan" ON public.absensi_dan_catatan;
    CREATE POLICY "Public access on absensi_dan_catatan" ON public.absensi_dan_catatan FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ========================================================================
-- AKTIFKAN SUPABASE REALTIME REPLICATION (Opsional & Direkomendasikan)
-- ========================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.kelas;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mapel;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.siswa;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.guru;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.period_list;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tujuan_pembelajaran;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.nilai_siswa;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.absensi_dan_catatan;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication
        NULL;
    END;
END $$;

-- ========================================================================
-- SEED INITIAL DATA DEFAULT (Jika Belum Ada)
-- ========================================================================
INSERT INTO public.config (id, admin_username, admin_password_key, active_period_id, is_seed_initialized)
VALUES ('main', 'admin', 'alirsyadsolo', 'p1', true)
ON CONFLICT (id) DO NOTHING;
