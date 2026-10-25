"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  DEFAULT_SUBJECTS,
  predikat,
  type AttRecord,
  type AttSession,
  type Grade,
  type Journal,
  type NotificationItem,
  type SchoolClass,
  type SchoolSettings,
  type Student,
  type Teacher,
} from "@/lib/types";
import { SetupScreen, useRequireSession, useSessionUser } from "@/components/Setup";

type Role = "admin" | "guru";
const GURU_VIEWS: View[] = ["dashboard", "siswa", "absensi", "nilai", "jurnal", "laporan"];

type View =
  | "dashboard" | "kelas" | "siswa" | "absensi"
  | "nilai" | "jurnal" | "guru" | "sekolah" | "laporan";

type Status = "H" | "S" | "I" | "A";

const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  kelas: "Data Kelas",
  siswa: "Data Siswa",
  absensi: "Absensi Siswa",
  nilai: "Nilai & Leger",
  jurnal: "Jurnal Mengajar",
  guru: "Akun Guru",
  sekolah: "Data Sekolah",
  laporan: "Laporan Semester",
};

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "dashboard", icon: "🏠", label: "Dashboard" },
  { view: "kelas", icon: "🗂️", label: "Data Kelas" },
  { view: "siswa", icon: "🎓", label: "Data Siswa" },
  { view: "absensi", icon: "🗓️", label: "Absensi Siswa" },
  { view: "nilai", icon: "📊", label: "Nilai & Leger" },
  { view: "jurnal", icon: "📖", label: "Jurnal Mengajar" },
  { view: "laporan", icon: "🖨️", label: "Laporan Semester" },
  { view: "guru", icon: "👥", label: "Akun Guru" },
  { view: "sekolah", icon: "🏫", label: "Data Sekolah" },
];

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const STATUS_META: { key: Status; label: string; color: string }[] = [
  { key: "H", label: "Hadir (H)", color: "#0e7a5f" },
  { key: "S", label: "Sakit (S)", color: "#e9b949" },
  { key: "I", label: "Izin (I)", color: "#7ea4d8" },
  { key: "A", label: "Alfa (A)", color: "#c96f4a" },
];

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO(): string { return toISODate(new Date()); }

export default function DashboardApp() {
  const sessionState = useRequireSession();
  const sessionUser = useSessionUser(sessionState === "ready");
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [myPhoto, setMyPhoto] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [sessions, setSessions] = useState<AttSession[]>([]);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  async function loadAll() {
    const supabase = getSupabase();
    if (!supabase) return;
    const [s, c, st, t, j, ses, rec, g, n] = await Promise.all([
      supabase.from("school_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("classes").select("*").order("name"),
      supabase.from("students").select("*").order("name"),
      supabase.from("teachers").select("*").order("name"),
      supabase.from("journals").select("*").order("date", { ascending: false }),
      supabase.from("att_sessions").select("*").order("date", { ascending: false }),
      supabase.from("att_records").select("*"),
      supabase.from("grades").select("*"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    ]);
    if (s.data) setSettings(s.data as SchoolSettings);
    if (c.data) setClasses(c.data as SchoolClass[]);
    if (st.data) setStudents(st.data as Student[]);
    if (t.data) setTeachers(t.data as Teacher[]);
    if (j.data) setJournals(j.data as Journal[]);
    if (ses.data) setSessions(ses.data as AttSession[]);
    if (rec.data) setRecords(rec.data as AttRecord[]);
    if (g.data) setGrades(g.data as Grade[]);
    if (n.data) setNotifications(n.data as NotificationItem[]);
    setLoading(false);
  }

  useEffect(() => {
    if (sessionState === "ready") void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState]);

  useEffect(() => {
    if (!sessionUser) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    supabase
      .from("profiles")
      .select("photo")
      .eq("user_id", sessionUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setMyPhoto((data as { photo: string }).photo ?? "");
      });
    return () => { active = false; };
  }, [sessionUser]);

  const className = (id: number | null) =>
    classes.find((c) => c.id === id)?.name ?? "—";

  const stats = useMemo(() => {
    const totalRecords = records.length;
    const hadir = records.filter((r) => r.status === "H").length;
    const pct = totalRecords ? Math.round((hadir / totalRecords) * 100) : 0;
    return {
      totalSiswa: students.filter((s) => s.status === "Aktif").length,
      totalKelas: classes.length,
      pct,
      totalJurnal: journals.length,
      totalSesi: sessions.length,
      counts: Object.fromEntries(
        STATUS_META.map((m) => [m.key, records.filter((r) => r.status === m.key).length])
      ) as Record<Status, number>,
    };
  }, [students, classes, journals, sessions, records]);

  async function logout() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function markAllRead() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  if (sessionState === "setup") return <SetupScreen />;
  if (sessionState === "loading" || loading) {
    return (
      <main className="setup-wrap">
        <p className="muted">Memuat data sekolah…</p>
      </main>
    );
  }

  const headName = settings?.head_name || "Admin Kepala Sekolah";
  const headTitle = settings?.head_title || "Administrator Utama";
  const semester = settings?.semester || "Genap";
  const academicYear = settings?.academic_year || "Tahun Ajaran Aktif";
  const unread = notifications.filter((n) => !n.is_read).length;

  // ---- Peran pengguna ----
  // Aturan: peran eksplisit di app_metadata menang; bila belum diatur,
  // akun yang tertaut ke data guru = guru, akun lain (dibuat pemilik
  // langsung di Supabase) = admin. Aturan yang sama ditegakkan di RLS.
  const linkedTeacher = sessionUser
    ? teachers.find((t) => t.auth_user_id && t.auth_user_id === sessionUser.id) ?? null
    : null;
  const role: Role =
    sessionUser?.roleMeta === "admin" || sessionUser?.roleMeta === "guru"
      ? sessionUser.roleMeta
      : linkedTeacher
        ? "guru"
        : "admin";
  const isAdmin = role === "admin";
  const displayName = !isAdmin && linkedTeacher ? linkedTeacher.name : headName;
  const displayTitle = !isAdmin && linkedTeacher ? `Guru • ${linkedTeacher.subject || "—"}` : headTitle;
  const visibleNav = NAV.filter((n) => isAdmin || GURU_VIEWS.includes(n.view));
  const activeView: View = isAdmin || GURU_VIEWS.includes(view) ? view : "dashboard";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="profile">
          <button
            className="avatar-btn"
            title="Ganti foto profil"
            onClick={() => setPhotoOpen(true)}
          >
            <span className="avatar">
              {myPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={myPhoto} alt={`Foto profil ${displayName}`} />
              ) : (
                displayName.charAt(0)
              )}
            </span>
          </button>
          <div className="avatar-hint">Klik foto untuk mengganti</div>
          <h3>Hai, {displayName}! 👋</h3>
          <p>{displayTitle}</p>
          <p className="online-dot">● Online</p>
          <p style={{ marginTop: 4 }}>
            <span className={isAdmin ? "role-chip admin" : "role-chip"}>
              {isAdmin ? "🛡️ Admin" : "📚 Guru"}
            </span>
          </p>
          {settings?.school_name ? (
            <p style={{ marginTop: 6, color: "#f5ecd7", fontWeight: 700 }}>
              {settings.school_name}
            </p>
          ) : null}
        </div>
        <nav className="nav">
          <div className="nav-label">Menu Utama</div>
          {visibleNav.map((item) => (
            <button
              key={item.view}
              className={activeView === item.view ? "active" : ""}
              onClick={() => setView(item.view)}
            >
              <span className="ico">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="journal-card">
          <div className="crown">👑</div>
          <h4>Jurnal Hari Ini</h4>
          <p>Catat aktivitas KBM kelas dengan cepat &amp; rapi!</p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => setView("jurnal")}
          >
            + Isi Jurnal Cepat
          </button>
        </div>
      </aside>

      <main className="main">
        <TopBar
          title={VIEW_TITLES[activeView]}
          badge={`Semester ${semester} • ${academicYear}`}
          notifications={notifications}
          unread={unread}
          onMarkAllRead={markAllRead}
          onLogout={logout}
          students={students}
          classes={classes}
          journals={journals}
          className={className}
          go={setView}
        />

        {activeView === "dashboard" && (
          <DashboardView
            stats={stats}
            sessions={sessions}
            records={records}
            headName={displayName}
            semester={semester}
            academicYear={academicYear}
            schoolName={settings?.school_name ?? ""}
            go={setView}
          />
        )}
        {activeView === "kelas" && (
          <ClassesModule
            classes={classes}
            students={students}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {activeView === "siswa" && (
          <StudentsModule
            students={students}
            classes={classes}
            className={className}
            reload={loadAll}
            toast={showToast}
            readOnly={!isAdmin}
          />
        )}
        {activeView === "absensi" && (
          <AttendanceModule
            classes={classes}
            students={students}
            sessions={sessions}
            records={records}
            className={className}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {activeView === "nilai" && (
          <GradesModule
            classes={classes}
            students={students}
            grades={grades}
            className={className}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {activeView === "jurnal" && (
          <JournalsModule
            journals={journals}
            classes={classes}
            className={className}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {activeView === "laporan" && (
          <ReportModule
            students={students}
            classes={classes}
            grades={grades}
            records={records}
            className={className}
            schoolName={settings?.school_name ?? ""}
            schoolAddress={settings?.address ?? ""}
            headName={headName}
            defaultSemester={semester}
            defaultYear={academicYear}
          />
        )}
        {activeView === "guru" && (
          <TeachersModule teachers={teachers} reload={loadAll} toast={showToast} />
        )}
        {activeView === "sekolah" && (
          <SchoolSettingsModule
            settings={settings}
            reload={loadAll}
            toast={showToast}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
      {photoOpen && sessionUser && (
        <PhotoProfileModal
          userId={sessionUser.id}
          name={displayName}
          current={myPhoto}
          onClose={() => setPhotoOpen(false)}
          onSaved={(photo) => {
            setMyPhoto(photo);
            setPhotoOpen(false);
            showToast(photo ? "Foto profil berhasil diperbarui." : "Foto profil dihapus.");
          }}
        />
      )}
    </div>
  );
}

/* ================= Foto Profil Akun ================= */

function fileToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas tidak tersedia.")); return; }
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("File gambar tidak terbaca.")); };
    img.src = url;
  });
}

function PhotoProfileModal(props: {
  userId: string;
  name: string;
  current: string;
  onClose: () => void;
  onSaved: (photo: string) => void;
}) {
  const [preview, setPreview] = useState(props.current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) { setErr("Pilih file gambar (JPG/PNG)."); return; }
    if (file.size > 8 * 1024 * 1024) { setErr("Ukuran foto maksimal 8 MB."); return; }
    try {
      setPreview(await fileToSquareDataUrl(file));
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Gagal memproses foto.");
    }
  }

  async function save(photo: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    setErr("");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: props.userId, photo, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    setBusy(false);
    if (error) {
      setErr(
        /profiles/i.test(error.message)
          ? "Tabel foto profil belum ada di database. Jalankan ulang supabase/schema.sql di SQL Editor Supabase, lalu coba lagi."
          : error.message
      );
      return;
    }
    props.onSaved(photo);
  }

  return (
    <Modal title="Foto Profil Akun" onClose={props.onClose}>
      {err && <div className="alert-error">{err}</div>}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <span className="avatar" style={{ width: 110, height: 110, fontSize: 42, margin: "0 auto" }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`Foto profil ${props.name}`} />
          ) : (
            props.name.charAt(0)
          )}
        </span>
        <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
          Foto otomatis dipotong persegi &amp; diperkecil (256px) agar ringan.
        </p>
      </div>
      <label>Upload Foto Baru
        <input type="file" accept="image/*" onChange={(e) => void onFile(e)} />
      </label>
      <div className="modal-actions">
        {props.current && (
          <button className="btn btn-danger" onClick={() => void save("")} disabled={busy}>
            Hapus Foto
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={props.onClose} disabled={busy}>Batal</button>
        <button className="btn btn-emerald" onClick={() => void save(preview)} disabled={busy || preview === props.current}>
          {busy ? "Menyimpan…" : "Simpan Foto"}
        </button>
      </div>
    </Modal>
  );
}

/* ================= TopBar: pencarian global + notifikasi ================= */

function TopBar(props: {
  title: string;
  badge: string;
  notifications: NotificationItem[];
  unread: number;
  onMarkAllRead: () => void;
  onLogout: () => void;
  students: Student[];
  classes: SchoolClass[];
  journals: Journal[];
  className: (id: number | null) => string;
  go: (v: View) => void;
}) {
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const q = query.trim().toLowerCase();

  const results: { label: string; sub: string; view: View }[] = [];
  if (q.length >= 2) {
    props.students
      .filter((s) => s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((s) =>
        results.push({
          label: s.name,
          sub: `Siswa ${props.className(s.class_id)} • NIS ${s.nis}`,
          view: "siswa",
        })
      );
    props.classes
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((c) =>
        results.push({ label: c.name, sub: `Kelas • Wali ${c.homeroom_teacher}`, view: "kelas" })
      );
    props.journals
      .filter(
        (j) =>
          j.material.toLowerCase().includes(q) || j.subject.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((j) =>
        results.push({
          label: j.material,
          sub: `Jurnal ${j.subject} • ${props.className(j.class_id)}`,
          view: "jurnal",
        })
      );
  }

  return (
    <div className="topbar">
      <h1>{props.title}</h1>
      <span className="badge-live">{props.badge}</span>
      <div className="spacer" />
      <div className="search-wrap">
        <input
          placeholder="Cari siswa, kelas, materi…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q.length >= 2 && (
          <div className="search-results">
            {results.length === 0 && (
              <button disabled>Tidak ada hasil untuk “{query}”</button>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  props.go(r.view);
                  setQuery("");
                }}
              >
                {r.label}
                <small>{r.sub}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="notif-anchor">
        <button
          className="icon-btn"
          aria-label="Notifikasi"
          onClick={() => setNotifOpen((v) => !v)}
        >
          🔔
          {props.unread > 0 && <span className="notif-count">{props.unread}</span>}
        </button>
        {notifOpen && (
          <div className="notif-panel">
            <div className="panel-head">
              <h4>Notifikasi</h4>
              {props.unread > 0 && (
                <button
                  className="btn btn-small"
                  onClick={() => void props.onMarkAllRead()}
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
            {props.notifications.length === 0 && (
              <div className="notif-item">Belum ada notifikasi.</div>
            )}
            {props.notifications.map((n) => (
              <div key={n.id} className={`notif-item${n.is_read ? "" : " unread"}`}>
                <strong>{n.title}</strong>
                <small>{n.message}</small>
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="btn-logout" title="Keluar dari dashboard" onClick={props.onLogout}>
        <span aria-hidden="true">⏻</span> Keluar
      </button>
    </div>
  );
}

/* ================= Dashboard ================= */

function weekPercents(
  sessions: AttSession[],
  records: AttRecord[],
  weekOffset: number
): number[] {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Senin = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + weekOffset * 7);
  return DAY_LABELS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toISODate(d);
    const ids = sessions.filter((s) => s.date === iso).map((s) => s.id);
    const recs = records.filter((r) => ids.includes(r.session_id));
    if (!recs.length) return 0;
    return Math.round((recs.filter((r) => r.status === "H").length / recs.length) * 100);
  });
}

function DashboardView(props: {
  stats: {
    totalSiswa: number; totalKelas: number; pct: number; totalJurnal: number;
    totalSesi: number; counts: Record<Status, number>;
  };
  sessions: AttSession[];
  records: AttRecord[];
  headName: string;
  semester: string;
  academicYear: string;
  schoolName: string;
  go: (v: View) => void;
}) {
  const [week, setWeek] = useState(0);
  const bars = weekPercents(props.sessions, props.records, week);
  const { counts } = props.stats;
  const total = STATUS_META.reduce((a, m) => a + (counts[m.key] ?? 0), 0);

  // Donut SVG
  const R = 62, C = 2 * Math.PI * R;
  let acc = 0;
  const segments = STATUS_META.map((m) => {
    const val = total ? (counts[m.key] ?? 0) / total : 0;
    const seg = { ...m, val, start: acc };
    acc += val;
    return seg;
  });

  return (
    <>
      <section className="hero">
        <span className="pill">
          ☀ Semester {props.semester} • {props.academicYear}
        </span>
        <h2>Selamat Mengajar, {props.headName}! ☀️</h2>
        <p>
          Kelola absensi harian, rekap nilai siswa, dan jurnal mengajar
          {props.schoolName ? ` di ${props.schoolName}` : ""} dengan lebih
          hangat dan menyenangkan hari ini.
        </p>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => props.go("absensi")}>
            ▶ Mulai Absensi Kelas
          </button>
          <button className="btn" onClick={() => props.go("nilai")}>
            📊 Input Nilai
          </button>
        </div>
      </section>

      <section className="kpis">
        <div className="kpi tone-1">
          <div className="k-ico">🎓</div>
          <div className="k-label">Total Siswa</div>
          <div className="k-value">{props.stats.totalSiswa}</div>
          <div className="k-sub">Siswa Aktif Terdaftar</div>
        </div>
        <div className="kpi tone-2">
          <div className="k-ico">🗂️</div>
          <div className="k-label">Data Kelas</div>
          <div className="k-value">{props.stats.totalKelas}</div>
          <div className="k-sub">Rombongan Belajar</div>
        </div>
        <div className="kpi tone-3">
          <div className="k-ico">⏰</div>
          <div className="k-label">Kehadiran</div>
          <div className="k-value">{props.stats.pct}%</div>
          <div className="k-sub">{props.stats.totalSesi} Sesi Absensi</div>
        </div>
        <div className="kpi tone-4">
          <div className="k-ico">🔥</div>
          <div className="k-label">Jurnal Mengajar</div>
          <div className="k-value">{props.stats.totalJurnal}</div>
          <div className="k-sub">Pertemuan Tercatat</div>
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Grafik Kehadiran &amp; Aktivitas</h3>
              <div className="sub">Persentase kehadiran per sesi/hari</div>
            </div>
            <div className="toggle">
              <button className={week === 0 ? "on" : ""} onClick={() => setWeek(0)}>
                Minggu Ini
              </button>
              <button className={week === -1 ? "on" : ""} onClick={() => setWeek(-1)}>
                Minggu Lalu
              </button>
            </div>
          </div>
          <div className="bars">
            {bars.map((v, i) => (
              <div className="bar-col" key={DAY_LABELS[i]}>
                <div
                  className={`bar${i === 1 ? " alt" : i > 1 ? " soft" : ""}`}
                  style={{ height: `${Math.max(v, 3)}%` }}
                  title={`${DAY_LABELS[i]}: ${v}% hadir`}
                />
                <span>{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Komposisi Kehadiran Siswa</h3>
              <div className="sub">Akumulasi Hadir, Sakit, Izin &amp; Alfa</div>
            </div>
            <button className="btn btn-small" onClick={() => props.go("absensi")}>
              Detail
            </button>
          </div>
          <div className="donut-wrap">
            <svg width="168" height="168" viewBox="0 0 168 168" role="img"
              aria-label={`Kehadiran ${props.stats.pct}%`}>
              <circle cx="84" cy="84" r={R} fill="none" stroke="#eee4d2" strokeWidth="20" />
              {segments.filter((s) => s.val > 0).map((s) => (
                <circle
                  key={s.key}
                  cx="84" cy="84" r={R} fill="none"
                  stroke={s.color} strokeWidth="20"
                  strokeDasharray={`${s.val * C} ${C}`}
                  strokeDashoffset={-s.start * C}
                  transform="rotate(-90 84 84)"
                >
                  <title>{`${s.label}: ${Math.round(s.val * 100)}%`}</title>
                </circle>
              ))}
              <text x="84" y="82" textAnchor="middle" fontSize="24" fontWeight="800" fill="#22302a">
                {props.stats.pct}%
              </text>
              <text x="84" y="102" textAnchor="middle" fontSize="12" fill="#52645b">
                Hadir
              </text>
            </svg>
            <div className="donut-legend">
              {STATUS_META.map((m) => (
                <div className="legend-row" key={m.key}>
                  <span className="dot" style={{ background: m.color }} />
                  {m.label}
                  <span className="val">
                    {total ? Math.round(((counts[m.key] ?? 0) / total) * 100) : 0}% ({counts[m.key] ?? 0})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ================= Komponen bantu ================= */

function Modal(props: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{props.title}</h3>
        {props.children}
      </div>
    </div>
  );
}

type Reload = () => Promise<void>;
type ToastFn = (msg: string) => void;

/* ================= Data Kelas ================= */

function ClassesModule(props: {
  classes: SchoolClass[]; students: Student[]; reload: Reload; toast: ToastFn;
}) {
  const [editing, setEditing] = useState<SchoolClass | null | undefined>(undefined);
  const [form, setForm] = useState({ name: "", room: "", homeroom_teacher: "", capacity: 32 });

  function open(row?: SchoolClass) {
    setEditing(row ?? null);
    setForm(
      row
        ? { name: row.name, room: row.room, homeroom_teacher: row.homeroom_teacher, capacity: row.capacity }
        : { name: "", room: "", homeroom_teacher: "", capacity: 32 }
    );
  }

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = { ...form, capacity: Number(form.capacity) || 0 };
    const { error } = editing
      ? await supabase.from("classes").update(payload).eq("id", editing.id)
      : await supabase.from("classes").insert(payload);
    if (error) { props.toast("Gagal menyimpan kelas. Nama kelas mungkin sudah dipakai."); return; }
    setEditing(undefined);
    await props.reload();
    props.toast(editing ? "Kelas berhasil diperbarui." : "Kelas berhasil ditambahkan.");
  }

  async function remove(row: SchoolClass) {
    if (!window.confirm(`Hapus kelas ${row.name}? Siswa di kelas ini tidak ikut terhapus.`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("classes").delete().eq("id", row.id);
    if (error) { props.toast("Gagal menghapus kelas."); return; }
    await props.reload();
    props.toast("Kelas berhasil dihapus.");
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>Data Kelas</h2>
        <div className="spacer" />
        <button className="btn btn-emerald" onClick={() => open()}>+ Tambah Kelas</button>
      </div>
      {props.classes.length === 0 && <div className="empty">Belum ada kelas. Tambahkan kelas pertama Anda.</div>}
      <div className="cards-grid">
        {props.classes.map((c) => (
          <div className="class-card" key={c.id}>
            <h3>{c.name}</h3>
            <p>📍 {c.room || "—"}</p>
            <p>👩‍🏫 Wali Kelas: {c.homeroom_teacher || "—"}</p>
            <p>👥 {props.students.filter((s) => s.class_id === c.id).length} siswa • Kapasitas {c.capacity}</p>
            <div className="row-actions">
              <button className="btn btn-small" aria-label={`Edit kelas ${c.name}`} onClick={() => open(c)}>Edit</button>
              <button className="btn btn-small btn-danger" onClick={() => void remove(c)}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      {editing !== undefined && (
        <Modal title={editing ? "Edit Kelas" : "Tambah Kelas"} onClose={() => setEditing(undefined)}>
          <label className="full">Nama Kelas
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VII-A" />
          </label>
          <div className="form-grid">
            <label>Ruang / Lokasi
              <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Ruang 7A • Lantai 1" />
            </label>
            <label>Kapasitas (siswa)
              <input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </label>
          </div>
          <label>Wali Kelas
            <input value={form.homeroom_teacher} onChange={(e) => setForm({ ...form, homeroom_teacher: e.target.value })} placeholder="Nama wali kelas" />
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(undefined)}>Batal</button>
            <button className="btn btn-emerald" onClick={() => void save()}>
              {editing ? "Simpan Perubahan" : "Tambah Kelas"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ================= Data Siswa ================= */

function StudentsModule(props: {
  students: Student[]; classes: SchoolClass[];
  className: (id: number | null) => string; reload: Reload; toast: ToastFn;
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ name: "", nis: "", class_id: "", gender: "Laki-laki", status: "Aktif" });

  const rows = props.students.filter((s) => {
    const okSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.nis.toLowerCase().includes(search.toLowerCase());
    const okClass = classFilter === "all" || String(s.class_id) === classFilter;
    return okSearch && okClass;
  });

  function open(row?: Student) {
    setEditing(row ?? null);
    setForm(
      row
        ? { name: row.name, nis: row.nis, class_id: row.class_id ? String(row.class_id) : "", gender: row.gender, status: row.status }
        : { name: "", nis: "", class_id: props.classes[0] ? String(props.classes[0].id) : "", gender: "Laki-laki", status: "Aktif" }
    );
  }

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = {
      name: form.name, nis: form.nis,
      class_id: form.class_id ? Number(form.class_id) : null,
      gender: form.gender, status: form.status,
    };
    const { error } = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert(payload);
    if (error) { props.toast("Gagal menyimpan siswa. NIS mungkin sudah dipakai."); return; }
    setEditing(undefined);
    await props.reload();
    props.toast(editing ? "Data siswa berhasil diperbarui." : "Siswa berhasil ditambahkan.");
  }

  async function remove(row: Student) {
    if (!window.confirm(`Hapus siswa ${row.name}? Data absensi dan nilai siswa ini ikut terhapus.`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("students").delete().eq("id", row.id);
    if (error) { props.toast("Gagal menghapus siswa."); return; }
    await props.reload();
    props.toast("Siswa berhasil dihapus.");
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>Data Siswa</h2>
        <div className="spacer" />
        <input className="search-inline" placeholder="Cari nama / NIS…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ width: 160 }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">Semua Kelas</option>
          {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!props.readOnly && (
          <>
            <button className="btn" onClick={() => setImportOpen(true)}>📥 Impor Dapodik</button>
            <button className="btn btn-emerald" onClick={() => open()}>+ Tambah Siswa</button>
          </>
        )}
      </div>
      {props.readOnly && (
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          Anda masuk sebagai <strong>Guru</strong> — data siswa bersifat lihat saja.
          Perubahan data siswa dilakukan oleh Admin.
        </p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Nama</th><th>NIS</th><th>Kelas</th><th>Jenis Kelamin</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.nis}</td>
                <td>{props.className(s.class_id)}</td>
                <td>{s.gender}</td>
                <td><span className={`pill-status${s.status === "Aktif" ? "" : " off"}`}>{s.status}</span></td>
                <td>
                  {props.readOnly ? (
                    <span className="muted">—</span>
                  ) : (
                    <div className="row-actions">
                      <button className="btn btn-small" onClick={() => open(s)}>Edit</button>
                      <button className="btn btn-small btn-danger" onClick={() => void remove(s)}>Hapus</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="empty">Tidak ada siswa yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing !== undefined && (
        <Modal title={editing ? "Edit Siswa" : "Tambah Siswa"} onClose={() => setEditing(undefined)}>
          <div className="form-grid">
            <label>Nama Siswa
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
            </label>
            <label>NIS
              <input value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} placeholder="2024001" />
            </label>
            <label>Kelas
              <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">— Belum ada kelas —</option>
                {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Jenis Kelamin
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>Laki-laki</option><option>Perempuan</option>
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Aktif</option><option>Nonaktif</option><option>Lulus</option><option>Pindah</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(undefined)}>Batal</button>
            <button className="btn btn-emerald" onClick={() => void save()}>
              {editing ? "Simpan Perubahan" : "Tambah Siswa"}
            </button>
          </div>
        </Modal>
      )}
      {importOpen && (
        <ImportDapodikModal
          classes={props.classes}
          students={props.students}
          onClose={() => setImportOpen(false)}
          onDone={async (msg) => {
            setImportOpen(false);
            await props.reload();
            props.toast(msg);
          }}
        />
      )}
    </section>
  );
}

/* ================= Impor Siswa dari Dapodik ================= */

interface DapoRow {
  name: string;
  nis: string;
  gender: string;
  dup: boolean;
  noName: boolean;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.trunc(v));
  return String(v).trim();
}

function ImportDapodikModal(props: {
  classes: SchoolClass[];
  students: Student[];
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<DapoRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [rombel, setRombel] = useState("");
  const [target, setTarget] = useState<string>("rombel");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!raw.length) { setErr("File kosong atau formatnya tidak terbaca."); return; }

      const keys = Object.keys(raw[0]).map((k) => k.toLowerCase().trim());
      const findCol = (cands: string[]) => {
        const hit = keys.find((k) => cands.some((c) => k === c || k.includes(c)));
        return hit ? Object.keys(raw[0]).find((k) => k.toLowerCase().trim() === hit) ?? null : null;
      };
      const colName = findCol(["nama siswa", "nama peserta", "nama"]);
      const colNipd = findCol(["nipd", "nis"]);
      const colNisn = findCol(["nisn"]);
      const colJk = findCol(["jk", "jenis kelamin"]);
      const colRombel = findCol(["rombel saat ini", "rombel", "kelas"]);
      if (!colName) { setErr("Kolom Nama tidak ditemukan. Pastikan file adalah ekspor peserta didik Dapodik."); return; }

      const existingNis = new Set(props.students.map((s) => s.nis).filter(Boolean));
      const seen = new Set<string>();
      let rombelName = "";
      const parsed: DapoRow[] = raw.map((r) => {
        const name = cellText(r[colName]);
        const nis = (colNipd ? cellText(r[colNipd]) : "") || (colNisn ? cellText(r[colNisn]) : "");
        const jkRaw = colJk ? cellText(r[colJk]).toUpperCase() : "";
        const gender = jkRaw.startsWith("P") || jkRaw.includes("PEREMPUAN") ? "Perempuan" : "Laki-laki";
        if (colRombel && !rombelName) rombelName = cellText(r[colRombel]);
        let dup = false;
        if (nis) {
          if (existingNis.has(nis) || seen.has(nis)) dup = true;
          seen.add(nis);
        }
        return { name, nis, gender, dup, noName: !name };
      });
      setRows(parsed);
      setRombel(rombelName);
      setTarget(rombelName ? "rombel" : props.classes[0] ? String(props.classes[0].id) : "none");
    } catch {
      setErr("Gagal membaca file. Gunakan file .xlsx hasil ekspor Dapodik.");
    }
  }

  const validRows = (rows ?? []).filter((r) => !r.dup && !r.noName);
  const dupCount = (rows ?? []).filter((r) => r.dup).length;
  const noNameCount = (rows ?? []).filter((r) => r.noName).length;

  async function submit() {
    const supabase = getSupabase();
    if (!supabase) return;
    setErr("");
    setBusy(true);
    try {
      let classId: number | null = null;
      if (target === "rombel") {
        const existing = props.classes.find(
          (c) => c.name.toLowerCase() === rombel.toLowerCase()
        );
        if (existing) {
          classId = existing.id;
        } else {
          const { data, error } = await supabase
            .from("classes")
            .insert({ name: rombel, room: "", homeroom_teacher: "", capacity: 32 })
            .select("id")
            .single();
          if (error) throw new Error("Gagal membuat kelas dari rombel file.");
          classId = (data as { id: number }).id;
        }
      } else if (target !== "none") {
        classId = Number(target);
      }
      const payload = validRows.map((r) => ({
        name: r.name, nis: r.nis, gender: r.gender, status: "Aktif", class_id: classId,
      }));
      const { error } = await supabase.from("students").insert(payload);
      if (error) throw new Error(error.message);
      await props.onDone(
        `Impor selesai: ${payload.length} siswa ditambahkan${dupCount ? `, ${dupCount} dilewati (NIS duplikat)` : ""}${noNameCount ? `, ${noNameCount} dilewati (tanpa nama)` : ""}.`
      );
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Impor gagal.");
    }
  }

  return (
    <Modal title="Impor Siswa dari Dapodik" onClose={props.onClose}>
      {err && <div className="alert-error">{err}</div>}
      <label>File Ekspor Dapodik (.xlsx)
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void onFile(e)} />
      </label>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: -4 }}>
        Yang diambil hanya <strong>Nama</strong>, <strong>NIS</strong> (dari NIPD, cadangan
        NISN), <strong>Jenis Kelamin</strong>, dan <strong>Rombel</strong>. Data pribadi lain
        di file (NIK, alamat, orang tua) <strong>tidak</strong> ikut disimpan.
      </p>
      {rows && (
        <>
          <div className="summary-bar">
            <span>📄 {fileName}</span>
            <span>Total: {rows.length}</span>
            <span>Siap impor: {validRows.length}</span>
            {dupCount > 0 && <span>Duplikat NIS: {dupCount}</span>}
            {noNameCount > 0 && <span>Tanpa nama: {noNameCount}</span>}
          </div>
          <label>Masukkan ke Kelas
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {rombel && <option value="rombel">Buat / pakai kelas dari rombel file: “{rombel}”</option>}
              {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="none">— Tanpa kelas —</option>
            </select>
          </label>
          <div style={{ overflowX: "auto", maxHeight: 240, overflowY: "auto", marginBottom: 10 }}>
            <table>
              <thead><tr><th>Nama</th><th>NIS</th><th>JK</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name || "—"}</td>
                    <td>{r.nis || "—"}</td>
                    <td>{r.gender === "Perempuan" ? "P" : "L"}</td>
                    <td>{r.noName ? "⚠️ Tanpa nama" : r.dup ? "⏭️ Duplikat" : "✅ Siap"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && (
              <p className="muted" style={{ fontSize: 12.5 }}>…dan {rows.length - 8} baris lainnya.</p>
            )}
          </div>
        </>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose} disabled={busy}>Batal</button>
        <button className="btn btn-emerald" onClick={() => void submit()} disabled={busy || !rows || validRows.length === 0}>
          {busy ? "Mengimpor…" : `Impor ${validRows.length} Siswa`}
        </button>
      </div>
    </Modal>
  );
}

/* ================= Akun Guru ================= */

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  buf.forEach((n) => { out += chars[n % chars.length]; });
  return out;
}

async function callTeacherAccount(body: Record<string, unknown>): Promise<{ ok?: boolean; existed?: boolean; roles?: Record<string, string>; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase belum terhubung." };
  const { data, error } = await supabase.functions.invoke("create-teacher-account", { body });
  if (!error) return (data as { ok?: boolean; existed?: boolean; roles?: Record<string, string> }) ?? { ok: true };
  let msg = "";
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === "function") {
      const j = (await ctx.clone().json()) as { error?: string };
      if (j?.error) msg = j.error;
    }
  } catch { /* abaikan */ }
  if (!msg) {
    const raw = error.message ?? "";
    msg = /not found|404|failed to fetch|failed to send a request|networkerror/i.test(raw)
      ? "Fitur ini belum aktif di Supabase. Pasang dulu Edge Function “create-teacher-account” (sekali saja, ±5 menit) — panduannya ada di README bagian “Membuat Akun Login Guru dari Aplikasi”."
      : raw || "Terjadi kesalahan.";
  }
  return { error: msg };
}

function TeachersModule(props: { teachers: Teacher[]; reload: Reload; toast: ToastFn }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Teacher | null | undefined>(undefined);
  const [form, setForm] = useState({ name: "", subject: "", status: "Aktif", email: "" });
  const [accountFor, setAccountFor] = useState<{ teacher: Teacher; mode: "create" | "reset" } | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const rows = props.teachers.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let active = true;
    callTeacherAccount({ action: "roles" }).then((res) => {
      if (active && res.roles) setRoles(res.roles);
    });
    return () => { active = false; };
  }, []);

  async function changeRole(t: Teacher, newRole: string) {
    if (!t.auth_user_id) return;
    const res = await callTeacherAccount({ action: "set_role", teacher_id: t.id, role: newRole });
    if (res.error) { props.toast(res.error); return; }
    setRoles((prev) => ({ ...prev, [t.auth_user_id as string]: newRole }));
    props.toast(
      newRole === "admin"
        ? `${t.name} sekarang berperan Admin (berlaku saat login berikutnya).`
        : `${t.name} sekarang berperan Guru (berlaku saat login berikutnya).`
    );
  }

  function open(row?: Teacher) {
    setEditing(row ?? null);
    setForm(
      row
        ? { name: row.name, subject: row.subject, status: row.status, email: row.email ?? "" }
        : { name: "", subject: "", status: "Aktif", email: "" }
    );
  }

  async function unlink(row: Teacher) {
    if (!window.confirm(`Lepas tautan akun login dari ${row.name}? User login-nya tidak dihapus, hanya tidak lagi terhubung ke data guru ini.`)) return;
    const res = await callTeacherAccount({ action: "unlink", teacher_id: row.id });
    if (res.error) { props.toast(res.error); return; }
    await props.reload();
    props.toast("Tautan akun login berhasil dilepas.");
  }

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = editing
      ? await supabase.from("teachers").update(form).eq("id", editing.id)
      : await supabase.from("teachers").insert(form);
    if (error) { props.toast("Gagal menyimpan data guru."); return; }
    setEditing(undefined);
    await props.reload();
    props.toast(editing ? "Data guru berhasil diperbarui." : "Guru berhasil ditambahkan.");
  }

  async function remove(row: Teacher) {
    if (!window.confirm(`Hapus data guru ${row.name}?`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("teachers").delete().eq("id", row.id);
    if (error) { props.toast("Gagal menghapus data guru."); return; }
    await props.reload();
    props.toast("Data guru berhasil dihapus.");
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>Akun Guru</h2>
        <div className="spacer" />
        <input className="search-inline" placeholder="Cari guru…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-emerald" onClick={() => open()}>+ Tambah Guru</button>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
        Kelola data guru sekaligus akun login-nya. Klik <strong>Buat Akun Login</strong> pada
        baris guru, tentukan email &amp; password awal, lalu berikan ke guru yang bersangkutan —
        guru masuk lewat halaman login yang sama dengan akun tersebut.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Nama Guru</th><th>Mata Pelajaran</th><th>Status</th><th>Akun Login</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.subject}</td>
                <td><span className={`pill-status${t.status === "Aktif" ? "" : " off"}`}>{t.status}</span></td>
                <td>
                  {t.auth_user_id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                      <span className="pill-status" title={t.email}>✓ Aktif{t.email ? ` • ${t.email}` : ""}</span>
                      <label style={{ margin: 0, fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }}>
                        Peran:
                        <select
                          style={{ width: "auto", padding: "4px 8px", fontSize: 12.5 }}
                          value={roles[t.auth_user_id] ?? "guru"}
                          onChange={(e) => void changeRole(t, e.target.value)}
                        >
                          <option value="guru">Guru</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    </div>
                  ) : (
                    <span className="pill-status off">Belum ada akun</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    {t.auth_user_id ? (
                      <>
                        <button className="btn btn-small" onClick={() => setAccountFor({ teacher: t, mode: "reset" })}>Reset Password</button>
                        <button className="btn btn-small" onClick={() => void unlink(t)}>Lepas Tautan</button>
                      </>
                    ) : (
                      <button className="btn btn-small btn-gold" onClick={() => setAccountFor({ teacher: t, mode: "create" })}>Buat Akun Login</button>
                    )}
                    <button className="btn btn-small" onClick={() => open(t)}>Edit</button>
                    <button className="btn btn-small btn-danger" onClick={() => void remove(t)}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">Tidak ada guru yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing !== undefined && (
        <Modal title={editing ? "Edit Guru" : "Tambah Guru"} onClose={() => setEditing(undefined)}>
          <label>Nama Guru
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap + gelar" />
          </label>
          <div className="form-grid">
            <label>Mata Pelajaran
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Matematika" />
            </label>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Aktif</option><option>Nonaktif</option>
              </select>
            </label>
          </div>
          <label>Email (untuk akun login)
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama.guru@sekolah.sch.id" />
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(undefined)}>Batal</button>
            <button className="btn btn-emerald" onClick={() => void save()}>
              {editing ? "Simpan Perubahan" : "Tambah Guru"}
            </button>
          </div>
        </Modal>
      )}
      {accountFor && (
        <TeacherAccountModal
          teacher={accountFor.teacher}
          mode={accountFor.mode}
          onClose={() => setAccountFor(null)}
          onDone={async (msg) => {
            setAccountFor(null);
            await props.reload();
            props.toast(msg);
          }}
        />
      )}
    </section>
  );
}

/* Modal pembuatan akun login guru / reset password (via Edge Function) */
function TeacherAccountModal(props: {
  teacher: Teacher;
  mode: "create" | "reset";
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}) {
  const isCreate = props.mode === "create";
  const [email, setEmail] = useState(props.teacher.email ?? "");
  const [password, setPassword] = useState(() => genPassword());
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (isCreate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr("Isi email guru yang valid terlebih dahulu.");
      return;
    }
    if (password.length < 8) {
      setErr("Password minimal 8 karakter.");
      return;
    }
    setBusy(true);
    const res = await callTeacherAccount({
      action: isCreate ? "create" : "reset",
      teacher_id: props.teacher.id,
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    await props.onDone(
      isCreate
        ? res.existed
          ? `Akun login untuk ${props.teacher.name} ditautkan dari akun yang sudah terdaftar (password tidak berubah — gunakan Reset Password bila perlu menggantinya).`
          : `Akun login untuk ${props.teacher.name} berhasil dibuat. Berikan email & password ini ke gurunya.`
        : `Password akun ${props.teacher.name} berhasil direset. Berikan password baru ini ke gurunya.`
    );
  }

  return (
    <Modal title={isCreate ? `Buat Akun Login — ${props.teacher.name}` : `Reset Password — ${props.teacher.name}`} onClose={props.onClose}>
      {err && <div className="alert-error">{err}</div>}
      {isCreate && (
        <label>Email Login Guru
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama.guru@sekolah.sch.id" autoComplete="off" />
        </label>
      )}
      <label>{isCreate ? "Password Awal" : "Password Baru"}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-small" onClick={() => setShowPw((v) => !v)}>
            {showPw ? "Sembunyikan" : "Lihat"}
          </button>
          <button type="button" className="btn btn-small" onClick={() => { setPassword(genPassword()); setShowPw(true); }}>
            Buat Otomatis
          </button>
        </div>
      </label>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
        Password ini hanya tampil di sini — <strong>catat dan berikan langsung ke guru yang
        bersangkutan</strong>, jangan kirim lewat grup. Guru masuk melalui halaman login
        dengan email &amp; password ini.
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose} disabled={busy}>Batal</button>
        <button className="btn btn-gold" onClick={() => void submit()} disabled={busy}>
          {busy ? "Memproses…" : isCreate ? "Buat Akun Login" : "Reset Password"}
        </button>
      </div>
    </Modal>
  );
}

/* ================= Laporan Semester (Rapor) ================= */

function autoCatatan(avg: number | null, hadirPct: number | null): string {
  if (avg === null) return "Belum ada nilai yang tercatat untuk semester ini.";
  let text: string;
  if (avg >= 90) text = "Ananda menunjukkan prestasi belajar yang sangat baik dan konsisten. Pertahankan semangat belajarnya.";
  else if (avg >= 80) text = "Ananda menunjukkan prestasi belajar yang baik. Terus tingkatkan kedisiplinan dan semangat belajarnya.";
  else if (avg >= 70) text = "Ananda menunjukkan prestasi belajar yang cukup. Perlu meningkatkan fokus dan ketekunan dalam belajar.";
  else if (avg >= 60) text = "Ananda perlu bimbingan dan pendampingan belajar yang lebih intensif agar hasil belajarnya meningkat.";
  else text = "Ananda memerlukan perhatian dan pendampingan khusus. Mohon kerja sama orang tua/wali untuk memantau kegiatan belajar di rumah.";
  if (hadirPct !== null && hadirPct < 85) {
    text += " Kehadiran Ananda perlu ditingkatkan agar tidak tertinggal materi pelajaran.";
  }
  return text;
}

function ReportModule(props: {
  students: Student[]; classes: SchoolClass[]; grades: Grade[]; records: AttRecord[];
  className: (id: number | null) => string;
  schoolName: string; schoolAddress: string; headName: string;
  defaultSemester: string; defaultYear: string;
}) {
  const [classId, setClassId] = useState("");
  const [mode, setMode] = useState<"satu" | "semua">("satu");
  const [studentId, setStudentId] = useState("");
  const [semester, setSemester] = useState(props.defaultSemester);
  const [year, setYear] = useState(props.defaultYear);
  const [note, setNote] = useState("");

  const activeClass = props.classes.find((c) => String(c.id) === classId) ?? props.classes[0];
  const classStudents = useMemo(
    () =>
      (activeClass ? props.students.filter((s) => s.class_id === activeClass.id) : [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [props.students, activeClass]
  );
  const selected =
    classStudents.find((s) => String(s.id) === studentId) ?? classStudents[0];

  const subjects = useMemo(() => {
    const ids = new Set(classStudents.map((s) => s.id));
    const found = new Set(props.grades.filter((g) => ids.has(g.student_id)).map((g) => g.subject));
    const ordered = DEFAULT_SUBJECTS.filter((s) => found.has(s));
    const rest = [...found].filter((s) => !DEFAULT_SUBJECTS.includes(s)).sort();
    return [...ordered, ...rest];
  }, [props.grades, classStudents]);

  const scoreOf = (sid: number, subject: string): number | null =>
    props.grades.find((g) => g.student_id === sid && g.subject === subject)?.score ?? null;

  const avgOf = (sid: number): number | null => {
    const vals = subjects
      .map((sub) => scoreOf(sid, sub))
      .filter((v): v is number => v !== null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const countsOf = (sid: number) => {
    const recs = props.records.filter((r) => r.student_id === sid);
    const c: Record<Status, number> = { H: 0, S: 0, I: 0, A: 0 };
    recs.forEach((r) => { c[r.status] += 1; });
    const total = recs.length;
    return { ...c, total, pct: total ? Math.round((c.H / total) * 100) : null as number | null };
  };

  const ranked = useMemo(() => {
    return classStudents
      .map((s) => ({ id: s.id, avg: avgOf(s.id) }))
      .filter((r) => r.avg !== null)
      .sort((a, b) => (b.avg as number) - (a.avg as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classStudents, subjects, props.grades]);
  const rankOf = (sid: number): number | null => {
    const i = ranked.findIndex((r) => r.id === sid);
    return i >= 0 ? i + 1 : null;
  };

  const docs = mode === "semua" ? classStudents : selected ? [selected] : [];
  const printDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <section className="module">
      <div className="module-head no-print">
        <h2>Laporan Semester</h2>
        <div className="spacer" />
        <button className="btn btn-gold" onClick={() => window.print()} disabled={!docs.length}>
          🖨️ Cetak / Simpan PDF
        </button>
      </div>

      <div className="report-controls no-print">
        <label>Kelas
          <select
            value={activeClass ? String(activeClass.id) : ""}
            onChange={(e) => { setClassId(e.target.value); setStudentId(""); }}
          >
            {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as "satu" | "semua")}>
            <option value="satu">Satu Siswa</option>
            <option value="semua">Semua Siswa di Kelas</option>
          </select>
        </label>
        {mode === "satu" && (
          <label>Siswa
            <select value={selected ? String(selected.id) : ""} onChange={(e) => setStudentId(e.target.value)}>
              {classStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <label>Semester
          <select value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option>Ganjil</option>
            <option>Genap</option>
          </select>
        </label>
        <label>Tahun Ajaran
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026/2027" />
        </label>
      </div>
      <label className="no-print" style={{ maxWidth: 720 }}>
        Catatan Wali Kelas (kosongkan untuk catatan otomatis berdasarkan nilai &amp; kehadiran)
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tulis catatan khusus… atau kosongkan untuk catatan otomatis"
        />
      </label>
      <p className="muted no-print" style={{ fontSize: 13, marginTop: 0 }}>
        Pratinjau di bawah persis seperti hasil cetak. Pada dialog cetak browser,
        pilih <strong>Simpan sebagai PDF</strong> bila ingin file PDF. Rekap kehadiran
        dihitung dari seluruh sesi absensi yang tercatat untuk siswa.
      </p>

      <div id="print-area">
        {docs.length === 0 && (
          <div className="empty">Belum ada siswa pada kelas ini.</div>
        )}
        {docs.map((s) => {
          const counts = countsOf(s.id);
          const avg = avgOf(s.id);
          return (
            <div className="report-doc" key={s.id}>
              <div className="report-head">
                <div className="report-school">{props.schoolName || "Nama Sekolah"}</div>
                {props.schoolAddress ? <div className="report-addr">{props.schoolAddress}</div> : null}
                <div className="report-line" />
                <div className="report-title">LAPORAN HASIL BELAJAR SISWA</div>
                <div className="report-sub">Semester {semester} • Tahun Ajaran {year}</div>
              </div>

              <div className="report-meta">
                <div><span>Nama Siswa</span><strong>{s.name}</strong></div>
                <div><span>NIS</span><strong>{s.nis || "—"}</strong></div>
                <div><span>Kelas</span><strong>{props.className(s.class_id)}</strong></div>
                <div><span>Wali Kelas</span><strong>{activeClass?.homeroom_teacher || "—"}</strong></div>
              </div>

              <div className="report-section">A. Nilai Mata Pelajaran</div>
              <table className="report-table">
                <thead>
                  <tr><th style={{ width: 42 }}>No</th><th>Mata Pelajaran</th><th style={{ width: 90 }}>Nilai</th><th style={{ width: 190 }}>Predikat</th></tr>
                </thead>
                <tbody>
                  {subjects.map((sub, i) => {
                    const v = scoreOf(s.id, sub);
                    return (
                      <tr key={sub}>
                        <td className="c">{i + 1}</td>
                        <td>{sub}</td>
                        <td className="c">{v === null ? "—" : v}</td>
                        <td>{v === null ? "Belum dinilai" : predikat(v)}</td>
                      </tr>
                    );
                  })}
                  {subjects.length === 0 && (
                    <tr><td colSpan={4} className="c">Belum ada nilai tercatat untuk kelas ini.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="report-summary">
                <div>Rata-rata Nilai: <strong>{avg === null ? "—" : avg}</strong></div>
                <div>Peringkat di Kelas: <strong>{rankOf(s.id) === null ? "—" : `${rankOf(s.id)} dari ${ranked.length} siswa`}</strong></div>
                <div>Predikat Umum: <strong>{avg === null ? "—" : predikat(avg)}</strong></div>
              </div>

              <div className="report-section">B. Rekap Kehadiran</div>
              <table className="report-table">
                <thead>
                  <tr><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alfa</th><th>Total Sesi</th><th>% Kehadiran</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="c">{counts.H}</td>
                    <td className="c">{counts.S}</td>
                    <td className="c">{counts.I}</td>
                    <td className="c">{counts.A}</td>
                    <td className="c">{counts.total}</td>
                    <td className="c">{counts.pct === null ? "—" : `${counts.pct}%`}</td>
                  </tr>
                </tbody>
              </table>

              <div className="report-section">C. Catatan Wali Kelas</div>
              <p className="report-note">{note.trim() ? note : autoCatatan(avg, counts.pct)}</p>

              <div className="report-sign">
                <div className="sign-block">
                  <div>Mengetahui,</div>
                  <div>Kepala Sekolah</div>
                  <div className="sign-space" />
                  <div className="sign-name">{props.headName}</div>
                </div>
                <div className="sign-block">
                  <div>{printDate}</div>
                  <div>Wali Kelas {props.className(s.class_id)}</div>
                  <div className="sign-space" />
                  <div className="sign-name">{activeClass?.homeroom_teacher || "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ================= Jurnal Mengajar ================= */

function JournalsModule(props: {
  journals: Journal[]; classes: SchoolClass[];
  className: (id: number | null) => string; reload: Reload; toast: ToastFn;
}) {
  const [editing, setEditing] = useState<Journal | null | undefined>(undefined);
  const [form, setForm] = useState({ date: todayISO(), class_id: "", subject: "", material: "", activity: "" });

  function open(row?: Journal) {
    setEditing(row ?? null);
    setForm(
      row
        ? { date: row.date, class_id: row.class_id ? String(row.class_id) : "", subject: row.subject, material: row.material, activity: row.activity }
        : { date: todayISO(), class_id: props.classes[0] ? String(props.classes[0].id) : "", subject: "", material: "", activity: "" }
    );
  }

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = { ...form, class_id: form.class_id ? Number(form.class_id) : null };
    const { error } = editing
      ? await supabase.from("journals").update(payload).eq("id", editing.id)
      : await supabase.from("journals").insert(payload);
    if (error) { props.toast("Gagal menyimpan jurnal."); return; }
    setEditing(undefined);
    await props.reload();
    props.toast("Jurnal berhasil disimpan.");
  }

  async function remove(row: Journal) {
    if (!window.confirm(`Hapus jurnal "${row.material}"?`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("journals").delete().eq("id", row.id);
    if (error) { props.toast("Gagal menghapus jurnal."); return; }
    await props.reload();
    props.toast("Jurnal berhasil dihapus.");
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>Jurnal Mengajar</h2>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => open()}>+ Isi Jurnal Cepat</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Tanggal</th><th>Kelas</th><th>Mata Pelajaran</th><th>Materi</th><th>Kegiatan</th><th>Aksi</th></tr></thead>
          <tbody>
            {props.journals.map((j) => (
              <tr key={j.id}>
                <td>{j.date}</td>
                <td>{props.className(j.class_id)}</td>
                <td>{j.subject}</td>
                <td><strong>{j.material}</strong></td>
                <td>{j.activity}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-small" onClick={() => open(j)}>Edit</button>
                    <button className="btn btn-small btn-danger" onClick={() => void remove(j)}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {props.journals.length === 0 && <tr><td colSpan={6} className="empty">Belum ada jurnal tercatat.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing !== undefined && (
        <Modal title={editing ? "Edit Jurnal" : "Isi Jurnal Cepat"} onClose={() => setEditing(undefined)}>
          <div className="form-grid">
            <label>Tanggal
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>Kelas
              <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">— Pilih kelas —</option>
                {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Mata Pelajaran
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Matematika" />
            </label>
            <label>Materi
              <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Topik yang diajarkan" />
            </label>
          </div>
          <label>Kegiatan / Aktivitas KBM
            <textarea rows={3} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} placeholder="Ringkasan kegiatan belajar mengajar…" />
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditing(undefined)}>Batal</button>
            <button className="btn btn-emerald" onClick={() => void save()}>
              {editing ? "Simpan Perubahan" : "Simpan Jurnal"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ================= Absensi Siswa ================= */

function AttendanceModule(props: {
  classes: SchoolClass[]; students: Student[]; sessions: AttSession[]; records: AttRecord[];
  className: (id: number | null) => string; reload: Reload; toast: ToastFn;
}) {
  const [date, setDate] = useState(todayISO());
  const [classId, setClassId] = useState<string>(props.classes[0] ? String(props.classes[0].id) : "");
  const [label, setLabel] = useState("Sesi 1");
  const [marks, setMarks] = useState<Record<number, Status>>({});
  const [loadedSessionId, setLoadedSessionId] = useState<number | null>(null);

  const classStudents = props.students.filter(
    (s) => String(s.class_id) === classId && s.status === "Aktif"
  );

  // Muat sesi yang sudah ada setiap tanggal/kelas/sesi berubah.
  useEffect(() => {
    const ses = props.sessions.find(
      (s) => s.date === date && String(s.class_id) === classId && s.session_label === label
    );
    if (ses) {
      setLoadedSessionId(ses.id);
      const m: Record<number, Status> = {};
      props.records.filter((r) => r.session_id === ses.id).forEach((r) => { m[r.student_id] = r.status; });
      setMarks(m);
    } else {
      setLoadedSessionId(null);
      setMarks({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, classId, label]);

  const summary = STATUS_META.map((m) => ({
    ...m,
    count: Object.values(marks).filter((v) => v === m.key).length,
  }));

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    if (!classId) { props.toast("Pilih kelas terlebih dahulu."); return; }
    const entries = Object.entries(marks);
    if (!entries.length) { props.toast("Tandai minimal satu siswa sebelum menyimpan."); return; }

    let sessionId = loadedSessionId;
    if (sessionId) {
      const { error } = await supabase.from("att_sessions").update({ date, class_id: Number(classId), session_label: label }).eq("id", sessionId);
      if (error) { props.toast("Gagal memperbarui sesi absensi."); return; }
      await supabase.from("att_records").delete().eq("session_id", sessionId);
    } else {
      const { data, error } = await supabase
        .from("att_sessions")
        .insert({ date, class_id: Number(classId), session_label: label })
        .select("id")
        .single();
      if (error || !data) { props.toast("Gagal membuat sesi absensi."); return; }
      sessionId = (data as { id: number }).id;
    }
    const { error: recErr } = await supabase.from("att_records").insert(
      entries.map(([studentId, status]) => ({
        session_id: sessionId, student_id: Number(studentId), status,
      }))
    );
    if (recErr) { props.toast("Gagal menyimpan data absensi."); return; }
    setLoadedSessionId(sessionId);
    await props.reload();
    props.toast("Absensi berhasil disimpan.");
  }

  async function loadSession(ses: AttSession) {
    setDate(ses.date);
    setClassId(ses.class_id ? String(ses.class_id) : "");
    setLabel(ses.session_label);
    props.toast(`Sesi ${ses.session_label} tanggal ${ses.date} dimuat untuk diedit.`);
  }

  async function deleteSession(ses: AttSession) {
    if (!window.confirm(`Hapus sesi absensi ${ses.session_label} tanggal ${ses.date}?`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("att_sessions").delete().eq("id", ses.id);
    if (error) { props.toast("Gagal menghapus sesi absensi."); return; }
    await props.reload();
    props.toast("Sesi absensi berhasil dihapus.");
  }

  return (
    <section className="module">
      <div className="module-head"><h2>Absensi Siswa</h2></div>
      <div className="inline-form">
        <div>
          <label>Tanggal</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label>Kelas</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Sesi</label>
          <select value={label} onChange={(e) => setLabel(e.target.value)}>
            <option>Sesi 1</option><option>Sesi 2</option><option>Sesi 3</option>
          </select>
        </div>
        <button className="btn" onClick={() => {
          const m: Record<number, Status> = {};
          classStudents.forEach((s) => { m[s.id] = "H"; });
          setMarks(m);
        }}>Semua Hadir</button>
        <button className="btn btn-emerald" onClick={() => void save()}>Simpan Absensi</button>
      </div>

      {loadedSessionId && (
        <p className="muted" style={{ fontSize: 13 }}>
          Sesi ini sudah tersimpan sebelumnya — perubahan Anda akan memperbaruinya.
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Nama Siswa</th><th>Kelas</th><th>Status Kehadiran</th></tr></thead>
          <tbody>
            {classStudents.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{props.className(s.class_id)}</td>
                <td>
                  <span className="att-btns">
                    {STATUS_META.map((m) => (
                      <button
                        key={m.key}
                        className={marks[s.id] === m.key ? `sel-${m.key}` : ""}
                        title={m.label}
                        onClick={() => setMarks((prev) => ({ ...prev, [s.id]: m.key }))}
                      >
                        {m.key}
                      </button>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
            {classStudents.length === 0 && (
              <tr><td colSpan={3} className="empty">Belum ada siswa aktif di kelas ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="summary-bar">
        <span>Ringkasan:</span>
        {summary.map((s) => <span key={s.key}>{s.label}: {s.count}</span>)}
        <span>Total ditandai: {Object.keys(marks).length}</span>
      </div>

      <h3 style={{ marginTop: 24 }}>Riwayat Sesi Absensi</h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Tanggal</th><th>Kelas</th><th>Sesi</th><th>H / S / I / A</th><th>Aksi</th></tr></thead>
          <tbody>
            {props.sessions.map((ses) => {
              const recs = props.records.filter((r) => r.session_id === ses.id);
              const cnt = (k: Status) => recs.filter((r) => r.status === k).length;
              return (
                <tr key={ses.id}>
                  <td>{ses.date}</td>
                  <td>{props.className(ses.class_id)}</td>
                  <td>{ses.session_label}</td>
                  <td>{cnt("H")} / {cnt("S")} / {cnt("I")} / {cnt("A")}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-small" onClick={() => loadSession(ses)}>Muat / Edit</button>
                      <button className="btn btn-small btn-danger" onClick={() => void deleteSession(ses)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {props.sessions.length === 0 && <tr><td colSpan={5} className="empty">Belum ada sesi absensi tersimpan.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ================= Nilai & Leger ================= */

function GradesModule(props: {
  classes: SchoolClass[]; students: Student[]; grades: Grade[];
  className: (id: number | null) => string; reload: Reload; toast: ToastFn;
}) {
  const [classFilter, setClassFilter] = useState<string>("all");
  const [extraSubjects, setExtraSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftLoaded, setDraftLoaded] = useState(false);

  const subjects = useMemo(() => {
    const set = new Set<string>([...DEFAULT_SUBJECTS, ...extraSubjects]);
    props.grades.forEach((g) => set.add(g.subject));
    return Array.from(set);
  }, [props.grades, extraSubjects]);

  // Isi draft dari data tersimpan (sekali, dan setiap data nilai berubah dari server).
  useEffect(() => {
    const d: Record<string, string> = {};
    props.grades.forEach((g) => { d[`${g.student_id}|${g.subject}`] = String(g.score); });
    setDraft(d);
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.grades.length]);

  const rows = props.students.filter(
    (s) => classFilter === "all" || String(s.class_id) === classFilter
  );

  function avgOf(studentId: number): number | null {
    const vals = subjects
      .map((sub) => draft[`${studentId}|${sub}`])
      .filter((v) => v !== undefined && v !== "")
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  async function saveRow(student: Student) {
    const supabase = getSupabase();
    if (!supabase) return;
    const payload = subjects
      .map((sub) => {
        const raw = draft[`${student.id}|${sub}`];
        return raw === undefined || raw === "" ? null : { student_id: student.id, subject: sub, score: Number(raw) };
      })
      .filter((x): x is { student_id: number; subject: string; score: number } => x !== null)
      .filter((x) => !Number.isNaN(x.score) && x.score >= 0 && x.score <= 100);
    if (!payload.length) { props.toast(`Isi minimal satu nilai untuk ${student.name}.`); return; }
    const { error } = await supabase.from("grades").upsert(payload, { onConflict: "student_id,subject" });
    if (error) { props.toast("Gagal menyimpan nilai."); return; }
    await props.reload();
    props.toast(`Nilai ${student.name} berhasil disimpan.`);
  }

  function exportCSV() {
    const header = ["Nama", "NIS", "Kelas", ...subjects, "Rata-rata", "Predikat"];
    const lines = rows.map((s) => {
      const avg = avgOf(s.id);
      const cells = [
        s.name, s.nis, props.className(s.class_id),
        ...subjects.map((sub) => draft[`${s.id}|${sub}`] ?? ""),
        avg === null ? "" : String(avg), predikat(avg),
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leger-nilai.csv";
    a.click();
    URL.revokeObjectURL(url);
    props.toast("Leger berhasil diunduh sebagai CSV.");
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>Nilai &amp; Leger</h2>
        <div className="spacer" />
        <select style={{ width: 170 }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">Semua Kelas</option>
          {props.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-gold" onClick={exportCSV}>⬇ Ekspor CSV</button>
      </div>
      <div className="inline-form">
        <div>
          <label>Tambah Mata Pelajaran</label>
          <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="cth. Pendidikan Agama" />
        </div>
        <button className="btn" onClick={() => {
          const name = newSubject.trim();
          if (name && !subjects.includes(name)) setExtraSubjects((p) => [...p, name]);
          setNewSubject("");
        }}>+ Tambah Mapel</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Nama Siswa</th><th>Kelas</th>
              {subjects.map((sub) => <th key={sub}>{sub}</th>)}
              <th>Rata-rata</th><th>Predikat</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const avg = draftLoaded ? avgOf(s.id) : null;
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{props.className(s.class_id)}</td>
                  {subjects.map((sub) => (
                    <td key={sub}>
                      <input
                        type="number" min={0} max={100}
                        value={draft[`${s.id}|${sub}`] ?? ""}
                        onChange={(e) => setDraft((p) => ({ ...p, [`${s.id}|${sub}`]: e.target.value }))}
                      />
                    </td>
                  ))}
                  <td><strong>{avg === null ? "—" : avg}</strong></td>
                  <td>{predikat(avg)}</td>
                  <td><button className="btn btn-small btn-emerald" onClick={() => void saveRow(s)}>Simpan</button></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={subjects.length + 5} className="empty">Tidak ada siswa pada filter ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Isi nilai 0–100 per mata pelajaran lalu klik Simpan per siswa. Rata-rata dan
        predikat dihitung otomatis. Tombol Ekspor CSV mengunduh leger sesuai filter kelas.
      </p>
    </section>
  );
}

/* ================= Data Sekolah ================= */

function SchoolSettingsModule(props: {
  settings: SchoolSettings | null; reload: Reload; toast: ToastFn;
}) {
  const [form, setForm] = useState({
    school_name: "", address: "", head_name: "", head_title: "", semester: "Genap", academic_year: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (props.settings && !loaded) {
      setForm({
        school_name: props.settings.school_name ?? "",
        address: props.settings.address ?? "",
        head_name: props.settings.head_name ?? "",
        head_title: props.settings.head_title ?? "",
        semester: props.settings.semester ?? "Genap",
        academic_year: props.settings.academic_year ?? "",
      });
      setLoaded(true);
    }
  }, [props.settings, loaded]);

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase
      .from("school_settings")
      .upsert({ id: 1, ...form }, { onConflict: "id" });
    if (error) { props.toast("Gagal menyimpan data sekolah."); return; }
    await props.reload();
    props.toast("Data sekolah berhasil disimpan.");
  }

  return (
    <section className="module">
      <div className="module-head"><h2>Data Sekolah</h2></div>
      <div className="panel" style={{ boxShadow: "none", marginBottom: 18, background: "var(--ivory)" }}>
        <h3>{form.school_name || "(Nama sekolah belum diisi)"}</h3>
        <div className="sub">
          Kepala Sekolah: {form.head_name || "—"} ({form.head_title || "—"}) • Semester {form.semester} • {form.academic_year || "—"}
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>{form.address || "Alamat sekolah belum diisi."}</p>
      </div>
      <div className="form-grid">
        <label>Nama Sekolah
          <input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} placeholder="cth. SD Negeri 1 Contoh" />
        </label>
        <label>Nama Kepala Sekolah
          <input value={form.head_name} onChange={(e) => setForm({ ...form, head_name: e.target.value })} placeholder="Nama kepala sekolah" />
        </label>
        <label className="full">Alamat Sekolah
          <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jalan, kelurahan, kecamatan, kota" />
        </label>
        <label>Jabatan
          <input value={form.head_title} onChange={(e) => setForm({ ...form, head_title: e.target.value })} placeholder="Administrator Utama" />
        </label>
        <label>Semester
          <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
            <option>Ganjil</option><option>Genap</option>
          </select>
        </label>
        <label>Tahun Ajaran
          <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="cth. 2025/2026 atau Tahun Ajaran Aktif" />
        </label>
      </div>
      <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
        <button className="btn btn-emerald" onClick={() => void save()}>Simpan Data Sekolah</button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Perubahan nama kepala sekolah, semester, dan tahun ajaran langsung tampil di
        sidebar dan hero dashboard.
      </p>
    </section>
  );
}
