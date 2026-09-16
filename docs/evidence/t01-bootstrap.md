# Bukti T-01 — Bootstrap dan toolchain

T-01 selesai diuji pada 10 September 2026. Cakupan: monorepo web/API/contracts, TypeScript, build produksi Bun, halaman minimum, dan decode Sharp. Pemeriksaan ini dilakukan oleh pembuat implementasi; tidak merupakan audit independen atau penerimaan MVP penuh.

## Lingkungan dan versi

- Lokal: macOS arm64, Bun `1.4.0` (`1381054db`).
- Linux: Debian arm64 dalam Docker melalui profil Colima terpisah `umbul-nogo`, Bun `1.4.0` (`34cbb9a40`).
- Base image: `oven/bun:1.4.0-debian`, digest `sha256:5bb0f9be3a1a36a03e27c9a9dd894a3b1ad26657155c7df4dda771e17bf872ef`.
- Image pembuktian: `umbul-nogo-bootstrap:t01`, ID `sha256:42c23050bc3cb058a753ba242e15ac7f463a4306bd326fdc8f070337c5ab1cd2`.
- SHA-256 `bun.lock` pada pembuktian T-01: `9347fbb3ac229c48407bb4d866d1793ed48d07a9b2bf909aa77a6d97f90205e6`. Penambahan tooling tugas berikutnya akan mengubah lockfile; hasil ini terikat pada baseline tersebut.

| Paket | Versi yang diuji |
| --- | --- |
| SvelteKit / Svelte | 2.70.3 / 5.57.0 |
| Vite / plugin Svelte | 8.2.2 / 7.3.0 |
| svelte-adapter-bun | 1.0.1 |
| Tailwind / plugin Vite | 4.3.3 / 4.3.3 |
| Elysia / Zod | 1.4.30 / 4.5.4 |
| Sharp / libvips | 0.35.4 / 8.18.6 |
| TypeScript / @types/bun / svelte-check | 5.9.3 / 1.4.0 / 4.7.6 |
| Playwright / Chromium | 1.63.0 / 153.0.8010.12 |

## Hasil yang diamati

| Pemeriksaan | Hasil dan batas bukti |
| --- | --- |
| `bun install --frozen-lockfile` | Lulus di lokal dan build Docker, tanpa perubahan lockfile |
| `bun run check` | Lulus lokal/Linux; Svelte 0 error dan 0 warning; API, kontrak, konfigurasi Vite/Playwright, serta skrip diperiksa |
| `bun run build` | Web dan API dibangun pada Bun di lokal/Linux; konfigurasi SvelteKit berada di vite.config.ts |
| `bun run verify:runtime` | Output produksi berjalan sebagai dua proses Bun; API/SSR berhasil, API dihentikan menghasilkan HTTP 503, kedua proses keluar dengan kode 0 pada SIGTERM; lulus lokal/Linux |
| `bun run verify:sharp` | Fixture PNG 1×1 didecode menjadi piksel, dimensi diperiksa, byte invalid ditolak; lulus lokal/Linux arm64 |
| `bun run test:smoke` | Empat tes Chromium lulus: dua skenario pada desktop/mobile; HTML tanpa JavaScript, CSS Tailwind, favicon, import kontrak browser, hydration buka/tutup, tanpa error browser atau overflow |
| `bun run dev` | Web port 5173 dan API port 3001 dapat dimuat; penghentian supervisor menutup kedua port |
| Tinjauan tampilan | Screenshot development 1440 px dan 390 px ditinjau; halaman awal hijau/krem dan informasi kosong terbaca |

Seluruh script/config aplikasi authored memakai TypeScript atau format deklaratif. JS hasil build dan node_modules diabaikan Git. Git lokal diinisialisasi pada branch main; tidak ada remote, commit, atau deployment publik yang dibuat pada T-01.

## Penyesuaian dan keterbatasan

- Pemanggilan workspace memakai `bun run --cwd ...`; varian posisi flag yang menampilkan bantuan CLI tidak dihitung sebagai pemeriksaan berhasil.
- Deklarasi dependency Elysia/bun-types/adapter menimbulkan error TypeScript internal. `skipLibCheck` dibatasi ke web/API/tooling; kontrak tetap memeriksa deklarasi. Strict pada source aplikasi tetap aktif. Rincian ada di [konvensi kode](../code-conventions.md).
- Kontrak menggunakan lib DOM untuk tipe URL yang dirujuk Zod, dengan `types: []` agar ambient Bun/Node tidak masuk kontrak.
- Docker CLI lokal tidak menyediakan buildx; build berhasil memakai builder yang tersedia tanpa flag `--progress`.
- Konfigurasi melalui plugin mengikuti [SvelteKit configuration](https://svelte.dev/docs/kit/configuration); integrasi Tailwind mengikuti [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite). Bukti runtime di atas lebih terbatas pada versi/lingkungan yang diuji.
- Linux yang diuji adalah arm64. Linux amd64, koneksi PostgreSQL/S3, autentikasi, CRUD, pengaturan, performa produksi, dan skenario penerimaan MVP belum dibuktikan oleh T-01.
- `/internal/bootstrap` dan halaman awal bersifat sementara; identitas terkonfirmasi akan berpindah ke alur database/snapshot pada T-04/T-14. Tidak ada tarif, foto, atau jadwal fiktif.

Langkah pengulangan tersedia di [README](../../README.md). Definisi tugas ada di [task.md](../task.md).
