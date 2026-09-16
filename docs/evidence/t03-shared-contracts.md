# Bukti T-03 — Shared schema dan kontrak

Tanggal implementasi: 16 September 2026. Branch pengiriman: `development`.

## Cakupan implementasi

`packages/contracts` menyediakan exports per domain: `public-site`, `auth`, `destination`, `opening-hours`, `contacts`, `seo`, `operations`, `attractions`, `ticket-rates`, `facilities`, `gallery-items`, `images`, `media`, `mutation-receipts`, `envelopes`, `errors`, dan `primitives`. Export bootstrap T-01 tetap tersedia hingga integrasi snapshot T-14.

- Semua objek memakai schema strict, termasuk objek bersarang dan DTO publik. Tipe DTO/request diturunkan dari Zod. Tipe input POST mempertahankan `isVisible` opsional; output normalisasi berisi default `false`.
- Teks di-trim dan dihitung per Unicode code point; password tidak di-trim. Nilai nullable harus eksplisit null; nominal tidak melakukan coercion. Query versi DELETE menggunakan desimal kanonis dan menghasilkan angka aman.
- Jadwal memeriksa tujuh hari unik, waktu/durasi hingga 24 jam, dan benturan lintas hari termasuk Minggu–Senin. Normalisasi urutan dilakukan setelah validasi agar indeks error mengikuti input.
- Kontak memeriksa format sesuai jenis, pasangan koordinat/media, ID kontak respons non-null, serta duplikasi ID input. Status tersembunyi tidak membebaskan validasi format.
- Snapshot publik memiliki daftar field sendiri tanpa Operasional, status admin, versi konten, maupun rincian storage. Schema ketat menolak penambahan field privat; mapper eksplisit dan pengujian kebocoran melalui HTTP/HTML tetap tugas T-14/T-23.
- Envelope baca admin/mutasi/publik dipisahkan. Receipt membatasi metode/path, status sukses, DTO domain, ID item, dan metadata commit asli. Katalog error membatasi details per kode; converter field error mengembalikan pesan aman tanpa nilai input.
- Media memisahkan varian ready dari status lain, membatasi rujukan menurut resource/field, dan menyediakan schema query serta cursor terdecode. Pengiriman multipart, decoding gambar, encoding cursor/filter matching, lease, dan keberadaan media tetap tanggung jawab backend.

## Batas kepemilikan validasi

Schema tidak membuktikan sesi aktif, Origin, kepemilikan ID kontak, status media di database, versi terkini, maupun seluruh keanggotaan reorder. Khusus reorder, pemeriksaan duplikasi/ID hilang/asing dilakukan service setelah konflik versi sesuai API; schema hanya memeriksa struktur. Parsing query berulang, batas byte stream, dan pemetaan status HTTP berada pada adapter T-05 dan route terkait.

Seluruh import runtime kontrak hanya memakai Zod dan modul lokal. Typecheck kontrak menggunakan `types: []`, tanpa ambient Node/Bun dan tanpa `skipLibCheck`. Root menambahkan devDependency workspace kontrak agar unit test mengimpor entry point yang sama dengan aplikasi; tidak ada versi dependency eksternal baru.

## Verifikasi

Unit test tersedia di `tests/unit/contracts/fields.test.ts` dan `responses.test.ts`, memakai fixture berlabel dengan waktu/UUID tetap. Skenario mencakup null/0/batas nominal, Unicode astral dan combining mark, waktu lintas hari, input strict/read-only, publikasi, privasi snapshot, media, receipt, dan seluruh katalog error.

Lingkungan pemeriksaan: macOS arm64, Bun `1.4.0`, TypeScript `5.9.3`, Zod `4.5.4` dari lockfile proyek.

| Pemeriksaan | Hasil |
| --- | --- |
| `bun run check` | Lulus; kontrak diperiksa terpisah, diikuti API, web, dan tooling/tes. Svelte 0 error/0 warning. |
| `bun run lint` | Lulus; termasuk batas import kontrak/browser. |
| `bun run format:check` | Lulus. |
| `bun run check:source` | Lulus, 41 file sumber authored. |
| `git diff --check` | Lulus. |
| `bun run test:unit` | **Belum dijalankan**; konfirmasi pemilik telah diminta dan belum diterima. |
| Integrasi/E2E/CI GitHub | **Belum dijalankan** pada task ini. |

Pemeriksaan awal menemukan dependency workspace root yang belum dinyatakan dan penggunaan `toReversed` yang tidak sesuai target ES2022 pada fixture. Keduanya diperbaiki; hasil statis di atas berasal dari pemeriksaan ulang setelah perbaikan. Tidak ada dependency eksternal yang di-upgrade.

Review sumber juga memperbaiki rantai validasi Instagram: pemeriksaan host hanya berjalan setelah URL sah, sehingga input rusak tidak diteruskan ke constructor URL. Kasus unit untuk input tersebut sudah ditulis, namun hasil runtime belum dibuktikan.

Implementasi dan penulisan unit test tersedia, tetapi checkbox T-03 **belum ditandai selesai** sebelum bukti unit diperoleh. Kelulusan pemeriksaan statis bukan bukti kelulusan perilaku schema.

Tidak ada klaim endpoint HTTP, database, storage, autentikasi, mapper SSR, CI GitHub, atau deployment sudah dibuktikan oleh pekerjaan kontrak ini.
