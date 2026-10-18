# Halaman Data Guru

Halaman `src/pages/TeachersPage/Teachers.jsx` dibuka lewat sidebar **Data Guru**. Tampilan mengikuti referensi: judul dan pengantar, panel hijau pencarian nama/NIP dan tombol **+ Data Guru**, lalu kartu profil, status, dan mata pelajaran. Header, sidebar, serta navigasi bawah tetap memakai dashboard yang sama.

Pencarian dijalankan di server setelah jeda 300 ms atau Enter. Mengganti pencarian kembali ke halaman pertama, membatalkan request sebelumnya, dan menyembunyikan hasil lama. Loading, hasil kosong, error/coba lagi, serta pagination Laravel didukung. Tidak ada data guru contoh yang disisipkan ke aplikasi.

## Konfigurasi Axios

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DATA_GURU_ENDPOINT=/api/data_guru
```

Konfigurasi aktif ada di `.env.local`; restart Vite setelah perubahan. `src/services/teachers.js` memakai Axios instance dari `src/services/api.js`, termasuk timeout 15 detik, `Accept: application/json`, dan `Authorization: Bearer <auth_token>` jika sudah login.

## GET /api/data_guru

```http
GET /api/data_guru?search=00010029091&page=1
Authorization: Bearer <token-dari-login>
Accept: application/json
```

`search` opsional, dipangkas spasi tepinya, dan dihilangkan bila kosong. Backend menerapkan pencarian nama atau NIP terhadap seluruh data yang diizinkan bagi pengguna. `page` adalah bilangan bulat positif, mulai dari 1.

Respons HTTP 200:

```json
{
  "status": 200,
  "data": [
    {
      "id_guru": "001",
      "nama": "Jaka Subagya, S.Pd.",
      "nip": "00010029091",
      "sn": "000123",
      "mata_pelajaran": "Matematika",
      "status": "ACTIVE",
      "type": "guru"
    }
  ],
  "current_page": 1,
  "last_page": 3,
  "total": 18
}
```

Array langsung, `{ "data_guru": [...] }`, paginator Laravel di dalam `data`, dan metadata resource `meta` juga didukung. Semua field asli backend dipertahankan di `payload`/`items`.

Nama kartu membaca `nama`, `nama_guru`, atau `name`. Identifier memakai label **NIP** jika `nip` tersedia, **NIG** jika `nig` tersedia, atau **SN** untuk nomor kartu `sn`. Identifier tetap berupa string agar nol di depannya terjaga; SN tidak dilabeli sebagai NIP.

Mata pelajaran membaca `mata_pelajaran`, `mapel`, atau `nama_mapel`. String, relasi objek dengan `nama_mapel`/`nama`/`name`, serta array beberapa mata pelajaran didukung. `ACTIVE`/`aktif` menjadi **Aktif**; `INACTIVE`/`nonaktif` menjadi **Nonaktif**. Status lain dipertahankan dan field yang belum tersedia ditampilkan sebagai `—`.

## POST /api/data_guru

Tombol **+ Data Guru** membuka modal nama, NIP, mata pelajaran, dan SN opsional. Request default frontend:

```json
{
  "nama": "Jaka Subagya, S.Pd.",
  "nip": "00010029091",
  "mata_pelajaran": "Matematika",
  "sn": "000123",
  "status": "ACTIVE",
  "type": "guru"
}
```

Nama memakai key `nama` sesuai contoh respons guru yang sudah ada. Nama, NIP, dan mata pelajaran wajib berupa string tidak kosong. SN opsional dan tidak dikirim bila kosong. Spasi tepi dipangkas, tetapi NIP/SN tetap string. Nama field dapat disesuaikan di `TEACHER_FIELDS`. Kontrak awal mengirim mata pelajaran sebagai teks; backend yang memakai relasi ID perlu menyamakan kontrak request tersebut dengan frontend.

Respons sukses HTTP **201**:

```json
{
  "status": 201,
  "message": "Data guru berhasil ditambahkan.",
  "data": {
    "id_guru": "002",
    "nama": "Jaka Subagya, S.Pd.",
    "nip": "00010029091",
    "mata_pelajaran": "Matematika",
    "status": "ACTIVE",
    "type": "guru"
  }
}
```

Setelah konfirmasi berhasil dari server, modal ditutup, pencarian dikosongkan, dan daftar serta statistik dashboard dimuat ulang. Tidak ada kartu baru yang dibuat sebelum server merespons sukses. Pengiriman ganda ditahan dan kontrol dinonaktifkan selama penyimpanan. Jika timeout, periksa data sebelum mencoba lagi karena server mungkin sudah menerima request.

Validasi HTTP **422**:

```json
{
  "message": "Data guru belum valid.",
  "errors": {
    "nama": ["Nama guru wajib diisi."],
    "nip": ["NIP sudah digunakan."],
    "mata_pelajaran": ["Mata pelajaran wajib diisi."],
    "sn": ["Nomor kartu sudah digunakan."]
  }
}
```

Error ditampilkan di field terkait, input dipertahankan, dan modal tetap terbuka. HTTP **409** ditangani sebagai konflik NIP/SN, **401** sebagai sesi berakhir, **403** sebagai izin ditolak, dan **429** sebagai terlalu banyak permintaan. Koneksi gagal dan timeout memiliki pesan tersendiri. `status` 400–599, `status: false`, atau `success: false` pada JSON tetap ditolak meskipun HTTP 200.

```js
import { teachersApi } from "../services/teachers.js";

const controller = new AbortController();
const payload = await teachersApi.list({ search: "Jaka", page: 1 }, { signal: controller.signal });
const result = await teachersApi.create(
  { nama: "Jaka Subagya, S.Pd.", nip: "00010029091", mata_pelajaran: "Matematika", sn: "000123" },
  { signal: controller.signal },
);
```

Proyek ini berisi frontend pemanggil API. Backend Laravel perlu menyediakan GET dan POST di atas, mendukung field NIP/mapel/status, memvalidasi token dan izin tambah guru, menjamin keunikan NIP/SN, serta mengizinkan CORS. Controller, migration, dan database Laravel tidak ada di proyek ini; integrasi backend asli perlu diverifikasi setelah route tersedia.
