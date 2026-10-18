import test from "node:test";
import assert from "node:assert/strict";
import { buildTeacherPayload, buildTeacherSearchParams, getTeacherError, normalizeCreatedTeacher } from "../src/services/teachers.js";
import { getTeacherCard, normalizeTeachersList } from "../src/pages/TeachersPage/teacherData.js";

const teacher = { nama: " Jaka Subagya, S.Pd. ", nip: " 00010029091 ", mata_pelajaran: " Matematika ", sn: " 000123 " };

test("payload tambah guru memakai nama backend dan mempertahankan NIP/SN sebagai string", () => {
  assert.deepEqual(buildTeacherPayload({ ...teacher, id_guru: "999", is_admin: true, type: "admin" }), {
    nama: "Jaka Subagya, S.Pd.", nip: "00010029091", mata_pelajaran: "Matematika", sn: "000123", status: "ACTIVE", type: "guru",
  });
  assert.equal(Object.hasOwn(buildTeacherPayload({ ...teacher, sn: " " }), "sn"), false);
});

test("nama/NIP/mapel wajib diisi dan NIP/SN numerik ditolak sebelum request", () => {
  for (const field of ["nama", "nip", "mata_pelajaran"]) {
    assert.throws(() => buildTeacherPayload({ ...teacher, [field]: " " }), (error) => Boolean(getTeacherError(error).fields[field]));
  }
  for (const field of ["nip", "sn"]) {
    assert.throws(() => buildTeacherPayload({ ...teacher, [field]: 123 }), (error) => Boolean(getTeacherError(error).fields[field]));
  }
  assert.throws(() => buildTeacherPayload(null), (error) => Boolean(getTeacherError(error).fields.nama));
});

test("pencarian guru hanya mengirim search dan halaman yang valid", () => {
  assert.deepEqual(buildTeacherSearchParams({ search: " 00010029091 ", page: 2, type: "guru" }), { search: "00010029091", page: 2 });
  assert.deepEqual(buildTeacherSearchParams(), { page: 1 });
  assert.throws(() => buildTeacherSearchParams({ page: 0 }));
  assert.throws(() => buildTeacherSearchParams({ search: 123 }));
});

test("daftar guru menerima paginator Laravel serta mempertahankan seluruh record backend", () => {
  const record = { id_guru: "001", nama: "Jaka", nip: "000123", mata_pelajaran: "Matematika", tambahan: { nilai: null } };
  const payload = { data: { data: [record], current_page: 2, last_page: 3, total: 13 } };
  const result = normalizeTeachersList(payload);
  assert.equal(result.items[0], record);
  assert.equal(result.payload, payload);
  assert.equal(result.currentPage, 2);
  assert.equal(result.lastPage, 3);
  assert.equal(result.total, 13);
  assert.equal(normalizeTeachersList({ data_guru: [record] }).items[0], record);
  assert.deepEqual(normalizeTeachersList([]).items, []);
});

test("kartu guru membedakan NIP, NIG, SN, mata pelajaran, dan status", () => {
  assert.deepEqual(getTeacherCard({ id_guru: "001", nama: "Jaka", nip: "000123", sn: "999", status: "ACTIVE", mata_pelajaran: "Matematika" }), {
    id: "001", name: "Jaka", identifierLabel: "NIP", identifier: "000123", subject: "Matematika", status: "Aktif", active: true,
  });
  assert.equal(getTeacherCard({ nig: "001" }).identifierLabel, "NIG");
  assert.equal(getTeacherCard({ sn: "002" }).identifierLabel, "SN");
  assert.equal(getTeacherCard({ mata_pelajaran: { nama_mapel: "Matematika" } }).subject, "Matematika");
  assert.equal(getTeacherCard({ mapel: [{ nama: "Fisika" }, "Kimia"] }).subject, "Fisika, Kimia");
  assert.equal(getTeacherCard({ status: "INACTIVE" }).status, "Nonaktif");
  assert.equal(getTeacherCard({}).subject, "—");
  assert.equal(getTeacherCard({}).status, "—");
});

test("respons kosong dan gagal tidak dianggap guru berhasil disimpan atau daftar kosong", () => {
  assert.equal(normalizeCreatedTeacher({ status: 201, data: { id_guru: "001" } }).record.id_guru, "001");
  assert.equal(normalizeCreatedTeacher({ message: "Berhasil" }).message, "Berhasil");
  for (const payload of [null, {}, [], { status: false }, { success: false }, { status: 422 }]) {
    assert.throws(() => normalizeCreatedTeacher(payload));
  }
  for (const payload of [null, {}, { data: null }, { data: [null] }, { status: false, data: [] }, { data: { success: false, data: [] } }]) {
    assert.throws(() => normalizeTeachersList(payload));
  }
});

test("error guru memetakan seluruh field validasi dan membedakan konflik, izin, serta sesi", () => {
  const errors = { nama: ["Nama wajib diisi."], nip: ["NIP sudah digunakan."], mata_pelajaran: "Mapel wajib diisi.", sn: ["Kartu sudah digunakan."] };
  assert.deepEqual(getTeacherError({ response: { status: 422, data: { errors } } }).fields, {
    nama: "Nama wajib diisi.", nip: "NIP sudah digunakan.", mata_pelajaran: "Mapel wajib diisi.", sn: "Kartu sudah digunakan.",
  });
  assert.match(getTeacherError({ response: { status: 409 } }, "save").message, /sudah digunakan/);
  assert.match(getTeacherError({ response: { status: 403 } }, "save").message, /izin menambah guru/);
  assert.match(getTeacherError({ response: { status: 401 } }).message, /login kembali/);
});
