export interface SchoolSettings {
  id: number;
  school_name: string;
  address: string;
  head_name: string;
  head_title: string;
  semester: string;
  academic_year: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  room: string;
  homeroom_teacher: string;
  capacity: number;
}

export interface Student {
  id: number;
  name: string;
  nis: string;
  class_id: number | null;
  gender: string;
  status: string;
}

export interface Teacher {
  id: number;
  name: string;
  subject: string;
  status: string;
  email: string;
  auth_user_id: string | null;
}

export interface Journal {
  id: number;
  date: string;
  class_id: number | null;
  subject: string;
  material: string;
  activity: string;
}

export interface AttSession {
  id: number;
  date: string;
  class_id: number | null;
  session_label: string;
}

export interface AttRecord {
  id: number;
  session_id: number;
  student_id: number;
  status: "H" | "S" | "I" | "A";
}

export interface Grade {
  id: number;
  student_id: number;
  subject: string;
  score: number;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const DEFAULT_SUBJECTS = [
  "Matematika",
  "Bahasa Indonesia",
  "IPA",
  "Bahasa Inggris",
];

export function predikat(avg: number | null): string {
  if (avg === null || Number.isNaN(avg)) return "-";
  if (avg >= 90) return "A — Sangat Baik";
  if (avg >= 80) return "B — Baik";
  if (avg >= 70) return "C — Cukup";
  if (avg >= 60) return "D — Kurang";
  return "E — Sangat Kurang";
}
