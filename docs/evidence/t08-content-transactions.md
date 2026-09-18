# Bukti implementasi T-08 — transaksi konten dan receipt

Tanggal: 18 September 2026. Branch: `development`.

## Implementasi tersedia

- Service mutasi atomik: validasi schema dan hash niat, lock akun/sesi/global, receipt sebelum pemeriksaan versi, perbandingan proyeksi, kenaikan versi, audit metadata, serta receipt sukses tervalidasi.
- Pemeriksaan sesi di dalam transaksi berbagi advisory lock T-06/T-07; replay juga memerlukan sesi aktif. Callback tidak berjalan pada replay.
- Lookup HTTP privat berdasarkan akun/method/path/key, pemetaan error, cache privat, serta helper respons replay/Location untuk fitur berikutnya.
- Retensi 24 jam dari finalisasi receipt menjelang commit dan cleanup batch maksimal 1000. Batas timestamp commit dijelaskan pada [panduan transaksi](../content-transactions.md).
- Constraint unik receipt yang sudah tersedia pada T-04 dipakai tanpa migrasi baru.

## Pemeriksaan yang dijalankan

- `bun run --cwd apps/api check`: TypeScript API lulus.
- ESLint pada kode content, helper sesi transaksi, server/error mapper, job, dan file tes terkait: lulus.
- Prettier pada sumber dan manifest yang berubah: diterapkan.

Ini hanya pemeriksaan statis, bukan bukti keberhasilan transaksi atau HTTP.

## Skenario yang ditulis, belum dijalankan

| Klaim | Oracle yang disiapkan |
| --- | --- |
| Niat sama setelah normalisasi/default | Hash sama untuk variasi key/whitespace; berbeda untuk urutan array, null/0, dan versi |
| Satu efek pada retry | Dua mutasi serentak menghasilkan satu receipt, satu versi, dan metadata replay |
| Versi global dan konflik | Dua akun menyimpan dari versi sama; satu berhasil, satu konflik, versi naik sekali |
| Replay sebelum keberadaan entitas | Create/delete tarif fixture dan replay setelah item dihapus; Location tetap |
| Penanda publik/tiket | No-op/Operasional/tarif tersembunyi tidak mengubah tanggal; create/delete tarif publik mengubahnya |
| Rollback atomik | Kegagalan callback, DTO invalid, kegagalan insert audit, abort, dan expiry sesi membatalkan data/state/receipt |
| Batas akses | Akun lain tidak membaca receipt; akun nonaktif/sesi dicabut ditolak; expiry diperiksa kembali selama mutasi |
| Kontensi | Lock singleton yang ditahan memicu 409 dengan Retry-After tanpa receipt sukses |
| Retensi | Lookup tepat batas expiry menghasilkan 404, replay tidak memperpanjang expiry, cleanup menghapus expired dan mempertahankan receipt aktif |
| HTTP dan data privat | Katalog query/path/key, header/sesi, respons HEAD, envelope asli, cache privat, dan log tanpa token/body |

Suite unit/HTTP: `bun run test:content`. Integrasi nyata: `bun run test:db` dengan database test kosong terisolasi dan guard opt-in T-04. **Seluruh tes belum dijalankan**, sesuai instruksi pemilik. CI tidak dipicu dan tetap manual. Tidak ada database atau konten nyata dimutasi selama pengerjaan.

Kelengkapan proyeksi/DTO tiap fitur akan dibuktikan saat integrasi endpoint pada T-09/T-12/T-13/T-14. Gangguan respons setelah commit dan pemulihan UI tetap T-22. Bukti perilaku prasyarat T-03–T-07 juga masih menunggu tes. T-08 belum dicentang selesai.
