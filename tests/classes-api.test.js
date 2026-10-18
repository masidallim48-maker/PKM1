import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient } from "../src/services/api.js";
import { classesApi } from "../src/services/classes.js";

const originalBaseURL = apiClient.defaults.baseURL;
const originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const record = { id_kelas: "001", nama_kelas: "X AKL", jumlah_siswa: 32, id_wali_kelas: "002", wali_kelas: { id_guru: "002", nama: "Bpk. Susanto" } };
const values = { nama_kelas: " X AKL ", id_wali_kelas: " 002 " };
let received, responseStatus, responsePayload, holdWrite, writeStarted;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const item = { method: req.method, url, headers: req.headers };
  received.push(item);
  res.setHeader("Content-Type", "application/json");
  if (!url.pathname.startsWith("/api/kelas") && url.pathname !== "/api/data_guru") { res.writeHead(404).end(); return; }
  if (req.method === "GET") {
    let fallback = { data: [record], current_page: Number(url.searchParams.get("page") || 1), last_page: 3 };
    if (url.pathname.startsWith("/api/kelas/")) fallback = { data: record };
    if (url.pathname === "/api/data_guru") {
      const page = Number(url.searchParams.get("page"));
      fallback = { data_guru: { data: [{ id_guru: `00${page}`, nama: `Guru ${page}` }], current_page: page, last_page: 2 } };
    }
    res.statusCode = responseStatus;
    res.end(JSON.stringify(responsePayload ?? fallback));
    return;
  }
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    item.body = JSON.parse(body);
    writeStarted?.();
    if (holdWrite) return;
    res.statusCode = responseStatus === 200 && req.method === "POST" ? 201 : responseStatus;
    res.end(JSON.stringify(responsePayload ?? { data: record }));
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
  holdWrite = false;
  writeStarted = undefined;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "classes-token" } });
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

test("daftar kelas mengirim GET search/page dan token serta membaca paginator", async () => {
  const result = await classesApi.list({ search: " X AKL ", page: 2 });
  assert.equal(received[0].method, "GET");
  assert.equal(received[0].url.pathname, "/api/kelas");
  assert.equal(received[0].url.searchParams.get("search"), "X AKL");
  assert.equal(received[0].url.searchParams.get("page"), "2");
  assert.equal(received[0].headers.authorization, "Bearer classes-token");
  assert.equal(result.currentPage, 2);
  assert.equal(result.lastPage, 3);
  assert.equal(result.items[0].id_kelas, "001");
});

test("tambah dan edit kelas memakai POST/PUT JSON dengan whitelist field dan ID string", async () => {
  await classesApi.create({ ...values, jumlah_siswa: 999 });
  await classesApi.update("001", values);
  assert.deepEqual(received.map((item) => [item.method, item.url.pathname]), [["POST", "/api/kelas"], ["PUT", "/api/kelas/001"]]);
  for (const item of received) {
    assert.deepEqual(item.body, { nama_kelas: "X AKL", id_wali_kelas: "002" });
    assert.equal(item.headers.authorization, "Bearer classes-token");
    assert.match(item.headers["content-type"], /application\/json/);
  }
});

test("detail meng-encode ID di URL dan menolak respons untuk kelas berbeda", async () => {
  responsePayload = { data: { ...record, id_kelas: "X/AKL ?" } };
  await classesApi.detail("X/AKL ?");
  assert.equal(received[0].url.pathname, "/api/kelas/X%2FAKL%20%3F");
  responsePayload = { data: { ...record, id_kelas: "002" } };
  await assert.rejects(classesApi.detail("001"), /ID pada respons/);
  await assert.rejects(classesApi.update("001", values), /ID pada respons/);
});

test("pilihan wali kelas memuat semua halaman guru dengan ID nol depan", async () => {
  const items = await classesApi.getTeachers();
  assert.deepEqual(items, [{ id: "001", name: "Guru 1" }, { id: "002", name: "Guru 2" }]);
  assert.deepEqual(received.map((item) => item.url.searchParams.get("page")), ["1", "2"]);
  assert.ok(received.every((item) => item.headers.authorization === "Bearer classes-token"));
});

test("validasi menghentikan request kelas yang tidak valid sebelum HTTP", async () => {
  await assert.rejects(classesApi.create({ nama_kelas: " " }));
  await assert.rejects(classesApi.update("001", { ...values, id_wali_kelas: 2 }));
  for (const id of ["", " ", "..", ".", 1]) await assert.rejects(classesApi.detail(id));
  await assert.rejects(classesApi.list({ page: 0 }));
  assert.equal(received.length, 0);
});

test("daftar/opsi kelas menolak record tanpa ID, halaman salah, dan error JSON HTTP 200", async () => {
  for (const payload of [{ data: [{ nama_kelas: "X AKL" }] }, { data: [record], current_page: 2 }, { success: false, data: [] }, { data: { status: 422, data: [] } }]) {
    responsePayload = payload;
    await assert.rejects(classesApi.list());
  }
  responsePayload = { data: [{ nama: "Guru tanpa ID" }] };
  await assert.rejects(classesApi.getTeachers(), /ID dan nama guru/);
});

test("HTTP gagal dan respons simpan tanpa record tidak menghasilkan sukses", async () => {
  for (const status of [401, 403, 404, 409, 422, 500]) {
    responseStatus = status;
    responsePayload = { errors: { nama_kelas: ["Tidak valid."] } };
    await assert.rejects(classesApi.create(values), (error) => error.response.status === status);
    await assert.rejects(classesApi.update("001", values), (error) => error.response.status === status);
    await assert.rejects(classesApi.detail("001"), (error) => error.response.status === status);
  }
  responseStatus = 200;
  for (const payload of [{ success: false }, { message: "Tanpa record" }, { data: { success: false } }]) {
    responsePayload = payload;
    await assert.rejects(classesApi.create(values));
    await assert.rejects(classesApi.update("001", values));
  }
});

test("request edit kelas yang sedang berjalan dapat dibatalkan", { timeout: 3000 }, async () => {
  holdWrite = true;
  const started = new Promise((resolve) => { writeStarted = resolve; });
  const controller = new AbortController();
  const cancelled = assert.rejects(classesApi.update("001", values, { signal: controller.signal }), axios.isCancel);
  await started;
  controller.abort();
  await cancelled;
});

test("AbortSignal diteruskan ke daftar, detail, dan pilihan guru", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(classesApi.list({}, { signal: controller.signal }), axios.isCancel);
  await assert.rejects(classesApi.detail("001", { signal: controller.signal }), axios.isCancel);
  await assert.rejects(classesApi.getTeachers({ signal: controller.signal }), axios.isCancel);
  assert.equal(received.length, 0);
});
