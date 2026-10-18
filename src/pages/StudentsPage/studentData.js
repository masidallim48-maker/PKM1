import { normalizeCollection } from "../DashboardPage/dashboardData.js";
import { assertStudentResponse } from "../../services/students.js";

function count(value) {
  if (!["number", "string"].includes(typeof value) || (typeof value === "string" && !value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function normalizeStudentsList(payload, page = 1) {
  assertStudentResponse(payload);
  const collection = normalizeCollection(payload, "data_siswa", page);
  const summary = { students: null, classes: null };
  let envelope = payload;
  for (let depth = 0; depth < 5 && envelope && typeof envelope === "object" && !Array.isArray(envelope); depth++) {
    const values = envelope.summary ?? envelope.meta?.summary;
    if (values) {
      summary.students = count(values.total_siswa) ?? summary.students;
      summary.classes = count(values.total_kelas) ?? summary.classes;
    }
    envelope = envelope.data_siswa ?? envelope.data;
  }
  return { ...collection, summary };
}

function text(value) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function getStudentCard(record, classes = []) {
  const group = record.kelas;
  const className = text(group && typeof group === "object" ? group.nama_kelas ?? group.nama : group)
    || text(record.nama_kelas) || classes.find((item) => item.id === text(record.id_kelas))?.name || "—";
  const status = text(record.status);
  const active = ["active", "aktif"].includes(status.toLowerCase().trim());
  const inactive = ["inactive", "nonaktif", "non-aktif"].includes(status.toLowerCase().trim());
  const nis = text(record.nis);
  const nisn = text(record.nisn);
  const sn = text(record.sn);
  const identifierLabel = nis ? "NIS" : nisn ? "NISN" : "SN";
  return {
    id: text(record.id_siswa ?? record.id ?? record.sn),
    name: text(record.nama_siswa ?? record.nama ?? record.name) || "—",
    identifierLabel,
    identifier: nis || nisn || sn || "—",
    className,
    status: active ? "Aktif" : inactive ? "Nonaktif" : status || "—",
    active,
  };
}
