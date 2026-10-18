import test from "node:test";
import assert from "node:assert/strict";
import { buildStudentPayload, buildStudentSearchParams, getStudentError, normalizeCreatedStudent } from "../src/services/students.js";
import { getStudentCard, normalizeStudentsList } from "../src/pages/StudentsPage/studentData.js";

const student = { nama_siswa: " Irhanda Ari Ramadhan ", nis: " 000123 ", sn: " 000456 ", id_kelas: " 001 " };

test("payload tambah siswa mempertahankan nol awal NIS, SN, dan ID kelas serta tidak menyalin field tambahan", () => {
  assert.deepEqual(buildStudentPayload({ ...student, id_siswa: "999", is_admin: true, status: "INACTIVE" }), {
    nama_siswa: "Irhanda Ari Ramadhan", nis: "000123", sn: "000456", id_kelas: "001", status: "ACTIVE", type: "siswa",
  });
  assert.equal(Object.hasOwn(buildStudentPayload({ ...student, sn: " " }), "sn"), false);
});

test("data wajib kosong dan identifier numerik ditolak sebelum penyimpanan", () => {
  for (const field of ["nama_siswa", "nis", "id_kelas"]) {
    assert.throws(() => buildStudentPayload({ ...student, [field]: " " }), (error) => Boolean(getStudentError(error).fields[field]));
  }
  for (const field of ["nis", "id_kelas", "sn"]) {
    assert.throws(() => buildStudentPayload({ ...student, [field]: 123 }), (error) => Boolean(getStudentError(error).fields[field]));
  }
});

test("pencarian hanya mengirim search dan page yang valid", () => {
  assert.deepEqual(buildStudentSearchParams({ search: " 000123 ", page: 2 }), { search: "000123", page: 2 });
  assert.deepEqual(buildStudentSearchParams({ search: " " }), { page: 1 });
  assert.throws(() => buildStudentSearchParams({ page: 0 }));
});

test("ringkasan global membaca summary backend dan tidak menghitung kelas dari satu halaman", () => {
  const records = [{ id_siswa: "001", nama_siswa: "Irhanda", nis: "000123" }];
  const payload = { summary: { total_siswa: "370", total_kelas: "15" }, data: records, current_page: 1, last_page: 74, total: 370 };
  const result = normalizeStudentsList(payload);
  assert.equal(result.payload, payload);
  assert.equal(result.items, records);
  assert.deepEqual(result.summary, { students: 370, classes: 15 });
  assert.deepEqual(normalizeStudentsList({ data: records }).summary, { students: null, classes: null });
  assert.deepEqual(normalizeStudentsList({ summary: { total_siswa: [], total_kelas: " " }, data: [] }).summary, { students: null, classes: null });
});

test("kartu siswa membedakan NIS, NISN, SN, status, dan nama kelas", () => {
  assert.deepEqual(getStudentCard({ id_siswa: "001", nama_siswa: "Irhanda", nis: "000123", sn: "999", status: "ACTIVE", kelas: { nama_kelas: "X-AKL" } }), {
    id: "001", name: "Irhanda", identifierLabel: "NIS", identifier: "000123", className: "X-AKL", status: "Aktif", active: true,
  });
  assert.equal(getStudentCard({ nisn: "001" }).identifierLabel, "NISN");
  assert.equal(getStudentCard({ sn: "002" }).identifierLabel, "SN");
  assert.equal(getStudentCard({ id_kelas: "001" }, [{ id: "001", name: "X-AKL" }]).className, "X-AKL");
  assert.equal(getStudentCard({ status: "INACTIVE" }).status, "Nonaktif");
  assert.equal(getStudentCard({}).status, "—");
});

test("sukses tambah siswa memerlukan konfirmasi server dan respons gagal tidak menjadi data kosong", () => {
  assert.equal(normalizeCreatedStudent({ status: 201, data: { id_siswa: "001" } }).record.id_siswa, "001");
  assert.equal(normalizeCreatedStudent({ message: "Berhasil" }).message, "Berhasil");
  for (const payload of [null, {}, [], { status: false }, { success: false }, { status: 422 }]) {
    assert.throws(() => normalizeCreatedStudent(payload));
  }
  assert.throws(() => normalizeStudentsList({ status: false, data: [] }));
  assert.throws(() => normalizeStudentsList({ data: null }));
});

test("error validasi dan konflik NIS dipetakan ke UI", () => {
  assert.deepEqual(getStudentError({ response: { status: 422, data: { errors: { nis: ["NIS sudah digunakan."], id_kelas: "Kelas tidak valid." } } } }).fields,
    { nis: "NIS sudah digunakan.", id_kelas: "Kelas tidak valid." });
  assert.match(getStudentError({ response: { status: 409 } }, "save").message, /sudah digunakan/);
  assert.match(getStudentError({ response: { status: 403 } }, "save").message, /izin menambah/);
  assert.match(getStudentError({ response: { status: 401 } }).message, /login kembali/);
});
