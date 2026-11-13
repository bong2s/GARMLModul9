// Learning content for Modul 9 (Struktur dan Arsitektur CPU).
// Source: Makalah Kelompok 9, Bab II (sections 2.1-2.10). Terminology follows the paper.
//
// Topics, in learning order (paper section in brackets):
//   1. Organisasi Prosesor [2.1]            2. Organisasi Register [2.2, 2.7]   3. Siklus Instruksi [2.3]
//   4. Pipeline Instruksi [2.4]             5. RISC dan Karakteristik Eksekusi Instruksi [2.5, 2.6]
//   6. Optimasi Register [2.8]              7. RISC vs CISC [2.9]
//   8. Motorola 88000 [2.10.1]              9. MIPS R4000 [2.10.2]

import {
  FIG_88000,
  FIG_CISC,
  FIG_CPU_ORG,
  FIG_CYCLE,
  FIG_PIPELINE,
  FIG_R4000,
  FIG_REGISTERS,
  FIG_RISC,
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
    short: "Prosesor, bus sistem, ALU, unit kontrol",
    blocks: [
      { kind: "heading", text: "Pengertian prosesor" },
      {
        kind: "text",
        text: "Prosesor adalah komponen perangkat keras yang menjadi pusat pengolahan komputer: menjalankan instruksi program sekaligus mengatur jalannya operasi komputer. Karena peran sentralnya, prosesor sering disebut “otak” komputer.",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "Program tidak dapat berjalan tanpa prosesor: program di memori utama baru berguna setelah instruksinya diambil dan dieksekusi prosesor.",
          "Seluruh data diolah prosesor lewat operasi aritmetika dan logika.",
          "Unit kontrol menyelaraskan kerja komponen lain agar sinkron.",
          "Jenis dan kekuatan prosesor sangat menentukan kecepatan komputer (diukur dalam MHz atau GHz).",
        ],
      },
      { kind: "heading", text: "Letak prosesor" },
      {
        kind: "text",
        text: "Secara fisik, prosesor adalah chip persegi yang dipasang pada soket (socket) di motherboard, papan sirkuit utama yang menghubungkan seluruh komponen. Tipe soket harus cocok dengan model prosesor. Misalnya, Intel memakai soket LGA yang pin-nya ada di motherboard, sedangkan AMD memakai soket AM4 atau AM5 yang pin-nya ada di prosesor.",
      },
      {
        kind: "text",
        text: "Secara logis, prosesor berada di pusat sistem dan terhubung ke memori utama serta perangkat I/O melalui bus sistem, yang terdiri dari tiga jalur:",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "Address Bus (bus alamat): menunjukkan lokasi memori atau perangkat yang dituju.",
          "Data Bus (bus data): membawa data yang dipindahkan.",
          "Control Bus (bus kontrol): membawa sinyal pengatur, misalnya perintah membaca atau menulis.",
        ],
      },
      { kind: "figure", svg: FIG_CPU_ORG, caption: "Organisasi prosesor (Gambar 9.1)" },
      { kind: "heading", text: "Lima tugas prosesor" },
      {
        kind: "text",
        text: "Menurut Stallings (2016), prosesor harus mampu melakukan lima hal:",
      },
      {
        kind: "list",
        ordered: true,
        items: [
          "Fetch Instruction: membaca instruksi dari memori (register, cache, atau memori utama).",
          "Interpret Instruction: menafsirkan (decode) instruksi untuk mengetahui tindakan yang diminta.",
          "Fetch Data: membaca data dari memori atau modul I/O bila instruksi memerlukannya.",
          "Process Data: melakukan operasi aritmetika atau logika pada data.",
          "Write Data: menulis hasil kembali ke memori atau modul I/O.",
        ],
      },
      { kind: "heading", text: "Empat komponen internal" },
      {
        kind: "list",
        ordered: false,
        items: [
          "ALU (Arithmetic and Logic Unit): mengerjakan pengolahan data, yaitu aritmetika (penjumlahan, pengurangan), logika (AND, OR, XOR, NOT), dan perbandingan nilai (=, ≠, <, >).",
          "Unit Kontrol (Control Unit): mengendalikan operasi prosesor dan komputer agar sinkron.",
          "Register: memori kecil berkecepatan tinggi di dalam prosesor untuk menyimpan data dan status secara sementara.",
          "Interkoneksi CPU (CPU Interconnection): sistem koneksi dan bus internal yang menghubungkan ALU, unit kontrol, dan register, serta tersambung ke bus sistem.",
        ],
      },
      { kind: "heading", text: "Cara kerja bersama" },
      {
        kind: "text",
        text: "Unit kontrol mengambil instruksi dari memori utama dan menentukan jenisnya. Jika instruksi memerlukan data, unit kontrol mengambilnya dari memori utama. Jika berupa perhitungan, instruksi dikirim ke ALU. Register menampung data dan status sementara, dan interkoneksi menjadi jalur bagi semuanya. Hasil pengolahan kemudian disimpan ke memori utama.",
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili chip prosesor. ALU, unit kontrol, dan register berada di dalam chip sehingga tidak tampak terpisah pada model; diagram menunjukkan hubungannya.",
      },
    ],
  },
  {
    id: "organisasi-register",
    title: "Organisasi Register",
    short: "User-visible, control dan status, hierarki",
    blocks: [
      { kind: "heading", text: "Pengertian" },
      {
        kind: "text",
        text: "Register adalah unit penyimpanan berukuran kecil di dalam CPU dengan kecepatan akses sangat tinggi. Register menyimpan instruksi, alamat lokasi memori, dan operand yang dipakai dalam pengolahan data.",
      },
      {
        kind: "text",
        text: "Organisasi register adalah pengaturan register di dalam prosesor. Pengaturan ini ditentukan perancang, sehingga prosesor yang berbeda dapat memiliki organisasi register yang berbeda. Berdasarkan fungsinya, register dibagi dua: User-Visible Registers serta Control and Status Registers.",
      },
      { kind: "heading", text: "User-Visible Registers" },
      {
        kind: "text",
        text: "Register yang dapat diakses programmer melalui bahasa assembly atau instruksi mesin:",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "General Purpose Register (GPR): menyimpan data, alamat, dan hasil sementara suatu perhitungan.",
          "Data Register: menyimpan data yang akan diproses CPU, tetapi tidak dipakai untuk menghitung alamat operand.",
          "Address Register: menyimpan alamat operand atau membantu proses pengalamatan, sehingga prosesor dapat menentukan lokasi data di memori.",
          "Condition Codes: sekumpulan bit penanda (flag) yang menunjukkan kondisi hasil suatu operasi. Prosesor memakainya untuk menentukan tindakan berikutnya, terutama pada instruksi percabangan.",
        ],
      },
      { kind: "heading", text: "Jenis Address Register" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Segment Pointer: menyimpan alamat dasar (base address) suatu segmen memori.",
          "Index Register: membantu pengalamatan berdasarkan indeks atau posisi tertentu, misalnya saat menelusuri data di memori.",
          "Stack Pointer: menunjuk posisi teratas (top) dari stack atau tumpukan data.",
        ],
      },
      { kind: "heading", text: "Control and Status Registers" },
      {
        kind: "text",
        text: "Register yang menyimpan informasi untuk mengendalikan operasi prosesor dan mendukung pelaksanaan instruksi:",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "Program Counter (PC): alamat instruksi berikutnya yang akan diambil.",
          "Instruction Register (IR): instruksi yang sedang diproses CPU.",
          "Memory Address Register (MAR): alamat lokasi memori yang akan diakses.",
          "Memory Buffer Register (MBR): data yang baru dibaca dari memori atau yang akan ditulis ke memori; penampung sementara dalam perpindahan data antara CPU dan memori. Pada siklus instruksi, makalah menyebutnya Memory Data Register (MDR).",
        ],
      },
      { kind: "figure", svg: FIG_REGISTERS, caption: "Register CPU dan hubungannya dengan RAM (Gambar 9.2)" },
      { kind: "heading", text: "Hierarki dan ukuran register" },
      {
        kind: "text",
        text: "Register berada di tingkat tertinggi hierarki memori: kecepatannya paling cepat, kapasitasnya paling kecil, dan harga per bit paling tinggi. Register juga menjadi cara tercepat untuk memanipulasi data di komputer.",
      },
      {
        kind: "text",
        text: "Ukuran register dinyatakan dalam jumlah bit yang dapat ditampung, misalnya register 8-bit, 16-bit, 32-bit, atau 64-bit. Register 32-bit menampung nilai selebar 32 bit.",
      },
      { kind: "heading", text: "Register berbeda dari RAM" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Letak: register berada di dalam CPU; RAM adalah memori utama komputer di luar CPU, tempat data dan instruksi program yang sedang dijalankan disimpan sementara.",
          "Hubungan: CPU mengambil instruksi dari RAM saat diperlukan, lalu memprosesnya dengan bantuan register. Alamat dan data melewati MAR dan MBR.",
          "Hierarki: register paling cepat dan paling kecil kapasitasnya; RAM lebih besar tetapi lebih lambat diakses.",
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
    short: "Fetch, Decode, Operand Fetch, Execute, Write Back",
    blocks: [
      {
        kind: "text",
        text: "Siklus instruksi (instruction cycle) adalah tahapan yang dilakukan CPU untuk mengambil, memahami, dan menjalankan instruksi dari sebuah program.",
      },
      { kind: "figure", svg: FIG_CYCLE, caption: "Siklus instruksi (Gambar 9.3)" },
      { kind: "heading", text: "Lima tahap" },
      {
        kind: "list",
        ordered: true,
        items: [
          "Fetch Cycle: CPU mengambil instruksi dari memori utama. Alamatnya ada di PC dan dipindahkan ke MAR. Unit kontrol mengirim sinyal baca ke memori, instruksi masuk ke MDR/MBR lalu ke IR. Nilai PC kemudian bertambah agar menunjuk instruksi berikutnya.",
          "Decode Cycle: unit kontrol menafsirkan instruksi di IR. CPU membaca bagian opcode (kode operasi) untuk menentukan perintah yang harus dilakukan dan mengidentifikasi data atau register yang terlibat.",
          "Operand Fetch: jika instruksi memerlukan data atau operand, CPU mengambilnya dari memori atau register lain.",
          "Execute Cycle: CPU menjalankan operasi sesungguhnya berdasarkan hasil decode. Eksekusi dapat berupa perhitungan aritmetika atau logika melalui ALU, pemindahan data antar memori, atau perubahan alur program (misalnya perintah jump).",
          "Write Back: hasil eksekusi ditulis kembali ke memori atau ke register tujuan.",
        ],
      },
      { kind: "heading", text: "Fetch Cycle dalam register" },
      {
        kind: "example",
        lines: [
          "MAR ← PC           ; alamat instruksi ke MAR",
          "MDR ← memori[MAR]  ; baca instruksi dari memori",
          "IR  ← MDR          ; instruksi masuk ke IR",
          "PC  ← PC + 1       ; menuju instruksi berikutnya",
        ],
      },
      {
        kind: "text",
        text: "PC menjaga urutan program karena selalu menunjuk instruksi berikutnya, sedangkan IR menyimpan instruksi yang sedang diproses.",
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor menjalankan siklus, Circuit Board mewakili papan yang menghubungkan CPU dengan komponen lain. Siklus adalah urutan proses, bukan komponen fisik.",
      },
    ],
  },
  {
    id: "pipeline-instruksi",
    title: "Pipeline Instruksi",
    short: "Enam tahap, timing, tiga hazard",
    blocks: [
      {
        kind: "text",
        text: "Pipeline adalah teknik prosesor untuk mencapai kecepatan (throughput) lebih besar dengan melakukan siklus instruksi secara tumpang tindih pada setiap siklus jam (clock cycle). Eksekusi instruksi dibagi menjadi beberapa sub-operasi yang disebut pipeline stages.",
      },
      { kind: "heading", text: "Enam tahap" },
      {
        kind: "list",
        ordered: true,
        items: [
          "IF (Instruction Fetch): membaca instruksi dari memori (instruction cache) berdasarkan alamat di PC.",
          "DI (Decode Instruction): mendekode opcode untuk memahami operasi yang diminta dan mengidentifikasi register atau operand yang terlibat.",
          "CO (Calculate Operand): menghitung alamat efektif lokasi operand, misalnya alamat base + offset.",
          "FO (Fetch Operand): membaca operand dari memori atau register berdasarkan alamat yang dihitung pada tahap CO.",
          "EI (Execute Operand): mengeksekusi operasi matematika atau logika dengan ALU, atau instruksi kontrol lain.",
          "Write Operation: menulis hasil akhir dari ALU ke register tujuan atau memori utama.",
        ],
      },
      { kind: "heading", text: "Diagram waktu" },
      {
        kind: "text",
        text: "Sumbu horizontal adalah siklus jam, sumbu vertikal adalah instruksi. Begitu instruksi pertama pindah ke tahap kedua, instruksi berikutnya sudah masuk tahap pertama.",
      },
      { kind: "figure", svg: FIG_PIPELINE, caption: "Empat instruksi melewati enam tahap (Gambar 9.4)" },
      {
        kind: "text",
        text: "Pada ilustrasi di makalah, 9 instruksi selesai dalam 14 siklus: instruksi pertama selesai pada siklus ke-6, lalu satu instruksi selesai setiap siklus berikutnya. Perhitungan ideal dari ilustrasi ini (6 tahap, tanpa hambatan):",
      },
      { kind: "formula", text: "Tanpa pipeline  = n × k = 9 × 6 = 54 siklus" },
      { kind: "formula", text: "Pipeline ideal = k + (n − 1) = 6 + 8 = 14 siklus" },
      { kind: "heading", text: "Pipeline hazard" },
      {
        kind: "text",
        text: "Hazard adalah kondisi yang mencegah instruksi berikutnya di dalam pipeline dieksekusi pada siklus clock yang seharusnya. Ada tiga jenis:",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "Resource Hazard: dua instruksi atau lebih di tahap berbeda membutuhkan komponen hardware yang sama pada siklus yang sama. Contoh: tahap IF dan FO sama-sama ingin memakai memori pada saat yang sama.",
          "Data Hazard: instruksi membutuhkan hasil instruksi sebelumnya yang belum selesai diproses atau belum ditulis ke register. Contoh: ADD R1, R2, R3 lalu SUB R4, R1, R5; SUB memerlukan R1 yang belum siap.",
          "Branch/Control Hazard: terjadi pada instruksi percabangan (BEQ, BNE, JUMP). CPU belum dapat menentukan alamat instruksi berikutnya yang harus di-fetch karena hasil kondisi percabangan baru selesai dihitung pada tahap eksekusi (EX/MEM).",
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
    title: "RISC dan Karakteristik Eksekusi Instruksi",
    short: "RISC, load/store, eksekusi instruksi",
    blocks: [
      { kind: "heading", text: "Pengertian RISC" },
      {
        kind: "text",
        text: "RISC (Reduced Instruction Set Computer) adalah pendekatan desain arsitektur prosesor yang memakai kumpulan instruksi relatif sederhana agar instruksi dapat diproses secara efisien. Tujuannya: menyederhanakan instruksi, memanfaatkan register, dan mendukung penerapan pipelining.",
      },
      { kind: "heading", text: "Karakteristik RISC" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Instruksi relatif sederhana: setiap instruksi berfungsi jelas dan tidak terlalu kompleks.",
          "Format instruksi teratur: pengambilan dan penerjemahan instruksi lebih mudah diatur.",
          "Penggunaan register: untuk menyimpan operand dan hasil sementara.",
          "Pendekatan Load/Store: instruksi load dan store memindahkan data antara memori dan register, sedangkan operasi aritmetika umumnya memakai data di register.",
          "Mendukung pipelining: beberapa tahap instruksi dikerjakan tumpang tindih sehingga lebih banyak instruksi selesai dalam satu waktu.",
        ],
      },
      { kind: "heading", text: "Cara kerja Load/Store" },
      {
        kind: "text",
        text: "Pendekatan ini memisahkan pemindahan data dari pengolahan data, dalam tiga tahap: Load (data dari memori ke register), Process (CPU mengolah data di register), dan Store (hasil disimpan dari register ke memori bila perlu).",
      },
      {
        kind: "example",
        lines: [
          "LOAD  R1, 5        ; Load: angka 5 ke R1",
          "LOAD  R2, 3        ; Load: angka 3 ke R2",
          "ADD   R3, R1, R2   ; Process: R1 + R2 = 8 (di register)",
          "STORE R3           ; Store: simpan 8 ke memori",
        ],
      },
      { kind: "heading", text: "Contoh arsitektur RISC" },
      {
        kind: "list",
        ordered: false,
        items: [
          "ARM: banyak dipakai pada smartphone, tablet, dan sistem tertanam (embedded systems).",
          "RISC-V: arsitektur instruction set terbuka yang spesifikasinya dapat dipakai untuk mengembangkan berbagai jenis prosesor.",
        ],
      },
      { kind: "heading", text: "Karakteristik eksekusi instruksi" },
      {
        kind: "text",
        text: "Berbeda dari karakteristik RISC yang menyangkut rancangan set instruksi, bagian ini menyangkut proses CPU menjalankan perintah program untuk mengolah data dan menghasilkan informasi. Ciri-cirinya:",
      },
      {
        kind: "list",
        ordered: false,
        items: [
          "Berurutan (sequential): instruksi dijalankan satu per satu sesuai urutan program, kecuali ada percabangan atau perubahan alur.",
          "Bertahap: melalui Fetch, Decode, dan Execute.",
          "Melibatkan komponen CPU: control unit, ALU, register, dan Program Counter.",
          "Memerlukan data (operand): instruksi tertentu membutuhkan operand untuk diproses.",
          "Menghasilkan output: berupa perhitungan, pemindahan data, penyimpanan data, atau perubahan kondisi.",
          "Berulang dan cepat: CPU menjalankan banyak instruksi berulang kali dengan sangat cepat sampai program selesai.",
        ],
      },
      { kind: "heading", text: "Komponen yang terlibat" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Control Unit (CU): mengatur dan mengendalikan jalannya eksekusi instruksi.",
          "ALU: operasi aritmetika (penjumlahan, pengurangan, perkalian, pembagian) dan logika.",
          "Register: penyimpanan kecil berkecepatan tinggi di dalam CPU untuk data, alamat memori, instruksi, dan hasil perhitungan.",
          "RAM: memori utama yang menyimpan sementara data dan instruksi program yang sedang dijalankan; CPU mengambil instruksi dari RAM saat diperlukan.",
          "Program Counter (PC): register khusus yang menyimpan alamat memori instruksi berikutnya.",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili prosesor secara umum. Karakteristik RISC adalah sifat rancangan, bukan bagian fisik yang tampak pada model.",
      },
    ],
  },
  {
    id: "optimasi-register",
    title: "Optimasi Register",
    short: "Allocation, renaming, reuse, akses memori",
    blocks: [
      {
        kind: "text",
        text: "Optimasi register adalah teknik optimasi pada kompiler yang memetakan sejumlah kecil register fisik di dalam CPU. Karena register adalah penyimpanan tercepat tetapi jumlahnya sedikit, pemakaiannya perlu diatur. Makalah membahas empat teknik.",
      },
      { kind: "heading", text: "1. Register Allocation" },
      {
        kind: "text",
        text: "Mengatur penempatan variabel dan data ke dalam register yang tersedia agar dipakai secara efisien.",
      },
      {
        kind: "example",
        lines: ["a → R1", "b → R2", "c → R3   ; tiga variabel yang sering dipakai ditempatkan di register"],
      },
      { kind: "heading", text: "2. Register Renaming" },
      {
        kind: "text",
        text: "Memakai nama register fisik yang berbeda untuk menghindari konflik pemakaian register pada instruksi tertentu.",
      },
      {
        kind: "example",
        lines: [
          "R1 ← a + b",
          "R2 ← R1 × 2",
          "R1 ← c + d   ; konflik: R1 dipakai lagi untuk nilai lain",
          "R5 ← c + d   ; renaming: pakai register fisik R5, konflik hilang",
        ],
      },
      { kind: "heading", text: "3. Register Reuse" },
      {
        kind: "text",
        text: "Memakai kembali register yang sudah tidak dibutuhkan untuk menyimpan data baru.",
      },
      {
        kind: "example",
        lines: [
          "R1 ← x + y",
          "R2 ← R1 × 2   ; setelah ini, R1 tidak diperlukan lagi",
          "R1 ← p + q    ; R1 dipakai kembali untuk data baru",
        ],
      },
      { kind: "heading", text: "4. Mengurangi akses memori" },
      {
        kind: "text",
        text: "Menyimpan data yang sering dipakai di register agar CPU tidak perlu terus-menerus mengambilnya dari RAM.",
      },
      {
        kind: "example",
        lines: [
          "Tanpa register : tiap iterasi baca dan tulis jumlah di RAM",
          "Dengan register: jumlah disimpan di R1 selama loop,",
          "                 ditulis ke RAM sekali di akhir",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor mewakili register, RAM Stick mewakili memori utama. Tujuan optimasi ini adalah mengurangi bolak-balik antara keduanya.",
      },
    ],
  },
  {
    id: "risc-vs-cisc",
    title: "RISC vs CISC",
    short: "Dua skema, tabel, kelebihan dan kekurangan",
    blocks: [
      { kind: "heading", text: "Pengertian" },
      {
        kind: "text",
        text: "CISC (Complex Instruction Set Computer) memakai set instruksi besar dan kompleks, sehingga satu instruksi dapat menjalankan tugas yang rumit. Pendekatan ini lahir karena biaya perangkat lunak saat itu jauh melebihi biaya perangkat keras dan bahasa pemrograman tingkat tinggi semakin kompleks. Tujuannya mempermudah penulisan kompilator, meningkatkan efisiensi eksekusi dengan memindahkan operasi kompleks ke microcode, dan mendukung bahasa tingkat tinggi yang lebih rumit.",
      },
      {
        kind: "text",
        text: "RISC (Reduced Instruction Set Computer) memakai instruksi sederhana agar diproses efisien, dengan memanfaatkan register, pendekatan load/store, dan pipelining.",
      },
      { kind: "heading", text: "Skema RISC" },
      { kind: "figure", svg: FIG_RISC, caption: "Skema konseptual RISC (Gambar 9.5)" },
      { kind: "heading", text: "Skema CISC" },
      { kind: "figure", svg: FIG_CISC, caption: "Skema konseptual CISC (Gambar 9.6)" },
      { kind: "heading", text: "Karakteristik CISC" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Instruksi banyak dan beragam, termasuk yang jarang dipakai.",
          "Format instruksi bervariasi: ukuran tidak seragam.",
          "Banyak mode pengalamatan.",
          "Unit kontrol memakai microprogram: instruksi kompleks diterjemahkan menjadi rangkaian mikroinstruksi.",
          "Instruksi dapat mengakses memori secara langsung, sehingga ketergantungan pada memori lebih besar.",
          "Waktu eksekusi bervariasi: satu instruksi dapat membutuhkan beberapa siklus clock.",
        ],
      },
      { kind: "heading", text: "Tabel perbandingan" },
      {
        kind: "table",
        head: ["Aspek", "RISC", "CISC"],
        rows: [
          ["Set instruksi", "Sederhana dan terbatas", "Besar dan beragam"],
          ["Format instruksi", "Seragam atau tetap", "Bervariasi"],
          ["Mode pengalamatan", "Sedikit dan sederhana", "Banyak"],
          ["Siklus eksekusi", "Umumnya satu siklus clock", "Bervariasi, sering beberapa siklus clock"],
          ["Jumlah register", "16 – 32", "8 – 16"],
          ["Akses memori", "Hanya lewat load dan store; operasi lain di register", "Instruksi dapat langsung mengakses memori"],
          ["Unit kontrol", "Hardwired, tanpa microcode", "Mikroprogram atau mikrokode"],
          ["Ukuran program", "Rata-rata sekitar 30% lebih panjang", "Lebih ringkas"],
          ["Pipelining", "Lebih efisien", "Lebih sulit"],
          ["Beban kompilator", "Lebih berat: pekerjaan dipindah ke waktu kompilasi", "Lebih ringan: instruksi kompleks tersedia"],
          ["Contoh", "ARM dan MIPS", "x86 (Intel dan AMD)"],
        ],
      },
      { kind: "heading", text: "Kelebihan dan kekurangan RISC" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Kelebihan: eksekusi instruksi lebih cepat, format seragam, ketergantungan pada memori lebih rendah, dan pipelining lebih efisien. Unit kontrol sederhana juga menyisakan ruang di chip untuk fitur lain seperti cache.",
          "Kekurangan: tugas kompleks memerlukan lebih banyak instruksi, program lebih panjang sehingga butuh lebih banyak memori, dan beban kerja berpindah ke kompilator.",
        ],
      },
      { kind: "heading", text: "Kelebihan dan kekurangan CISC" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Kelebihan: tugas kompleks dijalankan dengan satu instruksi sehingga kode lebih kecil, dan instruksi yang jarang dipakai tetap tersedia.",
          "Kekurangan: kompleksitas eksekusi dapat menurunkan kinerja, ketergantungan pada memori utama lebih besar, dan unit kontrol yang rumit membuat desain lebih lama dan mahal.",
        ],
      },
      {
        kind: "note",
        text: "Pada model 3D: kedua skema adalah diagram konseptual yang dikaitkan dengan model CPU yang sama, bukan dua CPU berbeda.",
      },
    ],
  },
  {
    id: "motorola-88000",
    title: "Motorola 88000",
    short: "RISC 32-bit, Harvard, decoupled execution",
    blocks: [
      {
        kind: "text",
        text: "Motorola 88000 dan MIPS R4000 adalah prosesor yang diciptakan pada era 1980-an hingga 1990-an. Keduanya menerapkan prinsip RISC, tetapi dengan pendekatan desain eksekusi dan pipeline yang berbeda.",
      },
      { kind: "heading", text: "Arsitektur dan konsep desain" },
      {
        kind: "text",
        text: "Motorola 88000 (MC88000) adalah keluarga prosesor RISC 32-bit yang dirancang dengan desain superscalar tahap awal berbasis arsitektur Harvard, yang memisahkan jalur bus instruksi dan data.",
      },
      { kind: "figure", svg: FIG_88000, caption: "Gambaran konseptual yang disederhanakan (Gambar 9.7)" },
      { kind: "heading", text: "Ide desain utama" },
      {
        kind: "list",
        ordered: false,
        items: [
          "Arsitektur Harvard: instruksi dan data punya jalur sendiri, sehingga keduanya dapat diakses tanpa berebut satu jalur.",
          "Decoupled execution: unit eksekusi independen (ALU/integer, Floating Point Unit, dan Data Unit) bekerja sendiri-sendiri.",
          "Pipeline multi-tahap: beberapa instruksi diproses bersamaan pada unit eksekusi yang berbeda.",
          "Register file besar (32 register 32-bit): meminimalkan latency akses memori.",
        ],
      },
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
      { kind: "heading", text: "Arsitektur dan konsep desain" },
      {
        kind: "text",
        text: "MIPS R4000 adalah salah satu prosesor RISC 64-bit komersial pertama di dunia. Arsitekturnya dirancang untuk memaksimalkan kecepatan clock tanpa kompleksitas transistor yang berlebihan.",
      },
      { kind: "heading", text: "Superpipelined" },
      {
        kind: "text",
        text: "R4000 memakai pendekatan eksekusi superpipelined (bukan superscalar murni): tahapan operasi dasar dibagi menjadi sub-tahap yang lebih kecil, sehingga instruksi diproses pada frekuensi clock yang sangat tinggi. Alasannya: semakin sedikit pekerjaan di tiap tahap, semakin singkat waktu yang dibutuhkan tahap itu, sehingga siklus clock bisa dipercepat.",
      },
      { kind: "figure", svg: FIG_R4000, caption: "Delapan tahap pipeline (Gambar 9.8)" },
      { kind: "heading", text: "Delapan tahap pipeline" },
      {
        kind: "list",
        ordered: true,
        items: [
          "IF1 (Instruction Fetch 1): tahap pertama pengambilan instruksi.",
          "IF2 (Instruction Fetch 2): tahap kedua pengambilan instruksi.",
          "RF (Register File): membaca register yang dibutuhkan instruksi.",
          "EX (Instruction Execute): mengeksekusi instruksi.",
          "TC (Tag Check): memeriksa tag untuk memastikan data yang dicari ada di cache.",
          "DC (Data Cache): mengakses data cache.",
          "TU (Tag Update): memperbarui tag.",
          "WB (Write Back): menulis hasil.",
        ],
      },
      {
        kind: "text",
        text: "Menurut makalah, desain ini memungkinkan dua kali lipat instruksi masuk ke pipeline per siklus clock internal.",
      },
      {
        kind: "note",
        text: "Pada model 3D: CPU Processor hanya representasi visual generik. Model ini bukan replika MIPS R4000.",
      },
    ],
  },
];
