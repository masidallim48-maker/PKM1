import { request } from "./api.js";
import { attendanceHistoryApi } from "./attendanceHistory.js";

const env = import.meta.env ?? {};
const STUDENTS_ENDPOINT = env.VITE_DATA_SISWA_ENDPOINT || "/api/data_siswa";
export const STUDENT_FIELDS = Object.freeze({ nama_siswa: "nama_siswa", nis: "nis", id_kelas: "id_kelas", sn: "sn" });

function validationError(errors) {
  const error = new Error("Periksa kembali data siswa.");
  error.response = { status: 422, data: { errors } };
  return error;
}

export function buildStudentSearchParams({ search = "", page = 1 } = {}) {
  if (typeof search !== "string" || !Number.isSafeInteger(page) || page < 1) {
    throw validationError({ search: ["Pencarian atau halaman tidak valid."] });
  }
  return { page, ...(search.trim() ? { search: search.trim() } : {}) };
}

export function buildStudentPayload(values) {
  const errors = {};
  for (const [field, label] of [["nama_siswa", "Nama siswa"], ["nis", "NIS"], ["id_kelas", "Kelas"]]) {
    if (typeof values[field] !== "string" || !values[field].trim()) errors[STUDENT_FIELDS[field]] = [`${label} wajib diisi.`];
  }
  if (values.sn != null && typeof values.sn !== "string") errors[STUDENT_FIELDS.sn] = ["Nomor kartu harus berupa string."];
  if (Object.keys(errors).length) throw validationError(errors);
  const payload = Object.fromEntries(["nama_siswa", "nis", "id_kelas"].map((field) => [STUDENT_FIELDS[field], values[field].trim()]));
  if (values.sn?.trim()) payload[STUDENT_FIELDS.sn] = values.sn.trim();
  return { ...payload, status: "ACTIVE", type: "siswa" };
}

export function assertStudentResponse(payload) {
  let current = payload;
  for (let depth = 0; depth < 5 && current && typeof current === "object" && !Array.isArray(current); depth++) {
    const status = Number(current.status);
    if ((status >= 400 && status <= 599) || current.status === false || current.success === false) {
      const error = new Error("Permintaan data siswa belum berhasil.");
      error.response = { status: status >= 400 && status <= 599 ? status : 422, data: current };
      throw error;
    }
    current = current.data_siswa ?? current.data;
  }
  return payload;
}

export function normalizeCreatedStudent(payload) {
  assertStudentResponse(payload);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Respons penambahan siswa belum sesuai.");
  const record = payload.data ?? payload;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Data siswa pada respons belum sesuai.");
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (record.id_siswa == null && record.id == null && !message && Number(payload.status) !== 201 && payload.success !== true) {
    throw new Error("Respons belum mengonfirmasi penyimpanan siswa.");
  }
  return { payload, record, message: message || "Data siswa berhasil ditambahkan." };
}

export const studentsApi = {
  async list(filters, { signal } = {}) {
    const payload = await request(STUDENTS_ENDPOINT, { method: "get", params: buildStudentSearchParams(filters), signal });
    return assertStudentResponse(payload);
  },
  getClasses: attendanceHistoryApi.getClasses,
  async create(values, { signal } = {}) {
    const payload = await request(STUDENTS_ENDPOINT, { method: "post", data: buildStudentPayload(values), signal });
    return normalizeCreatedStudent(payload);
  },
};

export function getStudentError(error, action = "load") {
  const status = error.response?.status ?? error.status;
  const fields = {};
  if (status === 422) {
    for (const [field, key] of [...Object.entries(STUDENT_FIELDS), ["search", "search"]]) {
      const value = error.response?.data?.errors?.[key];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  let message = action === "save" ? "Data siswa belum dapat disimpan. Silakan coba lagi." : "Data siswa belum dapat dimuat. Silakan coba lagi.";
  if (status === 401) message = "Sesi berakhir. Silakan login kembali.";
  else if (status === 403) message = action === "save" ? "Anda tidak memiliki izin menambah siswa." : "Anda tidak memiliki akses ke data siswa.";
  else if (status === 409) message = "NIS atau nomor kartu sudah digunakan. Periksa kembali data siswa.";
  else if (status === 422) message = "Periksa kembali data yang diisi.";
  else if (status === 429) message = "Terlalu banyak permintaan. Silakan tunggu sebentar.";
  else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") message = "Server belum merespons. Silakan periksa data sebelum mencoba lagi.";
  else if (error.code === "ERR_NETWORK") message = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return { message, fields };
}
