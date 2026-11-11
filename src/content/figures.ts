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
    label(144, 184, "bus internal", "middle") +
    arrow(120, 54, 134, 54) +
    arrow2(120, 142, 134, 142) +
    arrow2(142, 98, 160, 98) +
    arrow2(266, 98, 292, 98) +
    box(292, 62, 62, 72, "Memori", false, "& I/O") +
    label(279, 88, "bus", "middle") +
    label(279, 120, "sistem", "middle"),
  "Organisasi CPU: unit kontrol, ALU, register, dan bus internal, terhubung ke memori dan I/O lewat bus sistem"
);

/** 9.2 — user-invisible control registers and their link to main memory. */
export const FIG_REGISTERS = wrap(
  360,
  184,
  frame(6, 4, 208, 174) +
    label(16, 20, "CPU", "start") +
    box(18, 28, 84, 38, "PSW", false, "flag status") +
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
  "Register CPU (PC, IR, MAR, MBR, PSW, register umum) dan hubungannya dengan RAM"
);

/** 9.3 — instruction cycle with the interrupt check. */
export const FIG_CYCLE = wrap(
  360,
  196,
  box(10, 10, 100, 40, "1 Fetch") +
    box(130, 10, 100, 40, "2 Decode") +
    box(250, 10, 100, 40, "3 Operand Fetch") +
    box(250, 82, 100, 40, "4 Execute") +
    box(130, 82, 100, 40, "5 Store Result") +
    box(10, 82, 100, 40, "Cek interupsi", true) +
    arrow(110, 30, 130, 30) +
    arrow(230, 30, 250, 30) +
    arrow(300, 50, 300, 82) +
    arrow(250, 102, 230, 102) +
    arrow(130, 102, 110, 102) +
    arrow(40, 82, 40, 50) +
    label(46, 70, "tidak ada", "start") +
    arrow(60, 122, 60, 144) +
    label(66, 138, "ada", "start") +
    box(10, 146, 220, 40, "Rutin layanan interupsi", true, "lalu kembali ke Fetch"),
  "Siklus instruksi: Fetch, Decode, Operand Fetch, Execute, Store Result, lalu cek interupsi"
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

/** 9.5 — register allocation as graph colouring. */
export const FIG_COLORING = wrap(
  360,
  150,
  `<line x1="52" y1="40" x2="132" y2="40" class="f-line"/>` +
    `<line x1="52" y1="40" x2="92" y2="104" class="f-line"/>` +
    `<line x1="132" y1="40" x2="92" y2="104" class="f-line"/>` +
    `<line x1="92" y1="104" x2="172" y2="104" class="f-line"/>` +
    `<circle cx="52" cy="40" r="22" class="f-hot"/><text x="52" y="38" text-anchor="middle" class="f-txt">A</text><text x="52" y="51" text-anchor="middle" class="f-dim">R1</text>` +
    `<circle cx="132" cy="40" r="22" class="f-box"/><text x="132" y="38" text-anchor="middle" class="f-txt">B</text><text x="132" y="51" text-anchor="middle" class="f-dim">R2</text>` +
    `<circle cx="92" cy="104" r="22" class="f-box"/><text x="92" y="102" text-anchor="middle" class="f-txt">C</text><text x="92" y="115" text-anchor="middle" class="f-dim">R3</text>` +
    `<circle cx="172" cy="104" r="22" class="f-hot"/><text x="172" y="102" text-anchor="middle" class="f-txt">D</text><text x="172" y="115" text-anchor="middle" class="f-dim">R1</text>` +
    label(206, 38, "Simpul = variabel", "start") +
    label(206, 56, "Garis = aktif bersamaan", "start") +
    label(206, 74, "Warna = nomor register", "start") +
    label(206, 100, "A dan D tidak terhubung,", "start") +
    label(206, 114, "jadi boleh berbagi R1.", "start"),
  "Graph coloring: empat variabel A sampai D dialokasikan ke tiga register; A dan D berbagi R1"
);

/** 9.6 — overlapping register windows. */
export const FIG_WINDOWS = (() => {
  const w = 36;
  const shift = 2 * w;
  const rows = [
    { name: "Proc A", x: 46, y: 22 },
    { name: "Proc B", x: 46 + shift, y: 66 },
    { name: "Proc C", x: 46 + 2 * shift, y: 110 },
  ];
  let body = "";
  rows.forEach((r, ri) => {
    ["P", "L", "T"].forEach((seg, k) => {
      const overlap = (seg === "T" && ri < 2) || (seg === "P" && ri > 0);
      body +=
        `<rect x="${r.x + k * w}" y="${r.y}" width="${w - 2}" height="30" rx="4" class="${overlap ? "f-hot" : "f-box"}"/>` +
        `<text x="${r.x + k * w + (w - 2) / 2}" y="${r.y + 19}" text-anchor="middle" class="f-sm">${seg}</text>`;
    });
    body += `<text x="4" y="${r.y + 19}" class="f-dim">${r.name}</text>`;
  });
  [0, 1].forEach((ri) => {
    const ox = rows[ri + 1].x;
    const y1 = rows[ri].y + 30;
    const y2 = rows[ri + 1].y;
    body +=
      `<line x1="${ox}" y1="${y1}" x2="${ox}" y2="${y2}" class="f-line" stroke-dasharray="3 3"/>` +
      `<line x1="${ox + w - 2}" y1="${y1}" x2="${ox + w - 2}" y2="${y2}" class="f-line" stroke-dasharray="3 3"/>`;
  });
  body +=
    box(306, 22, 48, 118, "Global", false, "bersama") +
    label(4, 164, "P = parameter masuk · L = lokal · T = temporer (keluar)", "start") +
    label(4, 180, "T milik pemanggil = P milik yang dipanggil (tumpang tindih)", "start");
  return wrap(360, 188, body, "Register windows: tiga jendela prosedur dengan register temporer dan parameter yang tumpang tindih");
})();

/** 9.7 — conceptual RISC scheme. */
export const FIG_RISC = wrap(
  360,
  184,
  box(10, 10, 100, 52, "Instruksi", true, "sederhana, tetap") +
    box(130, 10, 100, 52, "Kontrol", false, "decode cepat") +
    box(250, 10, 100, 52, "Pipeline", false, "efisien, ±1 siklus") +
    arrow(110, 36, 130, 36) +
    arrow(230, 36, 250, 36) +
    box(10, 96, 100, 52, "Register", true, "banyak") +
    box(130, 96, 100, 52, "ALU", false, "operasi reg–reg") +
    box(250, 96, 100, 52, "Memori", false, "LOAD/STORE") +
    arrow(180, 62, 180, 96) +
    arrow2(110, 122, 130, 122) +
    `<path d="M300 148 V164 H60 V150" class="f-line" fill="none" marker-end="url(#arr)" marker-start="url(#arr)"/>` +
    label(180, 178, "LOAD / STORE"),
  "Skema RISC: instruksi sederhana dan seragam, register banyak, memori hanya diakses lewat LOAD dan STORE"
);

/** 9.8 — conceptual CISC scheme. */
export const FIG_CISC = wrap(
  360,
  160,
  box(10, 10, 100, 52, "Instruksi", true, "kompleks, variabel") +
    box(130, 10, 100, 52, "Kontrol", false, "mikrokode") +
    box(250, 10, 100, 52, "Pipeline", false, "lebih sulit") +
    arrow(110, 36, 130, 36) +
    arrow(230, 36, 250, 36) +
    box(10, 96, 100, 52, "Register", true, "lebih sedikit") +
    box(130, 96, 100, 52, "ALU", false, "operasi kompleks") +
    box(250, 96, 100, 52, "Memori", false, "operand memori") +
    arrow(180, 62, 180, 96) +
    arrow2(110, 122, 130, 122) +
    arrow2(230, 122, 250, 122),
  "Skema CISC: instruksi kompleks berpanjang variabel, register lebih sedikit, operasi dapat langsung memakai operand di memori"
);

/** 9.9 — Motorola 88000: separate instruction and data paths, several execution units. */
export const FIG_88000 = wrap(
  360,
  190,
  box(6, 26, 86, 44, "Memori", false, "instruksi") +
    frame(108, 8, 146, 174) +
    label(116, 22, "CPU", "start") +
    box(118, 30, 126, 30, "Unit instruksi", true) +
    box(118, 68, 126, 30, "Unit integer") +
    box(118, 106, 126, 30, "Unit floating-point") +
    box(118, 144, 126, 30, "Unit data (load/store)", true) +
    arrow(92, 45, 118, 45) +
    label(49, 84, "jalur instruksi", "middle") +
    arrow2(244, 159, 272, 159) +
    box(272, 140, 82, 38, "Memori", false, "data") +
    label(313, 134, "jalur data", "middle"),
  "Motorola 88000: jalur instruksi dan jalur data terpisah (Harvard) serta beberapa unit eksekusi independen"
);

/** 9.10 — MIPS R4000: pipeline stages split into shorter ones. */
export const FIG_R4000 = (() => {
  const u = 41;
  const x0 = 16;
  const top = [
    ["IF", 2],
    ["RD", 1],
    ["ALU", 1],
    ["MEM", 3],
    ["WB", 1],
  ] as const;
  const bottom = ["IF", "IS", "RF", "EX", "DF", "DS", "TC", "WB"];
  let body = label(x0, 14, "Pipeline 5 tahap (dasar)", "start");
  let x = x0;
  top.forEach(([name, span]) => {
    body +=
      `<rect x="${x}" y="22" width="${span * u - 3}" height="32" rx="5" class="f-box"/>` +
      `<text x="${x + (span * u - 3) / 2}" y="42" text-anchor="middle" class="f-txt">${name}</text>`;
    x += span * u;
  });
  body += label(x0, 82, "MIPS R4000: superpipeline 8 tahap", "start");
  bottom.forEach((name, i) => {
    body +=
      `<rect x="${x0 + i * u}" y="90" width="${u - 3}" height="32" rx="5" class="f-hot"/>` +
      `<text x="${x0 + i * u + (u - 3) / 2}" y="110" text-anchor="middle" class="f-txt">${name}</text>`;
  });
  body +=
    label(180, 144, "Tahap dipecah menjadi lebih pendek →") +
    label(180, 160, "waktu per tahap turun, frekuensi clock dapat naik");
  return wrap(360, 168, body, "MIPS R4000: pipeline lima tahap dipecah menjadi delapan tahap yang lebih pendek");
})();
