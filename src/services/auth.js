import { request } from "./api.js";

const env = import.meta.env ?? {};
const LOGIN_ENDPOINT = env.VITE_LOGIN_ENDPOINT || "/api/login";
const REGISTER_ENDPOINT = env.VITE_REGISTER_ENDPOINT || "/api/register";
const USER_STORAGE_KEY = "auth_user";

// Kontrak awal login: sesuaikan key dan nilai role ini dengan controller backend.
export const LOGIN_FIELDS = Object.freeze({
  username: "username",
  password: "password",
  type: "type",
});

export const REGISTER_FIELDS = Object.freeze({
  nama: "nama",
  username: "username",
  type: "type",
  password: "password",
  password_confirmation: "password_confirmation",
});

export const LOGIN_ROLES = Object.freeze([
  Object.freeze({ value: "guru", label: "Guru" }),
  Object.freeze({ value: "siswa", label: "Siswa" }),
  Object.freeze({ value: "wali_murid", label: "Wali Murid" }),
]);

function authValidationError(field, message, fields = LOGIN_FIELDS) {
  const error = new Error(message);
  error.status = 422;
  error.response = { status: 422, data: { errors: { [fields[field]]: [message] } } };
  return error;
}

function buildCredentialsPayload({ username, password, type }, fields) {
  if (typeof username !== "string" || !username.trim()) {
    throw authValidationError("username", "Username wajib diisi.", fields);
  }
  if (typeof password !== "string" || !password) {
    throw authValidationError("password", "Password wajib diisi.", fields);
  }
  if (!LOGIN_ROLES.some((role) => role.value === type)) {
    throw authValidationError("type", "Pilih jenis akun yang tersedia.", fields);
  }
  return {
    [fields.username]: username.trim(),
    [fields.password]: password,
    [fields.type]: type,
  };
}

export function buildLoginPayload(credentials) {
  return buildCredentialsPayload(credentials, LOGIN_FIELDS);
}

export function buildRegisterPayload({ nama, username, type, password, password_confirmation }) {
  if (typeof nama !== "string" || !nama.trim()) {
    throw authValidationError("nama", "Nama lengkap wajib diisi.", REGISTER_FIELDS);
  }
  const credentials = buildCredentialsPayload({ username, type, password }, REGISTER_FIELDS);
  if (password.length < 8) {
    throw authValidationError("password", "Password minimal 8 karakter.", REGISTER_FIELDS);
  }
  if (password_confirmation !== password) {
    throw authValidationError("password_confirmation", "Konfirmasi password tidak cocok.", REGISTER_FIELDS);
  }
  return {
    [REGISTER_FIELDS.nama]: nama.trim(),
    ...credentials,
    [REGISTER_FIELDS.password_confirmation]: password_confirmation,
  };
}

export const authApi = {
  login(credentials, { signal } = {}) {
    return request(LOGIN_ENDPOINT, {
      method: "post",
      data: buildLoginPayload(credentials),
      signal,
      // Login menggunakan kredensial form, tanpa token sesi sebelumnya.
      headers: { Authorization: null },
    });
  },
  async register(values, { signal } = {}) {
    const payload = await request(REGISTER_ENDPOINT, {
      method: "post",
      data: buildRegisterPayload(values),
      signal,
      headers: { Authorization: null },
    });
    return normalizeRegisterResponse(payload);
  },
};

export function normalizeRegisterResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Format respons registrasi belum sesuai.");
  }
  const status = Number(payload.status);
  if ((status >= 400 && status <= 599) || payload.success === false || payload.status === false) {
    const error = new Error("Registrasi belum berhasil.");
    const errorStatus = status >= 400 && status <= 599 ? status : 422;
    error.status = errorStatus;
    error.response = { status: errorStatus, data: payload };
    throw error;
  }
  return payload;
}

export function normalizeLoginResponse(payload) {
  const status = Number(payload?.status);
  if (status >= 400 && status <= 599) {
    const error = new Error("Login belum berhasil.");
    error.status = status;
    error.response = { status, data: payload };
    throw error;
  }

  const data = payload?.data ?? payload;
  const token = data?.token ?? data?.access_token ?? payload?.token ?? payload?.access_token;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Respons login belum memuat token sesi.");
  }
  const user = data?.user ?? payload?.user ?? null;
  if (user !== null && (typeof user !== "object" || Array.isArray(user))) {
    throw new Error("Format profil pada respons login belum sesuai.");
  }

  return { token, user, payload };
}

function getValidationFields(error, fieldNames) {
  const status = error.response?.status ?? error.status;
  const fields = {};
  const validation = error.response?.data?.errors;
  if (status === 422 && validation && typeof validation === "object") {
    for (const [field, backendField] of Object.entries(fieldNames)) {
      const value = validation[backendField];
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === "string") fields[field] = message;
    }
  }
  return fields;
}

export function getLoginError(error) {
  const status = error.response?.status ?? error.status;
  const fields = getValidationFields(error, LOGIN_FIELDS);
  let message = "Login belum berhasil. Silakan coba lagi.";
  if (status === 401 || status === 403) {
    message = "Username, password, atau jenis akun tidak sesuai.";
  } else if (status === 422) {
    message = "Periksa kembali data login Anda.";
  } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    message = "Server belum merespons. Silakan coba lagi.";
  } else if (error.code === "ERR_NETWORK") {
    message = "Tidak dapat terhubung ke server. Silakan coba lagi.";
  }
  return { message, fields };
}

export function getRegisterError(error) {
  const status = error.response?.status ?? error.status;
  const fields = getValidationFields(error, REGISTER_FIELDS);
  let message = "Registrasi belum berhasil. Silakan coba lagi.";
  if (status === 422) {
    message = "Periksa kembali data pendaftaran Anda.";
  } else if (status === 409) {
    message = "Username sudah digunakan. Silakan pilih username lain.";
  } else if (status === 401 || status === 403) {
    message = "Pendaftaran akun belum diizinkan. Silakan hubungi sekolah.";
  } else if (status === 429) {
    message = "Terlalu banyak percobaan. Silakan coba beberapa saat lagi.";
  } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    message = "Server belum merespons. Silakan coba lagi.";
  } else if (error.code === "ERR_NETWORK") {
    message = "Tidak dapat terhubung ke server. Silakan coba lagi.";
  }
  return { message, fields };
}

export function readAuthSession() {
  try {
    const storage = globalThis.localStorage;
    const token = storage?.getItem("auth_token");
    if (!token) return null;
    let user = null;
    try {
      user = JSON.parse(storage.getItem(USER_STORAGE_KEY) || "null");
    } catch {
      // Token tetap dapat dipakai jika cache profil belum tersedia.
    }
    if (!user || typeof user !== "object" || Array.isArray(user)) user = null;
    return { token, user };
  } catch {
    return null;
  }
}

export function saveAuthSession({ token, user }) {
  const storage = globalThis.localStorage;
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user ?? null));
  storage.setItem("auth_token", token);
}

export function clearAuthSession() {
  const storage = globalThis.localStorage;
  storage?.removeItem("auth_token");
  storage?.removeItem(USER_STORAGE_KEY);
}
