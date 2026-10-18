import test from "node:test";
import assert from "node:assert/strict";
import { buildResourcePayload, getResourceContract } from "../src/services/apiContracts.js";

test("payload siswa memakai field backend dan daftar field request yang diberikan", () => {
  const values = {
    id_siswa: "1", nama_siswa: "Andi", sn: "001051234561", status: "ACTIVE", type: "siswa",
    created_date: "2026-10-13 21:25:09", update_date: "Admin", name: "Alias UI",
  };
  const original = structuredClone(values);
  const payload = buildResourcePayload("data_siswa", values, ["nama_siswa", "sn"]);
  assert.deepEqual(payload, { nama_siswa: "Andi", sn: "001051234561" });
  assert.deepEqual(values, original);
});

test("payload guru mempertahankan null dan mengabaikan field yang tidak diberikan", () => {
  const payload = buildResourcePayload("data_guru", { nama: "Budi", sn: undefined, update_date: null }, ["nama", "sn", "update_date"]);
  assert.deepEqual(payload, { nama: "Budi", update_date: null });
  assert.equal(Object.hasOwn(payload, "type"), false);
});

test("field request dan resource yang belum memiliki kontrak harus ditentukan terlebih dahulu", () => {
  assert.throws(() => buildResourcePayload("data_siswa", { nama_siswa: "Andi" }), /validasi backend/);
  assert.throws(() => buildResourcePayload("data_siswa", {}, []), /validasi backend/);
  assert.throws(() => buildResourcePayload("data_siswa", { name: "Andi" }, ["name"]), /belum terdaftar/);
  assert.throws(() => buildResourcePayload("data_siswa", null, ["nama_siswa"]), /harus berupa objek/);
  assert.throws(() => getResourceContract("profile"), /belum tersedia/);
});
