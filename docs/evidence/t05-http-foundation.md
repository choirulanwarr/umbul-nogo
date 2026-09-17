# Bukti T-05 — Fondasi HTTP, konfigurasi dan diagnosis

Implementasi: 17 September 2026, branch `development`. Bun `1.4.0`, Elysia `1.4.30`, Zod `4.5.4`, Drizzle `0.45.2`. Zod menjadi dependency langsung API pada versi yang sama dengan kontrak; tidak ada upgrade versi eksternal.

## Perubahan

Factory app terpisah dari listener; environment wajib dan error startup aman; route descriptor `/api/v1`; 404/405/Allow/HEAD; request ID server; cache publik/privat; mapper error; schema request/response; parser JSON/multipart terbatas stream; deadline dengan signal; log allowlist; health internal DB/schema; shutdown idempotent dengan batas drain dan penutupan pool.

Bootstrap sementara kini membaca profil DB. Readiness memeriksa 15 tabel/kolom dan bootstrap tanpa akses journal atau dependency storage. Startup web/API sekarang memerlukan konfigurasi dan DB yang dimigrasi untuk membaca bootstrap, sehingga runner smoke/E2E dan README diperbarui.

## Bukti dan keterbatasan

| Pemeriksaan | Hasil |
| --- | --- |
| `bun run check` | Lulus pada kode final; kontrak, API, web, tooling dan kode tes diperiksa. Svelte 0 error/0 warning. |
| `bun run lint` | Lulus pada kode final, termasuk batas import. |
| `bun run format:check` | Lulus. |
| `bun run check:source` | Lulus, 57 file authored. |
| `git diff --check` | Lulus. |
| Unit/HTTP/database/integrasi/E2E | **Belum dijalankan**; pemilik meminta tes ditahan. |
| Startup aplikasi/database, smoke jaringan dan shutdown proses | **Belum dijalankan** pada task ini. |
| CI GitHub | **Belum dijalankan**; tetap workflow_dispatch. |

Skenario tertulis meliputi JSON/UTF-8 invalid, unknown/duplicate query, field strict dan nominal string, batas body tanpa Content-Length, multipart ganda, private cache, log tanpa input privat, error provider, output invalid, deadline/abort, env invalid tanpa secret, health, serta shutdown normal/forced/idempotent. Dua skenario integrasi DB menilai readiness pada schema utuh/kolom hilang. Keberadaan test bukan hasil lulus.

Pemeriksaan schema readiness membuktikan kompatibilitas baca bila dijalankan, bukan hash migrasi/constraint/izin setiap operasi. Endpoint bisnis dan autentikasi tetap milik tugas lanjut. Listener privat masih memerlukan pembatasan reverse proxy pada T-24. Batas infrastruktur Bun dapat menghasilkan respons sebelum envelope aplikasi terbentuk.

T-05 tetap belum dicentang selesai; bukti perilaku T-03/T-04 juga belum tersedia. Detail penggunaan, sumber teknis dan konsekuensi pada setup lama ada di [fondasi HTTP](../http-foundation.md).
