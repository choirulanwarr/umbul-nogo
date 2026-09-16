# Bukti T-04 — PostgreSQL, schema, migrasi dan fixture

Tanggal: 16 September 2026. Branch: `development`. Lingkungan pemeriksaan statis: macOS arm64, Bun `1.4.0`, TypeScript `5.9.3`. Dependensi backend baru dipin Drizzle ORM `0.45.2` dan Kit `0.31.10`; lockfile diperbarui tanpa upgrade dependensi aplikasi sebelumnya.

## Hasil implementasi

- Schema Drizzle backend untuk 15 entitas desain. Nominal menggunakan integer, versi menggunakan bigint dengan batas aman JS, waktu kejadian menggunakan timestamptz dan jam lokal menggunakan time. Constraints mencakup singleton, rentang/pasangan field, status, durasi, FK media RESTRICT, keunikan email/token/upload/scope receipt, serta indeks baca/expiry/lease.
- SQL awal dihasilkan melalui Drizzle Kit bersama snapshot/journal. Migrasi custom berisi bootstrap minimal dan GRANT eksplisit. Nama/wilayah terkonfirmasi, versi 0, tanggal tiket null, Operasional null, tujuh hari unknown; koleksi dan akun tetap kosong.
- Factory pool Bun SQL/Drizzle tanpa side effect saat import, maksimal 10 koneksi runtime/1 migrasi dan fungsi close. Integrasi lifecycle HTTP/env/readiness menunggu T-05.
- Runner menggunakan loader migrasi Drizzle, transaksi, advisory lock, role migrasi khusus, dan pemeriksaan hash riwayat. DDL/seed/journal ditulis pada transaksi yang sama, tanpa mengandalkan transaksi tersarang stock migrator Bun SQL.
- Compose PostgreSQL 18 development/test memiliki database, port loopback dan volume terpisah. Init membuat role runtime/migrasi tanpa superuser; runtime tidak memiliki DDL/TEMP/TRUNCATE/journal dan tidak dapat menghapus singleton/jadwal atau mengelola akun. Tidak ada trigger tes otomatis pada Compose/CI.
- Fixture development berlabel dan tersembunyi, tanpa akun/kredensial/media fiktif. Target/identitas database dan kondisi awal diperiksa sebelum penulisan. Tidak ada DROP/TRUNCATE otomatis atau seed produksi fiktif.
- Suite `apps/api/tests/database.integration.test.ts` ditulis untuk PostgreSQL nyata; dependency hilang tidak di-skip. Database test harus kosong, kedua koneksi diverifikasi, dan cleanup hanya baris fixture ber-ID tetap setelah target diperiksa.

Panduan perintah, environment, pemisahan privilege, sumber teknis, dan pemulihan ada di [database.md](../database.md).

## Pemeriksaan dan batas bukti

| Aktivitas | Status |
| --- | --- |
| Instalasi dependency dengan `--ignore-scripts` | Selesai; ORM/Kit dipin sesuai kandidat desain. |
| Generator `db:generate` dan custom migration | Berkas untuk 15 tabel dan bootstrap dihasilkan tanpa koneksi DB. |
| `bun run check` | Lulus pada kode final setelah review runner; kontrak, API, web, tooling dan kode tes diperiksa. Svelte 0 error/0 warning. |
| `bun run lint` | Lulus pada kode final, termasuk batas import backend/browser. |
| `bun run format:check` | Lulus setelah format fixture dan suite database dirapikan. |
| `bun run check:source` | Lulus, 50 file authored. |
| `git diff --check` | Lulus. |
| Startup PostgreSQL/Compose | **Belum dijalankan**. |
| Penerapan migrasi/fixture pada DB | **Belum dijalankan**. |
| Unit/integrasi/E2E/CI | **Belum dijalankan**, sesuai instruksi pemilik untuk tidak menjalankan tes dulu. |

Skenario integrasi yang disiapkan: bootstrap seluruh field, rerun tanpa overwrite, commit lintas koneksi dan rollback atomik, penolakan DDL runtime, batas nominal/koordinat/versi, jadwal lintas hari, FK media, scope receipt dengan hash berbeda, penolakan perubahan journal, serta fixture tanpa perubahan timestamp publik. Ini daftar skenario tertulis, **bukan hasil lulus**.

Review SQL menemukan escape `+` pada regex telepon; sumber diganti dengan kelas karakter `[+]` lalu migrasi yang belum pernah diterapkan dihasilkan ulang. Review driver menemukan stock migrator memulai transaksi session sendiri; runner menggunakan loader berkas dan transaksi eksplisit untuk menjaga kepemilikan lock. Kedua perbaikan belum diuji perilakunya.

T-04 **belum dicentang selesai**: bukti PostgreSQL nyata (migrasi, commit/rollback, privileges, restart/rerun) belum tersedia, dan T-03 masih belum memiliki hasil unit test. Konfigurasi dan kode tersedia bukan bukti bahwa database telah berjalan. Minor/digest image PostgreSQL aktual dicatat ketika lingkungan benar-benar diprovisikan; saat ini Compose hanya menetapkan mayor 18. Validasi relasi/status media, snapshot konsisten, normalisasi penuh dan transaksi layanan tetap mengikuti T-05 dan tugas fitur berikutnya.
