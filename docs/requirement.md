# Requirements — UMBUL NOGO

> Status: draf tahap 2 — cakupan terkonfirmasi; alur, fitur, dan kriteria penerimaan telah dirinci untuk ditinjau.
> Dokumen disusun bertahap. Keputusan pengguna dibedakan dari asumsi dan usulan rincian produk.
> Pembaruan 10 September 2026: data diisi sendiri secara bertahap melalui pengaturan; rancangan terperinci pada [settings.md](./settings.md).

## 1. Keputusan dan asumsi

### 1.1 Keputusan pengguna

- UMBUL NOGO adalah satu destinasi wisata di Wonogiri, Jawa Tengah, dengan beberapa daya tarik atau aktivitas.
- Cakupan tiket adalah menampilkan harga dan ketentuan tiket masuk.
- Pengelola memperbarui informasi wisata, harga tiket, dan foto melalui halaman admin.
- Data destinasi, foto, domain/hosting/storage, anggaran, dan penanggung jawab akan diisi pengguna kemudian. Sediakan pengaturan yang dapat diubah tanpa mengedit kode; data yang belum tersedia tidak menghalangi pengembangan.
- Arah visual menggabungkan alam yang sejuk (hijau, krem, foto destinasi dominan) dengan air yang segar (biru, putih, elemen ringan).

### 1.2 Asumsi dan usulan operasional

- Bahasa utama antarmuka dan konten adalah Bahasa Indonesia; harga ditampilkan dalam Rupiah dan informasi waktu mengikuti WIB (`Asia/Jakarta`).
- Wisatawan mengakses seluruh informasi publik tanpa akun.
- MVP menggunakan satu peran pengelola, yaitu `admin`. Jumlah akun mengikuti kebutuhan pengelola; belum ada pembagian peran editor dan pemberi persetujuan.
- Akun admin awal disiapkan secara terbatas oleh operator teknis. Pengelolaan akun dan pemulihan akses dirinci dalam desain operasional.
- Landing page utama memuat informasi kunjungan dalam satu halaman dengan navigasi antarbagian. Halaman detail aktivitas belum diperlukan pada MVP.
- Usulan penerapan warna: hijau dan krem menjadi dasar, biru air dan putih menjadi aksen serta permukaan pendukung. Nilai warna dan proporsinya dirinci pada `design.md`.
- Rincian fitur dan target kualitas pada tahap ini merupakan usulan berdasarkan cakupan yang dipilih, bukan fakta tentang operasional destinasi.
- Rekomendasi rancangan: konten dan operasional diisi lewat admin; koneksi domain/hosting/storage serta secret melalui konfigurasi deployment. Anggaran dan kontak penanggung jawab bersifat privat. Rincian field dan pembagian menu merupakan usulan implementasi.

## 2. Konteks yang sudah ditetapkan

| Aspek | Ketentuan |
| --- | --- |
| Nama produk | UMBUL NOGO |
| Bentuk produk | Aplikasi web landing page informasi wisata |
| Wilayah | Wonogiri, Jawa Tengah |
| Pengguna utama | End-user, yaitu wisatawan |
| Pengguna pendukung | Pengelola destinasi melalui halaman admin |
| Informasi utama | Informasi wisata serta tiket masuk |
| Gaya pengalaman | Modern, minimalis, sederhana, dengan micro-animation dan transisi halus |
| Perangkat sasaran | Mobile dan desktop; tablet tidak memerlukan rancangan khusus |
| Proses dokumentasi | PRD disusun per bagian atau tahap |

## 3. Rumusan kebutuhan dan tujuan

Wisatawan memerlukan informasi yang jelas tentang UMBUL NOGO untuk mempertimbangkan dan merencanakan kunjungan. Website membantu mereka memahami daya tarik wisata, biaya masuk, dan informasi praktis sebelum berangkat.

Rumusan ini berasal dari konteks produk yang diberikan; belum didukung riset langsung terhadap wisatawan.

### 3.1 Hasil yang diharapkan

- Wisatawan dapat memahami apa yang tersedia di UMBUL NOGO.
- Wisatawan dapat menemukan harga tiket dan ketentuan yang berlaku.
- Wisatawan dapat menemukan informasi yang diperlukan untuk merencanakan kunjungan.
- Informasi utama dapat diakses dengan nyaman melalui mobile dan desktop.
- Halaman publik dapat ditemukan dan dipahami mesin pencari melalui penerapan SEO.

Kriteria keberhasilan fungsional dan kualitas dirinci pada bagian 9–12. Target jumlah kunjungan website belum ditetapkan; transaksi dan penjualan online berada di luar cakupan.

## 4. Usulan cakupan MVP

| Area | Kebutuhan awal | Status |
| --- | --- | --- |
| Identitas destinasi | Nama, lokasi umum, dan pengantar UMBUL NOGO | Sesuai konteks pengguna; isi pengantar belum tersedia |
| Daya tarik wisata | Informasi daya tarik atau aktivitas yang tersedia beserta gambar pendukung | Sesuai konteks pengguna; daftar aktual belum tersedia |
| Tiket masuk | Harga, kategori jika ada, dan ketentuan tiket | Sesuai konteks pengguna; data aktual belum tersedia |
| Persiapan kunjungan | Jam operasional, alamat lengkap, petunjuk lokasi, dan fasilitas | Usulan pendukung; perlu data dari pengelola |
| Galeri | Foto yang merepresentasikan destinasi dan aktivitas | Usulan pendukung; aset belum tersedia |
| Kontak | Cara menghubungi pengelola | Usulan; kanal dan kontak belum tersedia |
| Pengelolaan konten | Pengelola memperbarui informasi wisata, tiket, dan gambar melalui admin | Dipilih pengguna; rincian fitur diusulkan pada tahap 2 |
| Pengaturan bertahap | Pusat pengaturan, daftar kelengkapan, anggaran bulanan, dan penanggung jawab internal | Permintaan pengguna 10 September 2026; nilai diisi kemudian |

### 4.1 Di luar cakupan MVP

Pemesanan, pembayaran, penerbitan tiket digital, dan validasi tiket masuk tidak termasuk cakupan yang dipilih pengguna. Website tidak menyediakan checkout, ketersediaan kuota, atau riwayat transaksi.

Akun wisatawan, ulasan pengguna, konten multibahasa, portal destinasi lain, blog, serta laporan penjualan belum menjadi kebutuhan yang diminta. Usulan MVP juga tidak memerlukan alur persetujuan konten bertingkat atau penjadwalan publikasi otomatis.

## 5. Batasan teknis wajib

| Area | Batasan |
| --- | --- |
| Frontend | Svelte dengan SvelteKit; SSR diperlukan untuk SEO |
| Backend | Bun sebagai runtime dan server; Elysia boleh digunakan sebagai framework ringan |
| Database | PostgreSQL |
| Styling | Tailwind CSS |
| Bahasa | TypeScript untuk seluruh kode FE dan BE; tidak ada berkas sumber `.js` murni. Logika dalam komponen `.svelte` menggunakan TypeScript |
| Repository | Monorepo: satu repository untuk frontend, backend, dan shared types |
| UI/UX | Modern, minimalis, sederhana, dengan micro-animation dan transisi halus |
| Responsivitas | Mobile dan desktop; tidak ada penanganan tablet secara khusus |
| SEO | SSR/prerender sesuai kebutuhan halaman, meta tag dinamis, sitemap, dan structured data |
| Gambar | AWS S3 atau object storage yang kompatibel dengan S3 |

Batasan ini berasal dari pengguna dan tidak boleh diganti. Pilihan framework backend, penyedia S3-compatible, hosting, dan rincian implementasi dibahas dalam desain tanpa mengubah batasan tersebut.

## 6. Informasi yang belum tersedia

| Informasi | Dampak pada dokumen berikutnya |
| --- | --- |
| Daftar daya tarik, fasilitas, harga tiket, dan ketentuan aktual | Konten halaman dan struktur informasi |
| Alamat lengkap, titik peta, jam operasional, serta kontak pengelola | Informasi kunjungan dan structured data |
| Logo, foto asli, serta pedoman merek jika tersedia | Penyesuaian aset dan nilai warna; arah alam dan air sudah dipilih pengguna |
| Identitas pengelola yang akan menerima akses admin | Penyiapan akun saat implementasi; tidak perlu mencantumkan kata sandi dalam dokumen |
| Domain, hosting, dan penyedia S3-compatible | Deployment, URL canonical, dan pengiriman gambar |

Harga, jam operasional, fasilitas, dan detail lokasi tidak boleh ditulis sebagai fakta sebelum datanya tersedia dan diverifikasi oleh pengelola. Placeholder yang digunakan untuk desain harus diberi label sebagai contoh.

Informasi ini dapat dilengkapi kemudian sesuai [settings.md](./settings.md). Konten, foto, anggaran, dan kontak penanggung jawab diisi melalui admin; domain, hosting, storage, serta akses layanan melalui panel penyedia dan konfigurasi deployment. Pengisian nama penanggung jawab tidak otomatis membuat akun admin. Anggaran bulanan hanya catatan rencana biaya dan boleh kosong. Data bisnis kosong tidak menggagalkan startup; konfigurasi koneksi wajib tetap diperlukan untuk menjalankan layanan.

## 7. Urutan penyusunan dokumen

Setiap tahap menghasilkan bagian yang dapat ditinjau, lalu pembahasan berlanjut dengan membawa keputusan dan pertanyaan yang masih terbuka.

| Tahap | Berkas | Hasil |
| --- | --- | --- |
| 1 — selesai | `requirement.md` | Konteks, tujuan, batasan wajib, dan pilihan cakupan MVP |
| 2 — draf tersusun | `requirement.md` | Alur pengguna, kebutuhan fungsional dan nonfungsional, serta kriteria penerimaan |
| 3 — draf tersusun | `design.md` | Struktur informasi, susunan halaman, interaksi, dan arah visual |
| 4 — draf tersusun | `design.md` | Arsitektur FE/BE, monorepo, model data, gambar, serta strategi SEO |
| 5 — draf tersusun | `api-standar.md` | Kontrak API sesuai fitur yang dipilih, validasi, respons, dan kesalahan |
| 6 — draf tersusun | `code-conventions.md` | Konvensi TypeScript, Svelte, backend, shared types, dan kualitas kode |
| 7 — draf tersusun | `task.md` | Tugas implementasi berurutan, dependensi, serta kriteria selesai |

Dokumentasi tahap 1–7 telah tersusun dalam lima berkas utama, dilengkapi [settings.md](./settings.md) untuk pengisian mandiri. `requirement.md` memuat keputusan produk dan rincian kebutuhan; `design.md` memuat UI/UX serta baseline arsitektur teknis. Kontrak publik/admin tersedia pada [api-standar.md](./api-standar.md), aturan penulisan/pemeriksaan kode pada [code-conventions.md](./code-conventions.md), dan urutan implementasi serta bukti penerimaan pada [task.md](./task.md). Implementasi telah dimulai dari fondasi T-01; kelengkapan MVP tetap mengikuti bukti tiap tugas.

## 8. Aktor dan alur utama

### 8.1 Wisatawan

**Kebutuhan:** memahami daya tarik, memperkirakan biaya masuk, dan memperoleh informasi untuk berkunjung.

1. Membuka landing page melalui tautan langsung atau hasil pencarian.
2. Membaca pengantar destinasi dan memilih bagian daya tarik atau tiket melalui navigasi.
3. Membaca harga beserta ketentuan yang sesuai dengan rencana kunjungannya.
4. Memeriksa jam operasional, fasilitas, dan alamat.
5. Membuka petunjuk lokasi atau kanal kontak yang tersedia jika diperlukan.

Alur utama selesai ketika wisatawan memperoleh informasi untuk merencanakan kunjungan. Klik petunjuk lokasi atau kontak merupakan tindakan opsional.

### 8.2 Pengelola

**Kebutuhan:** memperbarui informasi yang dibaca wisatawan tanpa mengubah kode proyek.

1. Masuk ke halaman admin dengan akun yang telah disiapkan.
2. Memilih informasi destinasi, daya tarik, tiket, fasilitas, galeri, atau metadata halaman.
   Pusat Pengaturan menyediakan pintasan ke editor yang sama, daftar kelengkapan, dan formulir Operasional privat.
3. Mengisi atau memperbarui data; untuk gambar, mengunggah berkas dan mengisi teks alternatif.
4. Menyimpan perubahan dan membaca hasil validasi atau pemberitahuan berhasil.
5. Memeriksa hasil pada halaman publik. Item yang disembunyikan tetap dapat dikelola melalui admin.
6. Keluar setelah selesai.

### 8.3 Perilaku penyimpanan dan penayangan

- Perubahan pada formulir belum memengaruhi data tersimpan sampai pengelola memilih **Simpan perubahan** dan server menyatakan berhasil.
- Untuk informasi destinasi dan metadata halaman, penyimpanan yang berhasil memperbarui konten publik.
- Pengaturan Operasional disimpan privat dan tidak mengubah konten maupun tanggal pembaruan publik. Kontak internal tidak otomatis ditampilkan sebagai kontak wisatawan.
- Daya tarik, tarif tiket, fasilitas, dan foto galeri memiliki status **Ditampilkan** atau **Disembunyikan** serta urutan tampil. Item baru berstatus Disembunyikan secara bawaan.
- Pengelola dapat memilih Ditampilkan saat menyimpan item yang sudah lengkap. Perubahan terhadap item yang sedang ditampilkan berlaku setelah penyimpanan berhasil.
- Tidak ada penjadwalan tarif atau publikasi otomatis dalam usulan MVP; pengelola bertanggung jawab mengganti tarif dan catatan saat diperlukan.
- Target usulan: permintaan halaman publik baru menampilkan pembaruan paling lambat 60 detik setelah penyimpanan berhasil. Halaman yang sudah terbuka memerlukan pemuatan ulang.

## 9. Kebutuhan fungsional dan kriteria penerimaan

ID kebutuhan dipakai kembali pada `design.md`, `api-standar.md`, dan `task.md` agar implementasi dapat ditelusuri. Seluruh kebutuhan di bagian ini merupakan usulan MVP; kebutuhan inti mengikuti keputusan pengguna pada bagian 1.1.

### 9.1 Halaman publik

| ID | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| PUB-01 | Identitas dan navigasi destinasi | Halaman menampilkan nama destinasi dari profil tersimpan (nilai awal UMBUL NOGO), lokasi umum, pengantar, dan gambar utama bila tersedia. Tautan **Lihat Tiket** tersedia pada bagian pembuka dan menuju bagian harga. Navigasi dapat digunakan di mobile dan desktop. |
| PUB-02 | Daya tarik atau aktivitas | Menampilkan nama, deskripsi, dan gambar bila tersedia untuk setiap item berstatus Ditampilkan, mengikuti urutan admin. Item Disembunyikan tidak terkirim melalui respons publik. |
| PUB-03 | Informasi tiket masuk | Setiap tarif yang ditampilkan memiliki nama tarif, harga Rupiah, satuan penerapan, dan ketentuan. Tanggal pembaruan informasi tiket ditampilkan. Kategori seperti anak/dewasa atau hari tertentu hanya digunakan jika diisi pengelola. |
| PUB-04 | Informasi kunjungan | Menampilkan jadwal operasional, catatan operasional yang tersedia, fasilitas yang ditampilkan, dan alamat. Petunjuk lokasi menuju lokasi yang ditetapkan pengelola; tombol hanya tersedia bila tujuan valid. |
| PUB-05 | Galeri destinasi | Foto berstatus Ditampilkan tersusun sesuai urutan admin, memiliki teks alternatif, dan menjaga proporsi saat dimuat. Keterangan foto ditampilkan bila diisi. |
| PUB-06 | Kontak pengelola | Menampilkan hanya kanal kontak yang diisi dan valid. Nomor telepon atau tautan membuka kanal yang sesuai. Kanal WhatsApp hanya muncul jika disediakan pengelola sebagai kontak informasi. |

### 9.2 Halaman admin

| ID | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| ADM-01 | Masuk dan keluar | Akun valid dapat masuk. Kredensial salah menghasilkan pesan umum. Sesi tidak sah atau kedaluwarsa tidak dapat membaca data privat maupun mengubah konten. Keluar mengakhiri sesi sehingga permintaan berikutnya ditolak. |
| ADM-02 | Navigasi pengelolaan | Setelah masuk, pengelola dapat membuka setiap kelompok konten dan halaman publik. Area admin tidak memuat metrik penjualan atau transaksi yang tidak tersedia. |
| ADM-03 | Mengelola profil dan informasi kunjungan | Pengelola dapat memperbarui pengantar, gambar utama, alamat, lokasi, jadwal, catatan operasional, dan kontak. Kesalahan masukan ditunjukkan pada kolom terkait. Nilai valid tetap tersimpan setelah halaman dimuat ulang. |
| ADM-04 | Mengelola daya tarik dan fasilitas | Pengelola dapat menambah, mengubah, mengatur urutan, menyembunyikan, menampilkan, dan menghapus item. Penghapusan meminta konfirmasi yang menyebut nama item. Hasil pada halaman publik mengikuti status dan urutan tersimpan. |
| ADM-05 | Mengelola tarif dan ketentuan | Pengelola dapat menambah, mengubah, mengurutkan, menyembunyikan, menampilkan, dan menghapus tarif dengan konfirmasi. Harga negatif, pecahan Rupiah, atau kolom wajib kosong ditolak. Perubahan harga dan ketentuan tampil bersama setelah penyimpanan berhasil. |
| ADM-06 | Mengelola gambar dan galeri | Pengelola dapat mengunggah, memilih, mengganti, dan mengatur foto galeri. Unggahan divalidasi sebelum dapat digunakan. Berkas yang masih dipakai konten tidak dapat dihapus dari penyimpanan; admin diminta mengganti atau melepas pemakaiannya terlebih dahulu. |
| ADM-07 | Mengelola metadata halaman | Pengelola dapat memperbarui judul SEO, deskripsi, dan gambar berbagi opsional. Jika metadata opsional kosong, nilai bawaan berasal dari profil destinasi yang tersedia. Perubahan tercermin dalam HTML publik sesuai target pembaruan konten. |
| ADM-08 | Umpan balik formulir | Tombol menyimpan menunjukkan proses berjalan. Keberhasilan hanya ditampilkan setelah server mengonfirmasi. Saat validasi atau jaringan gagal, masukan formulir tetap tersedia selama halaman terbuka agar dapat diperbaiki atau dikirim ulang; tidak ada pemberitahuan sukses palsu. |
| ADM-09 | Pengaturan dan pengisian bertahap | Pengelola dapat membuka pusat Pengaturan, menyimpan bagian yang valid tanpa melengkapi bagian lain, serta melanjutkan setelah login ulang. Kolom opsional menerima null; tidak ada harga/foto/jadwal rekaan. Daftar kelengkapan dihitung dari data tersimpan dan membedakan Belum diisi, Sudah diisi, serta Tidak dapat diperiksa. Ketersediaan data tidak dinyatakan sebagai verifikasi kebenaran atau kesiapan rilis. |
| ADM-10 | Operasional privat | Admin dapat mengisi/mengosongkan anggaran bulanan, nama/kontak penanggung jawab destinasi dan operator teknis, serta catatan internal. Data tersimpan setelah reload, terlindungi versi/receipt, dan tidak muncul pada API/HTML publik, metadata, atau log formulir. Isian ini tidak membuat akun, menerbitkan kontak publik, mengirim peringatan, atau mengubah tagihan layanan. |

Kontrol pesan autentikasi umum dan pembatasan percobaan masuk mengacu pada [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Detail sesi dan batas percobaan ditentukan pada desain teknis.

## 10. Kebutuhan konten dan aturan bisnis

### 10.1 Data yang dikelola

Ini adalah daftar informasi produk, bukan rancangan tabel database.

| Kelompok | Informasi minimum | Informasi tambahan |
| --- | --- | --- |
| Profil destinasi | Nama, pengantar, wilayah | Logo dan gambar utama dengan teks alternatif |
| Daya tarik | Nama, deskripsi, status tampil, urutan | Gambar dengan teks alternatif |
| Tarif tiket | Nama tarif, harga, satuan penerapan, ketentuan, status tampil, urutan | Catatan periode atau hari berlaku dalam bentuk teks |
| Informasi kunjungan | Alamat lengkap dan jadwal mingguan dengan status buka/tutup | Titik lokasi atau tautan peta, catatan khusus operasional |
| Fasilitas | Nama, status tampil, urutan | Deskripsi singkat |
| Galeri | Berkas gambar, teks alternatif, status tampil, urutan | Keterangan foto |
| Kontak | Sedikitnya satu kanal yang dapat digunakan sebelum peluncuran | Kanal tambahan dan media sosial |
| Metadata halaman | Judul dan deskripsi yang diisi atau diturunkan dari profil | Gambar berbagi khusus |
| Operasional privat | Semua field boleh kosong selama pengisian bertahap | Anggaran bulanan IDR, penanggung jawab destinasi, operator teknis, dan catatan internal; penanggung jawab nyata ditetapkan sebelum peluncuran |

Bootstrap produksi mengisi hanya nama UMBUL NOGO dan wilayah Wonogiri, Jawa Tengah yang sudah dikonfirmasi; kedua nilai selanjutnya dapat diedit. Field opsional null, koleksi kosong, dan jadwal tujuh hari unknown. Migrasi berikutnya tidak menimpa data yang sudah diisi. Nama/wilayah serta field wajib suatu item tetap divalidasi; pengisian bertahap dilakukan per bagian, tanpa menyimpan item invalid.

### 10.2 Aturan tiket dan jadwal

- Harga menggunakan nominal Rupiah bulat. Harga `0` hanya berarti gratis bila pengelola secara eksplisit mengisinya; harga kosong tidak boleh dianggap gratis.
- Satuan penerapan harus jelas, misalnya per orang atau per kendaraan. Contoh ini bukan pernyataan tentang tarif UMBUL NOGO yang sebenarnya.
- Ketentuan menerangkan siapa atau situasi apa yang dikenai tarif tersebut, termasuk cakupan biaya bila relevan. Website tidak menghitung total belanja atau menerbitkan bukti pembelian.
- Jika beberapa tarif ditampilkan, label dan ketentuannya harus membantu wisatawan membedakannya. Pengelola memeriksa bahwa isinya tidak saling bertentangan.
- Tanggal pembaruan informasi tiket berubah saat tarif publik, urutan, atau ketentuannya berubah. Mengedit foto destinasi tidak mengubah tanggal pembaruan tiket.
- Jadwal membedakan hari buka dan tutup. Jam buka/tutup serta catatan hari khusus berasal dari pengelola; website tidak menebak status operasional.

### 10.3 Gambar dan publikasi

- Usulan batas unggahan MVP: JPEG, PNG, atau WebP hingga 5 MiB per berkas. Format dan ukuran divalidasi di server, termasuk kecocokan isi berkas sebagai gambar.
- Gambar yang dipakai konten harus sudah berhasil disimpan di AWS S3 atau penyimpanan S3-compatible; kegagalan unggah tidak boleh mengganti gambar lama yang masih dipakai.
- Foto bermakna memerlukan teks alternatif; gambar dekoratif menggunakan alternatif kosong melalui desain komponen.
- Status Disembunyikan mengatur penayangan item pada website dan API publik. Status ini bukan fasilitas penyimpanan berkas rahasia; materi yang diunggah adalah aset promosi destinasi.
- Pengelola memastikan informasi dan foto mewakili kondisi destinasi. Konten contoh hanya digunakan pada lingkungan pengembangan atau pratinjau dengan label yang jelas.

### 10.4 Kondisi kosong dan gagal

| Kondisi | Perilaku yang diperlukan |
| --- | --- |
| Belum ada tarif yang ditampilkan | Bagian tiket tetap tersedia dengan pesan **Informasi harga tiket belum tersedia**. Kontak ditampilkan bila tersedia; tidak ada harga rekaan atau nilai gratis otomatis. |
| Daya tarik, galeri, atau fasilitas belum diisi | Bagian opsional yang kosong beserta tautan navigasinya dapat disembunyikan. Halaman tetap menampilkan identitas dan informasi lain yang tersedia. |
| Jadwal atau lokasi belum lengkap | Informasi yang belum diketahui diberi keterangan **Informasi belum tersedia**. Tautan peta yang belum valid tidak ditampilkan. |
| Gambar gagal dimuat | Ruang gambar tetap stabil dan teks konten dapat dibaca; tidak menampilkan gambar destinasi lain sebagai pengganti fakta. |
| Data utama gagal diambil dan tidak ada data tersimpan yang masih valid | Tampilkan pemberitahuan gangguan sementara dan cara mencoba lagi, dengan status HTTP yang sesuai untuk gangguan layanan. Kegagalan tidak diperlakukan sebagai data harga kosong. |
| Penyimpanan atau unggahan gagal | Data publik yang sudah tersimpan tetap konsisten; admin mendapat pesan yang dapat ditindaklanjuti dan dapat mencoba kembali. |
| Koneksi terputus setelah permintaan penyimpanan dikirim | Hasil transaksi ditandai belum dapat dipastikan; admin dapat memeriksa hasil atau mengulangi niat yang sama tanpa perubahan ganda. Timeout tidak langsung dinyatakan sebagai transaksi batal. |

## 11. Kebutuhan nonfungsional

### 11.1 SEO

| ID | Kebutuhan dan kriteria penerimaan |
| --- | --- |
| SEO-01 | HTML awal halaman publik memuat pengantar, daya tarik yang ditampilkan, harga, dan informasi kunjungan yang tersedia. Konten inti serta navigasi antarbagian dapat dibaca tanpa menunggu JavaScript browser. SSR SvelteKit tetap digunakan; prerender hanya dipilih bila mekanisme pembaruannya memenuhi target konten. |
| SEO-02 | Judul, meta description, canonical, serta metadata Open Graph dihasilkan dari konten halaman melalui server. Metadata juga diperbarui ketika konten terkait berubah, mengikuti target 60 detik. |
| SEO-03 | Sitemap memuat URL canonical publik yang dapat diindeks. Fragmen navigasi dalam satu landing page bukan halaman tersendiri. Login, admin, dan endpoint API tidak masuk sitemap; halaman admin/login diberi `noindex`. Halaman privat tetap dilindungi autentikasi. |
| SEO-04 | Structured data JSON-LD mendeskripsikan destinasi berdasarkan informasi yang tersedia dan sesuai dengan tampilan publik. Tidak menambahkan harga, jam, rating, atau ulasan yang belum tersedia. Perubahan informasi terkait memperbarui JSON-LD bersama HTML. |

Kebutuhan SSR, judul, deskripsi, dan sitemap mengikuti [panduan SEO SvelteKit](https://svelte.dev/docs/kit/seo). Structured data mengikuti [pedoman Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), terutama kesesuaian dengan konten yang terlihat. Tipe schema dan pemeriksaan teknis dipilih pada tahap desain. Penerapan SEO tidak menjadi janji peringkat atau kemunculan rich result.

### 11.2 Pengalaman, performa, dan operasional

| ID | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| NFR-01 | Responsivitas | Alur utama publik dan admin dapat diselesaikan pada lebar mobile 360–430 px serta desktop 1280–1920 px tanpa konten terpotong atau scroll horizontal pada halaman. Lebar di antaranya mengikuti tata letak fleksibel tanpa rancangan tablet khusus. |
| NFR-02 | Aksesibilitas | Navigasi dan formulir dapat dipakai dengan keyboard, fokus terlihat, urutan heading bermakna, kolom memiliki label, dan kesalahan tidak disampaikan hanya melalui warna. Informasi tidak hanya tersedia saat hover. Gerakan mengikuti preferensi reduced motion. |
| NFR-03 | Transisi halus | Animasi membantu perpindahan dan umpan balik interaksi, tanpa menunda akses harga atau membuat teks utama awalnya tersembunyi sampai JavaScript berjalan. Usulan durasi transisi antarmuka: 150–250 ms; pengurangan gerakan meniadakan animasi nonesensial. |
| NFR-04 | Performa publik | Target operasional: LCP ≤ 2,5 detik, INP ≤ 200 ms, dan CLS ≤ 0,1 pada persentil ke-75, dinilai terpisah untuk mobile dan desktop saat data lapangan memadai. Sebelum rilis, ukur build produksi dengan konten realistis dan catat perangkat serta kondisi jaringan. Uji laboratorium tidak dinyatakan sebagai kelulusan data lapangan. |
| NFR-05 | Proteksi akses dan masukan | Seluruh pembacaan privat dan perubahan admin memerlukan sesi sah di server. Permintaan tanpa hak akses tidak mengubah data atau berkas. Validasi dilakukan di server; konten ditampilkan sebagai teks atau format yang disanitasi. Rancangan keamanan mencakup proteksi CSRF pada autentikasi berbasis cookie dan pembatasan percobaan masuk. |
| NFR-06 | Kredensial dan rahasia | Password disimpan sebagai hash yang sesuai untuk password. Kunci database, penyimpanan gambar, serta kredensial admin tidak terkirim melalui HTML, bundle browser, API publik, atau log aplikasi. Koneksi produksi menggunakan HTTPS. |
| NFR-07 | Konsistensi konten | Dalam kondisi layanan normal, halaman publik yang diminta setelah batas 60 detik mencerminkan penyimpanan admin yang berhasil, termasuk status tampil, harga, metadata, dan JSON-LD. Kegagalan penyimpanan tidak menghasilkan perubahan sebagian dalam satu operasi logis. |
| NFR-08 | Pemulihan dan diagnosis | Sebelum peluncuran tersedia prosedur pencadangan dan pemulihan PostgreSQL serta aset S3. Pemulihan dicoba pada lingkungan terpisah dan referensi gambar diperiksa. Kegagalan layanan dapat ditelusuri melalui log tanpa data rahasia; frekuensi backup dan target pemulihan ditentukan sesuai hosting pada tahap desain. |

Target NFR-04 mengadopsi ambang pengalaman baik pada [Web Vitals](https://web.dev/articles/vitals). Angka tersebut adalah sasaran produk, bukan hasil pengukuran website yang sudah dibangun.

## 12. Skenario penerimaan MVP

Skenario berikut menjadi dasar rencana pengujian MVP pada `task.md`. Smoke test fondasi T-01 tidak menyatakan skenario penerimaan MVP ini telah lulus.

| ID | Skenario | Hasil yang diharapkan | Kebutuhan terkait |
| --- | --- | --- | --- |
| AC-01 | Wisatawan membuka landing page pada mobile dan desktop | Dapat menemukan daya tarik, tarif beserta ketentuan, dan informasi kunjungan tanpa login. | PUB-01–06, NFR-01 |
| AC-02 | HTML publik diperiksa sebelum JavaScript browser berjalan | Konten inti, metadata, dan JSON-LD yang relevan sudah tersedia; data sesuai tarif dan informasi yang ditampilkan. | SEO-01, SEO-02, SEO-04 |
| AC-03 | Admin mengubah harga dan ketentuan lalu menyimpan | Nilai tersimpan setelah reload admin; permintaan publik baru setelah batas pembaruan menampilkan nilai yang sama beserta tanggal pembaruan tiket. | ADM-05, NFR-07 |
| AC-04 | Admin mengirim harga negatif atau kosong | Server menolak dengan kesalahan pada kolom harga. Tarif publik sebelumnya tetap berlaku dan masukan lain tetap tersedia di formulir. | ADM-05, ADM-08 |
| AC-05 | Admin menyembunyikan daya tarik yang sebelumnya tampil | Setelah batas pembaruan, item hilang dari HTML dan API publik, tetapi tetap dapat diubah dan ditampilkan kembali melalui admin. | PUB-02, ADM-04, NFR-07 |
| AC-06 | Admin mengganti gambar dengan berkas invalid atau unggahan gagal | Berkas tidak dapat digunakan sebagai gambar konten; gambar lama tetap berfungsi dan admin dapat mencoba kembali. | ADM-06, ADM-08 |
| AC-07 | Pengunjung tanpa sesi mencoba membaca data privat atau mengubah konten; sesi yang sudah logout dicoba ulang | Akses ditolak di server; tidak ada perubahan data atau berkas. | ADM-01, NFR-05 |
| AC-08 | Semua tarif disembunyikan atau layanan data gagal | Tarif kosong menampilkan pesan ketersediaan informasi; gangguan layanan ditangani sebagai gangguan. Keduanya tidak menghasilkan harga palsu. | PUB-03, bagian 10.4 |
| AC-09 | Navigasi dan formulir dipakai dengan keyboard serta reduced motion | Fokus, label, pesan kesalahan, dan interaksi utama dapat digunakan; animasi nonesensial mengikuti preferensi pengguna. | NFR-02, NFR-03 |
| AC-10 | Halaman publik, login, dan admin diperiksa untuk indeksasi | Sitemap hanya memuat URL publik canonical; login/admin memiliki `noindex`; data privat memerlukan autentikasi. | SEO-03, NFR-05 |
| AC-11 | Admin membuka instalasi dengan data bisnis awal, mengisi satu bagian, lalu masuk kembali | Pengaturan tetap dapat dibuka; isian tersimpan, bagian kosong tidak memunculkan data rekaan, dan daftar kelengkapan berubah berdasarkan data tersimpan. Kegagalan pembacaan ditandai Tidak dapat diperiksa. | ADM-03, ADM-06, ADM-09 |
| AC-12 | Admin menyimpan/mengosongkan anggaran dan kontak internal; dua tab mengubah versi yang sama | Null berbeda dari 0; nilai invalid ditolak; konflik/retry tidak menimpa atau menggandakan perubahan. Data privat tidak masuk publik/log; tanggal publik/tiket tidak berubah; akun dan kontak publik tetap terpisah. | ADM-08, ADM-10, NFR-05–06 |

### 12.1 Kesiapan konten untuk peluncuran

- Pengelola menyediakan dan memeriksa nama, pengantar, setidaknya satu daya tarik, tarif beserta ketentuan, jadwal, alamat, dan satu kanal kontak.
- Gambar destinasi yang akan ditampilkan telah diperiksa pengelola dan dilengkapi teks alternatif yang sesuai.
- Data contoh tidak tampil sebagai informasi operasional pada website produksi.
- Pengelola dapat menjalankan alur pembaruan informasi dan memeriksa hasilnya pada halaman publik.

Kekurangan data operasional tidak menghalangi desain dan implementasi dengan placeholder berlabel, tetapi harus diselesaikan sebelum informasi tersebut dipublikasikan sebagai data nyata.
