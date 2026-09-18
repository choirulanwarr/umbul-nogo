# API tarif tiket — T-09

Implementasi tersedia; tes perilaku belum dijalankan. Seluruh endpoint memakai guard sesi/header/Origin T-06 dan transaksi/receipt T-08. Tidak ada tarif nyata atau akun baru dibuat saat pengerjaan. UI pengelolaan tarif masih berada pada T-17.

## Endpoint

Prefix: `/api/v1/admin/ticket-rates`.

| Metode/path | Perilaku |
| --- | --- |
| GET prefix | Daftar lengkap termasuk tarif tersembunyi, berurutan menurut `sortOrder`, lalu ID; tidak dipaginasi |
| GET `/{id}` | Detail beserta metadata snapshot; UUID invalid ditolak, item tidak ditemukan menghasilkan 404 |
| POST prefix | Tambah di posisi terakhir; default `isVisible: false`, boleh true bila field lengkap; sukses 201 dan Location |
| PUT `/{id}` | Ganti seluruh field editable secara atomik; tidak membuat ID yang hilang |
| DELETE `/{id}?expectedContentVersion=...` | Tanpa body; hapus dan padatkan urutan dalam satu transaksi |
| PUT `/order` | `{ ids, expectedContentVersion }`; semua ID termasuk tersembunyi wajib dikirim tepat sekali |

GET memakai transaksi `REPEATABLE READ`, `READ ONLY` untuk membaca versi dan tarif dari snapshot yang sama. Guard HTTP memeriksa sesi sebelum pembacaan. Kegagalan database dikembalikan sebagai 503, bukan daftar kosong; singleton state hilang menghasilkan error integritas. Respons privat memakai `private, no-store`.

Mutasi membutuhkan `Origin` yang sesuai, `X-Umbul-Client: admin-web`, cookie sesi, dan `Idempotency-Key` UUID v4. POST/PUT menerima versi pada body; DELETE menerima query integer desimal kanonis tanpa tanda/pecahan/nol awal. Route literal `/order` terpisah dari route UUID. Field/query asing ditolak.

## Validasi dan urutan

Schema bersama menjadi sumber validasi. Harga wajib angka integer 0–2.147.483.647: nol eksplisit sah, sedangkan null, string, kosong, negatif, pecahan, dan field yang hilang ditolak. Nama, satuan, dan ketentuan wajib terisi; `applicabilityNote` nullable. Harga dan ketentuan tidak pernah ditulis sebagai dua operasi terpisah. PUT mewajibkan boolean `isVisible` dan semua field editable; ID, posisi, serta timestamp dibuat server.

Setiap mutasi melewati service T-08: validasi struktur, receipt, pemeriksaan versi, baru pemeriksaan keberadaan/membership yang dapat berubah. Karena itu versi lama mendahului `INVALID_ORDER` untuk ID hilang/ganda/asing yang bentuk UUID-nya sah. Receipt delete tetap dapat direplay setelah item sudah hilang. Key sama dengan payload berbeda ditolak; create identik tidak menambah tarif kedua.

Reorder memeriksa kesetaraan seluruh himpunan ID dan mengubah posisi lewat satu pernyataan SQL. Array kosong hanya sah saat koleksi kosong. Delete memadatkan posisi tersisa mulai 0. Reorder/pemadatan hanya mengubah posisi, tanpa mengubah field editable, status tampil, ataupun `updatedAt`. Tidak ada batas jumlah tarif bisnis yang diturunkan dari fixture.

## Tanggal publik dan replay

Proyeksi tiket memakai field DTO publik: ID, nama, harga, satuan, ketentuan, dan catatan; hanya tarif tampil, sesuai urutan publik. Posisi numerik, status administratif, serta timestamp item tidak masuk perbandingan.

- Edit tarif tersembunyi, hapus tarif tersembunyi, atau pindah tarif tersembunyi tanpa mengubah urutan tarif tampil tidak mengubah `publicUpdatedAt`/`ticketsUpdatedAt`.
- Perubahan isi/himpunan/urutan tarif tampil, termasuk tampil/sembunyikan, mengubah kedua penanda melalui T-08.
- Penyimpanan identik menaikkan versi sekali tetapi tidak memalsukan tanggal publik.
- Replay mempertahankan data/versi/tanggal lama dan Location create. UI perlu membaca ulang keadaan terkini setelah rekonsiliasi.

Sumbernya berada di `apps/api/src/ticket-rates`; proyeksi publik diekspor agar dapat dipakai kembali saat snapshot publik T-14. Endpoint publik belum ditambahkan pada task ini.

## Verifikasi

Lihat [bukti T-09](./evidence/t09-ticket-rates.md). Suite `bun run test:db` sudah memuat skenario HTTP handler + PostgreSQL nyata untuk lifecycle, simpan/reload, invalid input, konflik, urutan, tanggal, receipt, dan duplikasi serentak. Fixture memakai database test kosong terisolasi sesuai [panduan database](./database.md). URL Request HTTPS di fixture tidak menjadi bukti transport TLS/browser; pengujian tersebut tetap mengikuti T-06/T-23.

Tes belum dijalankan sesuai instruksi pemilik. Tidak ada workflow CI dipicu. T-09 belum dicentang selesai; bukti perilaku dan prasyaratnya masih menunggu persetujuan tes.
