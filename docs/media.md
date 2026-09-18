# Unggahan dan pustaka media — T-10

Implementasi tersedia; tes belum dijalankan. T-10 mencakup unggahan, lookup upload key, list/detail, pemrosesan Sharp dan adapter S3. Penghapusan, rekonsiliasi otomatis, dan koordinasi backup adalah T-11. Tidak ada koneksi atau penulisan ke bucket nyata saat pengerjaan ini.

## Konfigurasi

Isi konfigurasi API pada fasilitas secret deployment, memakai template `.env.example`:

- `MEDIA_BASE_URL`: URL HTTPS host aset publik, opsional dengan prefix path. URL hasil stabil, tanpa query/tanda tangan yang kedaluwarsa.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: satu konfigurasi lengkap untuk storage tulis/baca privat.
- `S3_SESSION_TOKEN`: opsional untuk credential sementara; rotasi credential memerlukan penerapan konfigurasi baru.
- `S3_VIRTUAL_HOSTED_STYLE`: opsional true/false, default false. Sesuaikan endpoint/bucket addressing dengan penyedia.

Seluruh konfigurasi S3 boleh belum diisi pada tahap setup: aplikasi tetap melayani konten dan upload baru menghasilkan `503 STORAGE_UNAVAILABLE`. Konfigurasi S3 parsial atau konfigurasi URL tidak sah menggagalkan startup dengan pesan tanpa nilai rahasia. `MEDIA_BASE_URL` boleh tersedia tanpa credential S3 agar DTO media ready masih dapat dibaca. Bila URL aset belum tersedia tetapi database memiliki media ready, API mengembalikan error; tidak menyamarkannya menjadi daftar kosong.

HTTP endpoint storage hanya diterima untuk localhost/127.0.0.1/::1 pada lingkungan nonproduksi. Produksi membutuhkan HTTPS. Bucket/CDN, hak akses objek publik, serta kecocokan penyedia belum diprovisikan atau dibuktikan; ini termasuk T-24. API tidak mengubah ACL bucket atau mengirim credential ke browser.

## Endpoint dan batas

Prefix `/api/v1/admin/media`, semuanya memakai guard privat T-06:

| Metode/path | Hasil |
| --- | --- |
| POST `/uploads` | Multipart satu field `file`, `Idempotency-Key` UUID v4; 201 saat ready baru, 200 untuk ready yang sudah tersimpan, 202 untuk processing |
| GET `/uploads/{key}` | Reservasi akun saat ini; 404 UPLOAD_NOT_FOUND tidak membuktikan upload belum pernah terjadi |
| GET prefix | Pustaka bersama antaradmin; filter status, limit 1–100 (default 24), cursor opaque |
| GET `/{id}` | Detail status dan referensi, termasuk konten tersembunyi |

Batas body transport 6 MiB dan satu file 5 MiB. MIME/nama browser tidak dipercaya untuk memilih decoder atau key. JPEG/PNG/WebP statis diperiksa melalui signature, metadata dan decode; SVG/GIF, APNG, animated WebP, gambar rusak, serta lebih dari 25 juta piksel ditolak. Password/token/body multipart tidak dicatat dalam log request.

Varian WebP quality 82 menargetkan lebar 320/640/1280/1920 dengan lebar dibatasi ukuran sumber setelah orientasi dibenahi. Lebar yang sama dideduplicasikan; sumber di bawah 320 menghasilkan satu varian pada lebar asli. Metadata EXIF/ICC/XMP tidak dipertahankan oleh pipeline output. Input asli tidak disimpan ke bucket.

## Reservasi, lease, dan kesiapan

Hash SHA-256 sumber dan upload key memiliki scope uploader. Request identik memeriksa reservasi sebelum mengambil slot; byte berbeda pada key sama menghasilkan `UPLOAD_KEY_REUSED`, termasuk saat processing. Setiap proses API memiliki satu slot untuk satu pekerjaan gambar/S3. Slot penuh menghasilkan 503 MEDIA_CAPACITY_EXCEEDED dan Retry-After 5. Duplikat aktif mengembalikan 202, Location dan Retry-After 2 tanpa worker tambahan.

Transaksi reservasi memakai lock akun/sesi yang sama dengan T-06/T-07. Setiap attempt mempunyai UUID baru dan lease 90 detik. Slot dilepas setelah pekerjaan selesai/gagal; transaksi database tidak ditahan sepanjang decode atau storage. Pipeline Sharp membatasi waktu native per varian; request dan storage memakai AbortSignal/deadline.

Manifest berisi key, dimensi, ukuran dan checksum setiap varian disimpan dalam transaksi singkat **sebelum** upload objek. Key server berbentuk `media/{mediaId}/{attemptId}/{width}.webp`. Adapter memakai Bun.S3Client untuk menandatangani request server-to-server; fetch PUT/GET dibatasi waktu dan dapat dibatalkan. URL bertanda tangan itu tidak diberikan kepada klien. PUT menetapkan Content-Type WebP dan cache immutable. GET privat membaca ulang seluruh objek dengan batas ukuran dan memeriksa checksum SHA-256 serta Content-Type; keberhasilan PUT saja belum membuat media ready.

Commit ready memeriksa ulang sesi, status processing, attempt ID, dan lease yang masih berlaku. Worker lama tidak dapat mempromosikan hasil setelah attempt berganti. Data HTTP hanya mengandung varian ketika ready; key/checksum/lease/uploader/attempt tidak menjadi field DTO. URL publik memang menunjuk key immutable yang dihasilkan server.

Jika file invalid, status failed/IMAGE_INVALID tidak dapat diretry dengan key lama. Kegagalan storage/interupsi dapat dicoba lagi oleh uploader menggunakan byte/key yang sama; ID media tetap, attempt/prefix baru. Lease aktif tidak diambil alih. Lease expired dapat diganti oleh retry file; rekonsiliasi tanpa pengiriman file berada pada T-11. Deleting/deleted tidak dihidupkan kembali oleh upload.

Jika pencatatan kegagalan tidak dapat menghubungi DB, reservasi tetap processing hingga expiry. Jika respons hilang setelah commit ready, lookup/retry menemukan hasil tersimpan. Sisa objek attempt gagal/lama belum dibersihkan otomatis pada T-10: manifest aktif disimpan, prefix per-attempt tetap dapat ditemukan dari prefix media oleh job T-11 dengan masa aman 24 jam. Jangan menganggap pesan gagal sebagai bukti tidak ada objek atau efek database.

## Pustaka dan cursor

Default list mengecualikan deleted. Urutan `createdAt DESC, id DESC`; query berikutnya membandingkan pasangan yang sama dan filter status terikat dalam cursor. Cursor mempertahankan presisi mikrodetik timestamp PostgreSQL walaupun timestamp DTO ditampilkan dalam ISO milidetik. Cursor rusak/filter berubah ditolak sebagai INVALID_CURSOR. Cursor bukan token otorisasi dan tidak dijalankan sebagai SQL.

List/detail dan referensi dibaca dalam snapshot read-only REPEATABLE READ. Referensi mencakup hero/logo/SEO, daya tarik dan galeri, termasuk tersembunyi. `canRetryUpload` hanya true bagi uploader untuk gagal sementara atau processing yang lease-nya berakhir. Sesi/admin lain dapat melihat pustaka tetapi tidak lookup upload key akun lain. Upload tidak mengubah contentVersion atau penanda publik/tiket.

## Verifikasi dan rujukan

[Bukti T-10](./evidence/t10-media.md) memisahkan pemeriksaan statis dan skenario yang belum dieksekusi. Setelah persetujuan pemilik:

- `bun run test:media`: unit Sharp, orientasi, metadata, signature/animasi, piksel, cursor dan konfigurasi.
- `bun run test:db`: HTTP/media dengan PostgreSQL nyata, storage fixture dalam memori, memakai database kosong terisolasi T-04. Ini tidak membuktikan interoperabilitas S3.
- `bun run test:media-storage`: PUT/GET/checksum S3 nyata; konfigurasi khusus dari `.env.media-test.example`, opt-in `ALLOW_MEDIA_STORAGE_TESTS=umbul-media-test`, dan bucket berawalan `umbul-media-test-`. Bucket harus disediakan operator; suite hanya menghapus key acak yang dibuatnya, bukan bucket. Jangan memakai credential/bucket aplikasi nyata.

Tidak ada suite, job, ataupun CI dijalankan pada task ini. Penghapusan/reconciliation T-11 dan tes provider/TLS/browser tetap harus dilanjutkan.

Rujukan primer dibaca 18 September 2026: [Bun S3/presign](https://bun.com/docs/runtime/s3), [Sharp input metadata](https://sharp.pixelplumbing.com/api-input/), [Sharp output](https://sharp.pixelplumbing.com/api-output/). API juga dicocokkan dengan tipe lokal Bun 1.4.0 dan Sharp 0.35.4; dokumentasi daring Bun menampilkan versi lebih baru, sehingga bukti kompatibilitas tetap memerlukan runtime proyek/penyedia target.
