# Aturan kolaborasi proyek

Instruksi pemilik proyek, 11 September 2026:

- Remote utama: `git@github-personal:choirulanwarr/umbul-nogo.git` (`origin`).
- Kerjakan perubahan pada branch `development`. Setelah setiap task selesai, commit pekerjaan terkait dan push ke `origin/development`. Jangan force-push atau mengubah branch lain tanpa instruksi.
- Sebelum menjalankan tes, minta konfirmasi pemilik proyek dan tunggu jawabannya. Ini mencakup unit, integrasi, E2E, smoke, skrip verifikasi perilaku, serta pemicu workflow CI yang menjalankan tes. Persetujuan push tidak otomatis menjadi persetujuan tes.
- Workflow CI dipicu manual agar push tidak menjalankan tes tanpa konfirmasi. Jangan mengaktifkan tes otomatis kembali tanpa persetujuan.
- Jika tes belum disetujui, laporkan sebagai belum dijalankan. Jangan mengklaim task telah lolos validasi yang belum dilakukan.
- Menyalakan aplikasi untuk preview dan membaca status Git tidak memerlukan konfirmasi tes.
