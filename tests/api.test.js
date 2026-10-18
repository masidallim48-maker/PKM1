import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import axios from "axios";
import { apiClient, dashboardApi, request } from "../src/services/api.js";
import { authApi, normalizeLoginResponse } from "../src/services/auth.js";
import { attendanceApi } from "../src/services/attendance.js";

const originalBaseURL = apiClient.defaults.baseURL;
const originalProxy = apiClient.defaults.proxy;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let receivedRequests = [];
let studentsStatus = 200;
let registerStatus = 201;
let registerPayload;
let token = null;
let slowRequestStarted;
let attendanceStatus;
let attendancePayload;
let holdAttendance;
let attendanceRequestStarted;

const server = createServer((incoming, response) => {
  const url = new URL(incoming.url, "http://localhost");
  const received = { url, method: incoming.method, headers: incoming.headers };
  receivedRequests.push(received);
  response.setHeader("Content-Type", "application/json");

  if (url.pathname === "/api/absensi") {
    let body = "";
    incoming.setEncoding("utf8");
    incoming.on("data", (chunk) => { body += chunk; });
    incoming.on("end", () => {
      received.body = JSON.parse(body);
      attendanceRequestStarted?.();
      if (holdAttendance) return;
      response.statusCode = attendanceStatus;
      response.end(JSON.stringify(attendancePayload));
    });
    return;
  }

  if (url.pathname === "/api/register") {
    let body = "";
    incoming.setEncoding("utf8");
    incoming.on("data", (chunk) => { body += chunk; });
    incoming.on("end", () => {
      received.body = JSON.parse(body);
      response.statusCode = registerStatus;
      response.end(JSON.stringify(registerPayload));
    });
    return;
  }

  if (url.pathname === "/api/login") {
    let body = "";
    incoming.setEncoding("utf8");
    incoming.on("data", (chunk) => { body += chunk; });
    incoming.on("end", () => {
      received.body = JSON.parse(body);
      response.end(JSON.stringify({
        status: 200,
        message: "Login berhasil",
        data: { token: "test-login-token", user: { id_guru: "1", nama: "Budi", sn: "001", type: "guru" } },
      }));
    });
    return;
  }

  if (url.pathname === "/api/slow") {
    slowRequestStarted?.();
    return; // Koneksi ditutup oleh abort atau timeout dari client.
  }
  if (url.pathname === "/api/empty") {
    response.writeHead(204).end();
    return;
  }
  if (url.pathname === "/api/invalid-json") {
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><html></html>");
    return;
  }
  if (url.pathname === "/api/data_siswa") {
    response.statusCode = studentsStatus;
    response.end(JSON.stringify(studentsStatus === 200 ? { data: [] } : { message: "Tidak diizinkan" }));
    return;
  }
  if (url.pathname === "/api/data_guru") {
    response.end(JSON.stringify({ data: [{ nama: "Ibu Sari" }] }));
    return;
  }
  response.writeHead(404).end(JSON.stringify({ message: "Not found" }));
});

before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  apiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
  apiClient.defaults.proxy = false;
});

beforeEach(() => {
  receivedRequests = [];
  studentsStatus = 200;
  registerStatus = 201;
  registerPayload = { status: 201, message: "Registrasi berhasil", data: { user: { nama: "Budi" } } };
  token = null;
  slowRequestStarted = undefined;
  attendanceStatus = 201;
  attendancePayload = { status: 201, message: "Absensi berhasil", data: { id_absensi: "1", sn: "00123" } };
  holdAttendance = false;
  attendanceRequestStarted = undefined;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, value: { getItem: (key) => key === "auth_token" ? token : null },
  });
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

test("Axios mengirim GET ke kedua endpoint dengan Bearer token dan parameter halaman", async () => {
  token = "test-token";
  const [students, teachers] = await Promise.all([
    dashboardApi.getStudents({ page: 2 }), dashboardApi.getTeachers(),
  ]);
  assert.deepEqual(students, { data: [] });
  assert.equal(teachers.data[0].nama, "Ibu Sari");
  const studentRequest = receivedRequests.find(({ url }) => url.pathname === "/api/data_siswa");
  const teacherRequest = receivedRequests.find(({ url }) => url.pathname === "/api/data_guru");
  assert.equal(studentRequest.url.searchParams.get("page"), "2");
  assert.equal(teacherRequest.url.searchParams.get("page"), "1");
  for (const incoming of receivedRequests) {
    assert.equal(incoming.method, "GET");
    assert.equal(incoming.headers.accept, "application/json");
    assert.equal(incoming.headers.authorization, "Bearer test-token");
  }
});

test("interceptor membaca perubahan dan penghapusan token pada request berikutnya", async () => {
  token = "token-awal";
  await dashboardApi.getStudents();
  token = "token-baru";
  await dashboardApi.getStudents();
  token = null;
  await dashboardApi.getStudents();
  assert.deepEqual(receivedRequests.map(({ headers }) => headers.authorization), [
    "Bearer token-awal", "Bearer token-baru", undefined,
  ]);
});

test("header Authorization eksplisit tidak ditimpa token dari storage", async () => {
  token = "storage-token";
  await request("/api/data_guru", { headers: { authorization: "Bearer explicit-token" } });
  assert.equal(receivedRequests[0].headers.authorization, "Bearer explicit-token");
});

test("login mengirim payload JSON melalui POST tanpa token sesi sebelumnya", async () => {
  token = "expired-token";
  const payload = await authApi.login({ username: " guru ", password: " secret ", type: "guru" });
  const incoming = receivedRequests[0];
  assert.equal(incoming.method, "POST");
  assert.equal(incoming.url.pathname, "/api/login");
  assert.match(incoming.headers["content-type"], /application\/json/);
  assert.equal(incoming.headers.authorization, undefined);
  assert.deepEqual(incoming.body, { username: "guru", password: " secret ", type: "guru" });
  const session = normalizeLoginResponse(payload);
  assert.equal(session.token, "test-login-token");
  assert.equal(session.user.sn, "001");
});

const registration = {
  nama: " Budi ", username: " guru ", type: "guru",
  password: " secret123 ", password_confirmation: " secret123 ",
};

test("registrasi mengirim POST /api/register sebagai JSON tanpa Bearer token lama", async () => {
  token = "expired-token";
  const payload = await authApi.register(registration);
  const incoming = receivedRequests[0];
  assert.equal(incoming.method, "POST");
  assert.equal(incoming.url.pathname, "/api/register");
  assert.match(incoming.headers["content-type"], /application\/json/);
  assert.equal(incoming.headers.accept, "application/json");
  assert.equal(incoming.headers.authorization, undefined);
  assert.deepEqual(incoming.body, { ...registration, nama: "Budi", username: "guru" });
  assert.equal(payload.status, 201);
  assert.equal(payload.data.user.nama, "Budi");
});

test("validasi registrasi gagal sebelum request dikirim", async () => {
  await assert.rejects(authApi.register({ ...registration, password_confirmation: "berbeda" }),
    (error) => error.status === 422);
  assert.equal(receivedRequests.length, 0);
});

test("endpoint registrasi meneruskan validasi HTTP dan menolak error JSON pada HTTP 200", async () => {
  const errors = { username: ["Username sudah digunakan."] };
  for (const httpStatus of [422, 200]) {
    registerStatus = httpStatus;
    registerPayload = { status: 422, message: "Data tidak valid", errors };
    await assert.rejects(authApi.register(registration), (error) => {
      assert.equal(error.response.status, 422);
      assert.deepEqual(error.response.data.errors, errors);
      return true;
    });
  }
});

test("registrasi mendukung pembatalan melalui AbortSignal", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(authApi.register(registration, { signal: controller.signal }), axios.isCancel);
  assert.equal(receivedRequests.length, 0);
});

test("absensi masuk dan pulang mengirim POST JSON melalui Axios dengan token sesi", async () => {
  token = "attendance-token";
  for (const jenis_absensi of ["masuk", "pulang"]) {
    const result = await attendanceApi.submit({ sn: " 00123 ", jenis_absensi });
    assert.equal(result.record.sn, "00123");
    const incoming = receivedRequests.at(-1);
    assert.equal(incoming.method, "POST");
    assert.equal(incoming.url.pathname, "/api/absensi");
    assert.equal(incoming.headers.authorization, "Bearer attendance-token");
    assert.equal(incoming.headers.accept, "application/json");
    assert.match(incoming.headers["content-type"], /application\/json/);
    assert.deepEqual(incoming.body, { sn: "00123", jenis_absensi });
  }
});

test("nomor kartu tidak valid tidak dikirim ke endpoint absensi", async () => {
  await assert.rejects(attendanceApi.submit({ sn: " ", jenis_absensi: "masuk" }),
    (error) => error.response.status === 422);
  assert.equal(receivedRequests.length, 0);
});

test("endpoint absensi mempertahankan error validasi, duplikat, dan kegagalan di dalam JSON", async () => {
  for (const status of [401, 403, 409, 422]) {
    attendanceStatus = status;
    attendancePayload = { message: "Absensi ditolak", errors: { sn: ["Periksa nomor kartu."] } };
    await assert.rejects(attendanceApi.submit({ sn: "00123", jenis_absensi: "masuk" }),
      (error) => error.response.status === status);
  }
  attendanceStatus = 200;
  attendancePayload = { status: 409, message: "Sudah tercatat" };
  await assert.rejects(attendanceApi.submit({ sn: "00123", jenis_absensi: "masuk" }),
    (error) => error.response.status === 409);
});

test("request absensi yang sedang berjalan dapat dibatalkan saat pindah halaman", { timeout: 3000 }, async () => {
  holdAttendance = true;
  const started = new Promise((resolve) => { attendanceRequestStarted = resolve; });
  const controller = new AbortController();
  const cancelled = assert.rejects(attendanceApi.submit(
    { sn: "00123", jenis_absensi: "masuk" }, { signal: controller.signal },
  ), axios.isCancel);
  await started;
  controller.abort();
  await cancelled;
});

test("HTTP 401/403 mempertahankan status error dan tidak menghalangi respons guru", async () => {
  for (const status of [401, 403]) {
    studentsStatus = status;
    const [students, teachers] = await Promise.allSettled([
      dashboardApi.getStudents(), dashboardApi.getTeachers(),
    ]);
    assert.equal(students.status, "rejected");
    assert.equal(students.reason.response.status, status);
    assert.equal(teachers.status, "fulfilled");
    assert.equal(teachers.value.data[0].nama, "Ibu Sari");
  }
});

test("respons HTML dari route yang salah ditolak sebagai JSON tidak valid", async () => {
  await assert.rejects(request("/api/invalid-json"), (error) => error.code === "ERR_BAD_RESPONSE");
});

test("request tanpa isi menangani HTTP 204", async () => {
  assert.equal(await request("/api/empty"), null);
});

test("AbortController membatalkan request Axios yang sedang berjalan", { timeout: 3000 }, async () => {
  const started = new Promise((resolve) => { slowRequestStarted = resolve; });
  const controller = new AbortController();
  const cancelled = assert.rejects(request("/api/slow", { signal: controller.signal }), axios.isCancel);
  await started;
  controller.abort();
  await cancelled;
});

test("server yang tidak merespons menghasilkan error timeout", { timeout: 3000 }, async () => {
  await assert.rejects(request("/api/slow", { timeout: 50 }), (error) => error.code === "ECONNABORTED");
});
