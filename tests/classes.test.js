import test from "node:test";
import assert from "node:assert/strict";
import { buildClassPayload, buildClassSearchParams, getClassError, getClassView, normalizeClassRecord } from "../src/services/classes.js";

test("payload kelas hanya mengirim nama dan ID wali kelas, mempertahankan nol di depan", () => {
  assert.deepEqual(buildClassPayload({ nama_kelas: " X AKL ", id_wali_kelas: " 001 ", jumlah_siswa: 32, id_kelas: "999", is_admin: true }), { nama_kelas: "X AKL", id_wali_kelas: "001" });
  for (const id_wali_kelas of [null, undefined, " "]) {
    assert.deepEqual(buildClassPayload({ nama_kelas: "X AKL", id_wali_kelas }), { nama_kelas: "X AKL", id_wali_kelas: null });
  }
});

test("nama kelas wajib diisi dan ID guru harus string atau null", () => {
  for (const values of [null, {}, { nama_kelas: " " }, { nama_kelas: 123 }]) {
    assert.throws(() => buildClassPayload(values), (error) => Boolean(getClassError(error).fields.nama_kelas));
  }
  assert.throws(() => buildClassPayload({ nama_kelas: "X AKL", id_wali_kelas: 1 }), (error) => Boolean(getClassError(error).fields.id_wali_kelas));
});

test("pencarian kelas dipangkas dan page harus bilangan bulat positif", () => {
  assert.deepEqual(buildClassSearchParams({ search: " X AKL ", page: 2, wali: "diabaikan" }), { search: "X AKL", page: 2 });
  assert.deepEqual(buildClassSearchParams(), { page: 1 });
  for (const values of [{ page: 0 }, { page: 1.5 }, { page: "1" }, { search: 12 }]) assert.throws(() => buildClassSearchParams(values));
});

test("kartu kelas memakai jumlah siswa dari server dan relasi wali kelas", () => {
  assert.deepEqual(getClassView({ id_kelas: "001", nama_kelas: "X AKL", jumlah_siswa: "32", wali_kelas: { id_guru: "002", nama: "Bpk. Susanto" } }), {
    id: "001", name: "X AKL", studentCount: 32, teacherId: "002", teacherName: "Bpk. Susanto",
  });
  assert.equal(getClassView({ siswa_count: 0 }).studentCount, 0);
  assert.equal(getClassView({ students_count: 10 }).studentCount, 10);
  assert.equal(getClassView({ id: 1, nama: "XI AKL", id_wali_kelas: "003", nama_wali_kelas: "Ibu Sri" }).teacherName, "Ibu Sri");
  assert.equal(getClassView({ wali_kelas: "Bpk. Susanto" }).teacherName, "Bpk. Susanto");
});

test("jumlah siswa yang belum tersedia atau tidak valid tetap tidak diketahui", () => {
  for (const jumlah_siswa of [undefined, null, "", -1, 1.5, "32 siswa", true]) assert.equal(getClassView({ jumlah_siswa }).studentCount, null);
  assert.equal(getClassView({ siswa: [{ id_siswa: "1" }] }).studentCount, null);
  assert.equal(getClassView({}).teacherName, "—");
});

test("detail kelas menerima envelope dan mempertahankan seluruh field asli", () => {
  const record = { id_kelas: "001", nama_kelas: "X AKL", tambahan: { nilai: null } };
  for (const payload of [record, { data: record }, { kelas: record }, { data: { kelas: record } }]) {
    const result = normalizeClassRecord(payload, "001");
    assert.equal(result.record, record);
    assert.equal(result.payload, payload);
  }
});

test("respons gagal, kosong, atau ID berbeda tidak dianggap detail/simpan berhasil", () => {
  for (const payload of [null, [], {}, { data: [] }, { data: { id_kelas: "001" } }, { status: false }, { success: false }, { status: 422 }, { data: { success: false } }]) {
    assert.throws(() => normalizeClassRecord(payload));
  }
  assert.throws(() => normalizeClassRecord({ id_kelas: "002", nama_kelas: "X AKL" }, "001"));
});

test("error kelas memetakan field Laravel serta membedakan sesi, izin, tidak ditemukan, dan konflik", () => {
  const errors = { nama_kelas: ["Nama sudah digunakan."], id_wali_kelas: "Guru tidak ditemukan." };
  assert.deepEqual(getClassError({ response: { status: 422, data: { errors } } }).fields, { nama_kelas: "Nama sudah digunakan.", id_wali_kelas: "Guru tidak ditemukan." });
  for (const [status, message] of [[401, /login kembali/], [403, /izin/], [404, /tidak ditemukan/], [409, /berbenturan/], [429, /Terlalu banyak/]]) {
    assert.match(getClassError({ response: { status } }).message, message);
  }
});
