# Bukti T-06 — Sesi admin dan perlindungan akses

Implementasi: 17 September 2026, branch `development`. Tidak ada dependency atau migrasi baru; memakai tabel sesi, akun dan throttle T-04 serta kontrak T-03.

## Perubahan

Endpoint login/session/logout, Argon2id, token acak dengan penyimpanan hash, cookie produksi/dev, expiry absolut/idle, guard namespace privat sebelum parsing, Origin/header aplikasi, throttle PostgreSQL atomik dengan Retry-After, account lock untuk koordinasi revokasi, dan job cleanup berbatas ukuran. Server memakai alamat peer koneksi, tidak mempercayai forwarded header. Detail dan batas operasional ada di [panduan auth](../auth.md).

## Bukti dan keterbatasan

| Pemeriksaan | Hasil |
| --- | --- |
| `bun run check` | Lulus; kontrak, API, web, tooling dan kode tes diperiksa. Svelte 0 error/0 warning. |
| `bun run lint` | Lulus pada kode final, termasuk batas import. |
| `bun run format:check` | Lulus. |
| `bun run check:source` | Lulus, 65 file authored. |
| `git diff --check` | Lulus. |
| Unit/auth/HTTP/database/integrasi/E2E | **Belum dijalankan**, sesuai instruksi pemilik. |
| Startup, HTTPS, migrasi, cleanup dan CI | **Belum dijalankan** pada task ini; CI tetap manual. |

Tes tertulis mencakup cookie dan origin/header, autentikasi sebelum upload/receipt, error logout tanpa Set-Cookie, pesan credential umum, hash-only storage, rotasi/revokasi, expiry dengan clock terkendali, counter paralel dan bertahan saat service dibuat ulang, reset saat verifikasi, cleanup serta transport HTTPS dengan DB nyata. Skenario throttle memakai verifier ringan untuk mengisolasi counter; kasus lain memakai Argon2id nyata. Kasus HTTPS belum membuktikan cookie jar browser. Keberadaan tes dan kelulusan pemeriksaan statis bukan bukti kelulusan perilaku.

T-06 tetap belum dicentang selesai sampai bukti perilaku tersedia. Provisioning/reset/disable operasional mengikuti T-07; deployment proxy dan scheduler belum dikonfigurasi. Batas sumber di belakang proxy masih teragregasi pada alamat peer proxy.
