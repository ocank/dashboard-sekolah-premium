# Dashboard Sekolah Premium

Dashboard administrasi sekolah dengan tampilan premium (sidebar emerald gelap
beraksen emas, latar ivory hangat, font Plus Jakarta Sans) untuk mengelola:

- **Dashboard** — KPI live, grafik kehadiran mingguan, donut komposisi kehadiran
- **Data Kelas** — tambah / edit / hapus kelas
- **Data Siswa** — tambah / edit / hapus siswa, cari & filter per kelas
- **Absensi Siswa** — absensi per tanggal/kelas/sesi (H/S/I/A), riwayat sesi
- **Nilai & Leger** — input nilai, rata-rata & predikat otomatis, ekspor CSV
- **Jurnal Mengajar** — jurnal KBM + Isi Jurnal Cepat
- **Akun Guru** — data master guru
- **Data Sekolah** — identitas sekolah yang tampil di dashboard

Teknologi: **Next.js (App Router + TypeScript)** di **Vercel**, database +
login di **Supabase** (PostgreSQL + Supabase Auth). Semua data hanya bisa
diakses oleh user yang sudah login — kebijakan RLS di database menolak akses
publik/anon, jadi data siswa tidak terbuka untuk umum.

---

## Cara Deploy (Gratis)

### 1. Buat repositori GitHub dan push kode ini

1. Buka [github.com](https://github.com) → **New repository** → beri nama
   misalnya `dashboard-sekolah-premium` → **Create repository**.
2. Dari folder project ini di komputer Anda:

   ```bash
   git init
   git add .
   git commit -m "Dashboard Sekolah Premium"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```

   (Atau pakai GitHub Desktop: *Add Existing Repository* → pilih folder ini →
   *Publish repository*.)

### 2. Buat project Supabase

1. Buka [supabase.com](https://supabase.com) → **New project** → beri nama,
   buat password database (simpan baik-baik), pilih region terdekat
   (Singapore) → tunggu sampai project selesai dibuat.
2. Buka menu **SQL Editor → New query**, salin **seluruh isi** file
   `supabase/schema.sql` dari repositori ini, lalu klik **Run**.
   Ini membuat semua tabel, keamanan RLS, dan data awal (2 kelas, 2 siswa,
   absensi contoh 75% hadir, 2 jurnal, nilai contoh, 2 notifikasi, dan
   pengaturan sekolah default). File ini aman dijalankan berulang.

### 3. Buat user admin pertama

1. Di Supabase buka **Authentication → Users → Add user → Create new user**.
2. Isi email + password untuk admin/kepala sekolah, centang
   **Auto Confirm User** bila tersedia, lalu simpan.
   User inilah yang dipakai untuk login pertama kali ke dashboard.

### 4. Ambil API key Supabase

Di Supabase buka **Project Settings → API**, catat:

- **Project URL** — contoh `https://abcdefgh.supabase.co`
- **anon public key** — kunci panjang berawalan `eyJ...`

### 5. Import ke Vercel dan isi environment variable

1. Buka [vercel.com](https://vercel.com) → **Add New → Project** → import
   repositori GitHub yang tadi dibuat → framework akan terdeteksi sebagai
   Next.js, jangan ubah apa pun dulu.
2. Pada bagian **Environment Variables**, tambahkan dua variabel:

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari langkah 4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key dari langkah 4 |

3. Klik **Deploy** dan tunggu sampai selesai. Dashboard Anda live di alamat
   seperti `https://dashboard-sekolah-premium-xxxx.vercel.app`.
4. Buka alamat itu → login dengan user admin dari langkah 3 → selesai.
   Data awal bisa langsung diganti dari menu-menu di dalam dashboard
   (termasuk identitas sekolah di menu **Data Sekolah**).

> Bila suatu saat mengganti env variable di Vercel, lakukan **Redeploy**
> (Deployments → titik tiga → Redeploy) agar nilai baru dipakai.

---

## Membuat Akun Login Guru dari Aplikasi

Akun login guru bisa dibuat langsung dari dashboard (menu **Akun Guru →
Buat Akun Login**, termasuk **Reset Password**). Fitur ini memakai sebuah
Edge Function Supabase yang perlu dipasang **sekali saja** (±5 menit):

1. **Perbarui database**: di Supabase → **SQL Editor**, jalankan ulang isi
   `supabase/schema.sql` (aman — file ini idempotent, data tidak hilang).
   Ini menambahkan kolom `email` dan `auth_user_id` pada tabel `teachers`.
2. **Pasang Edge Function**: di Supabase → **Edge Functions → Create a new
   function**, beri nama persis `create-teacher-account`, hapus isi contohnya,
   lalu tempel seluruh isi file
   `supabase/functions/create-teacher-account/index.ts` dari repo ini →
   **Deploy**.
3. Selesai. Di dashboard → **Akun Guru**, setiap guru yang belum punya akun
   kini punya tombol **Buat Akun Login**: isi email + password awal
   (ada tombol *Buat Otomatis*), lalu berikan kredensial itu langsung ke
   gurunya. Guru masuk lewat halaman login yang sama.

Catatan keamanan: function berjalan dengan service role key yang otomatis
tersedia di server Supabase — kunci itu tidak pernah masuk ke kode aplikasi,
browser, atau GitHub. Function juga menolak panggilan dari siapa pun yang
belum login. Cara lama tetap bisa dipakai (Supabase → Authentication →
Users → Add user), dan akun yang dibuat dengan cara itu akan **ditautkan
otomatis** saat admin menekan Buat Akun Login dengan email yang sama.

Semua user yang login saat ini memiliki akses yang sama ke semua menu
(belum ada pembagian peran admin vs guru).

## Backup & Ekspor Data

- **Leger nilai** bisa diekspor kapan saja dari menu **Nilai & Leger →
  Ekspor CSV**.
- **Backup database penuh**: di Supabase buka **Database → Backups** untuk
  melihat backup otomatis, atau ekspor tabel lewat **Table Editor → (pilih
  tabel) → Export data as CSV**.
- Simpan juga salinan file `supabase/schema.sql` versi terbaru di repo —
  dengan file itu database bisa dibangun ulang dari nol.

> ⚠️ **Catatan tier gratis Supabase:** project gratis akan **di-pause**
> bila tidak ada aktivitas dalam waktu lama (sekitar 1 minggu). Data **tidak
> hilang** — buka dashboard Supabase lalu klik **Restore / Unpause** untuk
> menghidupkannya lagi. Membuka dashboard sekolah secara berkala juga
> mencegah pause. Vercel Hobby dan GitHub gratis tidak mem-pause project.

## Pengembangan Lokal

```bash
npm install
cp .env.example .env.local   # lalu isi URL + anon key Supabase Anda
npm run dev                  # buka http://localhost:3000
npm run build                # memastikan build produksi lolos
```

Tanpa `.env.local`, aplikasi tetap bisa di-build dan akan menampilkan layar
petunjuk setup berbahasa Indonesia (bukan error) — berguna untuk memeriksa
apakah env variable sudah terisi dengan benar setelah deploy.

## Struktur Project

```
src/app/            Halaman: / (pengarah), /login, /dashboard
src/components/     DashboardApp (semua modul), layar Setup
src/lib/            Client Supabase + tipe data
supabase/schema.sql Skema database + RLS + data awal
```
