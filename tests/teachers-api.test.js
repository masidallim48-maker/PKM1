import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient } from "../src/services/api.js";
import { teachersApi } from "../src/services/teachers.js";

const originalBaseURL = apiClient.defaults.baseURL;
const originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let received, responseStatus, responsePayload, holdCreate, createStarted;
const values = { nama: " Jaka Subagya, S.Pd. ", nip: " 00010029091 ", mata_pelajaran: " Matematika ", sn: " 000123 " };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const item = { method: req.method, url, headers: req.headers };
  received.push(item);
  res.setHeader("Content-Type", "application/json");
  if (url.pathname !== "/api/data_guru") { res.writeHead(404).end(); return; }
  if (req.method === "GET") { res.statusCode = responseStatus; res.end(JSON.stringify(responsePayload ?? { data: [] })); return; }
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    item.body = JSON.parse(body);
    createStarted?.();
    if (holdCreate) return;
    res.statusCode = responseStatus === 200 ? 201 : responseStatus;
    res.end(JSON.stringify(responsePayload ?? { status: 201, message: "Berhasil", data: { id_guru: "001" } }));
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
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "teachers-token" } });
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

test("daftar guru mengirim search/page melalui GET Axios dan token sesi", async () => {
  await teachersApi.list({ search: " 00010029091 ", page: 2 });
  assert.equal(received[0].method, "GET");
  assert.equal(received[0].url.searchParams.get("search"), "00010029091");
  assert.equal(received[0].url.searchParams.get("page"), "2");
  assert.equal(received[0].headers.authorization, "Bearer teachers-token");
});

test("tambah guru mengirim POST JSON ke endpoint guru dengan payload dan Bearer token", async () => {
  const result = await teachersApi.create(values);
  assert.equal(result.record.id_guru, "001");
  assert.equal(received[0].method, "POST");
  assert.equal(received[0].headers.authorization, "Bearer teachers-token");
  assert.match(received[0].headers["content-type"], /application\/json/);
  assert.deepEqual(received[0].body, { nama: "Jaka Subagya, S.Pd.", nip: "00010029091", mata_pelajaran: "Matematika", sn: "000123", status: "ACTIVE", type: "guru" });
});

test("validasi nama/NIP/mapel menghentikan request guru yang tidak valid", async () => {
  await assert.rejects(teachersApi.create({ ...values, nip: 123 }));
  await assert.rejects(teachersApi.create({ ...values, mata_pelajaran: " " }));
  await assert.rejects(teachersApi.list({ page: 0 }));
  assert.equal(received.length, 0);
});

test("error HTTP dan pembungkus JSON guru tetap diteruskan sebagai kegagalan", async () => {
  for (const status of [401, 403, 409, 422, 500]) {
    responseStatus = status;
    responsePayload = { message: "Ditolak", errors: { nip: ["Periksa NIP."] } };
    await assert.rejects(teachersApi.create(values), (error) => error.response.status === status);
    await assert.rejects(teachersApi.list(), (error) => error.response.status === status);
  }
  responseStatus = 200;
  responsePayload = { status: false, data: [] };
  await assert.rejects(teachersApi.list(), (error) => error.response.status === 422);
});

test("request tambah guru yang sedang berjalan dapat dibatalkan", { timeout: 3000 }, async () => {
  holdCreate = true;
  const started = new Promise((resolve) => { createStarted = resolve; });
  const controller = new AbortController();
  const cancelled = assert.rejects(teachersApi.create(values, { signal: controller.signal }), axios.isCancel);
  await started;
  controller.abort();
  await cancelled;
});

test("pembatalan pencarian guru diteruskan melalui AbortSignal tanpa request tambahan", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(teachersApi.list({ search: "Jaka" }, { signal: controller.signal }), axios.isCancel);
  assert.equal(received.length, 0);
});
