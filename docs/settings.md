# Pengaturan dan Pengisian Bertahap — UMBUL NOGO

> Status: draf rancangan, 10 September 2026. Pengguna ingin mengisi data destinasi, foto, pilihan layanan, anggaran, dan penanggung jawab sendiri di kemudian hari. Halaman pengaturan belum diimplementasikan.
> Acuan: [kebutuhan](./requirement.md), [desain](./design.md), [kontrak API](./api-standar.md), dan [tugas implementasi](./task.md).

## 1. Tempat mengisi setiap informasi

Pengaturan konten dan operasional disimpan di PostgreSQL melalui admin. Konfigurasi layanan diisi melalui panel hosting/deployment, dengan secret pada fasilitas secret penyedia. Keduanya dapat diperbarui tanpa mengedit kode aplikasi; perubahan layanan memerlukan penerapan konfigurasi dan pemeriksaan koneksi.

| Informasi | Tempat pengisian | Dampak setelah disimpan |
| --- | --- | --- |
| Nama, pengantar, wilayah, alamat, lokasi, jadwal, dan kontak publik | Pengaturan → Informasi Destinasi | Memperbarui halaman publik sesuai aturan penayangan |
| Logo, foto utama, foto daya tarik, dan galeri | Pemilih gambar pada formulir terkait serta pustaka media bersama | Foto siap pakai dapat dipilih, diganti, dan diatur keterangannya |
| Harga dan ketentuan tiket, daya tarik, fasilitas, serta galeri | Menu konten masing-masing, dengan pintasan dari Pengaturan | Pengelola menentukan isi, urutan, dan status tampil |
| Judul/deskripsi pencarian dan gambar berbagi | Pengaturan → Tampilan Pencarian | Metadata mengikuti isian atau fallback dari profil |
| Anggaran bulanan, penanggung jawab destinasi, operator teknis, dan catatan internal | Pengaturan → Operasional | Tersimpan privat, hanya dapat diakses admin |
| Domain website | Panel DNS/hosting dan konfigurasi deployment | Domain aktif, canonical, dan origin autentikasi mengikuti konfigurasi yang diterapkan |
| Hosting, region, serta koneksi database | Panel penyedia dan konfigurasi deployment | Menentukan tempat aplikasi/data berjalan; perpindahan layanan mengikuti panduan migrasi |
| Penyedia storage, bucket, region, host gambar, dan kredensial | Panel penyedia serta konfigurasi/secret deployment | Menentukan koneksi penyimpanan dan pengiriman gambar |

Nama penyedia, domain, dan kredensial tidak dikunci di source code. Anggaran adalah catatan rencana biaya bulanan dalam Rupiah; isian ini tidak membeli layanan, membayar tagihan, mengukur pemakaian, atau membatasi biaya penyedia secara otomatis.

## 2. Menu dan alur pengelola

`/admin/pengaturan` menjadi pusat pengaturan, dengan kartu Informasi Destinasi, Tampilan Pencarian, dan Operasional, serta pintasan Tiket, Daya Tarik, Fasilitas, dan Galeri. Kartu mengarah ke editor yang sama dengan menu utama, sehingga tidak ada salinan formulir atau data. Formulir Operasional berada di `/admin/pengaturan/operasional`.

Alur awal: masuk → buka Pengaturan → pilih bagian → isi data yang sudah tersedia → simpan → lanjutkan bagian lain kapan saja. Setiap formulir memiliki tombol simpan sendiri. Pengisian anggaran atau operator tidak menjadi prasyarat menyimpan profil/foto.

Formulir Operasional diberi keterangan **Hanya terlihat oleh admin**. Kontak untuk pengunjung tetap dikelola pada Informasi Destinasi; nomor penanggung jawab internal tidak otomatis menjadi kontak publik. Semua akun admin memiliki akses yang sama pada MVP. Mengisi nama/email penanggung jawab tidak membuat akun, mengirim undangan, atau memberikan akses; provisioning akun tetap melalui operator.

## 3. Nilai awal dan pengisian bertahap

- Bootstrap produksi hanya memakai identitas yang sudah diberikan pengguna: nama `UMBUL NOGO` dan wilayah `Wonogiri, Jawa Tengah`. Keduanya kemudian dibaca dari database dan dapat diedit melalui admin. Migrasi/restart berikutnya tidak menimpa isian pengelola.
- Pengantar, alamat, koordinat, foto, metadata opsional, anggaran, dan kontak internal dimulai sebagai `null`; daftar konten/kontak dimulai kosong. Tujuh hari jadwal dimulai dengan status `unknown`.
- Kolom opsional boleh dikosongkan kembali. Formulir mengirim `null`, bukan harga/anggaran 0 atau teks contoh. Jika suatu nilai diisi, validasi tetap berlaku; draft tersimpan tidak menjadi alasan menerima nomor, URL, atau pasangan koordinat invalid.
- Nama dan wilayah tetap wajib. Item koleksi yang dibuat tetap memenuhi field wajib kontraknya dan tersembunyi secara bawaan. Pengisian bertahap berarti melengkapi bagian satu per satu; tidak menambahkan penyimpanan item invalid atau autosave draft.
- Tanpa foto utama, tampilkan identitas teks dan latar desain. Tanpa logo gunakan nama destinasi. Gambar pengembangan tidak dipakai sebagai pengganti foto asli pada produksi.
- Konten kosong memakai perilaku pada bagian 10.4 [requirement.md](./requirement.md). Data destinasi yang belum diisi tidak menggagalkan startup, sedangkan konfigurasi koneksi wajib tetap harus tersedia agar layanan dapat berjalan.

## 4. Daftar kelengkapan di Pengaturan

Daftar ini membantu menemukan isian yang belum tersedia. Status dihitung ulang dari data tersimpan saat halaman dibuka atau tombol **Periksa kembali** dipilih; tidak ada checkbox selesai yang disimpan sendiri.

| Bagian | Kondisi untuk label Sudah diisi |
| --- | --- |
| Identitas | Nama, wilayah, dan pengantar tersedia |
| Daya tarik | Minimal satu daya tarik ditampilkan |
| Tiket | Minimal satu tarif lengkap ditampilkan; nilai 0 yang disengaja tetap sah |
| Informasi kunjungan | Alamat tersedia dan tujuh hari jadwal sudah diketahui, termasuk hari tutup |
| Kontak publik | Minimal satu kanal valid ditampilkan |
| Foto | Hero atau minimal satu foto daya tarik/galeri tersedia pada snapshot publik; logo saja tidak memenuhi baris ini |
| Penanggung jawab | Nama penanggung jawab destinasi dan operator teknis masing-masing diisi dengan minimal satu kanal telepon/email; orang yang sama boleh memegang keduanya |
| Anggaran (opsional) | Nominal diisi eksplisit; `null` berarti Belum diisi dan 0 berarti Rp0 |

Ringkasan konten menggunakan satu snapshot `GET /api/v1/public/site`, sedangkan bagian internal memakai `GET /api/v1/admin/operations`. Endpoint tetap mengikuti autentikasi masing-masing. Kegagalan pembacaan diberi label **Tidak dapat diperiksa**, bukan Belum diisi. Periksa ulang setelah perubahan; status dari tab lama bukan bukti keadaan terbaru. Tidak diperlukan endpoint checklist atau tabel status baru.

**Sudah diisi** hanya menyatakan data tersedia. Pengelola tetap memeriksa kebenaran harga, kontak, jadwal, dan keaslian foto sebelum peluncuran. Daftar ini tidak menyediakan tombol peluncuran otomatis, tidak mengubah status tampil item, dan tidak mengklaim domain/storage telah terhubung. Anggaran kosong tidak menghalangi publikasi. Logo serta override SEO tetap opsional. Pemeriksaan rilis tetap mengikuti T-24–T-28.

## 5. Konfigurasi domain, hosting, dan storage

Gunakan satu sumber konfigurasi aktif: environment deployment untuk koneksi/origin dan fasilitas secret penyedia untuk kredensial. Tidak ada endpoint admin yang menerima atau mengembalikan password database, access key S3, atau seluruh environment. Pedoman ini mengikuti pemisahan akses rahasia pada [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).

| Pengaturan teknis | Konfigurasi yang direncanakan |
| --- | --- |
| Domain utama | `SITE_ORIGIN` untuk web/API; `ORIGIN` adapter harus sama |
| Jalur API privat | `API_INTERNAL_URL` hanya untuk server web |
| Database | `DATABASE_URL`; migrasi memakai `MIGRATION_DATABASE_URL` terpisah |
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, dan kredensial yang disuntikkan ke API/job |
| URL foto publik | `MEDIA_BASE_URL` menggunakan host aset stabil |

Web membaca konfigurasi deployment yang berubah per lingkungan melalui akses environment privat saat runtime. Dukungan environment runtime SvelteKit tersedia di server; perilaku produksi bergantung adapter dan harus diuji pada build Bun proyek. Rujukan: [SvelteKit environment privat](https://svelte.dev/docs/kit/$env-dynamic-private).

Saat implementasi, sediakan template konfigurasi tanpa secret dan panduan deployment sesuai penyedia yang akhirnya dipilih. Pengguna dapat mengisi nilai melalui panel hosting; developer/operator menyiapkan penerapan awal dan prosedur pemeriksaannya. Tidak ada penyedia, domain, region, atau anggaran yang harus dipilih sekarang untuk menyusun aplikasi lokal. Lingkungan lokal tetap membutuhkan PostgreSQL dan storage S3-compatible uji untuk membuktikan fitur terkait.

Perubahan domain memerlukan DNS/HTTPS, penerapan `SITE_ORIGIN`/`ORIGIN` yang konsisten, serta pemeriksaan canonical, sitemap, login/logout, dan tautan. Sesi cookie pada domain lama tidak dipindahkan ke domain baru; pengelola masuk kembali. Penggantian hosting mengikuti deployment build yang sama dan pemindahan data jika diperlukan.

Perubahan storage/bucket memerlukan penyalinan dan verifikasi seluruh objek yang masih dirujuk, lalu penerapan konfigurasi baru dan pemeriksaan upload, baca gambar lama/baru, penghapusan, serta backup. Pertahankan host publik/key bila memungkinkan; jika host berubah, sediakan kelangsungan URL lama sesuai kebutuhan cache. Simpan konfigurasi dan salinan data lama sampai pemeriksaan berhasil agar pemulihan memungkinkan. Mengganti koneksi database juga memerlukan pemulihan/migrasi data, bukan membuat database kosong seolah konten lama belum diisi.

## 6. Cakupan implementasi

T-03/T-04 mencakup schema dan bootstrap kosong; T-12 mencakup API operasional privat; T-14 membuktikan data internal tidak masuk snapshot publik; T-18 membangun pusat Pengaturan, editor, serta daftar kelengkapan. T-23 menguji pengisian bertahap dan pemisahan data publik/privat. T-24 menyiapkan template/panduan konfigurasi serta memeriksa penerapannya. T-27/T-29 mencakup latihan pengisian dan serah terima.

Nama field, validasi, versi, dan perilaku simpan Operasional ditetapkan pada bagian 5.3 [api-standar.md](./api-standar.md). Ringkasan ini melengkapi lima dokumen awal; tidak menyatakan pekerjaan aplikasi sudah selesai.
