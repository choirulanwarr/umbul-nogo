# Bukti implementasi T-10 — unggahan dan pustaka media

Tanggal: 18 September 2026. Branch: `development`.

## Implementasi tersedia

- `apps/api/src/media`: konfigurasi deployment, pemrosesan Sharp, adapter Bun S3, reservasi/lease/slot, manifest/verifikasi, mapper referensi dan cursor, serta empat route HTTP.
- Server API memasang route dengan guard privat. Tidak ada schema/migrasi baru; fondasi `media_assets` T-04 dipakai.
- Template konfigurasi runtime dan storage test, [panduan media](../media.md), serta suite yang dipisahkan menurut dependency nyata/fixture.
- Gangguan storage tidak menjadi pemeriksaan readiness database; credential S3 belum diisi seluruhnya menghasilkan upload 503 sementara konten tetap dapat dibaca. Konfigurasi parsial invalid ditolak.

## Pemeriksaan statis

TypeScript API (`bun run --cwd apps/api check`), ESLint pada file terkait, dan formatting Prettier tersedia/lulus pada perubahan ini. Pemeriksaan ini tidak membuktikan upload, decode, transaksi, atau interoperabilitas storage.

## Skenario disiapkan, belum dijalankan

| Klaim | Skenario/oracle |
| --- | --- |
| Varian sesuai kontrak | Decode JPEG fixture beberapa ukuran, WebP dimensi/checksum, deduplikasi lebar, orientasi, metadata output |
| Input berbahaya/tidak sesuai ditolak | Signature rusak, SVG, chunk APNG/animated WebP, truncated PNG, >5 MiB, >25 juta piksel |
| Reservasi dan akses | HTTP dengan DB nyata, MIME/nama palsu tetapi bytes PNG valid, replay ready, key berubah bytes, lookup antar-uploader, pustaka bersama |
| Kapasitas | Storage barrier terkontrol: duplikat aktif 202, key berubah bytes 409, upload baru akun lain 503 dengan Retry-After |
| Failure/retry | Verifikasi storage gagal tidak menghasilkan ready; retry ID sama/prefix baru; file invalid tidak dapat diretry; deleting tidak reusable |
| Kepemilikan worker | Attempt diganti saat storage berjalan; worker lama gagal commit ready; lease expired dapat diretry; pencabutan sesi sebelum finalize mencegah ready |
| DTO/pagination | Referensi daya tarik tersembunyi, tidak ada field key/checksum internal, dua halaman timestamp sama tanpa item ganda, filter cursor berubah ditolak |
| S3 nyata | Suite terpisah melakukan PUT/GET/checksum di bucket uji beropt-in, lalu merusak objek untuk membuktikan verifikasi menolak |

**Seluruh tes belum dijalankan sesuai instruksi pemilik.** Suite `test:db` memakai storage fixture, bukan klaim S3 nyata. Suite `test:media-storage` belum dikonfigurasi/dijalankan; tidak ada bucket, credential operasional, atau URL CDN nyata dipilih. Tidak ada workflow CI dipicu.

Transport multipart/auth memiliki suite fondasi T-05/T-06 yang juga masih menunggu persetujuan tes. Perlombaan lease/revokasi lintas proses, crash proses native, koordinasi backup/reconciliation, provider target dan URL publik masih perlu bukti integrasi lebih lanjut. Penghapusan/orphan cleanup dan scheduler berada pada T-11/T-24. T-10 belum dicentang selesai.
