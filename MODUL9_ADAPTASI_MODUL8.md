# GARML AR Modul 9 — Struktur dan Arsitektur CPU (adaptasi dari Modul 8)

Mesin AR Modul 8 dipertahankan (kamera, WebXR, fallback, gesture, raycast, hotspot, panel info).
Perubahan hanya konten, model, dan wiring pemilihan model terkait.

| File | Perubahan |
|---|---|
| `public/models/` | `CPU_Processor.glb`, `Circuit_Board.glb` (byte-identik dengan cpu.glb / circuit-board.glb), `RAM_Stick.glb` (dari ram-stick.glb); `DDR5_RAM.glb` dihapus |
| `src/models/registry.ts` | 3 model; `TOPIC_MODELS` (topik → model, yang pertama = utama) |
| `src/ar/config.ts` | Kunci RAM menjadi `ram-stick`; angka ukuran/posisi tidak diubah |
| `src/ar/engine.ts` | `select(id, related)` dan `setRelated()`: model terkait tetap opak, hanya model utama yang dimanipulasi |
| `src/ar/hotspots.ts` | `setSelected(id, related)`: label model terkait tidak diredam |
| `src/main.ts` | Topik → model utama; pill menghitung topik yang melibatkan model; tab/chip tergulir ke item aktif |
| `src/content/lessons.ts`, `figures.ts` | 9 topik dan 10 diagram SVG baru |
| `src/content/renderLesson.ts`, `src/style.css` | Blok `table`; tab panel bisa digulir horizontal (9 tab); gaya tabel |

## Pemetaan topik → model (utama + terkait)
01 CPU · 02 CPU + RAM · 03 CPU + Papan · 04 Papan + CPU · 05 CPU · 06 CPU + RAM · 07–09 CPU

## Menjalankan
`npm install` → `npm run dev` atau `npm run build`. Kamera dan WebXR butuh HTTPS atau localhost.

## Revisi 2 (sumber: Makalah_Kelompok9.pdf)
- **Posisi Info Message:** penyebab asli adalah `scrollIntoView()` pada chip ALUR / tab panel; fungsi itu ikut menggulir
  ancestor `overflow:hidden`, sehingga viewport bergeser dan pengukuran `panelOffset()` (jarak ke panel ALUR) menjadi basi pada pembukaan pertama.
  Diganti `revealInScroller()` yang hanya menggulir daftar chip/tab. Ditambah `ResizeObserver` (ALUR, panel, viewport) agar
  posisi tetap menempel saat ukuran berubah.
- **Konten:** `lessons.ts` ditulis ulang mengikuti Bab II makalah (2.1–2.10); topik 05 menggabungkan 2.5 + 2.6.
- **Diagram:** `figures.ts` disesuaikan dengan makalah (siklus tanpa interupsi, tanpa PSW, tahap R4000 IF1…WB, skema RISC/CISC sesuai tabel);
  diagram graph coloring dan register windows dihapus karena tidak ada di makalah.
