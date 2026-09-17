# Fondasi HTTP — T-05

Implementasi tersedia; tes HTTP/database/proses **belum dijalankan**, sesuai instruksi pemilik. Kode tidak menjadi bukti kelulusan perilaku. Daftar pekerjaan dan batas bukti ada di [bukti T-05](./evidence/t05-http-foundation.md).

## Startup dan layanan

`app.ts` mengekspor `createApp(dependencies)` tanpa membuka listener atau pool. `server.ts` memvalidasi environment, membuat pool runtime, merakit Elysia, dan membuka listener Bun privat. Modul route/service tidak menjalankan migrasi/fixture. `SITE_ORIGIN` dan `DATABASE_URL` runtime wajib; port default 3001 dan host default 127.0.0.1. Produksi memerlukan origin HTTPS tanpa path/userinfo. Error startup hanya mengirim event dan pesan generik, tanpa nilai konfigurasi atau exception provider.

Isi `.env.example` dengan runtime URL sendiri setelah [setup PostgreSQL](./database.md). Secret migrasi/test/operator tidak diberikan ke web/API. Konfigurasi S3 baru menjadi wajib ketika layanan media T-10 diimplementasikan; readiness saat ini tidak menghubungi storage.

Route yang aktif:

| Route | Hasil |
| --- | --- |
| `GET/HEAD /internal/bootstrap` | Envelope identitas nama/wilayah dari singleton DB; tidak lagi memakai konstanta sebagai fallback. Profil tidak sah adalah internal error; kegagalan DB adalah 503. |
| `GET/HEAD /health/live` | `{ "status": "ok" }`, tanpa kueri DB. |
| `GET/HEAD /health/ready` | Memeriksa setiap kolom pada 15 tabel, tiga singleton dan tujuh hari. 200 `ok` atau 503 `unavailable`, tanpa detail DB. |
| Path lain | 404 envelope; route fitur `/api/v1` didaftarkan melalui descriptor `HttpRoute`. |

Readiness memeriksa kompatibilitas baca schema melalui proyeksi Drizzle semua kolom (LIMIT 0) dan snapshot read-only REPEATABLE READ. Ini bukan audit hash migrasi, constraint/index, atau izin seluruh mutasi. Runtime tetap tidak diberi akses journal. Statement DB dibatasi lebih pendek dari deadline HTTP. Pemeriksaan koneksi DB terjadi saat request/readiness; konfigurasi valid tidak menjamin DB tersedia saat startup.

Health/bootstrap berada pada listener privat yang sama; reverse proxy harus memblokir `/health/*` dan `/internal/*` dari jaringan publik pada T-24. Endpoint login/admin/snapshot publik belum dibuat oleh T-05; tidak ada sesi semu atau endpoint echo produksi.

## Transport dan handler

Elysia memakai `strictPath: true` dan parser otomatis dinonaktifkan per route; body dibaca sekali oleh parser terbatas. Pendekatan ini mengikuti [Elysia lifecycle](https://elysiajs.com/essential/life-cycle) dan [konfigurasi strict path](https://elysiajs.com/patterns/configuration). Registrasi descriptor memberi dispatch metode, 405/Allow, dan HEAD untuk GET. Trailing slash tidak dialihkan.

- Setiap request mendapat UUID server baru, `X-Request-Id`, `Cache-Control` sesuai publik/privat, dan `nosniff`. Request ID dari klien tidak dipercaya.
- Query berulang/tidak dikenal ditolak. Nilai diteruskan sebagai string untuk schema route; tidak ada coercion JSON implisit. Handler memanggil `parseInput` untuk schema request strict dan `jsonResponse` untuk schema keluaran. Input tidak sah menghasilkan 422; keluaran tidak sah menghasilkan 500.
- JSON dibatasi 65.536 byte, UTF-8 valid, Content-Type JSON. Multipart dibatasi 6.291.456 byte dan tepat satu part `file`. Ukuran dihitung dari stream, termasuk tanpa Content-Length; panjang deklarasi salah/terlalu besar ditolak. GET/DELETE tanpa descriptor body menolak body. File decode, format gambar dan batas 5 MiB milik schema/layanan media T-10.
- Hook `authorize` berjalan sebelum parsing query/body. T-06 memasang guard wajib namespace privat untuk Origin/header dan sesi PostgreSQL sebelum parsing; lihat [panduan auth](./auth.md). Verifikasi perilakunya belum dijalankan. Tidak ada CORS permisif.
- Deadline baca 3 detik, JSON/mutasi 10 detik, multipart 60 detik. Sinyal dibatalkan saat timeout/disconnect dan reader body dihentikan. Handler/service menerima `AbortSignal`; operasi database yang sedang berjalan dibatasi statement timeout dan diperiksa sinyalnya di antara kueri. Timeout HTTP **tidak membuktikan rollback** bagi mutasi yang nanti ditambahkan.
- `HttpError` membawa union error katalog dan header pendukung. Error tak dikenal dipetakan ke `INTERNAL_ERROR` generik, bukan exception mentah. Kegagalan framework juga dibungkus. Bun menerapkan batas body global; kegagalan sebelum handler dapat berupa respons infrastruktur tanpa envelope sesuai standar API.

Log request memakai objek allowlist: waktu UTC, level, request ID, template route, metode yang dikenal, status, durasi dan kode error bila ada. URL/query aktual, params, cookie/header, body, connection string, error stack dan nilai form tidak diteruskan ke logger.

## Shutdown dan pengujian

SIGINT/SIGTERM menutup listener untuk request baru, menunggu drain maksimal 10 detik, memaksa koneksi aktif berhenti jika perlu, kemudian menutup pool. Pemanggilan shutdown berulang memakai Promise yang sama. Drain/force mengikuti [Bun Server.stop](https://bun.com/reference/bun/Server/stop). Handler yang mengabaikan signal tidak mendapat jaminan efek dibatalkan; layanan mutasi tetap harus mengikuti aturan transaksi/receipt.

Suite tertulis `apps/api/tests/http.test.ts` menggunakan `Elysia.handle` dan dependency fixture, termasuk body stream, batas byte, parser, envelope, request ID, route/query, log, timeout, environment dan lifecycle. Ini menguji boundary tanpa jaringan nyata; bukan bukti proxy/HTTPS atau PostgreSQL. Jalankan `bun run test:http` hanya sesudah mendapat persetujuan tes. Dua skenario readiness nyata ditambahkan ke `test:db` untuk schema lengkap/kolom hilang, juga belum dijalankan.

Runner smoke dan Playwright kini mensyaratkan `TEST_DATABASE_URL` runtime pada database test dengan bootstrap asli yang sudah dimigrasi. Jangan memakai database produksi. Unit kontrak T-03 dan integrasi T-04 tetap tertunda. CI tetap manual; workflow/Dockerfile bootstrap lama belum menyediakan database test sehingga integrasi/E2E memerlukan provisioning sebelum dapat lulus, tanpa auto-skip.
