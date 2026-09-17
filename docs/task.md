# Tugas Implementasi — UMBUL NOGO

> Status: draf tahap 7 — daftar pekerjaan berdasarkan empat dokumen sebelumnya.
> Progres implementasi: **2 dari 29 tugas selesai**. T-01 dan T-02 memiliki hasil uji lokal/Linux; T-03–T-05 sudah diimplementasikan; bukti perilaku menunggu persetujuan tes.
> Acuan: [requirement.md](./requirement.md), [design.md](./design.md), [api-standar.md](./api-standar.md), dan [code-conventions.md](./code-conventions.md).
> Pembaruan 11 September 2026: lihat [bukti T-01](./evidence/t01-bootstrap.md) dan [bukti T-02](./evidence/t02-code-checks.md). Pengiriman pekerjaan memakai branch `development`; tes dan pemicu CI manual menunggu konfirmasi pemilik proyek sesuai [AGENTS.md](../AGENTS.md). Cakupan pengaturan pada [settings.md](./settings.md) tetap masuk tugas terkait.

## 1. Cakupan dan cara menggunakan daftar

Target implementasi adalah satu landing page wisata UMBUL NOGO di Wonogiri, Jawa Tengah, dengan informasi tiket dan halaman admin pengelola. Stack tetap SvelteKit SSR, Bun/Elysia, PostgreSQL, Tailwind CSS, TypeScript, monorepo, dan AWS S3/S3-compatible. Arah visual mengikuti hijau/krem dengan aksen biru/putih serta foto destinasi dominan. Pemesanan dan pembayaran tidak masuk pekerjaan MVP.

Peran FE, BE, developer, operator, dan pengelola pada dokumen ini menunjukkan tanggung jawab; satu orang dapat memegang beberapa peran. Kapasitas tim, anggaran, hosting, dan data destinasi belum tersedia, sehingga durasi/sprint belum ditetapkan.

Pengguna akan mengisi data/foto, anggaran, serta penanggung jawab melalui admin kemudian. Domain/hosting/storage diisi melalui konfigurasi deployment tanpa mengedit kode. Pengembangan memakai kondisi awal yang sah serta fixture uji terpisah; anggaran kosong tidak menjadi penghalang implementasi atau publikasi. Akses infrastruktur nyata tetap diperlukan untuk T-24 dan rilis.

- Checkbox menandai pekerjaan implementasi yang telah dibuktikan selesai. Keberadaan uraian tugas atau kode awal tidak cukup untuk mencentangnya.
- Dependensi menyatakan prasyarat penyelesaian tugas. Pengerjaan awal dengan fixture diperbolehkan, tetapi tugas belum selesai sampai integrasi dengan dependensinya terbukti.
- Simpan bukti pada PR/commit atau artefak CI yang sesuai: versi build, lingkungan, perintah/skenario, hasil, dan keterbatasannya. Jangan menyimpan secret atau salinan sesi pada bukti.
- Tugas yang tertahan mencatat penyebab, pemilik tindak lanjut, dan pekerjaan lain yang masih dapat dilanjutkan. Data operasional yang belum tersedia tidak menghalangi implementasi lokal dengan fixture berlabel.
- Jika implementasi memerlukan perubahan kontrak/desain, perbarui dokumen terkait dan dependensinya. Batasan teknis serta cakupan yang dipilih pengguna tetap berlaku.

Urutan bagian mengelompokkan pekerjaan, bukan mewajibkan semuanya berjalan serial. Fondasi UI T-15 dapat dimulai setelah T-01 dan T-03. Alur admin tiket T-16–T-17 dapat diselesaikan setelah API tiket T-09 tersedia, tanpa menunggu seluruh fitur media.

## 2. Titik hasil yang dapat ditinjau

| Hasil | Tugas utama | Bukti minimum |
| --- | --- | --- |
| Fondasi berjalan | T-01–T-05 | Dua proses Bun, shared contracts, PostgreSQL, dan pemeriksaan kode bekerja |
| Admin dapat mengelola tarif | T-06–T-09, T-15–T-17 | Login, simpan/reload tarif, validasi, konflik, dan pemulihan hasil simpan dapat diperiksa |
| Seluruh konten dapat dikelola | T-10–T-14, T-18–T-19 | Media siap pakai, profil, jadwal, kontak, koleksi, serta snapshot publik konsisten |
| Landing page siap ditinjau | T-20–T-21 | Mobile/desktop, tiket terbaca tanpa JavaScript, metadata dan sitemap tersedia |
| Kandidat rilis terbukti | T-22–T-27 | Penerimaan, staging, performa, pemulihan, dan konten nyata diperiksa |
| Diluncurkan dan diserahterimakan | T-28–T-29 | Pemeriksaan produksi, panduan pengelola, serta pengamatan operasional awal |

## 3. Fondasi monorepo dan data

### T-01 — Bootstrap dan pembuktian toolchain

- [x] Selesai
- **Dependensi:** tidak ada. **Pemilik:** developer.
- **Hasil:** workspace web/API/contracts, package manifest, Git ignore, kandidat lockfile, konfigurasi TS, serta halaman dan API minimum. Konfigurasi SvelteKit berada di `vite.config.ts` sesuai desain.
- **Selesai bila:** web SSR dan Elysia berjalan sebagai dua proses Bun; browser dapat memuat HTML, aset, dan hydration; kontrak dapat diimpor FE/BE; Tailwind menghasilkan CSS; Sharp dapat decode fixture pada target Bun/Linux. Pin versi setelah kompatibilitas dasar terbukti, tanpa file sumber JS buatan tangan.
- **Bukti:** build dan startup produksi minimum, versi runtime/dependensi, dan hasil smoke test. Dukungan antarmuka pada dokumentasi paket belum menjadi pengganti bukti ini.
- **Hasil aktual:** [bukti T-01](./evidence/t01-bootstrap.md); build/check/runtime/Sharp lulus macOS dan Linux arm64, serta empat smoke test Chromium lulus.

### T-02 — Pemeriksaan kode dan kerangka CI

- [x] Selesai
- **Dependensi:** T-01. **Pemilik:** developer.
- **Hasil:** konfigurasi strict TypeScript, Prettier, ESLint TS/Svelte, pemeriksaan batas import, pemeriksaan sumber TS, dan workflow CI dasar sesuai konvensi.
- **Selesai bila:** `format:check`, `lint`, `check`, dan `check:source` bekerja pada file authored; import terlarang dan contoh pelanggaran tipe/sumber ditolak. Definisikan script test/build dan pemisahan suite; tambahkan job saat suite tersedia tanpa melaporkan test kosong sebagai bukti perilaku.
- **Bukti:** CI memakai frozen lockfile, pemeriksaan positif/negatif yang relevan, dan generated output tidak masuk source control. CI lengkap diperiksa kembali pada T-23.
- **Hasil aktual:** [bukti T-02](./evidence/t02-code-checks.md); format/source/lint/typecheck, 13 tes tooling, build, serta integrasi lulus lokal dan Linux arm64. Enam uji negatif CLI dan empat tes browser lulus lokal. Workflow GitHub belum dijalankan; setelah verifikasi awal, pemicunya diubah menjadi manual sesuai kebijakan konfirmasi tes.

### T-03 — Shared schema dan kontrak

- [ ] Selesai
- **Dependensi:** T-01. **Pemilik:** BE dengan FE.
- **Hasil:** schema Zod dan tipe turunan untuk snapshot publik, sesi, profil/jadwal/kontak, SEO, Operasional privat, empat koleksi, media, envelope, versi, dan katalog error.
- **Selesai bila:** bentuk request/response sesuai seluruh bagian `api-standar.md`; input strict, null berbeda dari kosong/0, nominal integer, jadwal lintas tengah malam dan Unicode divalidasi. Package kontrak tidak membawa runtime server atau secret ke browser.
- **Bukti:** unit kontrak dengan nilai batas/masukan tidak sah dan typecheck terpisah. Pembatasan akses serta keberadaan media tetap milik service BE.
- **Hasil aktual:** [implementasi dan bukti T-03](./evidence/t03-shared-contracts.md); schema serta unit test tersedia; format, lint, typecheck terpisah/workspace, dan check sumber lulus. Pengujian perilaku belum dijalankan, menunggu persetujuan pemilik.

### T-04 — PostgreSQL, schema, migrasi, dan fixture

- [ ] Selesai
- **Dependensi:** T-01, T-03. **Pemilik:** BE.
- **Hasil:** PostgreSQL development/test, schema Drizzle seluruh entitas desain, migrasi awal SQL, pool, role runtime/migrasi terpisah, dan fixture berlabel.
- **Selesai bila:** migrasi berhasil pada database kosong; constraint, foreign key, indeks awal, singleton, serta tipe uang/waktu sesuai desain. Fixture tidak berisi kredensial produksi dan tidak dijalankan sebagai seed konten nyata. Database test terisolasi sebelum cleanup.
- **Bukti:** hasil migrasi dan transaksi commit/rollback pada PostgreSQL nyata; role runtime tidak memiliki hak DDL. Pemakaian snapshot konsisten diuji lebih lanjut pada T-14.
- **Pengisian awal:** bootstrap produksi hanya mengisi nama/wilayah terkonfirmasi, singleton state, singleton `operations_settings` dengan seluruh isian null, dan tujuh jadwal unknown; field opsional null serta koleksi kosong. Buktikan isi awal sesuai kontrak dan bootstrap/restart tidak menimpa data yang sudah diedit. Pembukaan admin tanpa fixture bisnis tambahan dibuktikan pada T-23 setelah autentikasi/UI tersedia.
- **Hasil aktual:** schema 15 tabel, migrasi SQL, pool, role, Compose development/test, fixture dan suite integrasi tersedia; lihat [panduan database](./database.md) dan [bukti T-04](./evidence/t04-database.md). Database/migrasi/tes belum dijalankan; dependensi T-03 juga belum memiliki bukti unit.

### T-05 — Fondasi HTTP, konfigurasi, dan diagnosis

- [ ] Selesai
- **Dependensi:** T-02, T-03, T-04. **Pemilik:** BE.
- **Hasil:** pemisahan `app.ts`/`server.ts`, validasi environment, routing `/api/v1`, pemetaan error, request ID, log aman, batas body, deadline, dan health internal.
- **Selesai bila:** status/envelope sesuai kontrak; JSON/query tidak sah ditolak; limit berlaku termasuk tanpa Content-Length; error tidak menjadi sukses/daftar kosong. Startup dengan konfigurasi wajib hilang gagal tanpa secret; readiness memeriksa DB/schema, sementara gangguan storage tidak mematikan kemampuan baca konten.
- **Bukti:** test HTTP terhadap input normal/tidak sah/batas ukuran, log yang telah diperiksa, health, dan shutdown. Autentikasi ditambahkan pada T-06; paparan jaringan produksi diperiksa pada T-24.
- **Hasil aktual:** factory aplikasi, transport HTTP, environment, readiness DB/schema, logging dan lifecycle tersedia; lihat [fondasi HTTP](./http-foundation.md) serta [bukti T-05](./evidence/t05-http-foundation.md). Tes belum dijalankan sesuai instruksi pemilik; T-03/T-04 masih menunggu bukti perilaku.

## 4. Akses admin dan penyimpanan tarif

### T-06 — Sesi admin dan perlindungan akses

- [ ] Selesai
- **Dependensi:** T-05. **Pemilik:** BE.
- **Hasil:** login, pembacaan sesi, logout, middleware sesi aktif, validasi Origin/header aplikasi, throttle login PostgreSQL, dan pembersihan sesi/counter kedaluwarsa.
- **Selesai bila:** password memakai Argon2id; token sesi acak hanya tersimpan sebagai hash; cookie produksi memenuhi kontrak; batas absolut 8 jam dan idle 30 menit ditegakkan. Origin hilang/null/asing dan sesi tidak sah ditolak, termasuk pada upload dan replay. Throttle bertahan setelah restart dan logout mencabut sesi server.
- **Bukti:** integrasi cookie melalui HTTPS uji, autentikasi gagal dengan pesan umum, kedaluwarsa/revokasi, dan `429` dengan Retry-After. Uji waktu menggunakan clock terkendali; tanpa polling yang mempertahankan idle session.

### T-07 — Provisioning dan pemulihan akses operator

- [ ] Selesai
- **Dependensi:** T-06. **Pemilik:** BE dan operator.
- **Hasil:** skrip TypeScript membuat akun awal, mereset password, menonaktifkan akun, serta panduan penyerahan/pemulihan akses.
- **Selesai bila:** password dimasukkan melalui prompt tersembunyi, tidak melalui argumen/log/seed; reset dan penonaktifan mencabut seluruh sesi secara atomik. Akun uji dapat dipakai untuk pengujian admin. Penerima akun nyata ditetapkan sebelum peluncuran.
- **Bukti:** akun uji berhasil login, sesi lama gagal setelah reset/disable, serta catatan audit tanpa credential. Tidak menambah pendaftaran publik atau layanan email reset.

### T-08 — Transaksi konten, versi, dan receipt

- [ ] Selesai
- **Dependensi:** T-06, T-03, T-04. **Pemilik:** BE.
- **Hasil:** service transaksi konten global, kanonisasi hash niat, constraint receipt, lookup/replay, pembersihan receipt kedaluwarsa, serta penanda pembaruan dan audit.
- **Selesai bila:** setiap operasi berhasil menaikkan versi sekali; perubahan data/audit/receipt committed bersama. Receipt identik diperiksa sebelum konflik versi/keberadaan entitas; kunci sama dengan payload berbeda ditolak. Retensi 24 jam dan lookup yang tidak membuktikan rollback mengikuti API.
- **Bukti:** integrasi service dengan perubahan fixture nyata, dua niat dari versi sama, duplikasi serentak, dan kegagalan transaksi. Konfirmasi melalui endpoint tarif pada T-09 dan pemutusan respons setelah commit pada T-22.

### T-09 — API tarif tiket

- [ ] Selesai
- **Dependensi:** T-08. **Pemilik:** BE.
- **Hasil:** list/detail, tambah, ganti, hapus, dan reorder `/admin/ticket-rates`, termasuk status tampil serta ketentuan.
- **Selesai bila:** tarif menyimpan harga dan ketentuan atomik; harga 0 diterima eksplisit, negatif/pecahan/kosong/string ditolak; item baru default tersembunyi namun boleh tampil jika lengkap. DELETE memakai versi query tanpa body; reorder memerlukan seluruh ID termasuk tersembunyi. Waktu tiket berubah hanya untuk perubahan tarif publik.
- **Bukti:** HTTP dan database setelah simpan/reload, invalid input, hide/show, reorder tidak lengkap, konflik, dan replay create/delete tanpa duplikasi.

## 5. Media dan seluruh konten destinasi

### T-10 — Unggahan dan pustaka media

- [ ] Selesai
- **Dependensi:** T-06, T-03, T-04. **Pemilik:** BE.
- **Hasil:** storage adapter S3, multipart upload, reservasi upload key, normalisasi Sharp, manifest varian, status lookup, list/detail media, dan pagination cursor.
- **Selesai bila:** hanya JPEG/PNG/WebP statis maksimal 5 MiB dan 25 megapiksel diproses; body maksimal 6 MiB; satu pemrosesan gambar aktif per instance. Varian WebP tidak upscale, metadata dibersihkan, object key dibuat server, dan `ready` baru committed setelah verifikasi semua objek. URL publik stabil; key/credential internal tidak masuk DTO.
- **Bukti:** unggahan nyata ke storage uji terisolasi, file rusak/animasi/MIME palsu/terlalu besar, slot penuh, duplicate key dengan byte sama/berbeda, serta cursor tidak sah. Kompatibilitas penyedia target dibuktikan pada T-24.

### T-11 — Rekonsiliasi dan penghapusan media

- [ ] Selesai
- **Dependensi:** T-10, T-08. **Pemilik:** BE dan operator.
- **Hasil:** DELETE media, pemeriksaan rujukan termasuk tersembunyi, helper penguncian lampiran, job rekonsiliasi/penghapusan, lease percobaan, serta kunci operasional bersama backup.
- **Selesai bila:** media dirujuk tidak dapat dihapus; `deleting` tidak dapat dilampirkan; 202 tidak dianggap siap/terhapus tuntas. Pekerja lama tidak menyelesaikan lease yang telah diambil alih; sisa prefix dibersihkan sesuai masa aman 24 jam; job berjalan setiap 10 menit dengan retry storage maksimal tiga kali per eksekusi. Media ready yang belum dipakai tetap ada.
- **Bukti:** integrasi crash pada batas DB/S3, respons unggah hilang, retry reservasi yang sama, dan perlombaan attach/delete. Kunci backup dipakai job sejak awal dan dibuktikan bersama prosedur backup pada T-26.

### T-12 — API profil, jadwal, kontak, SEO, dan Operasional

- [ ] Selesai
- **Dependensi:** T-08, T-11. **Pemilik:** BE.
- **Hasil:** GET/PUT `/admin/destination`, `/admin/seo`, dan `/admin/operations`, termasuk preview media yang relevan dan versi snapshot.
- **Selesai bila:** profil, tujuh hari jadwal, dan seluruh kontak disimpan atomik; ID kontak lama/new, urutan, penghapusan, koordinat berpasangan, serta URL tervalidasi. Jam unknown/closed tidak dibuat-buat; jadwal lintas hari divalidasi. Perubahan SEO hanya mengubah field SEO, dengan fallback yang ditetapkan API.
- **Bukti:** perubahan valid tersimpan setelah GET ulang; satu jadwal/kontak invalid membatalkan seluruh operasi; lampiran media non-ready ditolak; edit profil dan SEO dari versi sama berkonflik sesuai versi global.
- **Operasional:** seluruh field dapat null, budget 0 berbeda dari kosong, dan nilai invalid ditolak. Buktikan GET setelah PUT, konflik/replay/lookup receipt, penolakan sesi tidak sah, versi global naik sekali, serta kedua tanggal publik/tiket tidak berubah. Kontak internal tidak membuat akun/kontak publik/penerima alarm; log/audit tidak memuat nilai form. Tidak membuat endpoint konfigurasi deployment atau secret.

### T-13 — API daya tarik, fasilitas, dan galeri

- [ ] Selesai
- **Dependensi:** T-08, T-11. **Pemilik:** BE.
- **Hasil:** seluruh route list/detail/POST/PUT/DELETE/order untuk attractions, facilities, dan gallery-items.
- **Selesai bila:** field, nullability, kelengkapan publik, status awal, serta urutan mengikuti API; alt melekat pada penggunaan gambar. Hapus item tidak menghapus berkas. Seluruh pembacaan admin memuat versi dari snapshot yang sama dan seluruh mutasi memakai receipt.
- **Bukti:** siklus tambah/edit/hide/show/reorder/hapus tiap koleksi, validasi media/alt, urutan lengkap dengan item tersembunyi, dan rujukan media yang tetap terlindungi.

### T-14 — Snapshot publik yang konsisten

- [ ] Selesai
- **Dependensi:** T-09, T-12, T-13. **Pemilik:** BE.
- **Hasil:** `GET /api/v1/public/site` dari satu transaksi read-only REPEATABLE READ, mapper publik, schema hasil, dan no-store.
- **Selesai bila:** seluruh konten tampil dan metadata berasal dari snapshot yang sama; item tersembunyi, akun, sesi, versi admin, anggaran/kontak/catatan Operasional, dan rincian storage privat tidak terkirim. Tarif kosong adalah respons normal; gangguan DB/API atau integritas tidak menjadi daftar kosong/harga gratis.
- **Bukti:** baca ketika transaksi penulis berjalan, inspeksi seluruh DTO, data tanpa tarif/jadwal/foto, serta gangguan dependency. Penanda tanggal publik/tiket mengikuti perubahan proyeksi yang relevan.

## 6. Tampilan dan alur pengguna

### T-15 — Fondasi visual dan komponen

- [ ] Selesai
- **Dependensi:** T-01, T-03. **Pemilik:** FE.
- **Hasil:** token Tailwind dari desain, layout mobile/desktop, tipografi, button/link, form field, status, dialog, serta komponen gambar dengan varian/dimensi.
- **Selesai bila:** gaya hijau/krem dan aksen biru/putih konsisten, fokus/kontras jelas, keyboard bekerja, dan transisi 150–250 ms mengikuti reduced motion. Lebar perantara fluid; tidak menambah mode tablet khusus. Fixture foto diberi label dan tidak diperlakukan sebagai foto asli destinasi.
- **Bukti:** tinjauan komponen pada viewport desain dan keadaan normal/hover/fokus/error/disabled. Halaman penuh diverifikasi pada T-23.

### T-16 — Login dan kerangka admin

- [ ] Selesai
- **Dependensi:** T-06, T-07, T-15. **Pemilik:** FE.
- **Hasil:** `/admin/login`, shell admin, navigasi semua kelompok konten, tautan lihat website, logout, dan klien API browser/server sesuai batas kepercayaan.
- **Selesai bila:** cookie tetap HttpOnly, halaman privat mengambil data melalui sesi yang diperiksa server, token tidak masuk page data, dan navigasi admin tidak menampilkan metrik transaksi. Login gagal/429/sesi berakhir/logout tampil sesuai kontrak tanpa membocorkan keberadaan akun.
- **Bukti:** browser melalui HTTPS uji, kunjungan langsung route privat, reload, logout dan request ulang, serta inspeksi HTML/bundle/page data terhadap secret.

### T-17 — Editor tarif dan state penyimpanan

- [ ] Selesai
- **Dependensi:** T-09, T-16. **Pemilik:** FE dengan BE.
- **Hasil:** halaman list/tambah/edit tarif, pengurutan, hide/show, dialog hapus, serta pola state formulir dan rekonsiliasi yang digunakan fitur admin lain.
- **Selesai bila:** pengelola dapat menyimpan dan memuat ulang tarif; field invalid tidak menghapus isian lain; sukses menunggu server. Konflik mempertahankan formulir dan versi dasarnya. Timeout menyimpan descriptor niat dalam memori tab, memeriksa receipt, dan memakai key/payload lama saat retry; replay diikuti pembacaan terbaru. Akun berubah atau retensi habis memerlukan rekonsiliasi.
- **Bukti:** alur browser valid/invalid/konflik/sesi habis/hasil belum diketahui, termasuk dialog dengan nama item dan urutan lengkap saat list difilter.

### T-18 — Pengaturan, editor profil, metadata, dan Operasional

- [ ] Selesai
- **Dependensi:** T-12, T-14, T-17, T-19. **Pemilik:** FE.
- **Hasil:** `/admin/pengaturan` dengan daftar kelengkapan dan pintasan editor, `/admin/pengaturan/operasional`, formulir destinasi/jadwal/kontak dan SEO, pemilih/preview gambar bersama dari T-19, serta state simpan yang konsisten.
- **Selesai bila:** tujuh jadwal dapat diisi dengan unknown/open/closed dan penjelasan tutup esok hari; koordinat 0 sah; kontak baru/lama/hapus/urut mengikuti kontrak. Null untuk metadata opsional menggunakan fallback; formulir kotor tidak tertimpa respons latar. Hero, logo, dan gambar SEO dapat dipilih/diganti melalui pustaka media.
- **Bukti:** simpan/reload nilai profil dan SEO, penggantian hero/SEO, validasi field terarah, fallback, serta operasi atomik ketika satu jadwal/kontak ditolak. UI teks boleh dikerjakan lebih awal; penyelesaian penuh menunggu pemilih media T-19.
- **Pengisian bertahap:** setiap bagian dapat disimpan tanpa melengkapi bagian lain. Field bisnis kosong tidak memblokir navigasi; kewajiban/validasi field mengikuti API. Operasional berlabel Hanya terlihat oleh admin, mendukung null/0, konflik, dan pemulihan timeout seperti form lain. Pusat Pengaturan memakai editor yang sama dengan menu utama. Checklist dihitung dari snapshot publik dan Operasional pada saat buka/periksa ulang; gangguan baca menjadi Tidak dapat diperiksa. Buktikan status setelah simpan dan login ulang, tanpa autosave atau checklist selesai palsu.

### T-19 — Pustaka media dan editor koleksi

- [ ] Selesai
- **Dependensi:** T-10, T-11, T-13, T-17. **Pemilik:** FE.
- **Hasil:** pemilih/pustaka media bersama, upload dengan status, penggunaan dan penghapusan media, serta editor daya tarik, fasilitas, dan galeri. Pemilih menyediakan komponen yang digunakan editor profil/SEO pada T-18.
- **Selesai bila:** media hanya bisa dipilih setelah ready; 202/timeout/error tidak mengganti gambar lama. Lookup upload key memulihkan hasil; delete dirujuk menampilkan pemakainya; status deleting tetap terlihat. Setiap koleksi mendukung field validasi, alt, hide/show, reorder, hapus, dan rekonsiliasi simpan.
- **Bukti:** browser untuk seluruh koleksi, penggantian foto daya tarik/galeri, pagination media, file invalid, kehilangan respons, dan penolakan penghapusan media yang dipakai konten tersembunyi.

### T-20 — Landing page publik

- [ ] Selesai
- **Dependensi:** T-14, T-15. **Pemilik:** FE.
- **Hasil:** hero, navigasi anchor, daya tarik, tiket, fasilitas, galeri, kunjungan, dan kontak dari satu loader server SvelteKit.
- **Selesai bila:** nama/lokasi/pengantar dan tombol Lihat Tiket jelas; harga beserta satuan/ketentuan/tanggal pembaruan terbaca tanpa login/JavaScript. Bagian opsional kosong disembunyikan, tiket kosong tetap memberi pesan, peta/kontak hanya tampil jika valid. Kegagalan snapshot menjadi halaman 503; gambar gagal tidak meruntuhkan layout atau mengganti fakta destinasi.
- **Bukti:** HTTP HTML, browser dengan JavaScript nonaktif, navigasi mobile/desktop, snapshot tanpa konten opsional, kegagalan gambar/API, dan kesesuaian data saat hydration.

### T-21 — SEO dan kebijakan pengiriman

- [ ] Selesai
- **Dependensi:** T-20, T-12. **Pemilik:** FE dengan BE.
- **Hasil:** title/description/OG dinamis, canonical root, JSON-LD WebSite/WebPage/TouristAttraction, sitemap, robots, serta noindex login/admin.
- **Selesai bila:** metadata menggunakan snapshot yang sama dengan HTML; canonical berasal dari SITE_ORIGIN; sitemap hanya memuat root dan lastmod yang benar. JSON-LD aman diserialisasi dan berisi fakta terlihat tanpa rating/Offer buatan. HTML/API/data loader tidak di-cache; media/build immutable mengikuti desain.
- **Bukti:** HTML dan header sebelum JavaScript, validasi structured data yang relevan, parameter URL tidak menggandakan canonical, serta perubahan konten yang memperbarui metadata. Perilaku proxy target dibuktikan kembali pada T-24 dan T-28.

## 7. Pembuktian kandidat rilis

### T-22 — Integrasi kegagalan dan konkurensi

- [ ] Selesai
- **Dependensi:** T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14. **Pemilik:** BE.
- **Hasil:** suite integrasi PostgreSQL/S3 dan mekanisme uji kegagalan yang melengkapi test fitur, tanpa menduplikasi seluruh test yang telah memadai.
- **Selesai bila:** dua admin tidak saling menimpa; request identik serentak tidak menggandakan data/audit; respons diputus setelah commit dapat direkonsiliasi; receipt lama tidak dianggap state terbaru. Crash media, lease usang, partial upload, dan attach/delete menjaga konsistensi. Gangguan DB/storage/sesi ditangani sesuai kontrak.
- **Bukti:** hasil sebelum/sesudah data, status HTTP, jumlah audit/receipt, serta manifest objek pada lingkungan terisolasi. Uji mengendalikan batas commit/lease; bukan bergantung sleep atau mock transaksi.

### T-23 — Penerimaan browser, SSR, dan aksesibilitas

- [ ] Selesai
- **Dependensi:** T-02, T-17, T-18, T-19, T-20, T-21, T-22. **Pemilik:** FE dengan BE.
- **Hasil:** suite Playwright dan pemeriksaan manual yang melaksanakan AC-01 sampai AC-12 pada build produksi Bun, serta workflow CI lengkap.
- **Selesai bila:** seluruh skenario bagian 10 lulus, state simpan/error/fokus dapat dipakai dengan keyboard, reduced motion bekerja, dan tidak ada horizontal overflow pada mobile 360/390/430 px serta desktop 1280/1440/1920 px. Lebar 1024 px diperiksa sebagai transisi layout. Foto/metadata/error turut diperiksa; tidak hanya screenshot keadaan normal.
- **Bukti:** CI format/lint/typecheck/unit/integrasi/build/E2E sesuai konvensi, hasil viewport dan pemeriksaan manual. Lingkungan uji tidak tersedia harus dilaporkan sebagai gagal/tertahan, bukan auto-skip sukses.
- **Pengaturan:** uji kondisi awal tanpa data bisnis tambahan, pengisian satu bagian lalu login ulang, checklist baca gagal, dan anggaran null/0/invalid. Gunakan penanda uji privat untuk membuktikan budget/kontak/catatan tidak ada pada snapshot, HTML/hydration publik, metadata, atau log form; perubahan Operasional tidak mengubah timestamp publik/tiket maupun akun/kontak publik.

### T-24 — Staging, penyedia S3, dan konfigurasi rilis

- [ ] Selesai
- **Dependensi:** T-22, T-23. **Kebutuhan eksternal:** E-02, E-03. **Pemilik:** operator dengan developer.
- **Hasil:** lingkungan staging dengan HTTPS/reverse proxy satu origin, web/API Bun, PostgreSQL privat, bucket/host aset terpisah, job terjadwal, dan konfigurasi rilis terversi.
- **Selesai bila:** port privat/health tidak terbuka publik; hanya API/job mendapat hak storage dan DB sesuai perannya; browser menerima URL gambar stabil. PUT/GET/HEAD/DELETE dan pembacaan host aset terbukti pada penyedia terpilih. Proxy memelihara Origin tepercaya, limit body, cookie, no-store, dan deadline. CSP/header keamanan tidak mematahkan hydration/gambar.
- **Bukti:** deployment staging dari lockfile/image yang dicatat, smoke HTTPS, inspeksi header/log/bundle, percobaan akses origin storage, serta siklus upload/hapus melalui penyedia target. Penjadwal media/receipt/sesi dan deteksi kegagalan job dapat diamati.
- **Konfigurasi mandiri:** sediakan template environment tanpa secret dan panduan panel/deployment sesuai penyedia terpilih. Buktikan konfigurasi runtime domain/layanan dapat diterapkan pada build yang sama, tanpa mengedit kode. Panduan mencakup DNS/HTTPS dan login ulang saat domain berubah, pemindahan/verifikasi DB atau objek saat provider berubah, kelangsungan URL gambar lama, dan pemulihan konfigurasi sebelumnya. Pergantian provider nyata hanya dilakukan jika dibutuhkan; demonstrasikan penerapan konfigurasi serta pemeriksaan data pada lingkungan uji.

### T-25 — Performa dan kapasitas awal

- [ ] Selesai
- **Dependensi:** T-24. **Pemilik:** developer dan operator.
- **Hasil:** pengukuran build produksi dengan konten realistis, anggaran gambar, dan penentuan awal sumber daya host/pool.
- **Selesai bila:** LCP/CLS serta respons interaksi diukur dan hambatan nyata diperbaiki; target lapangan tetap LCP ≤ 2,5 detik, INP ≤ 200 ms, CLS ≤ 0,1 pada p75 mobile/desktop. Jalankan profil awal 10 permintaan halaman/detik selama 60 detik bersamaan satu upload dan satu perubahan admin; catat latency, error, CPU, memori, serta koneksi DB. Angka ini profil uji, bukan ramalan trafik/SLA.
- **Bukti:** perangkat/jaringan/versi/dataset dan hasil pengukuran; fixture awal 20 daya tarik, 10 tarif, dan 60 foto bukan batas bisnis. Hasil laboratorium tidak disebut sebagai kelulusan INP/data lapangan. Kekurangan ditindaklanjuti sebelum kandidat rilis dinyatakan siap.

### T-26 — Backup, restore, dan panduan gangguan

- [ ] Selesai
- **Dependensi:** T-24, T-11. **Kebutuhan eksternal:** E-03. **Pemilik:** operator dengan BE.
- **Hasil:** skrip/runbook backup PostgreSQL dan objek dari snapshot yang sama, restore terisolasi, koordinasi penghapusan, peringatan kegagalan, serta panduan rollback aplikasi.
- **Selesai bila:** backup harian hanya ditandai lengkap setelah dump dan manifest/objek diverifikasi; retensi awal DB 30 hari dan objek minimal 35 hari diterapkan. Restore memeriksa referensi, isi tarif, akun, pencabutan sesi yang dipulihkan, dan upload yang tertinggal. Sasaran RPO 24 jam/RTO 4 jam diuji; kegagalan dicatat dan diperbaiki sebelum kesiapan pemulihan diklaim.
- **Bukti:** latihan restore dengan waktu mulai/akhir, checksum/manifes, hasil rujukan gambar, serta uji backup bersamaan penghapusan. Alarm backup gagal/terlambat dan media job macet dapat diterima operator; rollback aplikasi diuji terhadap schema kompatibel.

### T-27 — Konten nyata dan latihan pengelola

- [ ] Selesai
- **Dependensi:** T-18, T-19, T-20, T-21, T-24. **Kebutuhan eksternal:** E-01, E-03. **Pemilik:** pengelola dengan FE/operator.
- **Hasil:** konten destinasi terverifikasi, aset asli dengan alt, akun penerima akses, dan panduan singkat penggunaan admin.
- **Selesai bila:** nama/pengantar, minimal satu daya tarik, tarif dan ketentuan, jadwal, alamat, serta minimal satu kanal kontak sudah diperiksa pengelola. Foto yang dipublikasikan mewakili destinasi; fixture tidak menjadi informasi produksi. Pengelola dapat menyimpan tarif, mengganti foto, menyembunyikan item, dan memeriksa hasil publik.
- **Bukti:** daftar pemeriksaan konten dan hasil latihan admin pada lingkungan aman. Jika foto/volume konten akhir mengubah beban halaman, ulangi bagian pengukuran T-25 yang terdampak sebelum T-28.
- **Pengisian oleh pengguna:** pengelola melengkapi data/foto melalui editor yang tersedia dan mencatat penanggung jawab destinasi/operator teknis beserta kanal kontak privat pada Operasional. Nama penerima akun dan penerima alarm tetap diprovisikan/dikonfigurasi terpisah. Anggaran boleh dilengkapi nanti; checklist Sudah diisi tidak menggantikan verifikasi fakta atau latihan ini.

## 8. Peluncuran dan pengoperasian

### T-28 — Rilis produksi dan pemeriksaan akhir

- [ ] Selesai
- **Dependensi:** T-22, T-23, T-24, T-25, T-26, T-27. **Kebutuhan eksternal:** E-02, E-03. **Pemilik:** operator dengan developer/pengelola.
- **Hasil:** aplikasi produksi dari kandidat yang telah diuji, konfigurasi domain/HTTPS, konten nyata, backup, serta catatan rilis dan langkah pemulihan.
- **Selesai bila:** migrasi kompatibel berjalan sekali sebelum trafik diarahkan; versi image/Bun/schema dicatat; rollback/pemulihan tersedia. Melalui domain produksi, periksa halaman publik/SSR/metadata/gambar, login/logout, serta satu perubahan konten terkontrol yang benar. GET baru melalui proxy mencerminkan commit paling lambat 60 detik, termasuk API, HTML, data loader, dan metadata yang relevan.
- **Bukti:** checklist rilis, timestamp commit dan pembacaan, health/header produksi, serta konfirmasi tidak ada fixture/secret. Jangan mengubah harga nyata untuk smoke test; gunakan perubahan konten yang memang diperlukan dan diverifikasi pengelola. Kegagalan kritis ditangani melalui prosedur pemulihan sebelum rilis dinyatakan berhasil.

### T-29 — Pengamatan awal dan serah terima

- [ ] Selesai
- **Dependensi:** T-28. **Pemilik:** operator dan pengelola dengan developer.
- **Hasil:** laporan operasional awal, penerima peringatan, jadwal pemeliharaan, serta jalur pelaporan masalah yang sudah disepakati.
- **Selesai bila:** ada backup lengkap dari lingkungan produksi, jadwal job dan kegagalan dapat ditelusuri, serta pengelola memahami pembaruan konten dan pemulihan akses. Catat keadaan performa lapangan dari data yang tersedia; jika belum memadai, tandai belum terukur dan tetapkan pemilik/jadwal peninjauan, tanpa menyatakan target p75 sudah lulus.
- **Bukti:** laporan awal dengan waktu observasi, status backup/job/error, dokumen akses operasional tanpa password, dan tindak lanjut bernama. Pemeliharaan berulang diteruskan sebagai kegiatan operasional setelah serah terima ini.
- **Panduan pengaturan:** serahkan cara mengubah konten, anggaran, kontak internal, serta konfigurasi layanan; jelaskan kapan perlu penerapan/restart atau migrasi data. Simpan jalur kontak operator dan panduan pemulihan juga pada lokasi privat yang dapat diakses saat aplikasi down. Mengubah kontak Operasional tidak otomatis mengubah tujuan alarm; panduan memuat langkah pembaruan keduanya bila diperlukan.

## 9. Kebutuhan eksternal yang perlu dipenuhi

Pengumpulan informasi berikut dapat dimulai sejak awal pengembangan. Daftar ini tidak menuntut pengisian credential di dokumen atau percakapan.

E-01 diisi pengguna melalui admin; catatan anggaran dan penanggung jawab melalui Operasional. E-02 serta akses layanan E-03 melalui panel penyedia/konfigurasi deployment. Pemilihan dan pengisian nilai dapat ditunda sampai tugas yang membutuhkannya; pembangunan form dan pengujian lokal memakai data awal/fixture terisolasi.

| ID | Informasi/keputusan | Pemilik | Diperlukan untuk |
| --- | --- | --- | --- |
| E-01 | Daya tarik, fasilitas, harga/ketentuan, jam, alamat/peta, kontak, logo bila ada, dan foto asli beserta keterangan | Pengelola | T-27; sebelumnya gunakan fixture berlabel dan kondisi kosong yang benar |
| E-02 | Domain, hosting, region DB/storage, penyedia S3-compatible, kemampuan CDN/host aset, dan anggaran | Pemilik produk dan operator | T-24 dan T-28; pengembangan lokal tetap dapat berjalan |
| E-03 | Penerima akun admin, operator deployment/backup, akses lingkungan melalui mekanisme secret, dan penerima peringatan | Pengelola dan operator | Penyerahan T-07, staging/pemulihan T-24–T-26, dan peluncuran T-27–T-29 |

## 10. Skenario penerimaan dan bukti

Seluruh hasil pada tabel ini masih **belum diuji**. ID AC berasal dari `requirement.md`; tugas pengujian mengisi hasil dan tautan bukti ketika aplikasi tersedia.

| Skenario | Tugas terkait | Hasil yang harus dibuktikan |
| --- | --- | --- |
| AC-01 | T-20, T-23 | Wisatawan pada mobile/desktop menemukan daya tarik, tarif/ketentuan, kunjungan, dan kontak tanpa login |
| AC-02 | T-14, T-20, T-21, T-23 | HTML tanpa JavaScript sudah berisi konten, metadata, dan JSON-LD yang konsisten |
| AC-03 | T-09, T-17, T-23, T-28 | Harga/ketentuan tersimpan setelah reload dan terbaca publik dalam batas 60 detik, dengan timestamp tiket yang benar |
| AC-04 | T-03, T-09, T-17, T-23 | Harga negatif/kosong ditolak pada field terkait, tarif lama dan isian lain tetap tersedia |
| AC-05 | T-13, T-14, T-19, T-23 | Item disembunyikan hilang dari HTML/API publik dan tetap dapat dikelola admin |
| AC-06 | T-10, T-11, T-19, T-23 | Gambar invalid/unggahan gagal tidak menggantikan gambar lama; hasil 202 belum dipakai |
| AC-07 | T-06, T-07, T-16, T-22, T-23 | Tanpa sesi atau setelah logout/reset, data privat dan perubahan ditolak oleh backend |
| AC-08 | T-14, T-20, T-23 | Tarif kosong berbeda dari gangguan layanan dan tidak menghasilkan harga rekaan/gratis |
| AC-09 | T-15, T-17, T-18, T-19, T-23 | Keyboard, label, fokus, error, dan reduced motion bekerja pada seluruh alur utama |
| AC-10 | T-16, T-21, T-23, T-28 | Sitemap hanya root canonical publik; admin/login noindex dan data privat tetap memerlukan sesi |
| AC-11 | T-04, T-12, T-14, T-18, T-23 | Pengisian per bagian dari data awal sah, tersimpan setelah login ulang; checklist mengikuti data tersimpan dan membedakan kosong dari gagal baca |
| AC-12 | T-03, T-08, T-12, T-14, T-18, T-23 | Operasional null/0/invalid, konflik/replay, serta isolasi data privat dan timestamp publik/tiket dibuktikan |

Skenario tambahan yang diwajibkan arsitektur/API: konflik dua admin, replay setelah respons hilang, retensi receipt habis, media worker usang, attach/delete, dan backup bersama penghapusan. Bukti utamanya ada pada T-08, T-11, T-22, dan T-26; kelulusan dua belas AC saja tidak menggantikan bukti tersebut.

## 11. Pemetaan seluruh kebutuhan

| Kebutuhan | Tugas implementasi dan verifikasi utama |
| --- | --- |
| PUB-01 | T-15, T-20, T-23 |
| PUB-02 | T-13, T-14, T-19, T-20, T-23 |
| PUB-03 | T-09, T-14, T-17, T-20, T-23, T-28 |
| PUB-04 | T-12, T-13, T-18, T-20, T-23 |
| PUB-05 | T-10, T-11, T-13, T-19, T-20, T-23 |
| PUB-06 | T-12, T-18, T-20, T-23, T-27 |
| ADM-01 | T-06, T-07, T-16, T-22, T-23 |
| ADM-02 | T-16, T-23 |
| ADM-03 | T-12, T-18, T-19, T-23 |
| ADM-04 | T-13, T-19, T-23 |
| ADM-05 | T-08, T-09, T-17, T-22, T-23 |
| ADM-06 | T-10, T-11, T-19, T-22, T-23 |
| ADM-07 | T-12, T-18, T-19, T-21, T-23 |
| ADM-08 | T-08, T-15, T-17, T-18, T-19, T-22, T-23 |
| ADM-09 | T-03, T-04, T-12, T-14, T-18, T-23, T-27 |
| ADM-10 | T-03, T-04, T-08, T-12, T-14, T-18, T-23, T-27, T-29 |
| SEO-01 | T-01, T-14, T-20, T-23 |
| SEO-02 | T-12, T-21, T-23, T-28 |
| SEO-03 | T-16, T-21, T-23, T-28 |
| SEO-04 | T-14, T-21, T-23 |
| NFR-01 | T-15, T-20, T-23 |
| NFR-02 | T-15, T-17, T-18, T-19, T-23 |
| NFR-03 | T-15, T-20, T-23 |
| NFR-04 | T-10, T-20, T-25, T-27, T-29 |
| NFR-05 | T-03, T-05, T-06, T-07, T-10, T-22, T-23 |
| NFR-06 | T-02, T-05, T-06, T-07, T-16, T-24 |
| NFR-07 | T-08, T-09, T-12, T-13, T-14, T-17, T-22, T-28 |
| NFR-08 | T-05, T-11, T-24, T-26, T-29 |

## 12. Batas penyelesaian

**Dokumentasi tahap 1–7 tersusun** ketika kelima file Markdown tersedia, saling merujuk, dan daftar tugas mencakup kebutuhan serta dependensi. Itu adalah hasil tahap ini.

[settings.md](./settings.md) melengkapi lima dokumen awal dengan rancangan pengisian mandiri. Penyelesaian aplikasi mengikuti checkbox berbukti di atas; T-01 telah selesai dan tugas lainnya mengikuti dependensi masing-masing.

**Kandidat siap rilis** memerlukan T-01 sampai T-27 selesai dengan bukti yang sesuai. Temuan kritis pada akses, harga, data, media, atau pemulihan tidak boleh ditutup hanya dengan catatan. Data destinasi dan konfigurasi nyata sudah tersedia, pengelola sudah mencoba admin, dan batas hasil pengukuran dinyatakan dengan benar.

**Peluncuran selesai** memerlukan T-28; **serah terima awal selesai** memerlukan T-29. Pemantauan lapangan dan pemeliharaan berulang tetap dilanjutkan oleh pemilik operasional. Kesiapan dokumen tidak berarti website sudah dibangun atau dipublikasikan.

Setelah T-01, implementasi dilanjutkan ke T-02/T-03 dan T-04 sesuai dependensi. Bukti pekerjaan dicatat pada tugas terkait; deployment produksi tetap mengikuti T-28.
