# Sesi admin — T-06

Implementasi tersedia; tes belum dijalankan sesuai instruksi pemilik. Status bukti ada di [T-06](./evidence/t06-auth.md). Gunakan database yang sudah dimigrasi dengan role `umbul_runtime`, `SITE_ORIGIN` origin web yang tepat, dan `NODE_ENV=production` untuk cookie produksi. Provisioning/reset/disable akun adalah T-07; task ini tidak membuat akun atau password operasional.

## Kontrak HTTP

| Metode/path | Input dan hasil |
| --- | --- |
| POST `/api/v1/auth/login` | JSON `{email,password}`; envelope `SessionDto` dan cookie sesi baru; sesi cookie lama dicabut dalam transaksi yang sama. |
| GET `/api/v1/auth/session` | Cookie sesi; envelope `SessionDto`, aktivitas diperbarui; sesi tidak sah/kedaluwarsa menghasilkan 401. |
| POST `/api/v1/auth/logout` | JSON `{}`; cabut sesi server sebelum menghapus cookie; sesi hilang/kedaluwarsa tetap idempotent. Kegagalan DB menghasilkan 503 tanpa cookie sukses palsu. |

Semua namespace `/api/v1/auth` dan `/api/v1/admin` wajib mengirim `X-Umbul-Client: admin-web`. Metode selain GET/HEAD wajib mengirim `Origin` persis sama dengan `SITE_ORIGIN`; hilang, `null`, atau asing menghasilkan 403. Selain POST login/logout, guard memeriksa sesi aktif sebelum parser query/body, termasuk path upload/receipt yang akan ditambahkan berikutnya. Factory tanpa guard menolak namespace privat. Tidak ada polling frontend sesi pada task ini.

Cookie produksi: `__Host-umbul_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, tanpa Domain, `Max-Age=28800`. Dev HTTP memakai nama terpisah `umbul_session_dev` tanpa Secure. Token acak 32 byte hanya dikirim lewat cookie; DB menyimpan SHA-256 token, bukan token mentah. Cookie ganda bernama sama ditolak. Respons/log tidak memuat token, password atau hash password.

Password menggunakan Argon2id dengan memoryCost 65536 KiB dan timeCost 2. Akun tidak ditemukan tetap melewati verifikasi dummy hash; password salah/akun tidak aktif menghasilkan pesan umum yang sama. Email dinormalisasi oleh kontrak, password tidak di-trim. Referensi API: [Bun password hashing](https://bun.com/docs/runtime/hashing).

## Waktu, konkurensi, dan operasi

Sesi kedaluwarsa pada batas absolut 8 jam atau idle 30 menit, mana yang lebih awal. Akses privat yang lolos guard memperbarui aktivitas tanpa memperpanjang batas absolut. PostgreSQL menyerialkan aktivitas sesi; jam mundur tidak menurunkan `lastSeenAt`.

Throttle membatasi 5 percobaan/email dan 30 percobaan/alamat sumber per jendela 15 menit. Reservasi kedua counter dilakukan atomik sebelum verifikasi password, termasuk percobaan yang berhasil. Counter tersimpan di PostgreSQL sehingga tidak direset saat proses restart. Respons 429 menyertakan `Retry-After` dalam detik. Email/alamat sumber pada key counter di-hash.

Alamat sumber berasal dari `Bun.serve().requestIP`, bukan header Forwarded/X-Forwarded-For kiriman klien. Di belakang reverse proxy, alamat peer proxy menjadi bucket bersama: batas 30 percobaan berlaku gabungan. Topologi proxy dan penerusan identitas klien tepercaya perlu ditangani pada T-24 sebelum produksi; implementasi ini belum memisahkan pengguna di belakang proxy. Alamat peer yang tidak tersedia menyebabkan login 503.

Login, autentikasi dan logout menggunakan advisory transaction lock akun, melalui `lockAccounts` di `apps/api/src/auth/locks.ts`. T-07 wajib mengambil lock yang sama sebelum reset/disable dan pencabutan sesi. Transaksi mutasi konten berikutnya juga perlu memeriksa ulang status akun/sesi di bawah lock yang sama; guard HTTP awal saja tidak menjamin revokasi tidak terjadi sebelum commit. Login membaca ulang hash dan status setelah verifikasi password untuk menolak reset/disable yang terjadi selama hashing.

`bun run auth:cleanup` adalah job operasional dengan `DATABASE_URL` runtime, bukan tes. Satu eksekusi menghapus maksimal 1000 sesi kedaluwarsa dan 1000 counter kedaluwarsa, memakai `SKIP LOCKED`; output hanya jumlah. Jalankan dari scheduler operasional (misalnya setiap 10 menit), ulangi bila backlog masih ada. Scheduler belum dipasang. Pemeriksaan expiry tetap dilakukan pada setiap autentikasi sehingga tidak bergantung pada cleanup. Job belum dijalankan pada implementasi ini.

## Tes yang disiapkan

Semua perintah tes berikut memerlukan persetujuan pemilik terlebih dahulu:

- `bun run test:auth`: guard, cookie produksi/dev, origin/header, parsing setelah autentikasi, kegagalan logout dan alamat sumber.
- `bun run test:http`: regresi transport dengan dependency fixture eksplisit.
- `bun run test:db`: suite database nyata ditambah auth, hashing, expiry dengan clock terkendali, konkurensi throttle, pembuatan ulang service, reset/disable, cleanup dan HTTPS lokal. Setup database terisolasi mengikuti [panduan database](./database.md); guard URL/role dan opt-in tetap berlaku.

Kasus HTTPS memakai sertifikat sementara yang dibuat oleh `openssl`, dihapus setelah tes, dan hanya client fixture itu yang menerima sertifikat self-signed. Kasus tersebut memeriksa TLS, atribut Set-Cookie dan revokasi server; enforcement cookie oleh browser masih perlu E2E T-23. Belum ada klaim kelulusan tes atau kesiapan deployment.
