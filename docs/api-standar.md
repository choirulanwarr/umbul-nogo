# Standar API — UMBUL NOGO

> Status: draf tahap 5 — kontrak untuk implementasi berdasarkan [requirement.md](./requirement.md) dan arsitektur pada [design.md](./design.md).
> Asumsi: satu destinasi, satu peran admin, informasi tiket tanpa transaksi, dan frontend serta API pada satu origin. Batas panjang field dan parameter operasional di bawah adalah usulan teknis.
> Endpoint MVP `/api/v1` belum diimplementasikan. Endpoint sementara `GET /internal/bootstrap` kini membaca profil DB melalui fondasi T-05; factory menyediakan boundary `/api/v1` untuk route fitur berikutnya dan health internal. Snapshot publik sebenarnya mengikuti T-14. Contoh harga, UUID, versi, dan waktu merupakan fixture pengembangan; bukan data operasional UMBUL NOGO.
> Pembaruan 10 September 2026: kontrak Operasional privat dan pengisian awal pada bagian 5.3–5.4; alur pengguna pada [settings.md](./settings.md).
> Implementasi schema T-03 tersedia di `packages/contracts/src` melalui exports per domain; lihat [bukti dan batas verifikasi](./evidence/t03-shared-contracts.md). Schema ini belum merupakan implementasi endpoint HTTP.

## 1. Cakupan dan kepemilikan

API Elysia berjalan pada Bun dan menjadi pemilik validasi, autentikasi, transaksi PostgreSQL, serta penulisan gambar ke S3. SvelteKit menggunakan API untuk SSR dan formulir admin. Seluruh schema dan tipe kontrak dibuat dalam TypeScript di `packages/contracts`; schema database dan kredensial tetap di backend.

Cakupan API: snapshot destinasi untuk wisatawan; sesi admin; profil, jadwal, kontak, daya tarik, tarif, fasilitas, galeri, SEO; serta unggahan dan pustaka media. Pendaftaran wisatawan, pemesanan, pembayaran, dan penerbitan tiket tidak menjadi endpoint MVP.

Pengaturan Operasional privat menggunakan `/admin/operations`. Istilah mutasi konten dan versi konten dalam dokumen ini juga mencakup penyimpanan pengaturan tersebut. API tidak menyediakan mutasi environment, pembelian domain/hosting, pemindahan storage, atau pengelolaan tagihan penyedia.

Dokumen ini menetapkan perilaku kontrak. Pada implementasi, schema Zod menjadi sumber validasi runtime dan tipe DTO turunan. Perubahan schema, handler, klien, dan dokumentasi harus konsisten dalam perubahan yang sama.

## 2. Aturan transport dan format

### 2.1 URL, metode, dan header

Base path adalah `/api/v1`. Path memakai Bahasa Inggris, huruf kecil, dan kebab-case; field JSON memakai camelCase. Tabel endpoint berikut menulis path relatif terhadap base path. Path kanonis tidak memiliki slash akhir. Mutasi ke path lain tidak dialihkan otomatis. ID entitas berupa UUID huruf kecil.

| Bagian | Ketentuan |
| --- | --- |
| Transport | HTTPS pada produksi; browser memakai origin website yang sama |
| Baca | `GET`, tanpa request body dan tanpa perubahan konten |
| Tambah | `POST`; ID dibuat server |
| Ganti data | `PUT` untuk seluruh field yang boleh diedit pada resource; field wajib tidak boleh dihilangkan |
| Hapus | `DELETE`, tanpa body; aturan versi penghapusan konten ada di bagian 7 |
| JSON | `Content-Type: application/json`; UTF-8; `Accept: application/json` pada klien aplikasi |
| Unggahan | `multipart/form-data` dengan boundary yang dibuat browser; tepat satu field berkas `file` |
| Header aplikasi | `X-Umbul-Client: admin-web` wajib untuk semua request `/auth/*` dan `/admin/*`, termasuk GET internal dari SvelteKit |
| Mutasi konten | `Idempotency-Key`, UUID v4 baru per niat penyimpanan; dipertahankan saat retry niat yang sama |
| Request ID | Server/proxy tepercaya membuat UUID dan mengirim `X-Request-Id`; nilai yang sama berada dalam `meta.requestId` |
| Cache | Respons publik `Cache-Control: no-store`; auth/admin `Cache-Control: private, no-store`, termasuk error |
| Ukuran | Body JSON maksimum 65.536 byte; multipart maksimum 6.291.456 byte; berkas maksimum 5.242.880 byte |

GET dan DELETE tidak memakai body untuk menjaga interoperabilitas. PUT di sini mengganti representasi yang dapat diedit, dengan field hasil server tetap dikelola server. Pilihan metode dan arti status HTTP mengacu pada [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html). Detail envelope dan header aplikasi merupakan kontrak proyek.

API menolak JSON tidak sah, tipe konten yang tidak didukung, field tidak dikenal, query tidak dikenal, dan parameter query berulang. Batas body ditegakkan saat membaca stream pada proxy dan API, termasuk tanpa Content-Length. GET tidak memakai query pencarian, sorting, atau pagination kecuali yang disebutkan secara eksplisit. Method yang tidak didukung menghasilkan `405` dengan header `Allow`. API tidak mengembalikan redirect ke HTML login ketika sesi berakhir.

### 2.2 Envelope respons

Semua respons aplikasi yang memiliki body memakai salah satu envelope berikut. HEAD dan respons infrastruktur yang gagal sebelum handler berjalan dapat tidak memiliki envelope; klien harus menangani respons non-JSON sebagai kegagalan transport/protokol.

```ts
type ApiSuccess<T, M extends object = object> = {
  success: true;
  data: T;
  meta: { requestId: string } & M;
};

type ContentState = {
  contentVersion: number;
  publicUpdatedAt: string;
  ticketsUpdatedAt: string | null;
};

type MutationMeta = ContentState & {
  idempotency: {
    key: string;
    replayed: boolean;
    originalRequestId: string;
    expiresAt: string;
  };
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Array<{ path: string; code: string; message: string }>;
    details?: Record<string, unknown>;
  };
  meta: { requestId: string };
};
```

Ini adalah notasi dokumentasi; implementasi mempersempit `error.code` dan `details` menjadi discriminated union dari katalog kesalahan bagian 9. `Record<string, unknown>` tidak menjadi izin mengirim objek database/error mentah. Jangan mengimpor tipe ORM sebagai kontrak respons.

- Pembacaan konten admin menggunakan `ApiSuccess<T, ContentState>`; data dan versi diperoleh dari snapshot transaksi read-only `REPEATABLE READ` yang sama.
- Mutasi konten menggunakan `ApiSuccess<T, MutationMeta>` dan baru dikirim setelah commit.
- Publik, sesi, dan media tidak menerima `contentVersion` administratif. Penanda pembaruan publik berada di DTO publik.
- Respons daftar memakai `data.items`; daftar lengkap tanpa pagination tidak diberi pagination semu.
- Tanggal kejadian berupa ISO 8601 UTC dengan akhiran `Z`. Jam operasional adalah `HH:mm` dalam `Asia/Jakarta`, bukan timestamp UTC.
- Harga berupa angka Rupiah bulat. `null` berarti belum tersedia/tidak dipakai; `[]` berarti daftar sah yang kosong. Field opsional dalam hasil tetap dikirim sebagai `null` bila kontraknya nullable.
- `contentVersion` adalah integer aman JavaScript, mulai dari 0. Kolom database dan validasi membatasi rentangnya agar tidak kehilangan presisi saat serialisasi.

Contoh kesalahan validasi harga:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Periksa kembali data yang diisi.",
    "fieldErrors": [
      {
        "path": "priceIdr",
        "code": "OUT_OF_RANGE",
        "message": "Harga harus berupa Rupiah bulat, minimal 0."
      }
    ]
  },
  "meta": { "requestId": "478d88e2-5f11-46d4-bc21-f99e9ae81913" }
}
```

## 3. Autentikasi dan perlindungan request

### 3.1 Endpoint sesi

| Metode | Path | Request | Hasil |
| --- | --- | --- | --- |
| POST | `/auth/login` | JSON `{ email, password }` | `200`, `SessionDto`, dan Set-Cookie baru |
| GET | `/auth/session` | Cookie sesi | `200`, `SessionDto`; `401` jika tidak sah/kedaluwarsa |
| POST | `/auth/logout` | JSON `{}` dan cookie jika ada | `200`, `{ loggedOut: true }`, setelah pencabutan sesi dan pengosongan cookie |

`SessionDto` berisi `user: { id, email, role: "admin" }`, `expiresAt`, dan `idleExpiresAt`. Token, hash password, dan hash sesi tidak masuk body. Login menormalisasi email dengan trim dan lowercase; password tidak di-trim atau dinormalisasi. Panjang email maksimum 254 karakter, password 15–128 karakter sesuai provisioning.

Email/password salah dan akun nonaktif menghasilkan `401 INVALID_CREDENTIALS` dengan pesan yang sama: **Email atau kata sandi tidak sesuai.** Percobaan dibatasi 5 per email dan 30 per alamat sumber dalam 15 menit secara atomik di PostgreSQL; jika salah satu batas tercapai, balas `429 RATE_LIMITED` dan `Retry-After` dalam detik.

Cookie produksi: `__Host-umbul_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, tanpa Domain; `Max-Age` tidak melebihi 28.800 detik. Batas absolut sesi 8 jam dan idle 30 menit ditegakkan di server. Login yang berhasil mengganti sesi browser yang disajikan dengan sesi baru. GET sesi memperbarui aktivitas; frontend tidak melakukan polling sesi tanpa aktivitas pengguna karena akan mempertahankan sesi idle secara tidak sengaja.

Logout boleh diulang saat cookie sudah hilang atau sesi sudah kedaluwarsa; hasil tetap `200` dan cookie dibersihkan. Jika pencabutan sesi yang mungkin masih aktif tidak dapat dipastikan karena database gagal, balas `503`, jangan mengklaim logout server berhasil. Logout tidak memakai tanda terima mutasi konten. Setelah login kembali, retry konten masih harus mengikuti bagian 7.

### 3.2 Pemeriksaan akses

Semua endpoint `/admin/*` memerlukan sesi admin aktif. Sesi tetap diperiksa sebelum mengembalikan tanda terima lama. Semua metode tidak aman, termasuk login, logout, upload, dan DELETE, memerlukan Origin yang sama persis dengan `SITE_ORIGIN` serta `X-Umbul-Client: admin-web`. Origin kosong, `null`, atau berbeda menghasilkan `403 ORIGIN_NOT_ALLOWED`; header aplikasi hilang/salah menghasilkan `403 CLIENT_HEADER_REQUIRED`.

Header aplikasi bukan rahasia atau bukti identitas. Kombinasi pemeriksaan Origin, header khusus, cookie, dan larangan CORS lintas origin melindungi alur browser. Body JSON hanya diterima sebagai JSON; multipart hanya pada upload dengan pemeriksaan yang sama. Pengecualian development menggunakan daftar origin eksplisit dalam konfigurasi, tanpa wildcard bercredential; aturan produksi tetap satu origin. Dasar proteksi ini: [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Urutan pemeriksaan: batas transport dan routing → origin/header untuk mutasi → sesi/otorisasi → parsing serta validasi → aturan bisnis. Login tidak membutuhkan sesi lama. GET internal SvelteKit membawa header aplikasi dan hanya cookie sesi yang diperlukan ke `API_INTERNAL_URL` tepercaya; pembacaan snapshot publik tidak meneruskan cookie admin.

API tidak menerima bearer token dari localStorage. Pembuatan akun, reset password, dan penonaktifan akun tetap melalui skrip operator TypeScript yang mencabut sesi sesuai `design.md`.

## 4. Snapshot publik untuk SSR

### 4.1 Endpoint dan bentuk data

`GET /public/site` tanpa query dan tanpa autentikasi menghasilkan `200 ApiSuccess<PublicSiteDto>`. Backend membaca seluruh bagian dari satu transaksi read-only `REPEATABLE READ`. SvelteKit memakai objek yang sama untuk HTML, meta tag, JSON-LD, dan hydration.

```ts
type ImageVariantDto = {
  url: string;
  width: number;
  height: number;
  mimeType: "image/webp";
  byteSize: number;
};

type ImageDto = {
  alt: string;
  variants: ImageVariantDto[];
};

type OpeningHourDto =
  | {
      weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      status: "open";
      opensAt: string;
      closesAt: string;
      closesNextDay: boolean;
    }
  | {
      weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      status: "closed" | "unknown";
      opensAt: null;
      closesAt: null;
      closesNextDay: false;
    };

type ContactKind = "phone" | "whatsapp" | "email" | "website" | "instagram";

type PublicSiteDto = {
  name: string;
  introduction: string | null;
  region: string;
  hero: ImageDto | null;
  logo: ImageDto | null;
  attractions: Array<{
    id: string;
    name: string;
    description: string;
    image: ImageDto | null;
  }>;
  tickets: {
    currency: "IDR";
    updatedAt: string | null;
    items: Array<{
      id: string;
      name: string;
      priceIdr: number;
      unit: string;
      terms: string;
      applicabilityNote: string | null;
    }>;
  };
  facilities: Array<{ id: string; name: string; description: string | null }>;
  gallery: Array<{ id: string; image: ImageDto; caption: string | null }>;
  visit: {
    timezone: "Asia/Jakarta";
    address: string | null;
    coordinates: { latitude: number; longitude: number } | null;
    mapUrl: string | null;
    notes: string | null;
    openingHours: OpeningHourDto[];
    contacts: Array<{ id: string; kind: ContactKind; label: string; href: string }>;
  };
  seo: {
    title: string;
    description: string;
    image: ImageDto | null;
  };
  publicUpdatedAt: string;
};
```

`variants` tidak kosong, lebar unik terurut menaik, dan hanya memuat URL hasil normalisasi yang sudah `ready`. Alt hero/aktivitas/galeri berasal dari konteks penggunaan; alt logo adalah `Logo ${name}` dan alt gambar berbagi adalah nama destinasi. Hero tidak tersedia menghasilkan `null`; backend tidak memilih foto lain secara acak.

`seo.title` menggunakan override atau nama. `seo.description` menggunakan override, lalu pengantar, lalu fallback faktual **Informasi wisata dan tiket masuk {name} di {region}.** `seo.image` menggunakan gambar SEO khusus atau hero jika tersedia. URL canonical tetap dibentuk SvelteKit dari `SITE_ORIGIN` root, sehingga API tidak menerima nilai canonical dari admin/pengunjung.

### 4.2 Aturan publikasi dan kegagalan

- Daftar hanya berisi item `isVisible: true`, termasuk kontak; status administratif dan jumlah item tersembunyi tidak dikirim. Urutan publik mengikuti `sortOrder`, lalu ID; angka posisi tidak perlu dikirim.
- Jadwal selalu memiliki tujuh hari, Senin = 1 sampai Minggu = 7. Hari belum diketahui berstatus `unknown`; tidak diubah menjadi tutup atau jam perkiraan.
- Tarif kosong menghasilkan `tickets.items: []`. UI menampilkan **Informasi harga tiket belum tersedia**. `updatedAt` dapat tetap berisi waktu terakhir perubahan daftar publik walaupun tarif terakhir sudah disembunyikan.
- Harga 0 hanya berasal dari angka 0 yang sengaja disimpan pengelola. DTO tidak menyediakan harga fallback, hasil kalkulasi checkout, atau harga minimum buatan.
- Informasi utama gagal dibaca, schema hasil tidak sah, atau referensi data rusak tidak diubah menjadi snapshot kosong. Gangguan dependency menghasilkan `503 SERVICE_UNAVAILABLE`; bug/integritas API menghasilkan `500 INTERNAL_ERROR`. SvelteKit memetakan kegagalan snapshot tersebut menjadi halaman gangguan HTTP 503 tanpa tarif palsu.
- Snapshot publik tidak menerima parameter untuk melihat draft. Admin memeriksa hasil publik melalui endpoint publik yang sama.
- Anggaran, penanggung jawab internal, dan catatan Operasional tidak masuk `PublicSiteDto`, metadata, HTML publik, atau data hydration publik. Mapper memilih field publik secara eksplisit; tidak menggabungkan objek pengaturan internal ke snapshot.

Sitemap, robots.txt, canonical, dan JSON-LD disajikan oleh endpoint/halaman SvelteKit, bukan endpoint admin tambahan. JSON-LD memakai informasi nyata yang tersedia sesuai bagian 15 `design.md`; tiket tetap informasi HTML pada MVP.

## 5. Profil destinasi, jadwal, kontak, SEO, dan operasional

### 5.1 Endpoint singleton

| Metode | Path | Request / data hasil |
| --- | --- | --- |
| GET | `/admin/destination` | `200`, seluruh `DestinationFields`, versi konten, serta `heroPreview` dan `logoPreview` bertipe `ImageDto \| null` |
| PUT | `/admin/destination` | JSON `DestinationFields` lengkap + `expectedContentVersion`; `200` dengan data bentuk GET dan metadata mutasi |
| GET | `/admin/seo` | `200`, `SeoFields`, `imagePreview: ImageDto \| null`, dan versi konten |
| PUT | `/admin/seo` | JSON `SeoFields` lengkap + `expectedContentVersion`; `200` dengan data bentuk GET dan metadata mutasi |

```ts
type ContactInput = {
  id: string | null;
  kind: ContactKind;
  label: string;
  value: string;
  isVisible: boolean;
};

type DestinationFields = {
  name: string;
  introduction: string | null;
  region: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  visitNotes: string | null;
  heroMediaId: string | null;
  heroAlt: string | null;
  logoMediaId: string | null;
  openingHours: OpeningHourDto[];
  contacts: ContactInput[];
};

type SeoFields = {
  title: string | null;
  description: string | null;
  imageMediaId: string | null;
};
```

Pada respons, seluruh kontak memiliki ID UUID non-null yang dibuat server. Input kontak baru memakai `id: null`; ID lama harus milik kontak yang masih ada dan tidak boleh berulang. Seluruh kontak lama, termasuk tersembunyi, dikirim ketika formulir dimuat. Urutan array menjadi urutan kontak; menghilangkan kontak lama berarti menghapusnya. GET tidak mengembalikan field SQL `sort_order` untuk diedit langsung.

PUT destinasi menyimpan profil, tujuh jadwal, dan seluruh kontak dalam satu transaksi. Kegagalan satu kontak/jadwal membatalkan keseluruhan operasi. PUT SEO hanya mengubah kolom SEO meskipun penyimpanannya berada dalam tabel profil yang sama. Kedua endpoint tetap berbagi versi global.

### 5.2 Validasi field

| Field | Aturan awal |
| --- | --- |
| Nama destinasi / region | Wajib, 1–120 / 1–160 karakter |
| Pengantar | Nullable; jika diisi 1–2.000 karakter |
| Alamat / catatan kunjungan | Nullable; maksimum 1.000 / 3.000 karakter |
| Koordinat | Keduanya null atau keduanya angka finite; latitude −90 sampai 90, longitude −180 sampai 180 |
| Map URL | Nullable; HTTPS absolut, maksimum 2.048 karakter, tanpa userinfo; tidak diambil oleh server |
| Hero | ID dan alt sama-sama null, atau ID media `ready` dan alt 1–200 karakter |
| Logo | Nullable; jika diisi harus merujuk media `ready` |
| Judul / deskripsi SEO | Nullable; 1–120 / 1–320 karakter; preview panjang tampilan adalah bantuan UI, bukan janji tampilan Google |
| Gambar SEO | Nullable; jika diisi media `ready` |
| Jadwal | Tepat tujuh weekday unik, dinormalisasi Senin–Minggu; status dan jam sesuai union |
| Kontak | Label 1–80 karakter; nilai wajib valid sesuai jenis walaupun kontak tersembunyi |

Jam berupa `00:00`–`23:59`. Untuk hari terbuka, durasi dihitung sebagai `tutup - buka + (closesNextDay ? 1440 : 0)` menit dan harus lebih dari 0 serta maksimum 1.440. Contoh buka 22:00, tutup 05:00 memerlukan `closesNextDay: true`. Jam sama dengan `closesNextDay: true` berarti 24 jam. Baris terbuka tidak boleh bertumpang tindih dengan jadwal terbuka hari berikutnya, termasuk Minggu ke Senin; status tutup pada hari berikutnya berarti tidak ada periode pembukaan baru hari itu. Label UI harus menjelaskan jam yang berakhir esok hari.

Telepon/WhatsApp memakai nomor internasional yang dinormalisasi ke `+` diikuti 8–15 digit, digit pertama bukan 0. FE membantu konversi format lokal sebelum kirim. Backend membentuk `tel:` atau `https://wa.me/` dari nomor tervalidasi. Email valid maksimum 254 karakter membentuk `mailto:`. Website memakai HTTPS absolut; Instagram menerima URL HTTPS dengan host tepat `instagram.com` atau `www.instagram.com`. URL maksimum 2.048 karakter, tanpa kredensial; protokol eksekusi ditolak. API tidak menguji kebenaran operasional alamat, nomor, atau tujuan peta; pengelola memverifikasinya sebelum ditampilkan.

### 5.3 Pengaturan Operasional privat

| Metode | Path | Request / data hasil |
| --- | --- | --- |
| GET | `/admin/operations` | `200 ApiSuccess<OperationsFields, ContentState>` dari snapshot yang sama dengan versi |
| PUT | `/admin/operations` | JSON `OperationsFields` lengkap + `expectedContentVersion`; `200 ApiSuccess<OperationsFields, MutationMeta>` setelah commit |

```ts
type OperationsFields = {
  monthlyBudgetIdr: number | null;
  destinationManagerName: string | null;
  destinationManagerPhone: string | null;
  destinationManagerEmail: string | null;
  technicalOperatorName: string | null;
  technicalOperatorPhone: string | null;
  technicalOperatorEmail: string | null;
  internalNotes: string | null;
};
```

Seluruh key wajib hadir pada PUT/GET; semua nilai boleh null, termasuk seluruh formulir. Field tidak dikenal ditolak. Frontend mengubah kolom opsional kosong menjadi null, sementara API menolak string kosong setelah trim pada nilai non-null. Nama non-null 1–120 karakter, catatan 1–2.000 karakter; telepon dan email mengikuti validasi kontak bagian 5.2. Field dapat diisi bertahap secara independen; kelengkapan nama beserta kanal kontak adalah indikator pada Pengaturan, bukan syarat menyimpan field valid.

`monthlyBudgetIdr` berupa integer JSON 0–2.147.483.647 atau null, sesuai kolom PostgreSQL integer. String angka, negatif, pecahan, dan nilai di luar rentang ditolak dengan `422 VALIDATION_ERROR`. Null berarti belum ditetapkan; 0 adalah anggaran Rp0 yang sengaja diisi. Mata uang tetap IDR dan periode tetap bulanan pada MVP; tidak ada konversi mata uang atau integrasi billing.

Kedua endpoint memerlukan sesi admin serta header aplikasi; PUT juga memerlukan Origin dan `Idempotency-Key` sesuai bagian 3 dan 7. Data, kenaikan `contentVersion`, metadata audit, dan receipt disimpan atomik. Operasi ini berbagi versi global dengan profil/koleksi sehingga dua penyimpanan dari versi sama dapat berkonflik meskipun form berbeda. `publicUpdatedAt` dan `ticketsUpdatedAt` tidak berubah. Lookup receipt mengizinkan path konkret `/api/v1/admin/operations` dengan method PUT; replay dan pemulihan setelah timeout mengikuti bagian 7.

Data hanya tersedia pada halaman admin terkait dan receipt privat milik akun sesuai retensi yang ada. Log/audit menyimpan metadata tindakan tanpa isi kontak, nominal, catatan, atau body respons. Input ini tidak membuat/mengubah akun, kontak publik, tujuan notifikasi, atau konfigurasi deployment. Seluruh admin memiliki akses yang sama pada MVP. Tidak ada endpoint DELETE singleton; mengosongkan nilai dilakukan dengan PUT null.

### 5.4 Bootstrap dan daftar kelengkapan

Bootstrap membuat singleton profil, state, dan Operasional. Nama awal `UMBUL NOGO`, region `Wonogiri, Jawa Tengah`, `contentVersion: 0`, `publicUpdatedAt` waktu inisialisasi, serta `ticketsUpdatedAt: null`. Field opsional null, koleksi/kontak kosong, dan tujuh jadwal unknown. Inisialisasi tidak dijalankan ulang untuk menimpa isian admin. Singleton wajib yang hilang setelah bootstrap dianggap masalah integritas, bukan dibuat diam-diam oleh GET.

Daftar kelengkapan menggunakan proyeksi yang sudah tersedia pada `/public/site` serta data privat `/admin/operations`, dengan aturan [settings.md](./settings.md). Tidak menambah field readiness ke snapshot publik, endpoint generik key-value settings, atau status lengkap yang disimpan terpisah. Form destinasi tetap memakai `DestinationFields` lengkap dengan null/unknown/array kosong yang sah; tidak menambahkan PATCH atau autosave draft pada MVP.

## 6. Daya tarik, tarif, fasilitas, dan galeri

### 6.1 Pola endpoint

`{collection}` hanya salah satu dari `attractions`, `ticket-rates`, `facilities`, atau `gallery-items`. Setiap pola berikut merupakan route konkret untuk masing-masing koleksi tersebut; string koleksi lain ditolak.

| Metode | Path | Perilaku / hasil |
| --- | --- | --- |
| GET | `/admin/{collection}` | `200`, `{ items: ItemDto[] }` lengkap termasuk tersembunyi, dengan versi snapshot |
| GET | `/admin/{collection}/{id}` | `200`, `ItemDto` dengan versi snapshot; UUID sah yang tidak ditemukan menghasilkan `404` |
| POST | `/admin/{collection}` | Field item + `expectedContentVersion`; `201`, `ItemDto`, metadata mutasi, dan `Location: /api/v1/admin/{collection}/{id}` |
| PUT | `/admin/{collection}/{id}` | Semua field editable + `expectedContentVersion`; `200`, `ItemDto` dan metadata mutasi; tidak membuat ID yang tidak ditemukan |
| DELETE | `/admin/{collection}/{id}?expectedContentVersion=42` | Tanpa body; `200`, `{ id, deleted: true }` dan metadata mutasi |
| PUT | `/admin/{collection}/order` | `{ expectedContentVersion, ids: string[] }`; `200`, `{ ids: string[] }` dan metadata mutasi |

Route literal `/order` didaftarkan terpisah dari parameter UUID. List konten tidak dipaginasi karena seluruh isinya membentuk satu landing page. UI mengurutkan berdasarkan daftar lengkap yang diterima, termasuk item tersembunyi; filter lokal tidak boleh mengubah daftar ID yang dikirim ke `/order`.

### 6.2 Field per koleksi

Semua tipe masukan di bawah ditambah `expectedContentVersion`. `isVisible` wajib boolean dalam PUT; boleh tidak dikirim pada POST dengan default `false`. POST boleh mengirim `true` secara eksplisit apabila semua data publik lengkap, sesuai kontrol **Tampilkan di Website**. ID, timestamp, serta posisi urutan tidak diterima sebagai field editable.

| Koleksi | Field editable | Kelengkapan dan batas |
| --- | --- | --- |
| `attractions` | `name: string`, `description: string \| null`, `mediaId: string \| null`, `imageAlt: string \| null`, `isVisible: boolean` | Nama 1–120; deskripsi nullable saat tersembunyi dan wajib 1–3.000 karakter saat tampil; media dan alt berpasangan, alt 1–200 bila media dipakai |
| `ticket-rates` | `name: string`, `priceIdr: number`, `unit: string`, `terms: string`, `applicabilityNote: string \| null`, `isVisible: boolean` | Nama 1–100; harga integer 0–2.147.483.647; satuan 1–60; ketentuan 1–3.000; catatan nullable maksimum 500 karakter |
| `facilities` | `name: string`, `description: string \| null`, `isVisible: boolean` | Nama 1–100; deskripsi nullable maksimum 1.000 karakter |
| `gallery-items` | `mediaId: string`, `altText: string`, `caption: string \| null`, `isVisible: boolean` | Media `ready` wajib; alt 1–200; caption nullable maksimum 500 karakter |

`ItemDto` mengembalikan field editable lengkap serta `id`, `sortOrder` integer mulai 0, `createdAt`, dan `updatedAt`. Daya tarik menambahkan `imagePreview: ImageDto | null`; galeri menambahkan `imagePreview: ImageDto`. Timestamp/posisi berasal dari server. Media yang direferensikan harus `ready` walaupun item masih tersembunyi.

Item baru ditempatkan paling akhir. Hapus item memadatkan posisi kelompok dalam transaksi yang sama. Gambar terkait tetap berada dalam pustaka media; menghapus penggunaan tidak otomatis menghapus berkas. Tidak ada pembatasan jumlah koleksi bisnis yang diturunkan dari jumlah fixture uji.

PUT `/order` wajib berisi seluruh ID yang saat ini tersimpan tepat satu kali. ID hilang/ganda/asing menghasilkan `422 INVALID_ORDER`; versi lama tetap menghasilkan `409 CONTENT_VERSION_CONFLICT` lebih dahulu. Array kosong hanya sah untuk koleksi kosong. Perubahan urutan tidak mengubah status tampil atau field item lain.

### 6.3 Contoh menyimpan tarif

Fixture ini memakai nama **Contoh tarif — data uji**, bukan kategori atau harga destinasi yang telah diverifikasi. Frontend mengirim `PUT /api/v1/admin/ticket-rates/8fb7c8ae-7b48-4dd2-8253-b312c1d86d38` dengan cookie, Origin, header aplikasi, Content-Type JSON, dan `Idempotency-Key: 13c10cd4-226c-4efb-95e5-591781a79ce3`.

```json
{
  "expectedContentVersion": 42,
  "name": "Contoh tarif — data uji",
  "priceIdr": 15000,
  "unit": "per orang",
  "terms": "Ketentuan contoh untuk pengujian formulir.",
  "applicabilityNote": null,
  "isVisible": false
}
```

Jika berhasil dan versi sebelumnya 42, `meta.contentVersion` menjadi 43. Karena fixture tetap tersembunyi, waktu pembaruan publik/tiket tidak berubah. Pengelola menerima data tersimpan dari server; frontend tidak menyimpulkan keberhasilan hanya dari hilangnya indikator loading.

## 7. Versi konten, idempotensi, dan rekonsiliasi

### 7.1 Versi untuk setiap niat penyimpanan

POST/PUT konten mengirim `expectedContentVersion` sebagai angka pada body. DELETE konten mengirimnya sebagai query integer desimal kanonis tanpa tanda atau pecahan, misalnya `?expectedContentVersion=42`, karena DELETE tidak menggunakan body. Keduanya dipetakan ke field internal yang sama. Login, logout, unggahan, dan penghapusan media yang tidak dirujuk tidak memakai versi konten.

Setiap mutasi konten memeriksa versi global di bawah kunci transaksi singleton. Versi lama menghasilkan `409 CONTENT_VERSION_CONFLICT` dengan `details: { expectedContentVersion, currentContentVersion }`; tidak ada overwrite atau merge otomatis. Frontend mempertahankan masukan pengguna, memuat data terbaru, dan memungkinkan pengguna menyusun penyimpanan baru. Hanya mengganti nomor versi tanpa meninjau perbedaan tidak dibenarkan.

Setiap niat konten baru yang berhasil menaikkan versi satu kali, termasuk penyimpanan data identik yang sudah lolos pemeriksaan versi. `publicUpdatedAt` hanya berubah bila proyeksi publik berubah; `ticketsUpdatedAt` hanya bila data/urutan tarif publik berubah. No-op tidak memalsukan tanggal publik. Replay tidak menaikkan versi atau menambah audit.

### 7.2 Identitas operasi dan tanda terima

1. Kunci unik memiliki cakupan akun admin, metode, path konkret kanonis tanpa query, dan `Idempotency-Key`. UUID entitas dalam path merupakan bagian cakupan.
2. Server membandingkan hash payload tervalidasi setelah normalisasi, termasuk `expectedContentVersion`. Untuk DELETE, hash memakai objek `{ expectedContentVersion }`. Hash bukan bagian constraint unik: payload berbeda dengan kunci/cakupan sama harus ditemukan dan ditolak.
3. Kanonisasi mengurutkan key objek secara rekursif, mempertahankan urutan array, memakai representasi angka JSON, dan memasukkan nilai default hasil schema. Cookie, request ID, serta waktu request tidak masuk hash. Karena itu perbedaan whitespace/key order JSON tidak membuat niat baru.
4. Autentikasi dan validasi struktur mendahului pencarian receipt; pemeriksaan versi, keberadaan entitas, dan relasi yang dapat berubah dilakukan setelah pencarian receipt. Replay penghapusan tetap dapat dikenali walaupun entitas sudah hilang.
5. Receipt sukses, data, penanda konten, dan audit disimpan dalam transaksi yang sama. Constraint unik serta penguncian/pengecekan ulang receipt menyelesaikan duplikasi serentak sebelum pemeriksaan versi. Request kedua tidak boleh salah dianggap konflik versi bila request identik pertama baru saja commit.
6. Kunci sama dengan payload berbeda menghasilkan `409 IDEMPOTENCY_KEY_REUSED`. Request identik yang masih berjalan boleh menunggu dalam tenggat; jika belum selesai, balas `409 OPERATION_IN_PROGRESS` dengan `Retry-After: 2`. Ini tidak menyatakan operasi pertama batal.
7. Receipt disimpan 24 jam sejak commit. Kesalahan validasi, autentikasi, konflik versi, dan transaksi yang dipastikan rollback tidak disimpan sebagai receipt sukses.

Replay mengembalikan status sukses dan `data` hasil operasi lama, termasuk metadata versi/tanggal lama. `meta.requestId` adalah request saat ini, `meta.idempotency.replayed: true`, dan `originalRequestId` tetap menunjuk eksekusi pertama. `expiresAt` tidak diperpanjang saat replay. `Location` pada create dikembalikan kembali. UI kemudian mengambil data terbaru; hasil lama tidak dianggap representasi terkini.

### 7.3 Membaca hasil setelah koneksi terputus

`GET /admin/mutation-receipts/{key}?method=PUT&path=%2Fapi%2Fv1%2Fadmin%2Fticket-rates%2F{id}` menerima metode `POST`, `PUT`, atau `DELETE` dan path konkret persis seperti cakupan bagian 7.2. Path di-URL-encode oleh klien, hanya dicocokkan dengan katalog mutasi konten, dan tidak dipakai untuk fetch/eksekusi internal. Placeholder `{id}` harus diganti UUID aktual. Lookup dibatasi pada akun yang sedang login.

Jika receipt masih tersedia, hasil `200` memiliki `data: { key, method, path, expiresAt, responseStatus, responseBody }`. `responseBody` adalah envelope sukses asli, dengan metadata request/versi saat commit. Schema membatasi bentuk hasil sesuai metode/path mutasi; cookie dan header autentikasi tidak disimpan dalam receipt.

Jika tidak ada receipt yang masih berlaku, balas `404 RECEIPT_NOT_FOUND`. Ini dapat berarti belum commit, belum pernah diterima, atau retensi berakhir; bukan bukti bahwa perubahan tidak terjadi. UI tidak menampilkan **Gagal disimpan** hanya berdasarkan lookup ini.

Saat terjadi timeout/putus koneksi atau respons 5xx dengan hasil commit yang belum dapat dipastikan:

1. Pertahankan nilai formulir dan descriptor niat `{ accountId, key, method, path, payload, firstSentAt }` dalam memori tab; tampilkan **Status penyimpanan belum dapat dipastikan. Periksa kembali.**
2. Periksa receipt dengan jeda 2, 4, dan 8 detik bila masih diperlukan, hentikan jika hasil ditemukan atau sesi berakhir. Jangan polling tanpa batas.
3. Dalam jendela retensi, tindakan **Periksa/coba kembali** boleh mengirim ulang niat yang sama dengan key dan payload semula. Jangan membuat key baru hanya karena jaringan bermasalah.
4. Sesudah hasil diketahui, baca ulang resource/list dan versi terbaru. Perubahan berikutnya memakai niat/key baru.
5. Jika melewati 24 jam sejak pengiriman pertama, akun login berubah, atau descriptor hilang karena tab ditutup, baca ulang data dan rekonsiliasi sebelum mengizinkan niat baru. Jaminan replay tidak diperpanjang setelah retensi.

Tidak ada antrean tulis offline atau penyimpanan password/token dalam descriptor. Kesalahan 4xx definitif tidak diulang otomatis; `OPERATION_IN_PROGRESS` ditangani sebagai status operasi dengan pemeriksaan eksplisit di atas. GET boleh diulang satu kali untuk gangguan transport dalam tenggat total yang sama. Proxy tidak mengulang mutasi secara otomatis.

## 8. Media dan unggahan

### 8.1 Endpoint media

| Metode | Path | Hasil |
| --- | --- | --- |
| GET | `/admin/media?status=ready&limit=24&cursor=...` | `200`, `{ items: MediaDto[], nextCursor: string \| null }` |
| GET | `/admin/media/{id}` | `200`, `MediaDto`, termasuk status penghapusan; `404` untuk ID tidak dikenal |
| POST | `/admin/media/uploads` | Multipart `file` dan `Idempotency-Key` sebagai upload key; `201` jika unggahan baru selesai, `200` untuk hasil siap yang ditemukan kembali, `202` jika percobaan yang sama masih berlangsung |
| GET | `/admin/media/uploads/{key}` | `200`, `MediaDto` untuk reservasi milik akun saat ini; `404 UPLOAD_NOT_FOUND` bila belum ditemukan |
| DELETE | `/admin/media/{id}` | Tanpa body/versi; `202` dan `{ id, status: "deleting" }` setelah status committed; `200` dan `{ id, status: "deleted" }` jika sudah selesai dihapus |

Semua endpoint media memerlukan admin. Pustaka dibagi antaradmin; lookup upload key dibatasi pada uploader supaya retry milik akun lain tidak bertabrakan. Semua preview publik hanya memiliki URL `ready`. Unggahan menggunakan reservasi `media_assets`, terpisah dari receipt konten JSON. DELETE media bersifat idempotent berdasarkan ID/status dan tidak memerlukan `Idempotency-Key`.

`MediaDto` berisi `id`, `status`, `variants: ImageVariantDto[]`, `createdAt`, `updatedAt`, `deletedAt: string | null`, `canRetryUpload: boolean`, `failureCode: "IMAGE_INVALID" | "STORAGE_UNAVAILABLE" | "UPLOAD_INTERRUPTED" | null`, dan `references: Array<{ resource: "destination" | "seo" | "attractions" | "gallery-items", id: string | null, field: string, label: string }>`.

Referensi mencakup konten tersembunyi; `id: null` untuk singleton, `field` terbatas pada nama penggunaan yang sah seperti `heroMediaId`, `logoMediaId`, `imageMediaId`, atau `mediaId`. Status selain `ready` memiliki `variants: []` pada DTO; key storage, checksum internal, lease, kredensial, dan percobaan worker tidak dikirim. `canRetryUpload` hanya true bagi uploader ketika kegagalan sementara dapat dicoba kembali atau lease processing telah berakhir; false untuk file invalid, lease aktif, ready, deleting, dan deleted. Nilai ini bukan izin melewati pemeriksaan ulang server.

### 8.2 Pagination pustaka

`limit` default 24, minimum 1, maksimum 100. `status` opsional menerima satu nilai `processing`, `ready`, `failed`, `deleting`, atau `deleted`; bila dihilangkan, sertakan semua kecuali `deleted`. Pustaka diurutkan `createdAt DESC, id DESC`.

Cursor opaque mengkode pasangan terakhir serta filter status; schema memvalidasi hasil decode dan kecocokan filter. Gunakan perbandingan pasangan `(created_at, id)` untuk halaman berikutnya; cursor tidak dijadikan SQL mentah atau kontrol otorisasi. Cursor rusak/filter berubah menghasilkan `422 INVALID_CURSOR`. `nextCursor: null` berarti tidak ada halaman lanjutan saat pembacaan tersebut. Unggahan baru muncul setelah daftar dimuat ulang; pagination lintas request bukan snapshot database yang dipertahankan.

### 8.3 Kontrak proses unggah

Satu file harus JPEG, PNG, atau WebP statis, maksimum 5 MiB dan 25.000.000 piksel hasil decode. Nama berkas dan MIME browser hanya petunjuk; server memeriksa signature, decode, dimensi, dan jumlah frame. Field tambahan/lebih dari satu file ditolak. Berkas SVG/GIF/animasi tidak diterima pada MVP.

Header upload key berupa UUID v4 yang tetap sama untuk byte file yang sama selama rekonsiliasi. Server menghitung SHA-256 sumber. Kunci sama dengan byte berbeda menghasilkan `409 UPLOAD_KEY_REUSED`, termasuk ketika status masih diproses. Pemeriksaan reservasi identik dilakukan sebelum mengambil slot pemrosesan gambar agar request duplikat dapat menerima status tanpa menciptakan worker kedua.

Alur normal mengikuti bagian 14 `design.md`: reservasi → lease percobaan → decode/normalisasi → manifest varian → penulisan objek → verifikasi → commit `ready`. Hasil WebP menargetkan lebar 320/640/1280/1920 tanpa upscale. Jika sumber lebih kecil dari 320 px, simpan satu varian pada lebar aslinya. Deduplicasikan lebar output yang sama.

`201`/`200` hanya diberikan saat status `ready`; `Location` menunjuk `/api/v1/admin/media/{id}`. Request duplikat yang masih aktif menerima `202`, `Location` status yang sama, dan `Retry-After: 2`. HTTP 202 tidak berarti file sudah dapat dipakai. Reservasi upload key tetap melekat pada media/tombstone dan tidak memakai batas receipt konten 24 jam.

Setelah timeout, klien membaca `/admin/media/uploads/{key}`. `404` dapat terjadi sebelum reservasi committed dan tidak membuktikan unggahan tidak pernah diproses. Klien boleh mengirim file dan key yang sama lagi. Backend tidak mengambil alih lease aktif. Lease berakhir setelah 90 detik; worker/job yang memperoleh kepemilikan baru secara atomik memverifikasi manifest sebelum mempromosikan hasil atau menetapkan kegagalan.

Pada `failed` atau percobaan terhenti yang diizinkan untuk dipulihkan, retry file yang sama menggunakan reservasi sama dengan ID percobaan/prefix baru. File invalid memerlukan perbaikan dan key baru. Media `deleting`/`deleted` tidak dihidupkan kembali oleh upload ulang dengan key lama: balas `409 MEDIA_NOT_REUSABLE`. Status `ready` yang tidak lagi dipakai konten tetap berada di pustaka.

### 8.4 Penghapusan dan batas proses

DELETE hanya menerima media `ready` atau `failed` yang tidak dirujuk; `processing` menghasilkan `409 MEDIA_BUSY`. Di transaksi, kunci baris media dan periksa seluruh rujukan; jika masih dipakai, balas `409 MEDIA_IN_USE` dengan `details.references` bentuk yang sama seperti DTO. Pemasangan media ke konten juga mengunci baris dan mensyaratkan `ready`, sehingga tidak berlomba dengan penghapusan.

Jika dapat dihapus, commit `deleting` lalu balas 202 dengan `Location` status. DELETE ulang ketika sudah `deleting` mengembalikan 202 yang sama tanpa membuat pekerjaan baru; `deleted` mengembalikan 200. Job setiap 10 menit menghapus objek dan mengubah status menjadi `deleted`; kegagalan storage tetap `deleting` dan dicoba kembali sesuai batas job. 202 tidak menjanjikan selesai dalam 10 menit. UI boleh memperbarui status dengan tindakan pengguna; polling opsional berhenti setelah 30 detik lalu menampilkan status tertunda.

Baseline satu proses gambar aktif per proses API. Slot habis menghasilkan `503 MEDIA_CAPACITY_EXCEEDED` dengan `Retry-After: 5` sebelum pemrosesan baru. Tenggat unggahan 60 detik; database tidak dikunci sepanjang pemrosesan gambar/S3. File lama tidak dilepas dari konten sampai mutasi lampiran baru berhasil. Penghapusan objek dan backup memakai koordinasi operasional yang dirinci dalam desain.

## 9. Status dan katalog kesalahan

| HTTP | Kode | Makna dan tindakan klien |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | JSON/multipart tidak dapat diparse, header key hilang/rusak, atau query berulang; perbaiki request |
| 401 | `AUTH_REQUIRED` / `INVALID_CREDENTIALS` | Sesi tidak sah atau login ditolak; tampilkan login tanpa menghapus isian konten dari memori tab |
| 403 | `ORIGIN_NOT_ALLOWED` / `CLIENT_HEADER_REQUIRED` | Pemeriksaan origin/header gagal; hentikan request dan perbaiki konfigurasi/klien |
| 404 | `NOT_FOUND` | Route/resource tidak ditemukan setelah pemeriksaan akses yang berlaku |
| 404 | `RECEIPT_NOT_FOUND` / `UPLOAD_NOT_FOUND` | Hasil lookup belum tersedia; ikuti rekonsiliasi, jangan menyimpulkan rollback |
| 405 | `METHOD_NOT_ALLOWED` | Metode salah; sertakan `Allow` |
| 409 | `CONTENT_VERSION_CONFLICT` | Formulir memakai versi lama; details berisi versi diharapkan dan saat ini |
| 409 | `IDEMPOTENCY_KEY_REUSED` / `UPLOAD_KEY_REUSED` | Kunci dipakai dengan input berbeda; jangan mengubah payload niat yang hasilnya belum diketahui |
| 409 | `OPERATION_IN_PROGRESS` | Operasi identik belum selesai; cek status, bukan membuat niat baru |
| 409 | `MEDIA_IN_USE` | Masih ada referensi; details berisi daftar penggunaan |
| 409 | `MEDIA_NOT_READY` / `MEDIA_BUSY` / `MEDIA_NOT_REUSABLE` | Status media tidak mengizinkan lampiran, hapus, atau pemakaian key ulang |
| 413 | `PAYLOAD_TOO_LARGE` / `FILE_TOO_LARGE` | Batas body/berkas terlampaui |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type request atau format gambar tidak didukung |
| 422 | `VALIDATION_ERROR` | Field/tipe/rentang/kelengkapan tidak sah; gunakan `fieldErrors` |
| 422 | `INVALID_ORDER` / `INVALID_CURSOR` | Daftar urutan atau cursor tidak sah |
| 422 | `IMAGE_INVALID` | Gambar rusak, animasi, atau batas piksel terlampaui; perbaiki file |
| 429 | `RATE_LIMITED` | Batas percobaan login; tampilkan waktu tunggu dari `Retry-After` |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga; tampilkan request ID dan pertahankan niat mutasi untuk rekonsiliasi |
| 503 | `SERVICE_UNAVAILABLE` / `STORAGE_UNAVAILABLE` / `MEDIA_CAPACITY_EXCEEDED` | Dependency atau kapasitas tidak tersedia; jangan mengganti data dengan daftar/harga palsu |

Tidak ada respons sukses 200 yang membungkus kegagalan. `201` berarti resource dibuat; `202` berarti proses diterima/status tersimpan dan pekerjaan lanjutan belum selesai. Penghapusan konten memakai 200 agar versi serta receipt dapat dikirim bersama.

`fieldErrors.path` mengikuti nama DTO, misalnya `priceIdr`, `openingHours.0.closesAt`, `contacts.1.value`, atau `ids`; indeks array mengacu pada urutan request. Kode field terbatas pada `REQUIRED`, `INVALID_TYPE`, `INVALID_FORMAT`, `OUT_OF_RANGE`, `TOO_LONG`, `UNKNOWN_FIELD`, dan `INVALID_COMBINATION`. Frontend memakai kode untuk perilaku dan pesan Bahasa Indonesia untuk pengelola.

Tidak mengirim stack trace, SQL, path mesin, credential, cookie, password, atau rincian provider mentah. Error log memakai request ID dan metadata aman. Validasi server atas tipe, panjang, rentang, content type, dan ukuran mengikuti [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

String teks biasa di-trim sebelum validasi panjang; nullable yang tidak diisi dikirim eksplisit sebagai `null`, bukan string kosong. Batas karakter dihitung sebagai Unicode code point setelah trim; password dikecualikan dari trim. Tidak ada coercion otomatis `"15000"` menjadi angka, `"false"` menjadi boolean, atau string kosong menjadi 0. FE mengonversi field HTML secara eksplisit sebelum validasi schema. Semua objek masukan bersifat strict; field readonly dan field tambahan ditolak.

## 10. Batas waktu, cache, dan pengoperasian

Pembacaan snapshot memiliki tenggat total 3 detik; mutasi JSON 10 detik; unggahan 60 detik. Timeout klien/proxy tidak membuktikan rollback. Respons proxy 502/504, body non-JSON, atau body sukses tidak lengkap ditangani sebagai hasil mutasi yang belum diketahui. Kueri memakai batas lebih pendek daripada HTTP; hanya server yang telah memastikan rollback dapat mencatat operasi sebagai batal.

Semua GET konten dan data loader SvelteKit bersifat `no-store`. Tidak ada ETag/304 sebagai mekanisme cache konten pada MVP, dan pemeriksaan versi aplikasi tidak diperlakukan sebagai `If-Match`. File build berhash dan URL media immutable memiliki kebijakan cache panjang terpisah menurut desain. Harga pada halaman yang sudah terbuka berubah setelah reload; permintaan publik baru harus memenuhi target pembaruan maksimum 60 detik.

Endpoint operasional API memakai `/health/live` dan `/health/ready` di listener internal, di luar `/api/v1`, dan diblokir dari routing publik. Liveness hanya memeriksa proses, readiness memeriksa koneksi database serta kompatibilitas schema; hasil minimal `{ status: "ok" }` dengan 200 atau `{ status: "unavailable" }` dengan 503. Gangguan unggahan storage dilaporkan terpisah dan tidak membuat halaman informasi gagal readiness. Tidak ada data credential/schema rinci dalam health response.

## 11. Bukti penerimaan saat implementasi

Tabel ini adalah kriteria kontrak yang perlu dibuktikan ketika API dibangun; belum merupakan hasil uji yang sudah lulus.

| Skenario | Hasil yang harus dapat diamati |
| --- | --- |
| Snapshot berisi konten tersembunyi dan publik | Hanya konten publik sampai ke DTO/HTML; metadata memakai snapshot yang sama |
| Tarif kosong versus database gagal | 200 dengan daftar kosong berbeda dari 503; tidak ada konversi menjadi gratis |
| Simpan harga negatif, pecahan, string, atau kosong | 422 pada field harga; harga dan ketentuan sebelumnya utuh |
| Profil valid tetapi salah satu jadwal/kontak tidak sah | Semua perubahan ditolak atomik; error menunjuk field yang sesuai |
| Dua request berbeda menggunakan versi sama | Hanya satu commit; request lain 409 dan input lokal tetap tersedia |
| Dua request identik serentak dengan key sama | Satu efek dan audit; request kedua menerima receipt atau status sedang berjalan |
| Putuskan respons setelah commit lalu retry | Hasil lama ditemukan tanpa item/versi/audit ganda; klien membaca keadaan terbaru |
| Receipt habis atau akun berubah | UI merekonsiliasi keadaan; tidak menjanjikan deduplikasi dengan cakupan lama |
| List difilter atau berisi item tersembunyi saat reorder | Seluruh ID harus tetap disertakan; urutan tidak diterapkan sebagian |
| Tanpa sesi, sesi dicabut, origin salah, header hilang | Backend menolak akses sesuai kontrak, termasuk upload dan replay receipt |
| File valid, MIME palsu, rusak, animasi, terlalu besar | Hanya hasil yang memenuhi validasi menjadi `ready`; UI tidak melampirkan 202 |
| Upload berhasil tetapi respons hilang | Key yang sama menemukan media yang sama, termasuk sebelum klien mengetahui ID |
| Attach dan DELETE media berjalan bersamaan | Salah satu ditolak sesuai status; tidak ada referensi ke objek yang dihapus |
| S3 gagal saat upload/penghapusan | Status tetap dapat direkonsiliasi; data konten sebelumnya tidak dilepas |
| Request publik baru setelah perubahan tarif | HTML/API/metadata melalui proxy mencerminkan commit dalam target 60 detik |

Tahap 5 melengkapi kontrak API dan aturan kegagalannya. Aturan penulisan, batas modul, dan pemeriksaan implementasinya tersedia pada [code-conventions.md](./code-conventions.md) dari tahap 6. Pekerjaan implementasi, dependensi, serta bukti penerimaannya tersedia pada [task.md](./task.md). Fondasi T-01 memiliki endpoint bootstrap sementara; endpoint MVP di dokumen ini menunggu tugas implementasi masing-masing.
