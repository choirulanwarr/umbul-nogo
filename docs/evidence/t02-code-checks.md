# Bukti T-02 — Pemeriksaan kode dan kerangka CI

Pemeriksaan dilakukan pada 11 September 2026. Cakupan T-02 adalah tooling yang aktif, penolakan pelanggaran, pemisahan suite, serta kerangka CI. Hasil ini tidak menyatakan fitur admin atau penerimaan MVP sudah selesai.

## Lingkungan dan versi

- Lokal: macOS arm64, Bun `1.4.0` (`1381054db`).
- Linux: Debian arm64 melalui Docker/Colima profil `umbul-nogo`, Bun `1.4.0` (`34cbb9a40`).
- SHA-256 `bun.lock`: `7a47d895f3da5fc9d787640a0b785657829300fc3773309d624c8b3bdee52e6a`.
- ESLint / @eslint/js: `9.39.5`; typescript-eslint / @typescript-eslint/utils: `8.70.0`.
- eslint-plugin-svelte: `3.23.0`; eslint-config-prettier: `10.1.8`.
- Prettier: `3.9.6`; plugin Svelte: `4.1.1`; plugin Tailwind: `0.8.1`.
- TypeScript `5.9.3`, Svelte `5.57.0`, dan runtime aplikasi mengikuti [baseline T-01](./t01-bootstrap.md).

ESLint 9 dipilih setelah konfigurasi aturan bertipe diperiksa bersama typescript-eslint; varian ESLint 10 yang sempat diuji belum kompatibel dengan tipe konfigurasi tersebut. Konfigurasi akhir memakai helper `ts.config`, tanpa cast untuk menyembunyikan ketidakcocokan. Rule import tipe memakai properti AST `source` yang tersedia pada dependency terpin.

## Pemeriksaan positif lokal

| Perintah | Hasil yang diamati |
| --- | --- |
| `bun install --frozen-lockfile` | Lulus; dependency/lockfile tidak berubah |
| `bun run format:check` | Lulus untuk source/config yang didukung; dokumen perencanaan dikecualikan melalui `.prettierignore` |
| `bun run check:source` | Lulus untuk 21 file sumber authored; dependency/generated output dikecualikan |
| `bun run lint` | Lulus TS/Svelte dengan aturan berbasis tipe dan batas import; tanpa warning lint |
| `bun run check` | Lulus API, kontrak, web, test, skrip, serta konfigurasi; Svelte 0 error dan 0 warning |
| `bun run test:unit` | 13 tes, 61 assertion, 0 gagal; mencakup helper dan eksekusi ESLint memakai konfigurasi proyek |
| `bun run build` | API dan web produksi berhasil dibangun pada Bun |
| `bun run test:integration` | Decode PNG nyata/penolakan byte invalid di Sharp; SSR produksi, API mati menghasilkan 503, web/API keluar dengan kode 0 pada shutdown |
| `bun run test:e2e` | 4 tes Chromium lulus: dua skenario pada desktop/mobile, HTML tanpa JavaScript, aset/CSS, kontrak browser, hydration, tanpa overflow atau error browser |

Perubahan komponen untuk memenuhi lint mempertahankan akses prop reaktif melalui `$props`; perilaku halaman awal diuji ulang pada output produksi. Tautan halaman error memakai resolver SvelteKit.

## Pembuktian penolakan

Enam pemeriksaan CLI memakai file sementara, satu per satu, kemudian menghapusnya dalam blok `finally`. Keberhasilan mensyaratkan exit code nonzero **dan** pesan pelanggaran yang diharapkan; error tidak terkait tidak dihitung sebagai lulus.

| Perintah | Fixture pelanggaran | Hasil |
| --- | --- | --- |
| `format:check` | File `.ts` dengan format `export const value={a:1}` | Exit 1; `Code style issues` |
| `check:source` | File `.js` di `scripts/` | Exit 1; JavaScript authored ditolak |
| `check:source` | Komponen dengan `<script>` tanpa `lang="ts"` | Exit 1; pesan kewajiban TypeScript |
| `lint` | `export const value: any = 1;` | Exit 1; `@typescript-eslint/no-explicit-any` |
| `check` | Nilai string untuk variabel `number` pada skrip `.ts` | Exit 2; `TS2322` |
| `check` | Nilai string untuk variabel `number` pada komponen Svelte | Exit 1; error tipe dari svelte-check |

Suite permanen `tests/unit` membuktikan tambahan berikut:

- Import lintas aplikasi ditolak lewat nama paket, path relatif, re-export, dynamic import literal, dan import tipe; tes ESLint memeriksa ID rule yang tepat serta tidak menerima parsing error sebagai penggantinya.
- Browser tidak boleh mengimpor environment privat, modul server, Node/Bun, atau Sharp; query `?raw` dan ekstensi `.server.js` juga diperiksa. Import environment pada server loader tetap diterima.
- Kontrak hanya mengimpor Zod atau modulnya sendiri; import kontrak dari aplikasi melalui exports paket diterima, jalan pintas ke source ditolak.
- `any`, Promise tanpa penanganan, double assertion `as unknown as`, dan dynamic import nonliteral ditolak oleh konfigurasi ESLint aktif.
- Script instance/module Svelte dibedakan dari komentar/teks; JavaScript dan ekstensi sumber yang belum memiliki dukungan lint/typecheck ditolak.

Setelah fixture pelanggaran dihapus, pemeriksaan positif dijalankan kembali dan lulus. Tidak ada fixture invalid yang tertinggal di source.

## Pengulangan Linux

Perintah berikut berhasil membangun image pengujian dari source dengan dependency terpasang melalui frozen lockfile:

```sh
docker --context colima-umbul-nogo build -f infra/Dockerfile.bootstrap -t umbul-nogo-checks:t02 .
```

Image hasil: `sha256:1b36d9a5a579fd48cdb2de4eed289ac7c6d210ede9f79155b440bd599f999d47` (`linux/arm64`). Base image sama dengan T-01. Format, 21 file sumber, lint, seluruh target typecheck, 13 tes/61 assertion, build produksi, decode Sharp, dan integrasi runtime semuanya lulus di dalam build Docker. Svelte melaporkan 0 error/0 warning; proses web/API berhenti dengan kode 0 dan skenario API tidak tersedia menghasilkan 503.

Pengujian browser dan enam probe CLI dijalankan di macOS; tidak diklaim sudah diulang pada Linux. Linux arm64 yang diuji juga bukan runner GitHub Ubuntu amd64. Dockerfile ini untuk verifikasi fondasi, bukan image deployment produksi.

## CI, suite, dan batas hasil

Workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) memakai action yang dipin ke commit, Bun `1.4.0`, frozen lockfile, permission `contents: read`, dan timeout 15 menit. Urutannya: format → sumber → lint → typecheck → unit → build → integrasi → pemasangan Chromium → E2E. Semua runner memakai dependency lokal.

GitHub Actions **belum dijalankan** karena repository belum memiliki remote. Konfigurasi workflow dan hasil lokal tidak disebut sebagai status hijau di GitHub. Pengujian penerimaan MVP serta layanan PostgreSQL/storage akan melengkapi CI pada tugas terkait dan T-23.

`bunfig.toml` membatasi discovery Bun ke `tests/unit`; Playwright hanya menemukan `tests/e2e`. Suite integrasi saat ini benar-benar menjalankan Sharp dan dua proses produksi, tanpa tes placeholder. Integrasi database/storage belum tersedia dan tidak dihitung sebagai lulus.

Generated output, dependency, environment, coverage, serta laporan browser diabaikan Git. Tidak ada source JS authored dalam daftar file yang dapat ditambahkan. Pengecualian `skipLibCheck` untuk deklarasi dependency tetap terbatas seperti pada T-01; strict source dan pemeriksaan kontrak tetap aktif. Formatter tidak memformat massal README/dokumen perencanaan. Alias modul baru harus disertai pembaruan aturan batas dan tesnya.

Cara mengulang pemeriksaan ada di [README](../../README.md); aturan lengkap ada di [konvensi kode](../code-conventions.md).

## Perubahan alur setelah verifikasi

Pada 11 September 2026, pemilik proyek menetapkan remote `git@github-personal:choirulanwarr/umbul-nogo.git`, pengiriman tiap task melalui branch `development`, dan konfirmasi sebelum tes. Trigger CI kemudian diubah dari push/PR menjadi `workflow_dispatch`. Hasil di atas merupakan hasil sebelum perubahan alur tersebut; tidak ada tes baru atau CI GitHub yang dijalankan untuk pengiriman ini. Lihat [AGENTS.md](../../AGENTS.md).
