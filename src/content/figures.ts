// Small inline SVG illustrations for the Modul 9 lessons.
// Static, author-written markup (no user input). Colours come from CSS classes in style.css
// (.f-box, .f-hot, .f-txt, .f-dim, .f-sm, .f-line) so the figures follow the panel accent colour.

const wrap = (w: number, h: number, body: string, label: string): string =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">` +
  `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="f-arrow"/></marker></defs>${body}</svg>`;

const box = (x: number, y: number, w: number, h: number, text: string, hot = false, sub = ""): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${hot ? "f-hot" : "f-box"}"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + (sub ? -2 : 4)}" text-anchor="middle" class="f-txt">${text}</text>` +
  (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" class="f-dim">${sub}</text>` : "");

const arrow = (x1: number, y1: number, x2: number, y2: number): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="f-line" marker-end="url(#arr)"/>`;

const arrow2 = (x1: number, y1: number, x2: number, y2: number): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="f-line" marker-start="url(#arr)" marker-end="url(#arr)"/>`;

const label = (x: number, y: number, text: string, anchor = "middle"): string =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" class="f-dim">${text}</text>`;

const frame = (x: number, y: number, w: number, h: number): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="f-box" stroke-dasharray="6 4"/>`;

/** 9.1 — basic CPU organisation: control unit, ALU, registers, internal bus. */
export const FIG_CPU_ORG = wrap(
  360,
  190,
  frame(4, 4, 262, 182) +
    label(14, 20, "CPU", "start") +
    box(16, 32, 104, 44, "Unit Kontrol", true, "pengatur sinyal") +
    box(16, 120, 104, 44, "Register", false, "penyimpan cepat") +
    box(158, 76, 96, 44, "ALU", true, "hitung & logika") +
    `<line x1="138" y1="30" x2="138" y2="170" class="f-line" stroke-width="5"/>` +
    label(144, 184, "interkoneksi CPU", "middle") +
    arrow(120, 54, 134, 54) +
    arrow2(120, 142, 134, 142) +
    arrow2(142, 98, 160, 98) +
    arrow2(266, 98, 292, 98) +
    box(292, 62, 62, 72, "Memori", false, "& I/O") +
    label(279, 88, "bus", "middle") +
    label(279, 120, "sistem", "middle"),
  "Organisasi CPU: unit kontrol, ALU, register, dan interkoneksi CPU, terhubung ke memori dan I/O lewat bus sistem"
);

/** 9.2 — user-invisible control registers and their link to main memory. */
export const FIG_REGISTERS = wrap(
  360,
  184,
  frame(6, 4, 208, 174) +
    label(16, 20, "CPU", "start") +
    box(18, 28, 84, 38, "Cond. Codes", false, "flag hasil") +
    box(18, 74, 84, 38, "R0 … Rn", false, "data / alamat") +
    box(18, 120, 84, 38, "IR", true, "instruksi aktif") +
    box(116, 28, 84, 38, "PC", true, "alamat berikut") +
    box(116, 74, 84, 38, "MAR", true, "alamat memori") +
    box(116, 120, 84, 38, "MBR", true, "data memori") +
    arrow(158, 66, 158, 74) +
    arrow(116, 139, 102, 139) +
    box(268, 50, 86, 100, "RAM", false, "memori utama") +
    arrow(200, 93, 268, 93) +
    label(234, 87, "alamat", "middle") +
    arrow(268, 139, 200, 139) +
    label(234, 133, "data", "middle"),
  "Register CPU (PC, IR, MAR, MBR, register umum, condition codes) dan hubungannya dengan RAM"
);

/** 9.3 — instruction cycle as in the paper: Fetch, Decode, Operand Fetch, Execute, Write Back. */
export const FIG_CYCLE = wrap(
  360,
  150,
  box(10, 10, 100, 40, "1 Fetch") +
    box(130, 10, 100, 40, "2 Decode") +
    box(250, 10, 100, 40, "3 Operand Fetch") +
    box(250, 90, 100, 40, "4 Execute") +
    box(130, 90, 100, 40, "5 Write Back", true) +
    arrow(110, 30, 130, 30) +
    arrow(230, 30, 250, 30) +
    arrow(300, 50, 300, 90) +
    arrow(250, 110, 230, 110) +
    `<path d="M130 110 H60 V52" class="f-line" fill="none" marker-end="url(#arr)"/>` +
    label(66, 84, "instruksi berikutnya", "start"),
  "Siklus instruksi: Fetch, Decode, Operand Fetch, Execute, Write Back, lalu instruksi berikutnya"
);

/** 9.4 — pipeline timing diagram, 4 instructions x 6 stages. */
export const FIG_PIPELINE = (() => {
  const stages = ["FI", "DI", "CO", "FO", "EI", "WO"];
  const n = 4;
  const colW = 33;
  const x0 = 34;
  const cols = stages.length + n - 1;
  let body = "";
  for (let t = 0; t < cols; t++) body += label(x0 + t * colW + colW / 2 - 1, 12, String(t + 1));
  for (let i = 0; i < n; i++) {
    const y = 22 + i * 26;
    body += `<text x="6" y="${y + 15}" class="f-dim">I${i + 1}</text>`;
    stages.forEach((s, k) => {
      const x = x0 + (i + k) * colW;
      body +=
        `<rect x="${x}" y="${y}" width="${colW - 3}" height="22" rx="4" class="${i === 0 ? "f-hot" : "f-box"}"/>` +
        `<text x="${x + (colW - 3) / 2}" y="${y + 15}" text-anchor="middle" class="f-sm">${s}</text>`;
    });
  }
  body += label(x0, 138, "Waktu (siklus) →", "start");
  return wrap(340, 146, body, "Diagram waktu pipeline enam tahap untuk empat instruksi: selesai dalam sembilan siklus");
})();

/** 9.5 — conceptual RISC scheme (paper section 2.9.2). */
export const FIG_RISC = wrap(
  360,
  184,
  box(10, 10, 100, 52, "Instruksi", true, "sederhana, tetap") +
    box(130, 10, 100, 52, "Kontrol", false, "hardwired") +
    box(250, 10, 100, 52, "Pipeline", false, "lebih efisien") +
    arrow(110, 36, 130, 36) +
    arrow(230, 36, 250, 36) +
    box(10, 96, 100, 52, "Register", true, "16 – 32") +
    box(130, 96, 100, 52, "ALU", false, "operasi di register") +
    box(250, 96, 100, 52, "Memori", false, "LOAD/STORE") +
    arrow(180, 62, 180, 96) +
    arrow2(110, 122, 130, 122) +
    `<path d="M300 148 V164 H60 V150" class="f-line" fill="none" marker-end="url(#arr)" marker-start="url(#arr)"/>` +
    label(180, 178, "LOAD / STORE"),
  "Skema RISC: instruksi sederhana dan tetap, register 16 sampai 32, memori hanya lewat LOAD dan STORE, kontrol hardwired"
);

/** 9.6 — conceptual CISC scheme (paper section 2.9.2). */
export const FIG_CISC = wrap(
  360,
  160,
  box(10, 10, 100, 52, "Instruksi", true, "besar, bervariasi") +
    box(130, 10, 100, 52, "Kontrol", false, "mikroprogram") +
    box(250, 10, 100, 52, "Pipeline", false, "lebih sulit") +
    arrow(110, 36, 130, 36) +
    arrow(230, 36, 250, 36) +
    box(10, 96, 100, 52, "Register", true, "8 – 16") +
    box(130, 96, 100, 52, "ALU", false, "") +
    box(250, 96, 100, 52, "Memori", false, "akses langsung") +
    arrow(180, 62, 180, 96) +
    arrow2(110, 122, 130, 122) +
    arrow2(230, 122, 250, 122),
  "Skema CISC: instruksi besar dan bervariasi, register 8 sampai 16, kontrol mikroprogram, instruksi dapat mengakses memori langsung"
);

/** 9.7 — Motorola 88000: Harvard (separate instruction/data paths), independent execution units, 32 x 32-bit register file. */
export const FIG_88000 = wrap(
  360,
  190,
  box(4, 62, 72, 46, "Memori", false, "instruksi") +
    frame(100, 8, 162, 174) +
    label(108, 22, "CPU", "start") +
    box(110, 30, 142, 30, "Unit integer (ALU)") +
    box(110, 68, 142, 30, "Unit floating-point") +
    box(110, 106, 142, 30, "Unit data", true) +
    box(110, 144, 142, 30, "Register 32 × 32-bit") +
    arrow(76, 85, 100, 85) +
    label(40, 124, "jalur", "middle") +
    label(40, 138, "instruksi", "middle") +
    arrow2(252, 121, 288, 121) +
    box(288, 98, 68, 46, "Memori", false, "data") +
    label(322, 160, "jalur data", "middle"),
  "Motorola 88000: jalur instruksi dan data terpisah (Harvard), unit eksekusi independen, register file 32 register 32-bit"
);

/** 9.8 — MIPS R4000: eight-stage superpipeline (stage names as in the paper). */
export const FIG_R4000 = (() => {
  const u = 41;
  const x0 = 16;
  const stages = ["IF1", "IF2", "RF", "EX", "TC", "DC", "TU", "WB"];
  const groups: Array<[number, number, string]> = [
    [0, 2, "fetch"],
    [2, 1, "reg."],
    [3, 1, "eksek."],
    [4, 3, "akses cache"],
    [7, 1, "tulis"],
  ];
  let body = label(x0, 14, "Superpipeline 8 tahap", "start");
  stages.forEach((name, i) => {
    body +=
      `<rect x="${x0 + i * u}" y="22" width="${u - 3}" height="32" rx="5" class="f-hot"/>` +
      `<text x="${x0 + i * u + (u - 3) / 2}" y="42" text-anchor="middle" class="f-txt">${name}</text>`;
  });
  groups.forEach(([start, span, text]) => {
    const gx = x0 + start * u;
    body +=
      `<line x1="${gx}" y1="62" x2="${gx + span * u - 3}" y2="62" class="f-line"/>` +
      `<text x="${gx + (span * u - 3) / 2}" y="76" text-anchor="middle" class="f-sm">${text}</text>`;
  });
  body +=
    label(180, 108, "Tahap dasar dibagi menjadi sub-tahap yang lebih kecil") +
    label(180, 124, "→ waktu per tahap singkat, frekuensi clock dapat tinggi");
  return wrap(360, 136, body, "MIPS R4000: pipeline delapan tahap IF1, IF2, RF, EX, TC, DC, TU, WB");
})();
