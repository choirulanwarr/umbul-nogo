# UMBUL NOGO

Proyek website wisata UMBUL NOGO di Wonogiri, Jawa Tengah, dengan informasi tiket dan halaman admin pengelola.

## Menjalankan fondasi aplikasi

Gunakan Bun `1.4.0`, sesuai `.bun-version`. Dari root proyek:

```sh
bun install --frozen-lockfile
# Isi .env dari .env.example: SITE_ORIGIN dan DATABASE_URL runtime wajib.
# Siapkan database/migrasi sesuai docs/database.md sebelum menjalankan aplikasi.
bun run dev
```

Web tersedia di `http://127.0.0.1:5173`, API bootstrap di `http://127.0.0.1:3001/internal/bootstrap`. Kedua proses dijalankan bersama; `Ctrl+C` menghentikannya. Sejak T-05, `.env` wajib berisi `SITE_ORIGIN` dan `DATABASE_URL` role runtime. Siapkan PostgreSQL dan migrasi melalui [panduan database](./docs/database.md); gunakan file operator terpisah untuk credential migrasi.

Fondasi T-01 menampilkan halaman awal dengan identitas terkonfirmasi dan pesan informasi belum tersedia. Endpoint bootstrap sementara kini membaca nama/wilayah dari database; schema dan migrasi tersedia sejak T-04. Admin, snapshot `/api/v1/public/site`, dan pengaturan mengikuti tugas berikutnya. Halaman awal memakai `noindex` sampai implementasi publik siap ditinjau.

## Build dan pemeriksaan

```sh
bun run format:check
bun run check:source
bun run lint
bun run check
bun run test:unit
bun run build
bun run test:integration
bun run --bun playwright install chromium
bun run test:e2e
```

`format:check` memeriksa source/config; `bun run format` memperbaiki formatnya. Dokumen perencanaan dan README dikecualikan agar tidak diubah massal. `check:source` menolak JavaScript authored, ekstensi sumber di luar `.ts`/`.svelte`, dan script Svelte tanpa `lang="ts"`. Lint memeriksa TypeScript/Svelte serta batas aplikasi, kontrak, dan server/browser.

`test:unit` menjalankan tes aturan tooling dan kontrak; `bunfig.toml` membatasi discovery Bun ke unit agar suite Playwright tidak ikut termuat. `test:integration` saat ini menjalankan decode Sharp dan `verify:runtime`: output produksi web/API di port 4183/4184, SSR, kegagalan API menjadi 503, dan shutdown. `test:http` menguji boundary HTTP dengan dependency fixture; `test:db` menguji PostgreSQL nyata secara terpisah. Sejak T-05, `test:integration` dan E2E memerlukan `TEST_DATABASE_URL` runtime pada database test yang sudah dimigrasi; tidak ada fallback DB palsu. Lihat [fondasi HTTP](./docs/http-foundation.md).

`test:e2e` (alias lama `test:smoke`) menjalankan output produksi di port 4173/4174 dan menguji Chromium desktop/mobile, HTML tanpa JavaScript, CSS, aset, serta hydration. Runner menghentikan proses yang dijalankannya; port uji harus kosong. Jalankan `build` terlebih dahulu dan pasang browser Playwright sebelum tes pertama. Di Linux, gunakan `bun run --bun playwright install --with-deps chromium` untuk memasang dependency sistem browser juga.

[Workflow CI](./.github/workflows/ci.yml) menyediakan pemeriksaan tersebut dengan Bun yang dipin dan frozen lockfile. Sesuai instruksi pemilik proyek, tes harus dikonfirmasi terlebih dahulu dan workflow hanya dipicu manual (`workflow_dispatch`); push tidak otomatis menjalankan tes. Status dan batas hasil sebelumnya dicatat dalam [bukti T-01](./docs/evidence/t01-bootstrap.md) dan [bukti T-02](./docs/evidence/t02-code-checks.md).

Pekerjaan dikirim ke `git@github-personal:choirulanwarr/umbul-nogo.git` melalui branch `development`. Setiap task yang selesai dicommit dan dipush ke branch tersebut. Aturan kolaborasi tersimpan di [AGENTS.md](./AGENTS.md).

Untuk menjalankan hasil produksi secara manual, buka dua terminal di root proyek:

```sh
bun run start:api
```

```sh
HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 bun run start:web
```

Dockerfile bootstrap berikut menyimpan alur pembuktian T-01/T-02. Sejak T-05, tahap integrasi memerlukan database test eksternal; wiring layanan database untuk Docker/CI belum tersedia. Perintah ini menjalankan tes dan memerlukan persetujuan:

```sh
docker build -f infra/Dockerfile.bootstrap -t umbul-nogo-checks:local .
```

Dockerfile ini merupakan lingkungan pembuktian fondasi, dengan dependensi development untuk format/source/lint/typecheck/unit/build/integrasi. Pengujian browser dijalankan terpisah lewat perintah di atas. Konfigurasi image dan deployment produksi ditangani pada T-24.

## Dokumentasi

Dokumentasi perencanaan tersedia di `docs/`. Mulai dari kebutuhan produk, lalu ikuti urutan berikut:

1. [Kebutuhan aplikasi](./docs/requirement.md) — cakupan MVP, fitur, aturan bisnis, dan kriteria penerimaan.
2. [Desain dan arsitektur](./docs/design.md) — UI/UX, struktur proyek, database, media, dan operasional.
3. [Standar API](./docs/api-standar.md) — kontrak endpoint, autentikasi, validasi, dan respons.
4. [Konvensi kode](./docs/code-conventions.md) — aturan implementasi, tooling, pengujian, dan CI.
5. [Tugas implementasi](./docs/task.md) — urutan pekerjaan, dependensi, dan progres implementasi.

[Pengaturan dan pengisian bertahap](./docs/settings.md) menjelaskan data yang nanti dapat Anda isi melalui admin serta konfigurasi domain, hosting, dan storage melalui deployment.
