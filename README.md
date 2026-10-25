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
belum login atau yang bukan Admin. Cara lama tetap bisa dipakai (Supabase →
Authentication → Users → Add user), dan akun yang dibuat dengan cara itu
akan **ditautkan otomatis** saat admin menekan Buat Akun Login dengan
email yang sama.

## Pembagian Peran: Admin vs Guru

- **Admin** — akses penuh: semua menu, termasuk **Data Kelas**,
  **Akun Guru**, dan **Data Sekolah**; satu-satunya yang boleh mengubah
  data master (kelas, siswa, guru) dan pengaturan sekolah.
- **Guru** — menu **Dashboard**, **Data Siswa** (lihat saja), **Absensi**,
  **Nilai & Leger**, dan **Jurnal Mengajar** (absensi, nilai, dan jurnal
  memang pekerjaan harian guru, jadi tetap bisa diisi/diedit).

Pembagian ini ditegakkan di **dua lapis**: tampilan aplikasi menyembunyikan
menu/aksi yang bukan haknya, dan Row Level Security di database menolak
tulisan yang tidak sesuai peran (fungsi `public.is_admin()` di
`supabase/schema.sql`) — jadi bukan sekadar kosmetik tampilan.

Cara peran ditentukan (berurutan):

1. Peran eksplisit pada `app_metadata.role` user Auth. Akun yang dibuat
   lewat **Buat Akun Login** otomatis berperan `guru`; Admin dapat
   mengubahnya menjadi `admin` (atau sebaliknya) lewat pilihan **Peran**
   di kolom Akun Login pada menu Akun Guru — berlaku saat user login
   berikutnya.
2. Bila belum diatur: akun yang tertaut ke data guru
   (`teachers.auth_user_id`) berperan guru; akun lain — termasuk akun
   pemilik yang dibuat langsung di Supabase Authentication — berperan
   admin, sehingga akun utama tidak pernah terkunci dari fitur Admin.

## Laporan Semester (Rapor)

Menu **Laporan Semester** menyusun rapor per siswa dari data yang sudah
ada: nilai per mata pelajaran + predikat, rata-rata, peringkat di kelas,
rekap kehadiran (H/S/I/A + persentase), dan catatan wali kelas (otomatis
berdasarkan nilai & kehadiran, atau ditulis sendiri). Pilih **Kelas**,
mode **Satu Siswa** atau **Semua Siswa di Kelas** (satu halaman A4 per
siswa), semester, dan tahun ajaran, lalu klik **Cetak / Simpan PDF** —
dialog cetak browser menghasilkan kertas A4 bersih tanpa sidebar, dan
bisa disimpan sebagai PDF. Menu ini tersedia untuk Admin dan Guru.

## Impor Siswa dari Dapodik

Di menu **Data Siswa → Impor Dapodik** (Admin saja), unggah file `.xlsx`
ekspor peserta didik Dapodik. Yang diambil hanya **Nama**, **NIS** (dari
kolom NIPD, cadangan NISN), **Jenis Kelamin** (L/P), dan **Rombel Saat
Ini** — data pribadi lain (NIK, alamat, data orang tua) tidak disimpan.
Sebelum impor ada pratinjau: siswa dengan NIS yang sudah terdaftar atau
duplikat di dalam file otomatis dilewati. Kelas tujuan bisa dipilih, atau
dibuat otomatis dari nama rombel di file (mis. "Kelas 1D").

## Foto Profil Akun

Klik foto/inisial di sidebar untuk mengganti foto profil akun yang sedang
login (Admin maupun Guru). Foto dipotong persegi dan diperkecil menjadi
256px JPEG di browser, lalu disimpan di tabel `profiles`
(kolom `photo`, satu baris per user). Kebijakan RLS-nya: semua user login
boleh melihat, tetapi setiap user hanya bisa mengubah fotonya sendiri.
Karena itu **tidak perlu Supabase Storage** — cukup jalankan ulang
`supabase/schema.sql` (idempotent) untuk membuat tabelnya.

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
