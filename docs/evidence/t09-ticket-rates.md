# Bukti implementasi T-09 — API tarif tiket

Tanggal: 18 September 2026. Branch: `development`.

## Implementasi

- `apps/api/src/ticket-rates/service.ts`: pembacaan snapshot konsisten, mutasi create/update/delete/order melalui T-08, pemadatan posisi, serta proyeksi tarif publik.
- `apps/api/src/ticket-rates/http.ts`: enam endpoint admin, parsing UUID/query DELETE, envelope/Location, dan integrasi guard privat.
- Server API memasang route tarif bersama autentikasi dan lookup receipt; schema/role/migrasi tetap menggunakan fondasi yang tersedia.
- [Panduan API tiket](../ticket-rates.md) menjelaskan validasi, urutan, penanda publik, dan replay.

## Pemeriksaan statis

- `bun run --cwd apps/api check`: lulus.
- ESLint pada service/HTTP tiket, server, error mapper, dan file tes terkait: lulus.
- Prettier pada file TypeScript yang berubah: diterapkan.

Pembacaan source adapter Drizzle Bun SQL terpasang menunjukkan konfigurasi transaksi diteruskan melalui `setTransaction`; ini mendukung pilihan konfigurasi `repeatable read`/`read only`, tetapi tidak menggantikan bukti runtime.

## Skenario disiapkan, belum dijalankan

Suite `bun run test:db` memuat `ticket-rates-database-cases.ts`:

- Daftar kosong; create harga nol tersembunyi secara default; explicit show; Location; GET ulang/detail dengan versi yang sesuai; harga/ketentuan tersimpan di PostgreSQL.
- Edit, no-op, hide/show, reorder, delete dan pemadatan posisi, termasuk pemindahan/penghapusan tarif tersembunyi tanpa memalsukan tanggal publik.
- Harga negatif/pecahan/string/kosong/null/overflow, ketentuan kosong, catatan kosong, field posisi asing, key/UUID/query invalid, dan DELETE dengan body ditolak. PUT invalid tidak mengubah harga/ketentuan lama.
- Reorder dengan ID hilang/ganda/asing; versi lama mendahului membership/keberadaan entitas; array kosong sah setelah koleksi kosong.
- Replay create/delete, lookup receipt asli, create identik serentak, serta key dipakai ulang dengan payload berbeda; pemeriksaan jumlah tarif/versi/audit.
- Header/sesi/Origin, cache privat, literal `/order`, dan log tanpa isi ketentuan.

**Tes belum dijalankan** sesuai instruksi pemilik. Tidak ada perubahan database nyata atau workflow CI dipicu. Fixture dijalankan hanya pada database test kosong terisolasi setelah persetujuan. URL HTTPS pada Request in-process bukan bukti TLS/browser.

Bukti snapshot saat penulis berjalan, gangguan jaringan setelah commit, dan alur browser tetap perlu integrasi T-14/T-22/T-23. Prasyarat T-03–T-08 belum memiliki seluruh bukti perilaku. T-09 masih belum dicentang selesai.
