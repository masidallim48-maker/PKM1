# Halaman Data Kelas

Sidebar **Data Kelas** membuka `src/pages/ClassesPage/Classes.jsx`. Halaman mengikuti referensi: judul Informasi Kelas, panel pencarian dan **Tambah Data Kelas +**, lalu kartu nama kelas, jumlah siswa, wali kelas, **Detail**, dan **Edit**. Header dan navigasi bawah memakai komponen dashboard yang sama.

Pencarian nama kelas dijalankan di server setelah jeda 300 ms atau Enter. Pergantian pencarian mengembalikan halaman ke 1 dan membatalkan request sebelumnya. Tersedia loading, hasil kosong, error/coba lagi, dan pagination. Data contoh hanya dipakai dalam pengujian; aplikasi menampilkan data dari backend.

## Konfigurasi dan endpoint

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_CLASSES_ENDPOINT=/api/kelas
VITE_DATA_GURU_ENDPOINT=/api/data_guru
```

Sesuaikan `.env.local` dan restart Vite setelah mengubah konfigurasi. `src/services/classes.js` memakai Axios instance bersama, timeout 15 detik, `Accept: application/json`, dan `Authorization: Bearer <auth_token>` dari sesi login.

| Metode | Endpoint default | Kegunaan |
| --- | --- | --- |
| GET | `/api/kelas?search=X%20AKL&page=1` | Daftar dan pencarian nama kelas |
| POST | `/api/kelas` | Tambah kelas |
| GET | `/api/kelas/{id_kelas}` | Detail terbaru untuk modal detail/edit |
| PUT | `/api/kelas/{id_kelas}` | Simpan perubahan kelas |
| GET | `/api/data_guru?page=1` | Pilihan wali kelas, seluruh halaman diambil |

`search` opsional dan tidak dikirim bila kosong. `page` bilangan bulat positif. ID di URL di-encode dan identifier dipertahankan sebagai string, termasuk nol di depan. Endpoint `/api/kelas` yang sama juga digunakan oleh pilihan kelas pada Data Siswa dan Riwayat Absensi; GET tanpa `search` harus tetap didukung.

## Respons daftar dan detail

Contoh respons **GET daftar**, HTTP 200:

```json
{
  "status": 200,
  "data": [
    {
      "id_kelas": "001",
      "nama_kelas": "X AKL",
      "jumlah_siswa": 32,
      "id_wali_kelas": "002",
      "wali_kelas": { "id_guru": "002", "nama": "Bpk. Susanto" }
    }
  ],
  "current_page": 1,
  "last_page": 3,
  "total": 15
}
```

Array langsung, `{ "kelas": [...] }`, paginator Laravel di `data`, dan metadata resource di `meta` juga didukung. Record wajib mempunyai ID dan nama. Semua field asli dipertahankan pada `payload`/`items`.

Contoh respons **GET detail**, HTTP 200:

```json
{
  "data": {
    "id_kelas": "001",
    "nama_kelas": "X AKL",
    "jumlah_siswa": 32,
    "id_wali_kelas": "002",
    "wali_kelas": { "id_guru": "002", "nama": "Bpk. Susanto" }
  }
}
```

Objek langsung atau pembungkus `kelas` juga diterima. ID detail/edit harus sama dengan ID yang diminta. Detail menampilkan nama, jumlah siswa, dan wali kelas; tombol **Edit kelas** membuka form dengan nilai terbaru tersebut.

Alias tampilan: ID `id_kelas`/`id`, nama `nama_kelas`/`nama`, jumlah `jumlah_siswa`/`siswa_count`/`students_count`. Jumlah 0 tetap ditampilkan sebagai 0; jumlah yang tidak tersedia menjadi `—`, bukan panjang daftar siswa yang mungkin terpotong pagination. Nama wali membaca `nama_wali_kelas` atau `wali_kelas` (string atau relasi objek dengan `nama`/`nama_guru`/`name`). ID wali membaca `id_wali_kelas` atau `wali_kelas.id_guru`/`id`. Backend sebaiknya mengirim ID dan nama wali bersama agar form edit dapat mempertahankan penugasan.

## Request tambah dan edit

POST dan PUT mengirim JSON yang sama:

```json
{
  "nama_kelas": "X AKL",
  "id_wali_kelas": "002"
}
```

`nama_kelas` wajib berupa string tidak kosong. `id_wali_kelas` opsional, berupa string ID guru atau `null` bila belum ditentukan/dihapus penugasannya. Spasi tepi dipangkas. Frontend hanya mengirim kedua field tersebut; jumlah siswa dihitung backend dari data siswa.

Pilihan guru berasal dari GET `/api/data_guru` dan mendukung pagination. Record guru membutuhkan `id_guru`/`id` dan `nama`/`nama_guru`/`name`. Jika guru yang sedang ditugaskan tidak ada dalam hasil pilihan, form tetap mempertahankan ID dan nama dari detail kelas. Jika respons hanya memberi nama wali tanpa ID, pengguna perlu memilih kembali wali kelas agar penugasan tidak terhapus tanpa sengaja.

Respons sukses POST **HTTP 201** dan PUT **HTTP 200** wajib memuat record kelas tersimpan dengan ID dan nama, memakai bentuk yang sama seperti GET detail. Respons kosong/204 belum didukung. Setelah sukses, modal ditutup dan daftar dimuat ulang. Setelah tambah, pencarian direset; setelah edit, filter yang aktif dipertahankan. UI menahan pengiriman ganda dan tidak membuat kartu sukses sebelum respons server valid.

Contoh validasi **HTTP 422**:

```json
{
  "message": "Data kelas belum valid.",
  "errors": {
    "nama_kelas": ["Nama kelas sudah digunakan."],
    "id_wali_kelas": ["Guru yang dipilih tidak ditemukan."]
  }
}
```

Error field ditampilkan di bawah input dan nilai form dipertahankan. HTTP 401, 403, 404, 409, dan 429 mempunyai pesan tersendiri; koneksi gagal dan timeout juga ditangani. JSON `status: false`, `success: false`, atau status 400–599 tetap dianggap gagal meskipun HTTP 200. Modal mendukung Escape, fokus keyboard, dan pembatalan request baca saat ditutup. Selama penyimpanan, tombol penutup dan form dinonaktifkan. Setelah timeout, periksa data sebelum mencoba lagi karena server mungkin sudah menerima perubahan.

```js
import { classesApi } from "../services/classes.js";

const controller = new AbortController();
const options = { signal: controller.signal };
await classesApi.list({ search: "AKL", page: 1 }, options);
await classesApi.detail("001", options);
await classesApi.create({ nama_kelas: "X AKL", id_wali_kelas: "002" }, options);
await classesApi.update("001", { nama_kelas: "XI AKL", id_wali_kelas: null }, options);
```

Proyek ini hanya berisi frontend. Backend Laravel perlu menyediakan route/controller, validasi nama dan relasi guru, perhitungan jumlah siswa, pemeriksaan token/izin, database, dan CORS untuk GET/POST/PUT beserta header Authorization/Content-Type/Accept. Integrasi dengan backend asli perlu diverifikasi setelah route tersedia.
