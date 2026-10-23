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
import { SetupScreen, useRequireSession } from "@/components/Setup";

type View =
  | "dashboard" | "kelas" | "siswa" | "absensi"
  | "nilai" | "jurnal" | "guru" | "sekolah";

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
};

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "dashboard", icon: "🏠", label: "Dashboard" },
  { view: "kelas", icon: "🗂️", label: "Data Kelas" },
  { view: "siswa", icon: "🎓", label: "Data Siswa" },
  { view: "absensi", icon: "🗓️", label: "Absensi Siswa" },
  { view: "nilai", icon: "📊", label: "Nilai & Leger" },
  { view: "jurnal", icon: "📖", label: "Jurnal Mengajar" },
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
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="profile">
          <div className="avatar">{headName.charAt(0)}</div>
          <h3>Hai, {headName}! 👋</h3>
          <p>{headTitle}</p>
          <p className="online-dot">● Online</p>
          {settings?.school_name ? (
            <p style={{ marginTop: 6, color: "#f5ecd7", fontWeight: 700 }}>
              {settings.school_name}
            </p>
          ) : null}
        </div>
        <nav className="nav">
          <div className="nav-label">Menu Utama</div>
          {NAV.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? "active" : ""}
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
          title={VIEW_TITLES[view]}
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

        {view === "dashboard" && (
          <DashboardView
            stats={stats}
            sessions={sessions}
            records={records}
            headName={headName}
            semester={semester}
            academicYear={academicYear}
            schoolName={settings?.school_name ?? ""}
            go={setView}
          />
        )}
        {view === "kelas" && (
          <ClassesModule
            classes={classes}
            students={students}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {view === "siswa" && (
          <StudentsModule
            students={students}
            classes={classes}
            className={className}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {view === "absensi" && (
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
        {view === "nilai" && (
          <GradesModule
            classes={classes}
            students={students}
            grades={grades}
            className={className}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {view === "jurnal" && (
          <JournalsModule
            journals={journals}
            classes={classes}
            className={className}
            reload={loadAll}
            toast={showToast}
          />
        )}
        {view === "guru" && (
          <TeachersModule teachers={teachers} reload={loadAll} toast={showToast} />
        )}
        {view === "sekolah" && (
          <SchoolSettingsModule
            settings={settings}
            reload={loadAll}
            toast={showToast}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
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
}) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null | undefined>(undefined);
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
        <button className="btn btn-emerald" onClick={() => open()}>+ Tambah Siswa</button>
      </div>
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
                  <div className="row-actions">
                    <button className="btn btn-small" onClick={() => open(s)}>Edit</button>
                    <button className="btn btn-small btn-danger" onClick={() => void remove(s)}>Hapus</button>
                  </div>
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
    </section>
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

async function callTeacherAccount(body: Record<string, unknown>): Promise<{ ok?: boolean; existed?: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase belum terhubung." };
  const { data, error } = await supabase.functions.invoke("create-teacher-account", { body });
  if (!error) return (data as { ok?: boolean; existed?: boolean }) ?? { ok: true };
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
    msg = /not found|404|failed to fetch|networkerror/i.test(raw)
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
  const rows = props.teachers.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

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
                    <span className="pill-status" title={t.email}>✓ Aktif{t.email ? ` • ${t.email}` : ""}</span>
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
