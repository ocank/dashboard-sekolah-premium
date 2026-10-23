// ============================================================
// Edge Function: create-teacher-account
// Dashboard Sekolah Premium — membuat akun login guru dari aplikasi.
//
// Cara pasang (sekali saja, ±5 menit):
//   Supabase Dashboard > Edge Functions > Create a new function
//   > nama: create-teacher-account > tempel SELURUH isi file ini
//   > Deploy.
//
// Keamanan:
// - Hanya user yang sudah login (JWT valid) yang boleh memanggil.
// - Pembuatan user memakai service role key yang OTOMATIS tersedia
//   di environment Edge Functions (SUPABASE_SERVICE_ROLE_KEY).
//   Kunci itu TIDAK PERNAH keluar dari server Supabase.
// ============================================================

// @ts-ignore — modul Deno untuk Edge Functions Supabase
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// @ts-ignore — Deno tersedia di runtime Edge Functions
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method tidak diizinkan." }, 405);
  }

  try {
    // @ts-ignore — Deno.env tersedia di runtime Edge Functions
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    // @ts-ignore
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !anonKey || !serviceKey) {
      return json({ error: "Konfigurasi server tidak lengkap." }, 500);
    }

    // 1) Pastikan pemanggil sudah login (JWT valid).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Tidak ada sesi login." }, 401);
    }
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Sesi login tidak valid." }, 401);
    }

    // 2) Baca & validasi input.
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "create");
    const teacherId = Number(body.teacher_id);
    if (!teacherId) return json({ error: "teacher_id wajib diisi." }, 400);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: teacher, error: tErr } = await admin
      .from("teachers")
      .select("id, name, email, auth_user_id")
      .eq("id", teacherId)
      .maybeSingle();
    if (tErr) return json({ error: tErr.message }, 500);
    if (!teacher) return json({ error: "Data guru tidak ditemukan." }, 404);

    // 3) Aksi: lepas tautan akun (user Auth TIDAK dihapus).
    if (action === "unlink") {
      const { error } = await admin
        .from("teachers")
        .update({ auth_user_id: null })
        .eq("id", teacherId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "unlink" });
    }

    const password = String(body.password ?? "");
    if (password.length < 8) {
      return json({ error: "Password minimal 8 karakter." }, 400);
    }

    // 4) Aksi: reset password akun yang sudah tertaut.
    if (action === "reset") {
      if (!teacher.auth_user_id) {
        return json({ error: "Guru ini belum punya akun login." }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(
        teacher.auth_user_id,
        { password }
      );
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "reset" });
    }

    // 5) Aksi: buat akun (atau tautkan akun yang sudah ada).
    if (action !== "create") {
      return json({ error: "Action tidak dikenal." }, 400);
    }
    const email = String(body.email ?? teacher.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Format email tidak valid." }, 400);
    }
    if (teacher.auth_user_id) {
      return json(
        { error: "Guru ini sudah memiliki akun login. Gunakan Reset Password bila perlu." },
        409
      );
    }

    let userId: string | null = null;
    let existed = false;
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: teacher.name, role: "guru" },
      });

    if (createErr) {
      // Email sudah terdaftar di Auth → cari user-nya untuk ditautkan.
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) return json({ error: createErr.message }, 500);
      const found = list.users.find(
        (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email
      );
      if (!found) return json({ error: createErr.message }, 500);
      userId = found.id;
      existed = true;
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) {
      return json({ error: "Gagal membuat akun login." }, 500);
    }

    const { error: upErr } = await admin
      .from("teachers")
      .update({ email, auth_user_id: userId })
      .eq("id", teacherId);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, action: "create", user_id: userId, existed });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Terjadi kesalahan server." },
      500
    );
  }
});
