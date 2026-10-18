# Halaman Data Siswa

Halaman `src/pages/StudentsPage/Students.jsx` dibuka melalui sidebar **Data Siswa**. Tampilan mengikuti referensi: kartu judul, panel hijau pencarian dan ringkasan, tombol **+ Data Siswa**, lalu kartu nama, NIS/NISN/SN, status, dan kelas. Header/sidebar/navigasi bawah tetap memakai dashboard yang sama.

Pencarian nama atau NIS dijalankan di backend setelah jeda 300 ms atau Enter, sehingga dapat mencari seluruh data, termasuk siswa pada halaman lain. Mengganti pencarian kembali ke halaman pertama; request lama dibatalkan dan hasil lama disembunyikan. Pagination Laravel, loading, data kosong, error, dan coba lagi didukung. Aplikasi tidak berisi siswa contoh.

## Konfigurasi Axios

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_SISWA_ENDPOINT=/api/data_siswa
VITE_CLASSES_ENDPOINT=/api/kelas
```

Konfigurasi aktif ada di `.env.local`; restart Vite setelah mengubahnya. `src/services/students.js` memakai Axios instance dari `src/services/api.js`, dengan timeout 15 detik, `Accept: application/json`, serta Bearer token `auth_token` bila tersedia.

## GET /api/data_siswa

```http
GET /api/data_siswa?search=000123&page=1
Authorization: Bearer <token-dari-login>
Accept: application/json
```

`search` opsional, dipangkas spasi tepinya dan dihilangkan bila kosong. Backend menerapkan pencarian `nama_siswa` atau `nis` terhadap seluruh data yang boleh diakses pengguna. `page` mulai dari 1. Query yang sama tetap dipakai saat pindah halaman.

Contoh respons:

```json
{
  "status": 200,
  "summary": { "total_siswa": 370, "total_kelas": 15 },
  "data": [
    {
      "id_siswa": "001",
      "nama_siswa": "Irhanda Ari Ramadhan",
      "nis": "000123",
      "sn": "000456",
      "id_kelas": "001",
      "kelas": { "id_kelas": "001", "nama_kelas": "X-AKL" },
      "status": "ACTIVE",
      "type": "siswa"
    }
  ],
  "current_page": 1,
  "last_page": 74,
  "total": 370
}
```

Array langsung, `{ "data_siswa": [...] }`, paginator Laravel di dalam `data`, dan metadata resource Laravel `meta` juga didukung. Semua field asli backend dipertahankan. Untuk respons pencarian, `total` adalah jumlah hasil yang cocok; `summary.total_siswa` dan `summary.total_kelas`, bila diberikan, tetap berisi jumlah global yang sesuai hak akses pengguna.

Ringkasan membaca `summary` dari backend. Jika belum tersedia, **Total Siswa** memakai `total` dari respons tanpa pencarian (atau jumlah array lengkap yang tidak dipaginasi) dan tetap dipertahankan selama pencarian; **Total Kelas** memakai jumlah seluruh pilihan kelas yang selesai dimuat dari `GET /api/kelas`. Nilai yang belum diketahui menampilkan `—`. Frontend tidak menghitung jumlah seluruh siswa/kelas dari satu halaman hasil pencarian.

Label kartu membedakan `nis`, `nisn`, dan `sn`; nomor kartu tidak dilabeli sebagai NIS. Nama kelas membaca relasi `kelas.nama_kelas`, `nama_kelas`, atau mencocokkan `id_kelas` dengan daftar kelas. `ACTIVE`/`aktif` ditampilkan **Aktif**, `INACTIVE`/`nonaktif` menjadi **Nonaktif**; status lain dipertahankan dan status yang tidak ada menjadi `—`.

## POST /api/data_siswa

Tombol **+ Data Siswa** membuka modal dengan nama siswa, NIS, kelas, dan nomor kartu (opsional). Pilihan kelas diambil dari `GET /api/kelas`, termasuk seluruh halaman bila dipaginasi; kontraknya sama dengan [Riwayat Absensi](attendance-history-page.md#get-apikelas).

Request default frontend:

```json
{
  "nama_siswa": "Irhanda Ari Ramadhan",
  "nis": "000123",
  "id_kelas": "001",
  "sn": "000456",
  "status": "ACTIVE",
  "type": "siswa"
}
```

Nama, NIS, dan ID kelas wajib berupa string tidak kosong. SN opsional; tidak dikirim bila kosong. Spasi tepi dipangkas, dan nol di depan identifier dipertahankan. Field input dipusatkan di `STUDENT_FIELDS`. Frontend mengirim status awal `ACTIVE` dan tipe `siswa`; backend tetap menentukan izin, validasi, dan nilai yang boleh disimpan.

Respons sukses HTTP **201**:

```json
{
  "status": 201,
  "message": "Data siswa berhasil ditambahkan.",
  "data": { "id_siswa": "002", "nama_siswa": "Irhanda Ari Ramadhan", "nis": "000123", "id_kelas": "001" }
}
```

Setelah sukses, modal ditutup, pencarian dikosongkan, dan daftar serta statistik dashboard dimuat ulang dari backend. Tidak ada penambahan kartu contoh sebelum konfirmasi server. Pengiriman ganda ditahan, kontrol dinonaktifkan saat menyimpan, dan request dapat dibatalkan saat halaman ditutup. Jika terjadi timeout, periksa data sebelum mencoba lagi karena server mungkin sudah menerima request.

HTTP **422** untuk validasi:

```json
{
  "message": "Data siswa belum valid.",
  "errors": {
    "nama_siswa": ["Nama siswa wajib diisi."],
    "nis": ["NIS sudah digunakan."],
    "id_kelas": ["Kelas tidak tersedia."],
    "sn": ["Nomor kartu sudah digunakan."]
  }
}
```

Error tampil pada field terkait, modal tetap terbuka, dan input dipertahankan. HTTP **409** menunjukkan konflik NIS/SN; **401**, **403**, **429**, timeout, dan jaringan gagal memiliki pesan yang sesuai. Respons JSON dengan status gagal tetap ditolak meskipun HTTP 200.

```js
import { studentsApi } from "../services/students.js";

const controller = new AbortController();
const payload = await studentsApi.list({ search: "Irhanda", page: 1 }, { signal: controller.signal });
const result = await studentsApi.create(
  { nama_siswa: "Irhanda Ari Ramadhan", nis: "000123", id_kelas: "001", sn: "000456" },
  { signal: controller.signal },
);
```

Proyek ini hanya menyediakan frontend pemanggil API. Backend Laravel perlu menyediakan GET dan POST di atas, mendukung field NIS/kelas, memvalidasi token dan izin tambah siswa, keunikan NIS/SN, serta CORS. Controller, migration, dan database Laravel tidak ada di proyek ini, sehingga integrasi backend asli perlu diverifikasi setelah endpoint tersedia.
