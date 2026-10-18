# Halaman Absensi

Halaman berada di `src/pages/AttendancePage/Attendance.jsx`. Sidebar **Absensi** dan tombol bawah **Scan Presensi** membuka halaman yang sama melalui navigasi lokal di `Dashbord.jsx`. Header, menu profil, sidebar, dan navigasi bawah tetap dipakai bersama. Jam/tanggal mengikuti waktu Asia/Jakarta dan diperbarui otomatis.

## Penggunaan

1. Pilih **Absen masuk** atau **Absen pulang**.
2. Tekan area scan atau tombol centang untuk mengaktifkan input kartu.
3. Tempelkan kartu pada reader USB/Bluetooth yang mengirim nomor kartu sebagai input keyboard dan Enter. Nomor kartu juga dapat diketik manual.
4. Enter atau tombol centang mengirim nomor kartu. Setelah berhasil, pesan server dan nama pengguna (jika dikirim) ditampilkan. Tekan area scan untuk kartu berikutnya.

Nomor kartu menggunakan `sn`, mengikuti kontrak siswa/guru yang sudah ada. Nomor tetap berupa string supaya nol di depannya terjaga. Membuka halaman atau mengganti jenis absensi tidak mengirim presensi. Input dan pilihan jenis dinonaktifkan selama penyimpanan; request ganda ditahan dan request dibatalkan saat meninggalkan halaman. Pengiriman ulang setelah hasil yang tidak pasti tetap perlu diperiksa backend agar tidak membuat record ganda.

## Endpoint Axios

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_ATTENDANCE_ENDPOINT=/api/absensi
```

Endpoint default adalah **POST /api/absensi**. Konfigurasi ada di `.env.local` dan contohnya di `.env.example`; restart Vite setelah perubahan. `src/services/attendance.js` memakai `request` dari `src/services/api.js`, sehingga base URL, timeout 15 detik, dan Bearer token `auth_token` mengikuti Axios instance yang sama dengan dashboard. Tidak ada token contoh yang dibuat untuk presensi.

```http
POST /api/absensi
Accept: application/json
Content-Type: application/json
Authorization: Bearer <token-dari-login>
```

```json
{
  "sn": "001051234561",
  "jenis_absensi": "masuk"
}
```

`sn` wajib berupa string tidak kosong; spasi tepi dipangkas. `jenis_absensi` hanya menerima `masuk` atau `pulang`. Nama field dipusatkan di `ATTENDANCE_FIELDS`, dan pilihan jenis di `ATTENDANCE_TYPES`. Frontend tidak mengirim ID pengguna, tanggal, atau status hadir yang dibuat sendiri; backend menentukan pemilik kartu, hak akses, waktu pencatatan, tanggal sekolah, dan hasil absensi.

Pemanggilan dari komponen lain:

```js
import { attendanceApi } from "../services/attendance.js";

const controller = new AbortController();
const result = await attendanceApi.submit(
  { sn: "001051234561", jenis_absensi: "masuk" },
  { signal: controller.signal },
);
// result.payload: seluruh JSON backend
// result.record: objek data absensi asli
// result.message: pesan yang ditampilkan
```

## Respons backend

Sukses: HTTP **201** (200 juga didukung).

```json
{
  "status": 201,
  "message": "Absensi masuk berhasil disimpan.",
  "data": {
    "id_absensi": "1",
    "sn": "001051234561",
    "nama_siswa": "Andi Pratama",
    "jenis_absensi": "masuk",
    "waktu": "2026-10-17T07:20:00+07:00"
  }
}
```

Record langsung dengan `id_absensi`/`id`, objek dengan `status: 200/201` atau `success: true`, serta `{ "message": "Absensi berhasil disimpan." }` juga diterima. Respons kosong, HTML, array, atau objek tanpa konfirmasi berhasil ditolak. `status` 400–599, `status: false`, dan `success: false` diperlakukan sebagai kegagalan meskipun HTTP 200. Tampilan nama membaca `nama_siswa`, `nama`, atau `user.nama` jika tersedia.

Validasi: HTTP **422**.

```json
{
  "message": "Data absensi tidak valid.",
  "errors": {
    "sn": ["Kartu belum terdaftar."],
    "jenis_absensi": ["Jenis absensi tidak sesuai."]
  }
}
```

| HTTP | Penanganan frontend |
| --- | --- |
| 401 | Sesi berakhir; login kembali |
| 403 | Tidak mempunyai izin melakukan absensi |
| 404 | Data presensi/kartu tidak ditemukan |
| 409 | Absensi sudah tercatat; tidak menampilkan sukses baru |
| 422 | Error ditampilkan pada field terkait |
| 429 | Tunggu sebelum mencoba kembali |
| 5xx / jaringan gagal / timeout | Pesan error; nilai kartu tetap tersedia |

Proyek ini berisi frontend pemanggil API. Backend Laravel perlu menyediakan route POST di atas, memvalidasi token dan kartu, menentukan urutan masuk/pulang, mencegah record ganda secara atomik, serta mengizinkan origin frontend melalui CORS. Database/controller Laravel tidak ada di proyek ini, sehingga penyimpanan ke backend asli perlu diverifikasi setelah endpoint tersedia.
