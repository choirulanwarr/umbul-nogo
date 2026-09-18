# Akun operator — T-07

Implementasi tersedia; tes perilaku belum dijalankan. Perintah ini dijalankan operator dari checkout tepercaya di terminal interaktif dengan Bun dan dependency proyek terpasang. Database harus sudah dimigrasi. Tidak ada pendaftaran publik atau reset melalui email.

## Konfigurasi dan perintah

Sediakan `MIGRATION_DATABASE_URL` melalui fasilitas secret lingkungan operator, dengan role `umbul_migrator`. Jangan menaruh URL berkredensial pada command line, tiket, atau dokumen. Role API `umbul_runtime` tetap hanya boleh membaca akun; kredensial migrator tidak diberikan kepada proses API/web.

Dari root repo:

```sh
bun run admin:account create
bun run admin:account reset
bun run admin:account disable
```

CLI meminta email, lalu password dan pengulangan password untuk create/reset. Password harus 15–128 karakter, tidak di-trim, tidak ditampilkan, dan tidak diterima melalui argumen, pipe, environment password, atau seed. Email dinormalisasi menjadi huruf kecil. Terminal harus interaktif; Ctrl-C/EOF membatalkan prompt. Konfirmasi `YA` menyebutkan tindakan dan email sasaran sebelum koneksi mutasi dibuka.

- `create` membuat akun aktif dengan Argon2id. Email yang sudah ada ditolak tanpa mengubah akun tersebut.
- `reset` mengganti password, **mengaktifkan kembali akun**, dan mencabut seluruh sesi. Gunakan ini juga untuk pemulihan akun nonaktif.
- `disable` menonaktifkan akun dan mencabut seluruh sesi; akun tidak dihapus agar rujukan konten/audit tetap tersedia. Pengulangan disable tetap aman dan menghasilkan audit tindakan baru.

Reset/disable mengambil lock akun yang sama dengan autentikasi T-06. Perubahan akun, penghapusan sesi, dan audit committed dalam satu transaksi; kegagalan salah satunya membatalkan semua. Password di-hash sebelum mengambil lock. Login yang sedang memeriksa hash lama harus membaca ulang akun di bawah lock sebelum membuat sesi.

Audit database menyimpan action `operator.account.create|reset|disable`, ID akun sasaran, request ID, dan waktu. `actorId` null berarti tindakan CLI, bukan identitas admin web. Output sukses hanya event, ID akun, dan request ID. Audit/output tidak memuat email, password, hash, token, atau connection string. Catatan operator di luar aplikasi perlu menghubungkan request ID dengan operator yang bertugas; aplikasi belum membuktikan identitas manusia pemegang akses shell.

## Penyerahan dan pemulihan

1. Tetapkan penerima akun nyata dan operator pemulihan sebelum peluncuran. Keduanya belum ditetapkan pada task ini. Kontak Operasional di admin tidak otomatis membuat akun.
2. Buat akun melalui terminal privat. Serahkan password melalui kanal privat yang disepakati atau password manager; jangan melalui Git, log, atau tiket. Penerima sebaiknya memilih password sendiri saat provisioning didampingi operator.
3. Setelah persetujuan tes pemilik, periksa login melalui HTTPS dan kemampuan akses admin. UI admin masih bergantung T-16; pemeriksaan HTTP dapat memakai endpoint T-06. Catat hasil tanpa credential.
4. Jika akses hilang, verifikasi penerima melalui prosedur pengelola lalu jalankan reset. Jika akses harus dicabut, jalankan disable. Jangan menonaktifkan akun terakhir kecuali akses operator untuk pemulihan tersedia; CLI tetap mengizinkan pencabutan darurat semua akun.
5. Setelah reset, sesi lama harus ditolak dan penerima login kembali. Throttle login tidak dihapus oleh reset; tunggu jendela throttle bila dibatasi. Tidak ada pengiriman email otomatis atau kewajiban ganti password pada login pertama.

Jika koneksi terputus saat commit, hasil dapat belum diketahui. Operator dapat memeriksa akun dan audit melalui koneksi administratif tanpa membaca hash. Create ulang menolak duplikasi; reset/disable dapat diulang secara sengaja dengan audit baru. Jangan menganggap pesan gagal membuktikan rollback ketika hasil commit tidak diketahui.

Tidak ada akun nyata dibuat saat implementasi. Fixture akun integrasi memakai alamat `example.test` dan hanya dibuat dalam database test terisolasi. `bun run test:db` memuat skenario T-07 bersama T-04/T-06; setup/guard database mengikuti [panduan database](./database.md). Eksekusi tes dan uji terminal manual tetap memerlukan konfirmasi pemilik menurut [AGENTS.md](../AGENTS.md).
