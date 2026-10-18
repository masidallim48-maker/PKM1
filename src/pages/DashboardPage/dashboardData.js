import { getResourceContract } from "../../services/apiContracts.js";

const numberFormatter = new Intl.NumberFormat("id-ID");

function nonNegativeInteger(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") {
    return null;
  }
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

// Mendukung array, Laravel paginator/resource, dan pembungkus data_siswa/data_guru.
export function normalizeCollection(payload, resource, requestedPage = 1) {
  getResourceContract(resource);
  const envelopes = [];
  let records = payload;

  for (let depth = 0; depth < 4 && !Array.isArray(records); depth += 1) {
    if (!records || typeof records !== "object") break;
    const responseStatus = nonNegativeInteger(records.status);
    if (responseStatus >= 400 && responseStatus <= 599) {
      const error = new Error(`Pengambilan ${resource} gagal (${responseStatus}).`);
      error.status = responseStatus;
      throw error;
    }
    envelopes.push(records);
    records = records[resource] ?? records.data;
  }

  if (!Array.isArray(records) || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
    throw new Error(`Format respons ${resource} harus berupa daftar data.`);
  }

  function metadata(key) {
    for (let index = envelopes.length - 1; index >= 0; index -= 1) {
      const value = envelopes[index].meta?.[key] ?? envelopes[index][key];
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  }

  const currentPage = Math.max(1, nonNegativeInteger(metadata("current_page")) ?? requestedPage);
  const lastPage = Math.max(currentPage, nonNegativeInteger(metadata("last_page")) ?? currentPage);
  const paginated = metadata("current_page") !== undefined || metadata("last_page") !== undefined;
  const total = nonNegativeInteger(metadata("total")) ?? (paginated ? null : records.length);

  return {
    // Simpan envelope dan seluruh field record dengan nama asli dari backend.
    payload,
    items: records,
    total,
    currentPage,
    lastPage,
  };
}

// Alias hanya untuk tampilan; objek backend tidak diubah atau dikirim ulang.
export function getPersonView(record, resource, page = 1, index = 0) {
  const contract = getResourceContract(resource);
  const student = resource === "data_siswa";
  const group = student ? record.kelas : record.mata_pelajaran ?? record.mapel;
  const groupName = typeof group === "object" && group !== null
    ? group.nama_kelas ?? group.nama_mapel ?? group.nama
    : group;

  return {
    id: record[contract.idField] ?? record.id ?? `${resource}-${page}-${index}`,
    name: record[contract.nameField] ?? record.nama ?? record.nama_guru ?? record.name ?? "-",
    identifier: record[contract.identifierField] ?? (student ? record.nisn ?? record.nis : record.nig ?? record.nip) ?? "-",
    description: groupName ?? (student ? record.nama_kelas : record.jabatan) ?? "-",
  };
}

export function getProfileView(profile) {
  // Profil harus berasal dari pengguna yang sedang login, bukan daftar siswa/guru.
  const record = profile?.data ?? profile ?? {};
  return {
    name: record.nama_siswa ?? record.nama ?? record.name,
    identifier: record.sn ?? record.nisn ?? record.nig ?? record.nip,
    status: record.status,
    type: record.type,
    birthDate: record.birthDate,
    address: record.address,
    phone: record.phone,
    photo: record.photo,
  };
}

export function formatCount(value) {
  return value === null || value === undefined ? "—" : numberFormatter.format(value);
}

export function createDashboardData({ students, teachers, profile, schoolName }) {
  function collectionStat(collection, label) {
    return {
      label,
      value: collection.loading && collection.total === null ? "…" : formatCount(collection.total),
      detail: collection.error
        ? "Gagal memuat data"
        : collection.loading
          ? "Memuat data..."
          : collection.total === null ? "Jumlah belum tersedia" : "Terdaftar",
    };
  }

  return {
    schoolName,
    dateLabel: new Intl.DateTimeFormat("id-ID", {
      weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
    }).format(new Date()),
    welcomeTitle: "Selamat Datang",
    welcomeSubtitle: getProfileView(profile).name || "Bpk/Ibu Admin Sekolah",
    welcomeDescription: "Berikut ringkasan data dan aktivitas sekolah untuk ditinjau.",
    stats: {
      students: collectionStat(students, "Siswa"),
      teachers: collectionStat(teachers, "Guru"),
      attendance: { value: "—", detail: "Belum tersedia", label: "Kehadiran" },
      extracurriculars: { value: "—", detail: "Belum tersedia", label: "Ekskul" },
    },
  };
}
