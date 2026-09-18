# Transaksi konten dan receipt — T-08

Implementasi tersedia; tes perilaku belum dijalankan. T-08 menyiapkan service bersama dan endpoint lookup. API mutasi tiket sudah terintegrasi pada [T-09](./ticket-rates.md); singleton/koleksi lain menyusul pada T-12/T-13. Tidak ada tarif atau konten operasional nyata diubah saat implementasi.

## Urutan transaksi

`createContentService({ db })` menyediakan `mutate(request, definition)` dan `lookup(request)`. Service memakai database runtime; constraint unik receipt dari migrasi T-04 tetap mencakup akun, method, path konkret, dan key. Hash payload bukan bagian constraint unik. Tidak diperlukan perubahan schema.

HTTP tetap melewati guard T-06 untuk sesi, Origin dan header aplikasi. Service juga memeriksa token sesi di database dalam transaksi yang sama dengan perubahan konten:

1. Ambil advisory lock akun yang sama dengan login/logout/reset/disable; periksa akun aktif, sesi, idle, expiry, serta sinyal pembatalan. DTO sesi dari guard saja tidak menjadi izin commit.
2. Validasi method/path dari katalog kontrak, UUID v4 key, request ID, serta schema input fitur. Hash output schema yang sudah dinormalisasi, termasuk default dan versi.
3. Kunci singleton `site_state`, lalu baca receipt. Receipt yang masih berlaku dengan hash sama dikembalikan sebelum pemeriksaan versi/keberadaan entitas. Hash berbeda menghasilkan `IDEMPOTENCY_KEY_REUSED`. Receipt kedaluwarsa dapat diganti dalam transaksi niat baru yang lolos versi.
4. Periksa versi global. Versi berbeda menghasilkan `CONTENT_VERSION_CONFLICT` beserta versi yang diharapkan dan versi saat ini. Batas integer aman tidak dapat dilewati.
5. Baca proyeksi publik/tiket sebelum perubahan, jalankan callback mutasi, lalu baca kembali proyeksi dalam transaksi yang sama. Perubahan tarif publik juga dianggap perubahan publik. Konten privat/tersembunyi dan no-op tidak mengubah tanggal publik.
6. Naikkan versi tepat satu kali untuk niat baru, termasuk no-op. Bentuk dan validasi envelope hasil menurut katalog receipt; simpan state, audit metadata, dan receipt secara atomik. Periksa ulang sesi serta pembatalan sebelum transaksi selesai. Kembalikan hasil setelah promise transaksi berhasil commit.

Urutan lock adalah akun → sesi → singleton → entitas/relasi fitur. Callback fitur tidak boleh mengambil lock akun lain. Mutasi serentak dari akun berbeda tetap berbagi versi global. Timeout lock PostgreSQL menghasilkan `409 OPERATION_IN_PROGRESS` dengan `Retry-After: 2`; ini dapat terjadi karena writer lain, bukan hanya duplikasi. Kegagalan dependency/commit yang belum jelas menghasilkan 503, bukan keberhasilan palsu. Client memakai lookup/replay sesuai kontrak sebelum menyusun niat baru.

Kanonisasi mengurutkan key objek rekursif secara leksikal, mempertahankan array, memakai angka JSON, dan membedakan null dari 0/kosong. Nilai non-JSON ditolak. Hash tidak memuat cookie, request ID, atau waktu request. Service tidak menyimpan password/token mentah, body input, atau isi formulir pada audit/log.

## Mengintegrasikan fitur berikutnya

Definisi mutasi berisi:

- `schema`: shared schema request fitur dengan `expectedContentVersion`. Gunakan schema create/update/order yang tepat. DELETE memetakan hasil `deleteContentQuerySchema` ke input numerik `{ expectedContentVersion }` sebelum pemanggilan.
- `project(tx)`: objek `{ public, tickets }` berisi JSON deterministik dari data yang benar-benar tampil dan dapat terpengaruh operasi tersebut. Abaikan timestamp administratif, field privat, serta item tersembunyi; urutkan sesuai urutan publik. Sertakan dampak tidak langsung seperti fallback SEO. Operasional memakai proyeksi tetap `null`/`[]`.
- `apply(tx, input)`: pemeriksaan keberadaan, relasi, dan urutan yang dapat berubah, kemudian mutasi memakai `tx` yang diberikan. Kembalikan `{ data, resourceId }`; data mengikuti DTO sukses fitur, resourceId null untuk singleton. Jangan mengubah `site_state`, audit, atau receipt sendiri. Jangan membuka transaksi terpisah atau melakukan I/O storage/jaringan di callback ini.

`mutationRequest(context, production, input?)` meneruskan identitas request dan token dari cookie tanpa menaruhnya pada DTO/log. `mutationResponse(result)` mengirim status/body serta Location. POST menghasilkan Location dari path koleksi + ID hasil, termasuk ketika replay. Metadata replay membawa request ID saat ini, `replayed: true`, dan originalRequestId tetap; versi/tanggal/data lama dipertahankan. UI tetap perlu membaca data terkini setelah rekonsiliasi.

Definisi/proyeksi adalah kode internal tepercaya, tidak berasal dari request klien. Service memastikan perbandingan proyeksi dan transaksi bersama; kelengkapan proyeksi tiap fitur masih harus dibuktikan pada T-09/T-12/T-13/T-14.

## Lookup dan retensi

`GET /api/v1/admin/mutation-receipts/{key}?method=PUT&path=%2Fapi%2Fv1%2Fadmin%2Foperations` sudah dipasang pada server API. Header `X-Umbul-Client: admin-web` dan cookie sesi aktif wajib. Query/path/key tidak sah ditolak. Path hanya dicocokkan dengan katalog, tidak dieksekusi sebagai URL. Respons memakai `private, no-store`.

Lookup hanya membaca receipt akun pemilik sesi. `data.responseBody` berisi envelope sukses asli; request ID lookup ada di metadata envelope luar. `404 RECEIPT_NOT_FOUND` berarti hasil belum tersedia atau retensi berakhir, **bukan bukti rollback**. Kegagalan database tidak disamarkan menjadi 404.

Masa berlaku 24 jam dihitung dari waktu finalisasi receipt menjelang commit, setelah callback perubahan selesai; bukan dari awal request/transaksi. PostgreSQL baru membuat receipt terlihat setelah commit. Timestamp commit WAL yang persis tidak tersedia untuk dimasukkan ke baris pada transaksi yang sama; durasi antara finalisasi dan commit belum diukur. Waktu diinject hanya oleh kode internal untuk tes, bukan oleh klien. Replay tidak memperpanjang masa berlaku. Lookup/replay menegakkan expiry walaupun job cleanup belum berjalan. Setelah masa berlaku berakhir, klien harus membaca ulang data dan merekonsiliasi sebelum niat baru.

`bun run receipts:cleanup` memakai `DATABASE_URL` runtime, menghapus maksimal 1000 receipt kedaluwarsa per eksekusi dengan `SKIP LOCKED`, dan hanya mengeluarkan jumlah. Operator dapat menjadwalkannya setiap 10 menit dan mengulang bila batch penuh. Scheduler belum dipasang; job belum dijalankan. Jangan memakai job sebagai pengganti pemeriksaan expiry atau sebagai tes terselubung.

## Bukti dan batasan

Lihat [bukti T-08](./evidence/t08-content-transactions.md). Suite `bun run test:content` memuat unit kanonisasi dan HTTP lookup dengan dependency fixture. `bun run test:db` memuat skenario transaksi PostgreSQL nyata bersama T-04/T-06/T-07. Keduanya memerlukan persetujuan pemilik sebelum dijalankan. Pengaturan database test mengikuti [panduan database](./database.md).

Integrasi mutasi lewat endpoint tiket tersedia pada T-09; tesnya masih menunggu persetujuan. Pemutusan respons setelah commit dan pemulihan UI berada pada T-22. T-08 belum dianggap selesai terbukti sebelum tes dan dependensinya memiliki bukti perilaku.
