import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient } from "../src/services/api.js";
import { studentsApi } from "../src/services/students.js";

const originalBaseURL = apiClient.defaults.baseURL;
const originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let received, responseStatus, responsePayload, holdCreate, createStarted;
const values = { nama_siswa: " Irhanda ", nis: " 000123 ", id_kelas: " 001 ", sn: " 000456 " };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const item = { method: req.method, url, headers: req.headers };
  received.push(item);
  res.setHeader("Content-Type", "application/json");
  if (url.pathname !== "/api/data_siswa") { res.writeHead(404).end(); return; }
  if (req.method === "GET") { res.statusCode = responseStatus; res.end(JSON.stringify(responsePayload ?? { data: [] })); return; }
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    item.body = JSON.parse(body);
    createStarted?.();
    if (holdCreate) return;
    res.statusCode = responseStatus === 200 ? 201 : responseStatus;
    res.end(JSON.stringify(responsePayload ?? { status: 201, message: "Berhasil", data: { id_siswa: "001" } }));
  });
});
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
  apiClient.defaults.proxy = false;
});
beforeEach(() => {
  received = [];
  responseStatus = 200;
  responsePayload = null;
  holdCreate = false;
  createStarted = undefined;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "students-token" } });
});
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});
after(async () => {
  apiClient.defaults.baseURL = originalBaseURL;
  apiClient.defaults.proxy = originalProxy;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("daftar siswa mengirim pencarian dan halaman melalui GET Axios dengan token", async () => {
  await studentsApi.list({ search: " 000123 ", page: 2 });
  assert.equal(received[0].method, "GET");
  assert.equal(received[0].url.searchParams.get("search"), "000123");
  assert.equal(received[0].url.searchParams.get("page"), "2");
  assert.equal(received[0].headers.authorization, "Bearer students-token");
});

test("tambah siswa mengirim POST JSON dengan field yang disiapkan dan token sesi", async () => {
  const result = await studentsApi.create(values);
  assert.equal(result.record.id_siswa, "001");
  assert.equal(received[0].method, "POST");
  assert.equal(received[0].headers.authorization, "Bearer students-token");
  assert.match(received[0].headers["content-type"], /application\/json/);
  assert.deepEqual(received[0].body, { nama_siswa: "Irhanda", nis: "000123", id_kelas: "001", sn: "000456", status: "ACTIVE", type: "siswa" });
});

test("validasi frontend tidak mengirim data siswa kosong atau NIS numerik", async () => {
  await assert.rejects(studentsApi.create({ ...values, nis: 123 }));
  await assert.rejects(studentsApi.create({ ...values, nama_siswa: " " }));
  await assert.rejects(studentsApi.list({ page: 0 }));
  assert.equal(received.length, 0);
});

test("HTTP validasi/izin/konflik dan kegagalan JSON tetap diteruskan sebagai error", async () => {
  for (const status of [401, 403, 409, 422, 500]) {
    responseStatus = status;
    responsePayload = { message: "Ditolak", errors: { nis: ["Periksa NIS."] } };
    await assert.rejects(studentsApi.create(values), (error) => error.response.status === status);
  }
  responseStatus = 200;
  responsePayload = { status: false, data: [] };
  await assert.rejects(studentsApi.list(), (error) => error.response.status === 422);
});

test("request tambah siswa yang berjalan mendukung AbortSignal", { timeout: 3000 }, async () => {
  holdCreate = true;
  const started = new Promise((resolve) => { createStarted = resolve; });
  const controller = new AbortController();
  const cancelled = assert.rejects(studentsApi.create(values, { signal: controller.signal }), axios.isCancel);
  await started;
  controller.abort();
  await cancelled;
});
