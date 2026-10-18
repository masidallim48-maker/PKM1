import { normalizeCollection } from "../DashboardPage/dashboardData.js";
import { assertTeacherResponse } from "../../services/teachers.js";

export function normalizeTeachersList(payload, page = 1) {
  assertTeacherResponse(payload);
  return normalizeCollection(payload, "data_guru", page);
}

function text(value) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function subjectName(value) {
  if (Array.isArray(value)) return value.map(subjectName).filter(Boolean).join(", ");
  if (value && typeof value === "object") return text(value.nama_mapel ?? value.nama ?? value.name);
  return text(value);
}

export function getTeacherCard(record) {
  const nip = text(record.nip);
  const nig = text(record.nig);
  const sn = text(record.sn);
  const status = text(record.status);
  const active = ["active", "aktif"].includes(status.toLowerCase().trim());
  const inactive = ["inactive", "nonaktif", "non-aktif"].includes(status.toLowerCase().trim());
  return {
    id: text(record.id_guru ?? record.id ?? record.sn),
    name: text(record.nama ?? record.nama_guru ?? record.name) || "—",
    identifierLabel: nip ? "NIP" : nig ? "NIG" : "SN",
    identifier: nip || nig || sn || "—",
    subject: subjectName(record.mata_pelajaran) || subjectName(record.mapel) || text(record.nama_mapel) || "—",
    status: active ? "Aktif" : inactive ? "Nonaktif" : status || "—",
    active,
  };
}
