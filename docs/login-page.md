# Halaman login

## Lokasi editing

| Yang ingin diubah | Lokasi |
| --- | --- |
| Seluruh tampilan login | `src/pages/LoginPage/Login.jsx` |
| Judul, nama sekolah, lokasi logo dan latar | Konstanta `LOGIN_CONTENT` di bagian atas `Login.jsx` |
| Tinggi banner, overlay, ukuran logo, judul sistem | Bagian komentar `EDIT BANNER` di `Login.jsx` |
| Kartu putih dan judul Selamat Datang | Bagian komentar `EDIT PANEL` di `Login.jsx` |
| Jarak, warna, ukuran field dan tombol | Bagian komentar `EDIT FORM` di `Login.jsx` |
| Pilihan Guru / Siswa / Wali Murid | `LOGIN_ROLES` di `src/services/auth.js` |
| Nama field request | `LOGIN_FIELDS` dan `buildLoginPayload` di `src/services/auth.js` |
| Link REGISTER dan form pendaftaran | `src/pages/LoginPage/Login.jsx`, bagian paragraf setelah tombol submit |
| Request registrasi | `REGISTER_FIELDS`, `buildRegisterPayload`, dan `authApi.register` di `src/services/auth.js` |
| Pembacaan respons backend | `normalizeLoginResponse` di `src/services/auth.js` |
| Penyimpanan sesi dan perpindahan login/dashboard | `src/services/auth.js` dan `src/App.jsx` |
| URL backend | `.env.local`, contoh tersedia di `.env.example` |
| Logo | `public/logodhakar.png` |
| Latar banner | `public/login-school.png` |

Saat development, buka `?page=login` untuk login atau `?page=register` untuk registrasi; URL tanpa parameter membuka preview dashboard. Pada hasil build, halaman awal tanpa `auth_token` menampilkan login. Sesi yang tersimpan membuka dashboard. Tombol keluar dashboard menghapus sesi lokal dan menampilkan login. Belum ada request logout server karena endpointnya belum diberikan.

## Endpoint login yang disiapkan

Kontrak di bawah adalah format awal frontend untuk endpoint login yang akan dibuat, dan dapat disesuaikan dengan controller backend.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_LOGIN_ENDPOINT=/api/login
```

Restart Vite setelah mengubah `.env.local`. Form mengirim `POST` JSON melalui Axios instance yang sama dengan dashboard. Request login tidak menyertakan Bearer token sesi sebelumnya.

```json
{
  "username": "contoh_guru",
  "password": "password_dari_form",
  "type": "guru"
}
```

Pilihan `type` sementara: `guru`, `siswa`, `wali_murid`. Nilai `wali_murid` belum dikonfirmasi dari backend. Sesuaikan `LOGIN_ROLES` jika backend menggunakan nama lain. Username dipangkas spasi di tepinya; isi password dikirim utuh. Nama field dapat diubah lewat `LOGIN_FIELDS` tanpa mengubah UI.

Respons berhasil yang disiapkan:

```json
{
  "status": 200,
  "message": "Login berhasil",
  "data": {
    "token": "token_dari_backend",
    "user": {
      "id_guru": "1",
      "nama": "Budi Santoso, S.Pd.",
      "sn": "1985010110",
      "type": "guru"
    }
  }
}
```

`token` dapat bernama `access_token`. `{ token, user }` tanpa pembungkus `data` juga didukung. `user` dapat memakai field siswa `id_siswa`/`nama_siswa`/`sn` atau struktur pengguna login lainnya. Data user dipertahankan sesuai respons backend. Frontend membutuhkan token yang tidak kosong sebelum masuk dashboard; tidak ada login contoh yang melewati backend.

Token disimpan sebagai `auth_token`, dan objek profil sebagai `auth_user`. Password tidak disimpan oleh frontend. Request dashboard selanjutnya memakai Bearer token. Backend tetap menentukan autentikasi dan hak akses pengguna; pilihan jenis akun pada form dikirim untuk diverifikasi backend.

Respons validasi HTTP 422:

```json
{
  "message": "Data login belum valid",
  "errors": {
    "username": ["Username wajib diisi."],
    "password": ["Password wajib diisi."],
    "type": ["Jenis akun tidak tersedia."]
  }
}
```

Error tersebut ditampilkan di field terkait. HTTP 401/403 menampilkan pesan kredensial tidak sesuai. Timeout dan koneksi gagal ditampilkan tanpa membuka dashboard. Jika backend menggunakan autentikasi cookie, alur CSRF/cookie perlu disesuaikan; konfigurasi awal memakai Bearer token.

## Registrasi akun

Paragraf **Belum punya akun? REGISTER** berada tepat di bawah tombol LOGIN. Link membuka form pendaftaran dengan nama lengkap, username, jenis akun, password, dan konfirmasi password. Di form registrasi, **Sudah punya akun? LOG IN** kembali ke login.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_REGISTER_ENDPOINT=/api/register
```

`authApi.register(values, { signal })` mengirim `POST` JSON melalui Axios tanpa Bearer token sesi lama. Endpoint dapat diubah lewat `.env.local`; restart Vite setelah mengubahnya. Nama field request dan pemetaan validasi Laravel dapat diubah di `REGISTER_FIELDS`.

Kontrak request default yang disepakati:

```json
{
  "nama": "Budi Santoso",
  "username": "contoh_guru",
  "type": "guru",
  "password": "password123",
  "password_confirmation": "password123"
}
```

Nama dan username wajib diisi, dengan spasi tepi dipangkas. `type` menggunakan pilihan yang sama dengan login: `guru`, `siswa`, `wali_murid`. Password minimal 8 karakter dan konfirmasi harus sama; spasi pada password dipertahankan. Backend tetap memvalidasi field, keunikan username, dan jenis akun yang boleh dibuat.

Respons berhasil: HTTP **201** (HTTP 200 juga didukung) dengan objek JSON, contoh:

```json
{
  "status": 201,
  "message": "Registrasi berhasil",
  "data": {
    "user": { "nama": "Budi Santoso", "username": "contoh_guru", "type": "guru" }
  }
}
```

Objek `{ "message": "Registrasi berhasil" }` juga didukung. Token tidak diperlukan untuk respons registrasi. Setelah sukses, form kembali ke login pada `?page=login`, menampilkan pesan berhasil, mempertahankan username/jenis akun, dan mengosongkan password. Tidak ada sesi yang dibuat otomatis oleh registrasi.

Respons validasi Laravel: HTTP **422**, dengan nama field yang sama seperti request:

```json
{
  "message": "Data pendaftaran belum valid",
  "errors": {
    "nama": ["Nama wajib diisi."],
    "username": ["Username sudah digunakan."],
    "type": ["Jenis akun tidak tersedia."],
    "password": ["Password minimal 8 karakter."],
    "password_confirmation": ["Konfirmasi password tidak cocok."]
  }
}
```

Validasi tampil pada field terkait. HTTP **409** ditangani sebagai konflik username, **401/403** sebagai pendaftaran yang tidak diizinkan, dan **429** sebagai terlalu banyak percobaan. Koneksi gagal dan timeout tetap menampilkan form agar dapat dicoba kembali. Pembungkus JSON dengan `status` 400–599, `status: false`, atau `success: false` ditolak meskipun HTTP mengembalikan 200. Request dapat dibatalkan saat halaman ditutup.

Proyek ini menyediakan frontend pemanggil API; kode Laravel tidak termasuk. Backend perlu menyediakan route `POST /api/register`, menyimpan akun, mengembalikan respons sesuai kontrak di atas, serta mengizinkan origin frontend melalui CORS.

## Aset banner

Logo berasal dari aset proyek yang sudah tersedia. `public/login-school.png` adalah ilustrasi foto lingkungan sekolah yang dibuat menggunakan built-in imagegen, bukan foto asli SMK Dharma Karya. Ganti file atau nilai `LOGIN_CONTENT.background` untuk menggunakan foto sekolah sebenarnya.

Prompt final yang digunakan:

> Use case: photorealistic-natural. Asset type: background photograph for a narrow mobile school login header, landscape 3:2 composition. Create a natural daytime editorial photograph of a modest Indonesian secondary-school courtyard, seen from an elevated first-floor corridor, with two- to three-storey off-white and pale aqua classroom buildings flanking a central courtyard, simple railings, tropical daylight and a flagpole. A few very small indistinct uniformed students in the courtyard are fine, no identifiable faces. Composition should show architecture on the left and right and an open middle distance. Natural real-world textures, slightly documentary quality. No text, no lettering, no logos, no watermarks, no UI, no decorative frames. The image will be cropped wide and given a dark teal overlay in CSS. This is an illustrative setting, not an actual named school. Save a project-usable raster file and return its local image path.
