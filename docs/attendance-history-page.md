# Riwayat Absensi

Halaman `src/pages/AttendanceHistoryPage/AttendanceHistory.jsx` dibuka dari menu sidebar **Riwayat Absensi**. Header, sidebar, menu profil, dan navigasi bawah memakai komponen dashboard yang sama. Tampilan mengikuti referensi: kartu judul/tanggal, filter kelas dan tanggal, lalu daftar nomor, nama siswa, dan status kehadiran.

Tanggal awal adalah hari ini di Asia/Jakarta (WIB). Judul tanggal mengikuti tanggal yang dipilih. Filter kelas awal **Semua kelas**; nama dan ID kelas diambil dari API. Tidak ada data siswa/kelas contoh dalam aplikasi. Perubahan filter mengulang dari halaman pertama, membatalkan request sebelumnya, dan menyembunyikan hasil lama saat memuat. Loading, data kosong, validasi, error, dan tombol coba lagi disediakan. Daftar kelas dan riwayat dimuat secara terpisah; kegagalan daftar kelas tidak menghapus riwayat semua kelas.

## Konfigurasi

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_CLASSES_ENDPOINT=/api/kelas
VITE_ATTENDANCE_HISTORY_ENDPOINT=/api/absensi/riwayat
```

Konfigurasi aktif berada di `.env.local`, dan contohnya di `.env.example`. Restart Vite setelah perubahan. `src/services/attendanceHistory.js` memakai Axios instance yang sama melalui `src/services/api.js`: timeout 15 detik, `Accept: application/json`, dan `Authorization: Bearer <auth_token>` jika sudah login. Halaman ini hanya menjalankan GET.

## GET /api/kelas

```json
{
  "status": 200,
  "data": [
    { "id_kelas": "001", "nama_kelas": "X-AKL" },
    { "id_kelas": "002", "nama_kelas": "XI-AKL" }
  ]
}
```

ID dan nama wajib tersedia. Alias `id`/`nama` juga didukung; ID string dipertahankan termasuk nol di depan. Respons berupa array langsung atau `{ "kelas": [...] }` juga diterima. Bila memakai paginator Laravel, client mengambil `?page=1` sampai `last_page` agar pilihan kelas lengkap. Setiap halaman perlu mengembalikan `current_page` yang sesuai. Semua record kelas asli tersedia pada `option.record`.

## GET /api/absensi/riwayat

Contoh request:

```http
GET /api/absensi/riwayat?id_kelas=001&tanggal=2026-08-12&page=1
Accept: application/json
Authorization: Bearer <token-dari-login>
```

| Query | Keterangan |
| --- | --- |
| `id_kelas` | ID kelas string; dihilangkan untuk semua kelas |
| `tanggal` | Wajib, tanggal kalender valid dalam format `YYYY-MM-DD`, mengikuti hari sekolah/WIB |
| `page` | Bilangan bulat positif, awal 1 |

Nama query dipusatkan di `HISTORY_FILTER_FIELDS`. Backend menerapkan filter dan hak akses berdasarkan token. Data yang diharapkan adalah satu baris per siswa untuk tanggal tersebut, dengan status kehadiran yang sudah ditentukan backend.

Respons HTTP 200:

```json
{
  "status": 200,
  "data": [
    { "id_absensi": "1", "id_siswa": "001", "nama_siswa": "Akbar Maulana", "status_kehadiran": "hadir" },
    { "id_absensi": "2", "id_siswa": "002", "nama_siswa": "Edwin Azis Permana", "status_kehadiran": "hadir" },
    { "id_absensi": "3", "id_siswa": "003", "nama_siswa": "Irhanda Ari Ramadhan", "status_kehadiran": "izin" }
  ]
}
```

Array langsung atau `{ "riwayat": [...] }` juga didukung. Nama membaca `nama_siswa`, `nama`, atau relasi `siswa.nama_siswa`/`siswa.nama`. Status membaca `status_kehadiran`, lalu `status`. Nilai `hadir`, `izin`, `sakit`, `alpa`/`alpha`, dan `terlambat` dipetakan ke label tampilan; status lain dipertahankan. Status yang tidak ada ditampilkan sebagai `—`, bukan dianggap hadir. Objek respons dan record asli tetap dipertahankan di hasil service.

Untuk pagination Laravel, kembalikan `current_page` dan `last_page`, dengan `from` atau `per_page` agar nomor baris berlanjut antarahalaman. Metadata dapat berada pada paginator langsung, `meta`, atau pembungkus `data`:

```json
{
  "data": [{ "id_absensi": "26", "nama_siswa": "Andi", "status_kehadiran": "hadir" }],
  "meta": { "current_page": 2, "last_page": 3, "per_page": 25, "from": 26 }
}
```

Tanpa `from`/`per_page`, nomor baris dimulai dari 1 pada tiap halaman. Tanpa metadata pagination, seluruh array dianggap satu halaman. Array kosong valid menampilkan pesan belum ada riwayat; respons rusak/HTML dan kegagalan JSON tidak dianggap data kosong.

## Validasi dan error

Contoh HTTP 422:

```json
{
  "message": "Filter tidak valid.",
  "errors": {
    "id_kelas": ["Kelas tidak tersedia."],
    "tanggal": ["Tanggal tidak valid."],
    "page": ["Halaman tidak valid."]
  }
}
```

HTTP 401 menampilkan sesi berakhir, 403 akses ditolak, 429 terlalu banyak permintaan, sedangkan timeout/jaringan gagal menyediakan coba lagi. Pembungkus dengan `status` 400–599, `status: false`, atau `success: false` tetap diperlakukan sebagai error meskipun HTTP 200.

```js
import { attendanceHistoryApi } from "../services/attendanceHistory.js";

const controller = new AbortController();
const classes = await attendanceHistoryApi.getClasses({ signal: controller.signal });
const history = await attendanceHistoryApi.getHistory(
  { id_kelas: "001", tanggal: "2026-08-12", page: 1 },
  { signal: controller.signal },
);
// history.items, history.payload, history.currentPage, history.lastPage, history.offset
```

Proyek ini berisi frontend pemanggil API. Backend Laravel perlu menyediakan kedua route GET, memvalidasi token/filter, menentukan status kehadiran, memfilter data di server, dan mengizinkan origin frontend melalui CORS. Controller dan database Laravel tidak ada di proyek ini; integrasi backend asli perlu diverifikasi setelah route tersedia.
