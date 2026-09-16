# Konvensi Kode — UMBUL NOGO

> Status: draf tahap 6 — pedoman implementasi untuk monorepo SvelteKit, API Elysia pada Bun, dan shared contracts TypeScript.
> Acuan: [requirement.md](./requirement.md), [design.md](./design.md), dan [api-standar.md](./api-standar.md).
> Fondasi T-01 sudah memiliki workspace, konfigurasi TS, build, dan smoke test minimum. Bagian pedoman lain diterapkan sesuai tugasnya; tooling lint/format/CI lengkap milik T-02.
> Pembaruan 10 September 2026: aturan data dinamis dan Operasional privat mengikuti [settings.md](./settings.md).

## 1. Aturan dasar

Konvensi ini menerjemahkan batasan pengguna dan kontrak yang sudah disusun menjadi aturan penulisan serta pemeriksaan kode. SvelteKit tetap menyediakan SSR untuk SEO, Bun menjalankan web/API, PostgreSQL menyimpan data, Tailwind mengatur styling, dan S3/S3-compatible menyimpan gambar.

- Semua logika aplikasi, skrip operasional, konfigurasi berlogika, dan pengujian ditulis dalam TypeScript. Komponen `.svelte` yang memiliki script wajib memakai `lang="ts"`, termasuk script module.
- Tidak menulis sumber `.js`, `.mjs`, atau `.cjs`. HTML, CSS, JSON, Markdown, SQL migrasi, dan konfigurasi infrastruktur deklaratif mengikuti format masing-masing. JavaScript hasil compiler/dependensi adalah artefak otomatis, bukan sumber proyek yang dikomit.
- Perubahan perilaku mengikuti kebutuhan dan kontrak API. Perubahan format kode tidak boleh diam-diam mengubah arti harga 0, publikasi, masa sesi, versi konten, atau retry.
- Identifier kode memakai Bahasa Inggris; label antarmuka, validasi, dan dokumentasi produk memakai Bahasa Indonesia. Nama proyek **UMBUL NOGO**; nama destinasi yang ditampilkan berasal dari profil tersimpan dan dapat diedit melalui admin.
- Harga, jam, fasilitas, kontak, serta foto contoh diberi label data uji dan hanya digunakan dalam lingkungan pengembangan/pengujian. Produksi tidak diisi fakta destinasi yang belum diberikan pengelola.
- Data profil, foto terpilih, anggaran, serta penanggung jawab dibaca dari database melalui kontrak API. Nama/wilayah awal hanya diinisialisasi sekali dari keputusan pengguna; komponen tidak mengunci nilainya atau menimpa isian saat restart. Placeholder UI tidak dikirim sebagai nilai formulir tersimpan.
- `OperationsFields` memakai schema input/output eksplisit. Null berbeda dari 0 dan dari string kosong. Simpan melalui transaksi/versi/receipt konten; data privat tidak masuk mapper publik, log body, atau audit berisi nilai formulir. Kontak internal tidak mengubah akun, kontak publik, atau penerima alarm.
- Konfigurasi koneksi dan domain dibaca dari environment runtime tervalidasi; kredensial disuntikkan dari fasilitas secret deployment. Jangan menyediakan endpoint admin untuk membaca/menulis seluruh environment atau menyimpan secret ke tabel pengaturan. Pengisian field bisnis kosong tetap dapat berjalan setelah koneksi wajib dikonfigurasi.
- Daftar kelengkapan diturunkan dari snapshot publik dan Operasional tersimpan sesuai settings.md. Error baca tetap error, bukan daftar kosong. Label Sudah diisi tidak menjadi boolean siap rilis atau bukti verifikasi fakta.
- Utamakan fungsi/modul dengan tanggung jawab jelas. Tambahkan abstraksi bersama ketika ada kebutuhan pemakaian yang nyata; hindari repository generik atau framework formulir buatan sendiri untuk semua fitur sejak awal.

## 2. Struktur dan arah dependensi

Struktur root mengikuti bagian 10 `design.md`. Nama workspace yang diusulkan: `@umbul-nogo/web`, `@umbul-nogo/api`, dan `@umbul-nogo/contracts`; dependensi internal menggunakan `workspace:*`.

| Lokasi | Isi dan batas |
| --- | --- |
| `apps/web/src/routes` | Halaman, layout, loader server, sitemap, dan robots; rute admin mengikuti Bahasa Indonesia pada desain UI |
| `apps/web/src/lib/components` | Komponen tampilan bersama dan komponen bagian destinasi; tidak mengakses database/storage |
| `apps/web/src/lib/features` | Formulir dan state per fitur bila dibutuhkan, misalnya `ticket-rates`; tidak menjadi lapisan wajib untuk komponen sederhana |
| `apps/web/src/lib/api` | Klien browser untuk API same-origin; tidak membaca environment privat |
| `apps/web/src/lib/server` | Klien API internal, environment privat web, dan pemetaan kegagalan SSR |
| `apps/api/src/modules/<feature>` | Route, service bisnis, query/repository konkret, dan mapper DTO fitur |
| `apps/api/src/db` | Pool, schema Drizzle, koneksi, dan tipe transaksi backend |
| `apps/api/src/storage` | Pemrosesan gambar, manifest, object key, klien S3, dan operasi rekonsiliasi |
| `apps/api/scripts` | Migrasi, provisioning/reset akun, backup/restore, dan job operasional TypeScript |
| `packages/contracts/src` | Schema request/response, tipe turunan, enum, dan kode kesalahan yang aman diimpor browser |
| `tests/e2e` | Pengujian alur browser lintas web/API dengan fixture terisolasi |

Web dan API boleh mengimpor kontrak; kontrak tidak mengimpor aplikasi. Web tidak mengimpor API, Drizzle, atau klien storage, termasuk hanya untuk mengambil tipe. Kontrak tidak mengimpor Svelte, Elysia, Drizzle, Bun, environment, atau modul Node. Aturan ini dijaga melalui exports package, lint batas import, dan typecheck terpisah; tidak cukup mengandalkan nama direktori.

Dalam backend, arah utama adalah route → service → query/storage. Service menentukan batas transaksi. Query yang menjadi bagian operasi atomik menerima handle transaksi dari service; tidak membuka transaksi/koneksi baru diam-diam. Hindari siklus import antarfitur dan akses database langsung dari handler UI.

Gunakan named exports pada modul aplikasi dan entry point kontrak per domain, misalnya `@umbul-nogo/contracts/ticket-rates`. Default export hanya bila diperlukan framework/configuration. Import dalam aplikasi memakai alias yang dikonfigurasi pada toolchain atau path relatif pendek; import antar-workspace melewati exports package. Pisahkan `import type`; jangan memakai barrel yang mencampur modul publik dan privat.

## 3. Penamaan dan format

| Elemen | Konvensi | Contoh |
| --- | --- | --- |
| File TypeScript/folder fitur | kebab-case; suffix menurut peran | `ticket-rate.service.ts`, `ticket-rate.mapper.ts` |
| Komponen Svelte | PascalCase | `TicketSection.svelte`, `FormField.svelte` |
| File khusus SvelteKit | Nama resmi framework | `+page.server.ts`, `+page.svelte`, `+server.ts`, `hooks.server.ts` |
| Modul reaktif Svelte jika diperlukan | `.svelte.ts` | `ticket-form.svelte.ts` |
| Fungsi/variabel | camelCase; fungsi diawali tindakan yang jelas | `saveTicketRate`, `expectedContentVersion` |
| Boolean | Menjelaskan keadaan/kemampuan | `isVisible`, `isSaving`, `canRetryUpload` |
| Tipe/interface | PascalCase tanpa prefiks `I` | `TicketRateDto`, `SaveState` |
| Schema | camelCase dengan suffix `Schema` | `ticketRateInputSchema` |
| Konstanta operasional tetap | UPPER_SNAKE_CASE, sertakan satuan | `UPLOAD_TIMEOUT_MS`, `MAX_IMAGE_BYTES` |
| Tabel/kolom SQL | snake_case; nama tabel mengikuti desain | `ticket_rates.price_idr` |
| Field DTO | camelCase sesuai API | `priceIdr`, `ticketsUpdatedAt` |
| Pengujian unit/integrasi | `.test.ts` / `.integration.test.ts` | `ticket-rate.integration.test.ts` |
| Pengujian browser | `.spec.ts` dalam `tests/e2e` | `ticket-publishing.spec.ts` |

Rute UI seperti `/admin/tiket` dan endpoint seperti `/api/v1/admin/ticket-rates` memiliki fungsi berbeda dan mengikuti dokumen masing-masing. Jangan menyamakan keduanya hanya demi penamaan internal.

Format otomatis: dua spasi, UTF-8, LF, newline akhir, semicolon, double quotes untuk string TS, trailing comma, dan lebar panduan 100 karakter. Formatter menentukan pemenggalan; jangan menambah lint kosmetik yang bersaing dengan formatter. Impor side effect yang urutannya bermakna tidak diacak untuk merapikan abjad.

Komentar menjelaskan alasan, invariant, atau keterbatasan yang tidak tampak dari kode. TODO menyebut kondisi penyelesaian atau referensi pekerjaan. Jangan menonaktifkan pemeriksaan seluruh file untuk menyembunyikan error; pengecualian lokal menyebut alasan teknis dan ditinjau bersama perubahan.

## 4. TypeScript dan konfigurasi

### 4.1 Pemeriksaan tipe

Rancangan `tsconfig.base.json` hanya membawa aturan bersama agar konfigurasi runtime setiap workspace tetap terpisah:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": false,
    "noEmit": true
  }
}
```

`strict` memeriksa nilai nullable dan tipe implisit; dua opsi tambahan menuntut penanganan akses indeks serta membedakan field yang tidak ada dari field bernilai undefined. `noEmit` digunakan untuk typecheck; build produksi dikerjakan toolchain aplikasi. Makna opsi mengacu pada [TSConfig TypeScript](https://www.typescriptlang.org/tsconfig/).

Web memperluas konfigurasi yang dihasilkan SvelteKit dan baseline bersama tanpa menghapus `paths`, `rootDirs`, atau konfigurasi framework. Gunakan `svelte-kit sync` sebelum pemeriksaan tipe route; jangan mengedit `.svelte-kit/tsconfig.json` atau generated `$types`. Tipe loader/endpoint berasal dari `./$types`, mengikuti [tipe SvelteKit](https://svelte.dev/docs/kit/types).

API menggunakan ESM dengan module resolution yang cocok untuk Bun, serta tipe Bun hanya pada lingkup backend/tooling. Kontrak dikompilasi terpisah dengan `types: []`, pustaka ECMAScript yang diperlukan, dan tanpa ambient types Bun; browser build juga memeriksa dependensinya. Alias TypeScript harus cocok dengan resolver Bun/Vite, karena konfigurasi typecheck sendiri tidak menulis ulang import runtime.

Konfigurasi `eslint.config.ts`, `vite.config.ts`, `drizzle.config.ts`, `playwright.config.ts`, serta skrip root ikut memiliki target typecheck yang sesuai; tidak hanya dapat ditranspile. Seluruh file authored masuk cakupan pemeriksaan. Dependensi yang memiliki masalah deklarasi tidak ditutupi dengan penurunan `strict` pada kode aplikasi; jika perlu pengecualian library, catat dampak dan alasannya secara terbatas.

Pada T-01, `skipLibCheck: true` digunakan hanya pada konfigurasi web, API, dan tooling karena deklarasi Elysia `1.4.30`, bun-types `1.4.0`, serta ambient adapter Bun `1.0.1` menghasilkan error internal deklarasi pada TypeScript `5.9.3`. Opsi ini melewati pemeriksaan internal file `.d.ts`; seluruh kode authored `.ts`/`.svelte` tetap strict dan penggunaan tipe dependency tetap diperiksa. Kontrak tidak mengaktifkannya; `types: []` tetap memisahkan kontrak dari ambient Bun/Node, dengan lib DOM untuk tipe URL yang dirujuk Zod. Evaluasi ulang pengecualian saat dependency diperbarui. Ini bukan bukti bahwa seluruh deklarasi dependency benar.

### 4.2 Gaya TypeScript

- Gunakan `const`; gunakan `let` ketika reassignment diperlukan. Tidak menggunakan `var`.
- Masukan eksternal bertipe `unknown` sampai berhasil divalidasi. Tidak memakai explicit `any`, `as unknown as T`, atau assertion untuk mengklaim respons jaringan sudah sah.
- Gunakan inferensi pada variabel lokal; beri tipe pada batas service, dependency, parameter publik, dan return yang menentukan kontrak. Gunakan `satisfies` untuk memeriksa bentuk konfigurasi/mapping tanpa menghilangkan inferensi.
- Gunakan `type` untuk union dan DTO turunan; `interface` untuk kontrak objek yang memang perlu diperluas. Tidak menduplikasi tipe yang sudah dapat diturunkan dari schema.
- Pakai literal union atau objek `as const` untuk status. Hindari enum runtime, namespace aplikasi, dan constructor parameter properties supaya pola TS juga sederhana untuk komponen Svelte.
- Tangani Promise secara eksplisit. Jangan melepas write/audit/unggahan ke proses latar tanpa penyimpanan status yang dapat dipulihkan. `void` hanya digunakan ketika rejection dan akibatnya telah ditangani.
- Gunakan discriminated union untuk hasil/state yang saling eksklusif; jangan membuat banyak boolean yang dapat serentak menyatakan simpan berhasil dan gagal.

Contoh bentuk state formulir; detail field error dan descriptor niat tetap mengikuti kontrak API:

```ts
type SaveState =
  | { status: "idle" }
  | { status: "saving"; operationKey: string }
  | { status: "saved"; contentVersion: number }
  | { status: "invalid"; fields: ReadonlyArray<string> }
  | { status: "conflict"; currentContentVersion: number }
  | { status: "uncertain"; operationKey: string }
  | { status: "failed"; requestId: string | null }
  | { status: "auth-required" };
```

## 5. Shared contracts dan validasi

Schema request dan response tinggal di `packages/contracts`; bentuk wire, field nullable, kode kesalahan, serta batas nilai mengacu pada `api-standar.md`. Gunakan schema objek strict dan turunkan tipe dengan `z.infer`/`z.input` sesuai kebutuhan. `safeParse` cocok untuk masukan formulir yang kegagalannya diharapkan, sementara validasi keluaran gagal berarti bug/masalah integritas yang harus ditangani. Kemampuan parsing serta tipe turunan didokumentasikan di [Zod basics](https://zod.dev/basics).

- Aturan struktur murni, panjang, rentang, dan hubungan antarfield yang tidak memerlukan database dibagi melalui kontrak. Otorisasi, versi saat ini, keberadaan entitas, dan status media diperiksa service backend.
- Normalisasi trim, null, nomor kontak, serta hitungan Unicode code point mengikuti API. Jika schema melakukan transformasi, bedakan tipe masukan `z.input` dari hasil `z.output` agar hash idempotensi memakai hasil normalisasi yang sama.
- Harga selalu angka Rupiah bulat. Field HTML kosong dipetakan menjadi error required, bukan `Number("")`, default 0, atau `parseInt` yang menerima sebagian teks.
- Nilai 0 diperiksa secara eksplisit; jangan memakai `if (priceIdr)` untuk menentukan harga tersedia. Koordinat 0 juga sah.
- Jangan menurunkan schema publik dari seluruh baris SQL dengan menghapus beberapa field. Definisikan field yang boleh keluar, map secara eksplisit, lalu validasi schema hasil.
- Klien mengurai JSON sebagai `unknown`, memvalidasi envelope sesuai endpoint, lalu membedakan error domain, error transport, dan respons yang tidak sesuai kontrak. Casting TypeScript tidak menggantikan validasi runtime.
- Frontend tidak memperbarui tarif secara optimistis sebelum commit server. Receipt replay adalah hasil operasi lama; sesudah itu ambil data/versi mutakhir.

Konstanta batas yang dipakai FE/BE berada bersama schema, misalnya batas harga dan ukuran berkas. Kebijakan server seperti biaya password, pool, TTL sesi, serta kredensial berada di konfigurasi backend; jangan menyalinnya ke browser untuk kemudahan import.

## 6. SvelteKit, SSR, dan state frontend

### 6.1 Komponen Svelte

Komponen baru memakai gaya Svelte 5: `$props` bertipe, `$state` untuk state yang dapat berubah, `$derived` untuk nilai turunan, serta event attribute seperti `onclick`/`onsubmit`. Gunakan callback props untuk komunikasi komponen dan `$bindable` hanya ketika two-way binding menjadi kontrak yang diperlukan. Script menggunakan fitur TS yang dapat dihapus saat kompilasi; rujukan: [TypeScript pada Svelte](https://svelte.dev/docs/svelte/typescript).

`$effect` digunakan untuk sinkronisasi dengan sistem browser eksternal yang memang memerlukan efek dan cleanup. Perhitungan harga/status tampilan memakai nilai turunan; tindakan simpan berada di event handler. Efek hanya berjalan di browser, sehingga pengambilan konten utama SEO tidak ditempatkan di dalamnya. Rujukan: [Svelte $effect](https://svelte.dev/docs/svelte/$effect).

Komponen bagian halaman menerima DTO yang diperlukan melalui props. Pecah komponen ketika tanggung jawab atau interaksinya berbeda, bukan karena batas jumlah baris arbitrer. Daftar memakai key ID stabil. Hindari state global hanya untuk menghubungkan dua komponen yang dapat memakai props/context.

### 6.2 Loader dan batas server

`+page.server.ts` halaman publik memuat satu snapshot API sebelum merender. `ssr = true` dan `prerender = false` mengikuti desain. Snapshot yang sama menyediakan konten, metadata, JSON-LD, dan hydration; jangan menambahkan fetch kedua di `onMount` untuk harga awal.

Gunakan `event.fetch` melalui klien server dengan target internal tetap. Klien publik tidak meneruskan cookie; klien admin internal meneruskan hanya cookie sesi yang diperlukan serta header aplikasi. Jangan memakai helper yang meneruskan seluruh header request ke semua URL. Atur `no-store` melalui jalur respons yang sesuai, termasuk kegagalan dan data loader.

Modul privat ditempatkan di `$lib/server` atau bernama `*.server.ts`, memakai mekanisme environment privat SvelteKit. Jangan mengembalikan secret, token sesi, URL internal, atau instance database pada page data. Batas import ini didukung [server-only modules SvelteKit](https://svelte.dev/docs/kit/server-only-modules).

State formulir dan data admin berada per pengguna/request/component, bukan mutable singleton pada scope modul server. Hindari menyimpan objek sesi atau snapshot yang dapat ditulis ulang oleh request lain. Gunakan `event.locals` untuk konteks request dan context component untuk state pohon halaman sesuai kebutuhan. Rujukan: [state management SvelteKit](https://svelte.dev/docs/kit/state-management).

Tidak mengakses `window`, `document`, atau localStorage saat evaluasi modul yang dirender server. Interaksi browser memiliki lifecycle dan cleanup. Nilai awal SSR harus deterministik; jangan menghasilkan harga, tanggal, atau markup awal dari jam lokal browser dan `Math.random()`.

### 6.3 Formulir admin

Form memakai label terhubung, tipe kontrol yang tepat, pesan per field, dan status simpan yang dapat diumumkan pembaca layar. Kendalikan submit dari elemen form agar keyboard tetap bekerja; blokir submit ganda untuk niat yang masih berjalan. Gagal validasi tidak menghapus field lain atau foto lama.

Simpan salinan nilai yang sedang diedit bersama versi snapshot asalnya. Respons pembacaan terbaru tidak boleh otomatis menimpa formulir kotor atau mengganti versi dasar tanpa rekonsiliasi. Buat `Idempotency-Key` ketika niat simpan dibentuk, simpan descriptor dalam memori tab, dan gunakan key/payload yang sama saat retry sesuai API. Sesi habis, konflik versi, kegagalan definitif, dan hasil belum diketahui memiliki state berbeda.

Semua mutasi browser dikirim ke Elysia melalui origin yang sama. Jika kelak memakai SvelteKit form actions sebagai perantara, kontrak penerusan Origin, cookie, key, status, dan timeout harus dirinci lebih dahulu; jangan menambah pemilik transaksi atau validasi bisnis kedua.

## 7. Tailwind, aksesibilitas, dan SEO

Token pada bagian 3 `design.md` didefinisikan satu kali pada `apps/web/src/app.css` melalui tema Tailwind. Komponen menggunakan token semantik seperti `brand`, `canvas`, `surface`, `water`, `text-muted`, dan `control-border`; jangan menduplikasi hex warna pada tiap komponen. Jangan menambah pustaka styling kedua.

Utility Tailwind dipakai langsung untuk layout dan state; scoped CSS diperbolehkan untuk pola yang lebih jelas ditulis sebagai CSS. Nama kelas dinamis harus berupa string lengkap pada mapping terhingga, misalnya pilihan variant tombol. Hindari konstruksi seperti `bg-${color}-500` yang tidak dapat ditemukan sebagai kelas lengkap saat build.

- Susunan dimulai dari mobile, lalu menyesuaikan desktop; lebar perantara tetap fluid tanpa mode tablet khusus. Form, tabel tiket, dan navigasi tidak boleh overflow pada viewport yang ditetapkan desain.
- Gunakan HTML semantik: link untuk navigasi, button untuk tindakan, label untuk input, hierarki heading yang teratur. Dialog hapus menyebut item, mendukung Escape, dan mengembalikan fokus.
- Jangan menghilangkan outline tanpa indikator pengganti. State error tidak hanya dibedakan dengan warna. Jangan memakai divider dekoratif sebagai satu-satunya batas kontrol.
- Transisi memakai durasi 150–250 ms dan perubahan ringan seperti opacity/transform. `prefers-reduced-motion` meniadakan gerakan nonesensial; konten inti tidak dimulai dalam keadaan tersembunyi menunggu JavaScript.
- Gambar memakai URL varian dari DTO, `srcset`, `sizes`, dimensi, serta alt sesuai konteks. Prioritaskan hero; lazy-load gambar lanjutan. Tidak menggunakan URL storage privat/bertanda tangan sementara sebagai gambar publik SEO.
- Format nominal menggunakan `Intl.NumberFormat` dengan locale `id-ID`, currency `IDR`, dan tanpa pecahan. Timestamp ditampilkan dengan zona `Asia/Jakarta`; string `HH:mm` jadwal tidak diparse menjadi tanggal UTC.
- Metadata menggunakan `<svelte:head>` dan snapshot SSR. Canonical berasal dari origin konfigurasi; admin/login noindex; sitemap hanya halaman publik. Serialisasi JSON-LD harus mengamankan karakter `<` sebelum penempatan dalam script; raw HTML admin tidak dirender.

Pengujian visual menilai warna hijau/krem, aksen biru/putih, foto dominan, dan keterbacaan berdasarkan implementasi yang benar-benar dirender. Pemeriksaan token saja tidak membuktikan seluruh UI aksesibel atau memenuhi Core Web Vitals.

## 8. Backend Bun/Elysia dan penanganan kesalahan

Pisahkan `app.ts` yang merakit aplikasi/dependency dari `server.ts` yang membaca konfigurasi, membuka listener, dan menangani shutdown. Mengimpor modul route/service tidak otomatis menyalakan server, menjalankan migrasi, atau membuat akun.

Environment backend dibaca dan divalidasi melalui modul `env.ts` saat startup; web memakai modul privatnya sendiri. Konfigurasi wajib yang hilang menggagalkan startup tanpa mencetak nilai rahasia. `.env.example` hanya berisi nama variabel dan placeholder; jangan memberi prefiks publik pada secret atau membaca environment tersebar dalam komponen/service. Kredensial migrasi dan backup tidak dimasukkan ke proses web/API runtime.

Route mengikat schema, konteks autentikasi, status, dan respons. Service memuat aturan bisnis dan transaksi. Query/repository konkret mengakses PostgreSQL. Mapper menyusun DTO secara eksplisit. Helper kecil dapat tetap bersama fitur; tidak setiap fungsi memerlukan file atau class tersendiri.

Dependency eksternal seperti database, storage, clock, dan pembuat ID dapat diberikan melalui factory/parameter yang jelas agar mekanisme penting dapat diuji. Hindari service locator global dan mock yang mengganti seluruh perilaku database untuk mengklaim transaksi benar.

- Middleware menerapkan batas body, header/Origin, sesi, dan parsing sesuai urutan di API. Sesi diperiksa lagi pada setiap endpoint privat, termasuk lookup dan replay.
- Error bisnis dipetakan ke kode/status katalog API pada batas HTTP. Error tak terduga dicatat aman dengan request ID dan dikembalikan sebagai respons generik; jangan mengirim `error.message` provider mentah.
- Tidak menangkap seluruh error lalu mengembalikan sukses, daftar kosong, atau harga 0. Kegagalan response validation dianggap kegagalan server.
- Setelah commit, kegagalan pengiriman respons tidak menjadi klaim rollback. Klien mengikuti rekonsiliasi; handler tidak mencoba membatalkan data yang sudah committed.
- GET tidak mengubah konten. Pembaruan `lastSeenAt` sesi dan logging tetap mengikuti aturan sesi, tanpa polling yang mempertahankan idle session.
- Deadline dan retry dimiliki satu lapisan sesuai API. Batalkan pekerjaan yang dapat dibatalkan, periksa kepemilikan lease untuk media, dan hindari loop retry tanpa batas.

Log berbentuk JSON dengan waktu UTC, level, request ID, route template, status, durasi, serta kode kegagalan yang diperlukan. Redact password, cookie, token, connection string, isi multipart, dan body formulir. Audit bisnis ditulis bersama transaksi konten; log request boleh bertambah ketika replay, tetapi audit perubahan tidak boleh ganda.

## 9. Database, transaksi, dan media

Schema Drizzle TypeScript dan migrasi SQL tinggal di backend. Nama serta constraint mengikuti model data desain. Harga memakai integer; timestamp kejadian memakai `timestamptz`, jam lokal memakai tipe waktu, dan DTO dikonversi secara eksplisit. Parameter SQL tidak disusun dengan interpolasi string masukan pengguna; gunakan query builder atau parameter binding.

Satu service mutasi konten menjalankan pemeriksaan receipt, kunci versi global, validasi relasi, perubahan entitas, penanda waktu, audit, serta penyimpanan receipt dalam transaksi yang sama. Pemeriksaan receipt dilakukan kembali setelah menunggu request serentak bila diperlukan, sebelum menolak versi lama. Resource yang telah dihapus tidak menghalangi replay penghapusan yang sah.

Kueri koleksi memiliki urutan deterministik; reorder menerima seluruh ID termasuk tersembunyi. Jangan memproses perubahan urutan sebagai request terpisah per item. Profil, seluruh jadwal, dan kontak pada satu formulir disimpan atomik.

Tidak menahan transaksi/kunci database sepanjang decode gambar atau akses S3. Transisi media memeriksa ID percobaan, lease, status, dan referensi sesuai desain; hasil 202 belum boleh dilampirkan. Lampiran dan penghapusan memakai penguncian baris media yang sama. File input tidak menjadi object key; key immutable dibentuk server.

Job memiliki lease/kunci, batas waktu, retry terbatas, dan hasil yang dapat diperiksa setelah proses berhenti. Seluruh penghapusan fisik objek dikoordinasikan dengan backup. Tidak menambahkan penghapusan media `ready` hanya karena belum dipakai.

Migrasi diberi urutan dari generator dan nama deskriptif, ditinjau, serta disimpan bersama perubahan schema. Jangan mengedit migrasi yang sudah diterapkan pada lingkungan bersama atau menjalankan `push` schema pada produksi. Rilis menjalankan migrasi sekali dengan role khusus; aplikasi memakai hak runtime terbatas. Perubahan data besar atau destructive memerlukan prosedur migrasi/restore yang konkret sesuai desain, bukan otomatis dilakukan saat startup.

## 10. Tooling dan dependensi

Baseline format menggunakan Prettier dengan plugin Svelte dan Tailwind. Konfigurasi deklaratif berikut sudah aktif di `.prettierrc.json` sejak T-02:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 100,
  "singleQuote": false,
  "semi": true,
  "trailingComma": "all",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./apps/web/src/app.css",
  "overrides": [
    {
      "files": "*.svelte",
      "options": { "parser": "svelte" }
    }
  ]
}
```

Path stylesheet mengikuti lokasi konfigurasi root. Plugin Tailwind ditempatkan terakhir, sesuai [panduan resmi prettier-plugin-tailwindcss](https://github.com/tailwindlabs/prettier-plugin-tailwindcss). Versi plugin dipilih dan dipin setelah terbukti bekerja dengan baseline Svelte/Tailwind proyek.

Lint menggunakan ESLint flat config `eslint.config.ts`, integrasi TypeScript dan Svelte, serta aturan yang mencakup `.ts`, `.svelte`, dan `.svelte.ts`. ESLint mendukung konfigurasi TypeScript secara native ketika dijalankan pada Bun, tetapi tidak melakukan typecheck konfigurasi itu sendiri; target typecheck tetap diperlukan. Rujukan: [konfigurasi TypeScript ESLint](https://eslint.org/docs/latest/use/configure/configuration-files#typescript-configuration-files).

Aturan aktif: import tipe konsisten, explicit `any` dan `as unknown as` ditolak, Promise tidak dibiarkan tanpa penanganan, kode/import tidak dipakai ditolak, dan larangan import melintasi batas server/browser. Aturan berbasis tipe mendapat project/parser yang sesuai, termasuk komponen Svelte. Warning aksesibilitas Svelte ditangani, bukan disembunyikan secara global. Formatter dan lint berjalan sebagai pemeriksaan terpisah.

Aturan `project/import-boundaries` memeriksa import, re-export, dynamic import literal, dan import tipe. Path lokal harus berada di workspace sendiri; kontrak diakses melalui exports paket. Kontrak hanya mengimpor modulnya sendiri dan Zod. Web tidak mengimpor API, Drizzle, Elysia, atau Sharp; modul browser/universal tidak mengimpor runtime Node/Bun, environment privat, atau modul server. Alias yang dikenali adalah `$lib` dan nama workspace; penambahan alias resolusi harus memperbarui pemeriksaan serta tesnya. Import dinamis nonliteral dan `require` ditolak pada aplikasi/kontrak.

`check:source` memindai sumber di luar direktori generated/dependency, termasuk skrip dan konfigurasi. Ekstensi logika authored dibatasi `.ts` dan `.svelte` agar tidak ada `.mts`, `.cts`, atau JSX yang lolos tanpa target lint/typecheck. Script instance/module Svelte diperiksa memakai parser compiler, sehingga teks atau komentar yang berisi `<script>` tidak dianggap kode. Formatter mencakup source/config yang didukung Prettier; README dan `docs/` dikecualikan secara eksplisit untuk mempertahankan format dokumen perencanaan dan ditinjau saat diedit.

Tooling dijalankan menggunakan dependency lokal melalui script package dengan runtime Bun, misalnya `bun --bun run lint`. Tidak menggunakan unduhan `latest` melalui runner sementara pada CI. Bun serta dependency dipin, satu `bun.lock` dikomit, dan CI memakai `bun install --frozen-lockfile`. Kandidat versi pada desain belum menjadi jaminan kompatibilitas; upgrade membawa perubahan lockfile dan bukti build/alur terdampak.

Konfigurasi SvelteKit tetap pada `vite.config.ts` sesuai desain; jangan menyalin `svelte.config.js`, `tailwind.config.js`, atau config JS lain dari tutorial. Logika skrip operasional memakai TS; YAML/Dockerfile hanya deklarasi dan pemanggilan skrip. Artefak `.svelte-kit`, build, coverage, laporan browser, dependency, dan environment nyata diabaikan oleh Git/formatter/linter sesuai fungsinya. SQL migrasi yang menjadi sumber rilis tetap dikomit.

## 11. Pengujian dan pemeriksaan CI

Pengujian mengikuti perilaku serta risiko perubahan. Bun test dipilih untuk unit/helper/schema dan integrasi backend; Playwright dengan file TypeScript untuk alur browser. Kemampuan runner merujuk pada [Bun test](https://bun.com/docs/test); kompatibilitas runner browser serta dependency tetap harus dibuktikan pada toolchain Bun/Linux yang dipilih.

| Lapisan | Yang dibuktikan | Batas dan aturan |
| --- | --- | --- |
| Unit/kontrak | Harga kosong/0/pecahan, normalisasi, rentang jadwal, strict schema, mapper publik | Fixture punya expected output mandiri; jangan menghitung ekspektasi melalui fungsi yang sedang diuji |
| Integrasi API + PostgreSQL nyata | Sesi, rollback, versi, receipt serentak, reorder, dan reference locking | Database/schema terisolasi per suite/worker; jangan mengganti PostgreSQL dengan SQLite atau mock untuk klaim ini |
| Media | Validasi decode, partial upload, lease, penghapusan, serta rekonsiliasi | Uji parser dengan file nyata; uji storage terhadap layanan S3-compatible terisolasi, lalu verifikasi perilaku penyedia target sebelum rilis |
| E2E web/API | Wisatawan membaca tiket, admin menyimpan, konflik, sesi habis, dan upload | Jalankan aplikasi produksi pada Bun; data uji/akun/bucket terpisah dari produksi |
| SSR/SEO | Konten tersedia tanpa JavaScript, canonical/meta/JSON-LD, sitemap, noindex | Periksa HTML HTTP dan browser tanpa JavaScript, termasuk kegagalan API; hydration sukses saja belum cukup |
| UI/aksesibilitas | Keyboard, fokus dialog/error, label, reduced motion, mobile/desktop | Gunakan viewport desain; gabungkan pemeriksaan otomatis dan tinjauan manual pada alur yang berubah |

Nama test menjelaskan kondisi dan hasil, misalnya **menolak harga kosong tanpa mengubah tarif publik**. Gunakan fixture berlabel, ID yang dapat dilacak, dan waktu tetap melalui clock yang dikendalikan ketika menguji TTL/lease. Jangan mengandalkan sleep panjang untuk kebetulan mendapatkan race; koordinasikan batas transaksi/commit dan amati hasilnya.

Pengujian browser memakai locator berdasarkan role/label dan assertion yang menunggu keadaan yang diharapkan, bukan selector kelas Tailwind atau timeout tetap. Setiap test dapat berjalan sendiri; perubahan data tidak bergantung urutan test. Pedoman ini sejalan dengan [Playwright best practices](https://playwright.dev/docs/best-practices).

Discovery test Bun harus mengecualikan suite Playwright dan memisahkan unit dari integrasi yang memerlukan layanan. Worker yang mengubah data global memakai fixture/database terpisah atau dijalankan serial secara eksplisit. Database/bucket test divalidasi konfigurasinya sebelum fixture cleanup; kegagalan menyiapkan lingkungan bukan alasan untuk melaporkan suite penting sebagai lulus.

Unit frontend pada Bun dibatasi pada helper/schema `.ts` yang tidak membutuhkan compiler Svelte atau DOM. Komponen dan modul rune `.svelte.ts` diuji melalui hasil kompilasi aplikasi pada pengujian browser; jangan mengimpor modul rune langsung ke Bun test lalu menganggap perilaku reaktifnya sudah diuji.

Perintah root berikut aktif sejak T-02; semuanya harus gagal dengan exit code nonzero bila pemeriksaan gagal:

| Perintah | Tanggung jawab |
| --- | --- |
| `bun --bun run format:check` | Memeriksa format file authored yang didukung, tanpa mengubah file |
| `bun --bun run format` | Memformat file secara eksplisit saat development |
| `bun --bun run lint` | Lint TS/Svelte, aksesibilitas yang terdeteksi, dan batas import |
| `bun --bun run check` | Sync SvelteKit; svelte-check; tsc tanpa emit untuk API, kontrak, helper, serta konfigurasi/tooling |
| `bun --bun run check:source` | Memeriksa tidak ada sumber JS authored dan script Svelte berlogika tanpa TypeScript; artefak/dependency dikecualikan |
| `bun --bun run test:unit` | Unit/schema/helper yang tidak memerlukan database atau browser |
| `bun --bun run test:integration` | Integrasi API, transaksi, serta media dengan dependency uji tersedia |
| `bun --bun run build` | Build/kemasan produksi web dan API sesuai baseline, menggunakan dependency yang sudah terkunci |
| `bun --bun run test:e2e` | Alur browser dan SSR terhadap build produksi pada lingkungan uji |

Urutan CI aktif: install frozen → format/check sumber/lint/typecheck → unit → build → integrasi → pemasangan browser → E2E. Integrasi bootstrap memakai output produksi sehingga build mendahuluinya. Saat ini unit menguji kebijakan tooling dan integrasi membuktikan decode Sharp serta proses web/API; suite schema, PostgreSQL, dan storage ditambahkan bersama fiturnya tanpa script kosong yang mengklaim sukses. `bunfig.toml` membatasi discovery Bun ke `tests/unit`, sedangkan Playwright hanya menemukan `tests/e2e`.

Workflow `.github/workflows/ci.yml` memakai Bun `1.4.0`, dependency lokal, action yang dipin ke commit, izin `contents: read`, dan timeout. Sesuai instruksi pemilik proyek 11 September 2026, workflow dipicu manual (`workflow_dispatch`) dan tes memerlukan konfirmasi terlebih dahulu; push tidak memicu tes otomatis. Eksekusi CI GitHub belum dibuktikan; hasil lokal/Linux sebelum kebijakan ini beserta batasnya ada di [bukti T-02](./evidence/t02-code-checks.md). Pemeriksaan independen boleh berjalan paralel dengan fixture terisolasi setelah disetujui. Test tidak boleh auto-skip ketika dependency wajib hilang. Simpan bukti kegagalan seperti request ID atau trace seperlunya tanpa mengekspos cookie/kredensial.

Tidak menetapkan angka coverage global sebagai pengganti bukti. Perubahan kosmetik kecil cukup diverifikasi format dan tampilan yang terdampak; perubahan harga, autentikasi, transaksi, atau media memerlukan bukti perilaku terkait. Setelah pemeriksaan relevan lulus, perluas pengujian hanya jika ada risiko atau perubahan tambahan yang membutuhkannya.

## 12. Git, review, dan dokumentasi

Setiap perubahan memiliki cakupan yang dapat ditinjau. Gunakan commit ringkas seperti `feat(tickets): add admin rate editing` atau `fix(media): reject referenced asset deletion`; ini usulan kebiasaan proyek, bukan alasan mengganti cakupan pekerjaan.

PR menjelaskan masalah, perubahan perilaku akhir, serta validasi yang benar-benar dijalankan. Sebutkan migrasi, perubahan kontrak, atau konfigurasi jika diperlukan reviewer. Jangan mengklaim sebuah endpoint, pengamanan, atau deployment selesai hanya karena kode terbangun atau dokumennya tersedia.

Sebelum penggabungan, tinjau diff aktual untuk perubahan yang tidak disengaja, file generated, data uji produksi, secret, serta perubahan API/schema tanpa dokumentasi. Jangan menyertakan reformat repository yang tidak berkaitan dengan perubahan fitur. Perubahan kontrak memperbarui `api-standar.md`; perubahan arsitektur memperbarui `design.md`; perubahan cakupan produk dicatat pada `requirement.md` berdasarkan keputusan pengguna.

## 13. Kriteria konvensi telah diterapkan

Konvensi dianggap diterapkan setelah workspace memiliki konfigurasi aktif dan bukti bahwa kode TS/Svelte diperiksa, boundary import ditegakkan, shared schema digunakan FE/BE, build produksi berjalan pada Bun, serta test perilaku relevan lulus. Daftar perintah tertulis atau snippet dokumentasi saja belum memenuhi kriteria tersebut.

Tahap 6 menghasilkan pedoman yang dapat ditinjau. Urutan implementasi, dependensi pekerjaan, dan kriteria selesai tersedia pada [task.md](./task.md). T-01 menerapkan fondasi dan pemeriksaan minimum; T-02 mengaktifkan format, lint, batas import, pemeriksaan sumber, pemisahan suite, dan kerangka CI. CI penerimaan MVP lengkap tetap dibuktikan pada T-23.
