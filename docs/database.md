# PostgreSQL development/test — T-04

Implementasi tersedia, tetapi startup database, penerapan migrasi, fixture, serta seluruh tes database **belum dijalankan**. Pemilik meminta agar tes belum dijalankan. Perintah pengujian di bawah hanya boleh dijalankan setelah persetujuan; environment flag bukan pengganti persetujuan tersebut. T-03 juga masih menunggu unit test, sehingga dependensi penyelesaian T-04 belum terbukti.

## Lingkungan lokal

`compose.yaml` menyediakan dua cluster PostgreSQL 18 dengan port dan volume berbeda:

| Lingkungan | Service/profile | Host port | Database |
| --- | --- | --- | --- |
| Development | `postgres-development` / `development` | `127.0.0.1:5433` | `umbul_nogo_development` |
| Test | `postgres-test` / `test` | `127.0.0.1:5434` | `umbul_nogo_test` |

Salin `.env.database.example` ke `.env.database.local`, lalu isi enam password lokal yang berbeda dan URL yang sesuai. Password pada URI harus di-URL-encode. Semua field Compose perlu diisi karena interpolasi dilakukan sebelum pemilihan profil. File lokal diabaikan Git. Jangan memakai credential produksi atau meneruskan file operator ini ke aplikasi web/API saat deployment.

Untuk menyalakan development ketika diperlukan:

```sh
docker compose --env-file .env.database.local --profile development up -d postgres-development
```

Init SQL dijalankan image PostgreSQL hanya pada volume kosong. Mengubah environment password tidak mengubah role pada volume lama; rotasi dilakukan operator melalui PostgreSQL. Mount memakai `/var/lib/postgresql`, sesuai [layout image PostgreSQL 18](https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/). Image lokal memakai tag mayor `postgres:18`; versi minor/digest aktual harus dicatat saat pengujian dan dipin saat provisioning rilis T-24. Tidak ada healthcheck/smoke test otomatis dalam Compose ini.

## Role dan pool

`infrastructure/postgres/init.sql` hanya untuk cluster lokal baru. Superuser `postgres` digunakan oleh init image; dua role aplikasi dibuat tanpa superuser, CREATEDB, CREATEROLE, atau REPLICATION:

- `umbul_migrator` menjadi pemilik database/schema dan tabel; hanya proses migrasi/operator menerima URL ini.
- `umbul_runtime` bukan pemilik, tidak mewarisi role migrasi, hanya CONNECT dan USAGE schema. Migrasi memberi izin tabel secara eksplisit: DML konten/media/sesi/receipt/throttle, SELECT/UPDATE singleton dan jadwal, SELECT akun, serta SELECT/INSERT audit. Tidak ada CREATE, TEMP, TRUNCATE, hak journal, atau pengelolaan akun melalui role runtime.

Pemisahan privileges mengikuti [PostgreSQL 18 privileges](https://www.postgresql.org/docs/18/ddl-priv.html). Untuk lingkungan terkelola, operator membuat kedua role dengan nama yang sama, database/schema dimiliki `umbul_migrator`, mencabut CONNECT/TEMP dari PUBLIC dan CREATE schema publik, lalu memberi CONNECT kepada runtime. Jangan menjalankan init lokal terhadap database bersama. Tabel baru pada migrasi berikutnya memerlukan GRANT eksplisit; tidak ada default privileges yang membocorkan seluruh tabel baru.

`createDatabase()` adalah factory tanpa koneksi saat modul diimpor. Pool runtime maksimal 10 koneksi, pool migrasi 1, idle timeout 20 detik, connect timeout 5 detik, dan close deadline 5 detik. Tidak ada log SQL/URL/parameter. Timestamp dipetakan ke string dan versi bigint ke angka dengan CHECK safe integer. Factory belum disambungkan ke server bootstrap; lifecycle/env/readiness HTTP masuk T-05. Parameter driver mengacu [Bun SQL](https://bun.com/docs/runtime/sql), dengan antarmuka paket terkunci diperiksa lokal.

## Migrasi

Dependensi backend dipin `drizzle-orm@0.45.2` dan `drizzle-kit@0.31.10`. Schema sumber berada di `apps/api/src/db/schema/index.ts`. Config generator tidak membutuhkan URL database.

```sh
bun run db:generate --name=nama_perubahan
bun --env-file=.env.database.local run db:migrate
```

Tinjau SQL dan snapshot sebelum menerapkan migrasi. Alur generate/custom migration merujuk [Drizzle Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate). Jangan memakai `drizzle-kit push` sebagai pengganti migrasi terversi.

`0000_initial_schema.sql` membuat 15 tabel, constraints, indeks dan FK. `0001_bootstrap_and_permissions.sql` mengisi tiga singleton, tujuh hari unknown, dan GRANT. Tidak mengisi akun, tarif, foto, kontak, atau anggaran. `ON CONFLICT DO NOTHING` mencegah bootstrap menimpa nilai; journal mencegah penerapan ulang pada startup/migrasi berikutnya. Runtime tidak menjalankan migrasi atau bootstrap.

Runner membaca SQL/hash melalui `readMigrationFiles` Drizzle dan memperoleh advisory transaction lock `(74104, 1)` sebelum membaca journal. Riwayat hash/urutan harus cocok dengan checkout; migrasi yang sudah diterapkan tidak boleh diedit, dihilangkan, atau lebih baru dari checkout. Pemeriksaan role, DDL, bootstrap, dan journal berada dalam transaksi yang sama; kegagalan membatalkan transaksi. Tenggat menunggu lock 10 detik dan per statement 60 detik. Migrasi serentak menunggu atau gagal, bukan menerapkan SQL tanpa koordinasi. Runner menerapkan statement dan journal langsung melalui transaksi Drizzle yang sama. Stock migrator Bun SQL memulai transaksi session sendiri; runner tidak menumpuknya di atas transaksi lock. Implementasi driver `0.45.2` diperiksa lokal, tetapi perilaku runner **belum dibuktikan pada PostgreSQL nyata**.

Migrasi awal bersifat penambahan; aplikasi bootstrap sebelumnya tetap kompatibel karena belum membaca DB. Setelah data bisnis ada, jangan menghapus schema atau mengedit migrasi yang sudah diterapkan untuk rollback. Pulihkan aplikasi sebelumnya bila kompatibel; pemulihan database memerlukan backup/restore terencana (T-26). Tidak tersedia skrip down/reset otomatis.

## Fixture lokal

Fixture hanya menambah satu tarif, daya tarik, fasilitas, dan kontak berlabel `data uji`, semuanya tersembunyi. Tidak ada akun/kredensial atau media palsu. Fixture meningkatkan versi sekali tanpa mengubah tanggal publik/tiket. Perintah hanya menerima host loopback, port development 5433, database `umbul_nogo_development`, role migrator, tanpa parameter URI tambahan, dan memeriksa identitas database aktual. `NODE_ENV=production` ditolak.

Set `ALLOW_DEVELOPMENT_FIXTURE=umbul_nogo_development` di file operator hanya ketika ingin mengisi fixture, lalu:

```sh
bun --env-file=.env.database.local run db:fixture
```

Database harus sudah dimigrasi, versi 0, dan koleksi kosong. Fixture ulang/target yang sudah diedit ditolak; tidak ada pembersihan/penimpaan otomatis. Semua penulisan fixture berada dalam satu transaksi. Jangan menjalankannya untuk mengisi konten nyata.

## Pengujian setelah disetujui

Suite terpisah `apps/api/tests/database.integration.test.ts` memerlukan cluster test kosong. Root `test:unit` tetap hanya menemukan unit test; `test:db` dipanggil eksplisit dan belum ditambahkan ke CI. Workflow CI tetap manual.

Set `ALLOW_DATABASE_TESTS=umbul_nogo_test` hanya setelah persetujuan, lalu:

```sh
docker compose --env-file .env.database.local --profile test up -d postgres-test
bun --env-file=.env.database.local run test:db
```

Suite memvalidasi kedua URL, port 5434, host loopback, database test, role terpisah, serta identitas koneksi migrator sebelum menulis. Bila tabel `public`/`drizzle` sudah ada, suite gagal tanpa DROP/TRUNCATE; sediakan volume test baru yang kosong melalui tindakan operator tersendiri. Jangan menjalankan `db:migrate` lebih dulu pada test karena suite sendiri perlu membuktikan migrasi dari kosong. Dependency/config hilang menghasilkan gagal, bukan skip.

Skenario tertulis: bootstrap lengkap, rerun migrasi tanpa overwrite, commit terlihat lintas koneksi, rollback atomik, privilege/DDL runtime, singleton/nominal/koordinat/versi, waktu lokal lintas hari, FK RESTRICT media, dan fixture tersembunyi. Perubahan uji umumnya di-rollback; satu baris ber-ID fixture dari uji commit dihapus melalui target yang telah diverifikasi. Schema dan bootstrap dipertahankan sesudah suite; tidak ada cleanup database otomatis. Hasilnya masih **belum diuji**.

DB CHECK menguatkan struktur, rentang, pasangan field, durasi per baris, dan relasi. Normalisasi URL/email lengkap, tujuh hari sebagai input utuh, benturan antarday, media ready/reference locking, serta bentuk JSON receipt/manifest tetap divalidasi kontrak/service sesuai tugas terkait; FK saja tidak membuktikan media boleh dipublikasikan.
