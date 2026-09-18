# Bukti implementasi T-07 — akun operator

Tanggal: 18 September 2026. Branch pengiriman: `development`.

## Hasil implementasi

- `apps/api/scripts/admin-account.ts`: CLI create/reset/disable; email dan password melalui prompt, konfirmasi password, konfirmasi tindakan, penolakan argumen tambahan dan input tanpa TTY.
- `apps/api/src/operator/prompt.ts`: input password memakai output terminal yang dibisukan, tanpa history; pembatalan menutup readline.
- `apps/api/src/operator/accounts.ts`: Argon2id memakai parameter T-06, normalisasi email, penolakan duplikasi, reset sekaligus reaktivasi, disable, pencabutan seluruh sesi, dan audit transaksional. Lock akun sama dengan service auth.
- CLI memakai `MIGRATION_DATABASE_URL` dengan role operator yang sudah tersedia; hak role API tetap hanya baca akun. Tidak ada migrasi, endpoint publik, seed credential, atau akun nyata baru.
- [Panduan operator](../operator-accounts.md): provisioning, penyerahan privat, pemulihan, throttle, audit, dan hasil commit yang belum diketahui.

## Pemeriksaan statis

- TypeScript API: `bun run --cwd apps/api check` — lulus.
- ESLint pada direktori operator, CLI, dan file tes terkait — lulus.
- Prettier pada file TypeScript/manifest yang berubah — diterapkan.

Pemeriksaan ini bukan bukti perilaku database atau terminal.

## Bukti yang masih menunggu

Tes belum dijalankan karena belum ada persetujuan pemilik menurut [AGENTS.md](../../AGENTS.md). Tidak ada workflow CI dipicu; pemicunya tetap manual.

Suite `test:db` sudah memuat skenario T-07: akun hasil provisioning dapat login, email ternormalisasi, duplikasi tidak mengganti password, reset mencabut beberapa sesi, password lama ditolak, disable menolak sesi/login, reset memulihkan akun nonaktif, rollback memulihkan akun/sesi/audit, role runtime tidak dapat menonaktifkan akun, serta audit tidak memuat credential. Suite memerlukan database test kosong terisolasi sesuai panduan T-04.

Pemeriksaan terminal perlu membuktikan password tidak tercetak, konfirmasi tidak cocok ditolak, Ctrl-C/EOF memulihkan terminal, dan pipe/argumen password ditolak. Konkurensi login/reset mengikuti lock T-06 tetapi belum dibuktikan pada eksekusi ini. Bukti HTTPS T-06 dan seluruh prasyarat T-03–T-06 juga masih menunggu tes. Penerima akun nyata harus ditetapkan sebelum peluncuran; T-07 tetap belum dicentang selesai.
