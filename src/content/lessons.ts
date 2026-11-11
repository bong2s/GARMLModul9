// Learning content for Modul 9 (Struktur dan Arsitektur CPU).
//
// Topics, in learning order:
//   1. Organisasi Prosesor   2. Organisasi Register  3. Siklus Instruksi
//   4. Pipeline Instruksi    5. Karakteristik RISC   6. Optimasi Register
//   7. RISC vs CISC          8. Motorola 88000       9. MIPS R4000

import {
  FIG_88000,
  FIG_CISC,
  FIG_COLORING,
  FIG_CPU_ORG,
  FIG_CYCLE,
  FIG_PIPELINE,
  FIG_R4000,
  FIG_REGISTERS,
  FIG_RISC,
  FIG_WINDOWS,
} from "./figures";

export type LessonBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "formula"; text: string }
  | { kind: "example"; lines: string[] }
  | { kind: "note"; text: string }
  | { kind: "figure"; svg: string; caption: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export interface LessonTopic {
  id: string;
  title: string;
  short: string;
  /** Supporting panel for a model (not one of the numbered topics). */
  context?: boolean;
  blocks: LessonBlock[];
}

export const MODULE_TOPICS: LessonTopic[] = [
  {
    id: "organisasi-prosesor",
    title: "Organisasi Prosesor",
    short: "ALU, unit kontrol, register, bus internal",
    blocks: [
      { kind: "heading", text: "Tugas CPU" },
      {
        kind: "text",
        text: "CPU menjalankan program lewat lima tugas: mengambil instruksi (fetch), menafsirkan instruksi, mengambil data, memproses data, dan menulis hasil. Agar semua itu berjalan, CPU memerlukan penyimpan sementara yang kecil dan cepat, yaitu register.",
      },
      { kind: "figure", svg: FIG_CPU_ORG, caption: "Organisasi dasar CPU (Gambar 9.1)" },
      { kind: "heading", text: "Komponen utama" },
      {
        kind: "list",
        ordered: false,
        items: [
          "ALU (Arithmetic Logic Unit): melakukan operasi aritmetika dan logika pada data.",
          "Unit kontrol (Control Unit): mengatur aliran data dan instruksi dengan sinyal kontrol ke ALU, register, dan memori.",
          "Register: penyimpan sementara di dalam CPU untuk instruksi, data, dan alamat.",
          "Bus internal: jalur yang memindahkan data dan sinyal antara ALU, register, dan unit kontrol di dalam CPU.",
        ],
      },
      {
        kind: "text",
        text: "Ke luar CPU, hubungan dengan memori dan perangkat I/O melewati bus sistem (alamat, data, dan kontrol).",
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili prosesor secara keseluruhan. ALU, unit kontrol, dan register berada di dalam chip dan tidak tampak terpisah pada model; keterkaitannya ditunjukkan oleh diagram.",
      },
    ],
  },
  {
    id: "organisasi-register",
    title: "Organisasi Register",
    short: "Register pengguna, PC, IR, MAR, MBR, PSW",
    blocks: [
      {
        kind: "text",
        text: "Register berada di puncak hierarki memori: paling cepat, paling kecil, dan terletak di dalam CPU. Register dibagi menjadi register yang terlihat oleh pemrogram dan register kontrol/status.",
      },
      { kind: "heading", text: "Register yang terlihat pengguna" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Register data: menyimpan data yang akan diolah.",
          "Register alamat: menyimpan alamat atau bagian alamat, misalnya register indeks dan stack pointer.",
          "Register kode kondisi (flag): bit hasil operasi, seperti nol, negatif, carry, dan overflow. Program dapat membacanya untuk percabangan.",
        ],
      },
      { kind: "heading", text: "Register kontrol dan status" },
      {
        kind: "list",
        ordered: false,
        items: [
          "PC (Program Counter): alamat instruksi berikutnya.",
          "IR (Instruction Register): instruksi yang sedang dieksekusi.",
          "MAR (Memory Address Register): alamat lokasi memori yang diakses.",
          "MBR (Memory Buffer Register): data yang baru dibaca dari, atau akan ditulis ke, memori.",
          "PSW (Program Status Word): kode kondisi dan bit status, misalnya izin interupsi dan mode eksekusi.",
        ],
      },
      { kind: "figure", svg: FIG_REGISTERS, caption: "Register CPU dan hubungannya dengan RAM (Gambar 9.2)" },
      { kind: "heading", text: "Register berbeda dari RAM" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Letak: register di dalam CPU; RAM di luar CPU, dihubungkan lewat bus.",
          "Kapasitas: register hanya puluhan; RAM jauh lebih besar.",
          "Kecepatan: akses register jauh lebih cepat daripada akses RAM.",
          "Cara akses: register dipanggil dengan nama atau nomor dalam instruksi; RAM diakses lewat alamat melalui MAR dan MBR.",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili CPU tempat register berada, RAM Stick mewakili memori utama. Register tidak tampak pada model; diagram menunjukkan hubungannya.",
      },
    ],
  },
  {
    id: "siklus-instruksi",
    title: "Siklus Instruksi",
    short: "Fetch, Decode, Execute, interupsi",
    blocks: [
      {
        kind: "text",
        text: "Siklus instruksi adalah rangkaian langkah yang diulang CPU untuk setiap instruksi, dari pengambilan hingga hasil tersimpan.",
      },
      { kind: "figure", svg: FIG_CYCLE, caption: "Siklus instruksi dengan pengecekan interupsi (Gambar 9.3)" },
      { kind: "heading", text: "Lima langkah" },
      {
        kind: "list",
        ordered: true,
        items: [
          "Fetch: alamat di PC dikirim lewat MAR, instruksi dibaca ke MBR lalu disalin ke IR. PC bertambah menunjuk instruksi berikutnya.",
          "Decode: unit kontrol menafsirkan opcode di IR.",
          "Operand Fetch: operand diambil dari register atau memori.",
          "Execute: ALU melakukan operasi yang diminta.",
          "Store Result: hasil ditulis ke register atau memori.",
        ],
      },
      { kind: "heading", text: "Peran PC dan IR" },
      {
        kind: "text",
        text: "PC menjaga urutan program karena selalu menunjuk instruksi berikutnya. IR menyimpan instruksi yang sedang diproses, sehingga isi PC boleh berubah tanpa mengganggu instruksi yang berjalan.",
      },
      { kind: "heading", text: "Interupsi" },
      {
        kind: "text",
        text: "Setelah satu instruksi selesai, CPU memeriksa apakah ada interupsi. Jika ada, CPU menyimpan keadaan program (misalnya PC dan PSW), menjalankan rutin layanan interupsi, lalu melanjutkan program. Jika tidak ada, CPU langsung fetch instruksi berikutnya.",
      },
      {
        kind: "example",
        lines: [
          "Fetch   : MAR ← PC ; MBR ← M[MAR] ; IR ← MBR ; PC ← PC + 1",
          "Decode  : unit kontrol membaca opcode pada IR",
          "Operand : ambil operand dari register / memori",
          "Execute : ALU memproses operand",
          "Store   : tulis hasil ke register / memori",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor melaksanakan siklus, Circuit Board menghubungkan CPU dengan memori dan perangkat lain. Siklus adalah urutan proses, bukan komponen fisik.",
      },
    ],
  },
  {
    id: "pipeline-instruksi",
    title: "Pipeline Instruksi",
    short: "Tahap, hitungan siklus, hazard",
    blocks: [
      {
        kind: "text",
        text: "Pipeline membagi eksekusi instruksi menjadi beberapa tahap, seperti jalur perakitan. Ketika satu instruksi berada di tahap kedua, instruksi berikutnya sudah masuk tahap pertama.",
      },
      { kind: "heading", text: "Contoh enam tahap" },
      {
        kind: "list",
        ordered: false,
        items: [
          "FI (Fetch Instruction): mengambil instruksi.",
          "DI (Decode Instruction): menafsirkan opcode dan mode pengalamatan.",
          "CO (Calculate Operands): menghitung alamat efektif operand.",
          "FO (Fetch Operands): mengambil operand.",
          "EI (Execute Instruction): menjalankan operasi.",
          "WO (Write Operand): menulis hasil.",
        ],
      },
      { kind: "figure", svg: FIG_PIPELINE, caption: "Empat instruksi melewati enam tahap (Gambar 9.4)" },
      { kind: "heading", text: "Hitungan siklus ideal" },
      { kind: "formula", text: "Tanpa pipeline  = n × k" },
      { kind: "formula", text: "Pipeline ideal  = k + (n − 1)" },
      {
        kind: "text",
        text: "n adalah jumlah instruksi dan k jumlah tahap, dengan satu siklus per tahap. Contoh n = 9, k = 6: tanpa pipeline 9 × 6 = 54 siklus, dengan pipeline ideal 6 + 8 = 14 siklus (sekitar 3,9 kali lebih cepat). Pada gambar, n = 4 selesai dalam 6 + 3 = 9 siklus.",
      },
      { kind: "heading", text: "Hazard" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Structural hazard: dua instruksi memerlukan sumber daya yang sama pada waktu yang sama, misalnya satu port memori untuk fetch instruksi dan fetch operand.",
          "Data hazard: instruksi memerlukan hasil instruksi sebelumnya yang belum ditulis. Contoh: ADD R1, R2, R3 lalu SUB R4, R1, R5.",
          "Control hazard: instruksi cabang (branch) mengubah PC, sehingga instruksi yang sudah diambil bisa salah.",
        ],
      },
      { kind: "heading", text: "Penanganan" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Stall: pipeline menahan sebagian instruksi (bubble) sampai hazard hilang.",
          "Forwarding: hasil dari ALU langsung diteruskan ke instruksi berikutnya tanpa menunggu ditulis ke register.",
          "Branch prediction: CPU menebak arah cabang agar fetch tetap berjalan; bila salah tebak, instruksi yang keliru dibuang.",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: Circuit Board dan CPU Processor ditampilkan bersama. Tahap pipeline adalah proses di dalam CPU, bukan bagian fisik yang dapat ditunjuk pada model.",
      },
    ],
  },
  {
    id: "karakteristik-risc",
    title: "Karakteristik RISC",
    short: "Instruksi sederhana, load/store, banyak register",
    blocks: [
      {
        kind: "text",
        text: "RISC (Reduced Instruction Set Computer) adalah rancangan CPU dengan set instruksi kecil dan sederhana, sehingga mudah dipercepat dan di-pipeline.",
      },
      { kind: "heading", text: "Ciri utama" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Instruksi sederhana dan terbatas jumlahnya.",
          "Format instruksi tetap (panjang sama, misalnya 32 bit), sehingga decoding cepat.",
          "Sebagian besar instruksi selesai dalam satu siklus mesin.",
          "Arsitektur load/store: hanya LOAD dan STORE yang mengakses memori; operasi lain bekerja antar register.",
          "Banyak register, untuk mengurangi akses memori.",
          "Pipeline efisien karena instruksi seragam dan berdurasi hampir sama.",
        ],
      },
      { kind: "heading", text: "Contoh: C = A + B" },
      {
        kind: "example",
        lines: [
          "LOAD  R1, A        ; R1 ← memori[A]",
          "LOAD  R2, B        ; R2 ← memori[B]",
          "ADD   R3, R1, R2   ; operasi hanya antar register",
          "STORE C, R3        ; memori[C] ← R3",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili prosesor RISC secara umum. Ciri RISC adalah sifat rancangan, bukan bagian fisik yang tampak pada model.",
      },
    ],
  },
  {
    id: "optimasi-register",
    title: "Optimasi Register",
    short: "Graph coloring dan register windows",
    blocks: [
      {
        kind: "text",
        text: "Register jauh lebih cepat daripada memori. Semakin sering data berada di register, semakin sedikit akses memori dan semakin cepat program. Ada dua pendekatan: lewat perangkat lunak (kompilator) dan lewat perangkat keras (register windows).",
      },
      { kind: "heading", text: "Mengapa register lebih cepat" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Register berada di dalam CPU, tanpa melewati bus ke luar chip.",
          "Akses RAM memerlukan jauh lebih banyak siklus.",
          "Karena itu variabel yang sering dipakai sebaiknya ditempatkan di register.",
        ],
      },
      { kind: "heading", text: "Perangkat lunak: graph coloring" },
      {
        kind: "text",
        text: "Jumlah register terbatas, jadi kompilator harus memilih variabel mana yang menempati register. Pada graph coloring, setiap variabel adalah simpul, dan dua variabel yang aktif bersamaan dihubungkan garis. Simpul diwarnai dengan n warna (n register) sehingga simpul bertetangga berbeda warna. Jika warna tidak cukup, sebagian variabel disimpan di memori.",
      },
      { kind: "figure", svg: FIG_COLORING, caption: "Alokasi register dengan graph coloring (Gambar 9.5)" },
      { kind: "heading", text: "Perangkat keras: register windows" },
      {
        kind: "text",
        text: "Pemanggilan prosedur memakai banyak register untuk parameter dan variabel lokal. Dengan register windows, tiap prosedur memperoleh jendela register sendiri, sehingga register tidak perlu disimpan ke memori setiap pemanggilan. Jendela yang berurutan dibuat tumpang tindih: register temporer pemanggil sekaligus menjadi register parameter prosedur yang dipanggil, sehingga parameter berpindah tanpa disalin.",
      },
      { kind: "figure", svg: FIG_WINDOWS, caption: "Register windows yang tumpang tindih (Gambar 9.6)" },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili register, RAM Stick mewakili memori yang lebih lambat. Register tidak tampak pada model; diagram menunjukkan perbedaannya.",
      },
    ],
  },
  {
    id: "risc-vs-cisc",
    title: "RISC vs CISC",
    short: "Dua skema konseptual dan perbandingannya",
    blocks: [
      {
        kind: "text",
        text: "CISC (Complex Instruction Set Computer) memiliki banyak instruksi kompleks; satu instruksi dapat melakukan banyak pekerjaan. RISC memiliki sedikit instruksi sederhana yang digabungkan oleh kompilator.",
      },
      { kind: "heading", text: "Skema RISC" },
      { kind: "figure", svg: FIG_RISC, caption: "Skema konseptual RISC (Gambar 9.7)" },
      { kind: "heading", text: "Skema CISC" },
      { kind: "figure", svg: FIG_CISC, caption: "Skema konseptual CISC (Gambar 9.8)" },
      { kind: "heading", text: "Perbandingan" },
      {
        kind: "table",
        head: ["Aspek", "RISC", "CISC"],
        rows: [
          ["Kompleksitas instruksi", "Sederhana, sedikit", "Kompleks, banyak"],
          ["Format instruksi", "Tetap", "Panjang bervariasi"],
          ["Akses memori", "Hanya LOAD/STORE", "Banyak instruksi dapat langsung memakai memori"],
          ["Penggunaan register", "Banyak, operasi antar register", "Lebih sedikit, sebagian khusus"],
          ["Panjang kode", "Lebih banyak instruksi", "Lebih ringkas"],
          ["Decoding", "Sederhana, umumnya hardwired", "Rumit, sering memakai mikrokode"],
          ["Efisiensi pipeline", "Tinggi", "Lebih sulit"],
        ],
      },
      { kind: "heading", text: "Contoh konseptual: C = A + B" },
      {
        kind: "example",
        lines: [
          "RISC : LOAD R1, A ; LOAD R2, B ; ADD R3, R1, R2 ; STORE C, R3",
          "CISC : ADD C, A, B   (satu instruksi, operand langsung dari memori)",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: kedua skema adalah diagram konseptual yang dikaitkan dengan model CPU yang sama, bukan dua CPU berbeda. Prosesor modern sering memadukan gagasan dari keduanya.",
      },
    ],
  },
  {
    id: "motorola-88000",
    title: "Motorola 88000",
    short: "RISC 32-bit, Harvard, unit eksekusi ganda",
    blocks: [
      {
        kind: "text",
        text: "Motorola 88000 adalah prosesor RISC 32-bit dengan dua ciri yang menonjol.",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "Arsitektur Harvard: jalur instruksi dan jalur data terpisah, sehingga instruksi dan data dapat diakses bersamaan tanpa saling menunggu.",
          "Beberapa unit eksekusi independen, misalnya unit integer, floating-point, dan data (load/store), yang dapat bekerja paralel.",
        ],
      },
      { kind: "figure", svg: FIG_88000, caption: "Gambaran konseptual yang disederhanakan (Gambar 9.9)" },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor hanya representasi visual generik. Model ini bukan replika Motorola 88000.",
      },
    ],
  },
  {
    id: "mips-r4000",
    title: "MIPS R4000",
    short: "RISC 64-bit, superpipeline 8 tahap",
    blocks: [
      {
        kind: "text",
        text: "MIPS R4000 adalah prosesor RISC 64-bit yang memakai superpipeline delapan tahap. Superpipeline membagi tahap pipeline menjadi tahap yang lebih pendek, sehingga waktu tiap tahap turun dan frekuensi clock dapat naik.",
      },
      { kind: "figure", svg: FIG_R4000, caption: "Tahap pipeline dipecah menjadi lebih pendek (Gambar 9.10)" },
      { kind: "heading", text: "Delapan tahap" },
      {
        kind: "list",
        ordered: false,
        items: [
          "IF: fetch instruksi, bagian pertama.",
          "IS: fetch instruksi, bagian kedua.",
          "RF: decode instruksi dan baca register.",
          "EX: eksekusi instruksi.",
          "DF: akses data cache, bagian pertama.",
          "DS: akses data cache, bagian kedua.",
          "TC: pemeriksaan tag cache.",
          "WB: tulis hasil ke register.",
        ],
      },
      {
        kind: "text",
        text: "Konsekuensinya, tahap yang lebih banyak membuat hukuman hazard (misalnya pada cabang) lebih besar.",
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor hanya representasi visual generik. Model ini bukan replika MIPS R4000.",
      },
    ],
  },
];
