import "./style.css";
import { MODULE_TOPICS, type LessonTopic } from "./content/lessons";
import { renderLesson } from "./content/renderLesson";
import { createViewer, type ARState, type Viewer } from "./ar/engine";
import { HotspotLayer } from "./ar/hotspots";
import { MODEL_LAYOUT } from "./ar/config";
import { getModelsForTopic, getOwnTopicsForModel, getPrimaryModel, getTopicsForModel, MODELS } from "./models/registry";

const app = document.querySelector<HTMLDivElement>("#app")!;

const GESTURE_SVG = {
  rotate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 4v5h-5"/></svg>',
  pan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/><path d="M12 2v20M2 12h20"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>',
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const modelOfTopic = (topicId: string): string | null => getPrimaryModel(topicId);

const topicNumber = (topic: LessonTopic): string =>
  String(MODULE_TOPICS.findIndex((t) => t.id === topic.id) + 1).padStart(2, "0");

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

app.innerHTML = `
  <main class="viewport" id="viewport">
    <div class="canvas-container" id="canvas-container"></div>

    <div class="top-bar" id="top-bar">
      <div class="filter-bar" id="comp-nav">
        <button class="filter-btn active" data-comp="all" type="button"><span>SEMUA</span><small>${MODULE_TOPICS.length}</small></button>
        ${MODELS.map(
          (m) => `
        <button class="filter-btn" data-comp="${m.id}" type="button" style="--pill-color:${MODEL_LAYOUT[m.id].color}">
          <span>${esc(MODEL_LAYOUT[m.id].label)}</span>${getOwnTopicsForModel(m.id).length ? `<small>${getOwnTopicsForModel(m.id).length}</small>` : ""}
        </button>`
        ).join("")}
      </div>
      <div class="top-actions">
        <button class="reset-btn" id="btn-reset-view" type="button">Reset View</button>
        <button class="ar-btn" id="btn-start-ar" type="button" disabled>Mulai AR</button>
      </div>
      <div class="mode-badge" id="mode-badge">PRATINJAU 3D · bukan AR terlacak</div>
    </div>

    <div class="gesture-hints" id="gesture-hints">
      <span class="gesture-hint">${GESTURE_SVG.rotate}<strong>PUTAR</strong><small>1 JARI</small></span>
      <span class="gesture-hint">${GESTURE_SVG.pan}<strong>PINDAH</strong><small>2 JARI</small></span>
      <span class="gesture-hint">${GESTURE_SVG.zoom}<strong>ZOOM</strong><small>PINCH</small></span>
    </div>

    <section class="component-flow" id="component-flow" aria-label="Alur urutan komponen">
      <h2>ALUR URUTAN KOMPONEN</h2>
      <div class="component-flow-list" id="alur-chips">
        ${MODULE_TOPICS.map(
          (topic, i) => `
        <button class="component-flow-item" type="button" data-topic-id="${topic.id}">
          <span class="component-flow-number">${i + 1}</span><span>${esc(topic.title)}</span>
        </button>`
        ).join("")}
      </div>
    </section>

    <div class="ar-status" id="ar-status" hidden></div>

    <section class="info-panel" id="info-panel" aria-label="Informasi komponen">
      <div class="panel-handle"></div>
      <button class="panel-close" id="panel-close" type="button" aria-label="Tutup panel informasi">&times;</button>
      <div class="info-category" id="info-category"></div>
      <h2 class="info-title" id="info-title"></h2>
      <div class="panel-tabs" id="panel-tabs" hidden></div>
      <div class="info-body" id="info-body"></div>
    </section>

    <div class="ar-hud" id="ar-hud" hidden>
      <p class="ar-hud-message" id="ar-hud-message" hidden></p>
      <div class="ar-hud-buttons" id="ar-hud-buttons" hidden>
        <button type="button" data-act="replace">Tempatkan ulang</button>
        <button type="button" data-act="reset">Reset</button>
        <button type="button" data-act="exit" class="danger">Keluar AR</button>
      </div>
    </div>

    <div class="loading-indicator" id="loading">Memuat model 3D…</div>
  </main>
`;

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const viewport = $<HTMLElement>("#viewport");
const canvasContainer = $<HTMLElement>("#canvas-container");
const topBar = $<HTMLElement>("#top-bar");
const compNav = $<HTMLElement>("#comp-nav");
const btnResetView = $<HTMLButtonElement>("#btn-reset-view");
const btnStartAR = $<HTMLButtonElement>("#btn-start-ar");
const modeBadge = $<HTMLElement>("#mode-badge");
const gestureHints = $<HTMLElement>("#gesture-hints");
const flow = $<HTMLElement>("#component-flow");
const alurChips = $<HTMLElement>("#alur-chips");
const arStatus = $<HTMLElement>("#ar-status");
const panel = $<HTMLElement>("#info-panel");
const panelClose = $<HTMLButtonElement>("#panel-close");
const infoCategory = $<HTMLElement>("#info-category");
const infoTitle = $<HTMLElement>("#info-title");
const infoBody = $<HTMLElement>("#info-body");
const panelTabs = $<HTMLElement>("#panel-tabs");
const hud = $<HTMLElement>("#ar-hud");
const hudMessage = $<HTMLElement>("#ar-hud-message");
const hudButtons = $<HTMLElement>("#ar-hud-buttons");
const loading = $<HTMLElement>("#loading");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let viewer: Viewer | null = null;
let hotspots: HotspotLayer | null = null;
let arState: ARState = "idle";
let arSupported = false;
let activeTopicId: string | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let disposed = false;
const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const sideSheetQuery = window.matchMedia("(orientation: landscape) and (min-width: 700px)");

// ---------------------------------------------------------------------------
// Status banner (errors / short hints)
// ---------------------------------------------------------------------------

function setStatus(text: string, sticky = true, ms = 2600): void {
  if (statusTimer) clearTimeout(statusTimer);
  arStatus.textContent = "";
  const msg = document.createElement("span");
  msg.textContent = text;
  arStatus.appendChild(msg);
  if (sticky) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ar-status-close";
    close.textContent = "Buka viewer 3D";
    close.addEventListener("click", () => {
      arStatus.hidden = true;
    });
    arStatus.appendChild(close);
  } else {
    statusTimer = setTimeout(() => {
      arStatus.hidden = true;
    }, ms);
  }
  arStatus.hidden = false;
}

// ---------------------------------------------------------------------------
// Layout → free region of the 3D view (measured from the real DOM)
// ---------------------------------------------------------------------------

function isShown(el: HTMLElement): boolean {
  return !el.hidden && getComputedStyle(el).display !== "none";
}

/**
 * The models are framed in the band between the top controls and the lowest of
 * (hints, alur panel, open info panel, AR HUD). Values are px from the canvas edges.
 */
/** Distance from the viewport bottom to the top of the ALUR panel (+ gap): the info panel sits above it. */
function panelOffset(): number {
  const rect = viewport.getBoundingClientRect();
  return Math.max(rect.bottom - flow.getBoundingClientRect().top + 8, 0);
}

function measureInsets(): { top: number; bottom: number; left: number; right: number } {
  const rect = canvasContainer.getBoundingClientRect();
  let top = topBar.getBoundingClientRect().bottom;
  if (isShown(modeBadge)) top = Math.max(top, modeBadge.getBoundingClientRect().bottom);
  top = Math.max(top - rect.top + 8, 0);

  let bottomEdge = rect.bottom;
  const consider = (el: HTMLElement, top0?: number) => {
    if (!isShown(el)) return;
    bottomEdge = Math.min(bottomEdge, top0 ?? el.getBoundingClientRect().top);
  };
  consider(flow);
  consider(gestureHints);
  consider(hud);
  let right = 0;
  if (panel.classList.contains("open")) {
    if (sideSheetQuery.matches) right = panel.offsetWidth + 10 + 8; // side sheet: frame the models beside it
    else bottomEdge = Math.min(bottomEdge, rect.bottom - panelOffset() - panel.offsetHeight);
  }
  const bottom = Math.max(rect.bottom - bottomEdge + 8, 0);
  return { top, bottom, left: 0, right };
}

function updateInsets(animate: boolean): void {
  panel.style.setProperty("--panel-bottom", `${panelOffset()}px`);
  // The AR controls must stay reachable: lift them above the info panel while it is open.
  hud.style.bottom = panel.classList.contains("open") && !sideSheetQuery.matches ? `${panelOffset() + panel.offsetHeight + 8}px` : "";
  const next = measureInsets();
  const changed =
    Math.abs(next.top - insets.top) > 1 ||
    Math.abs(next.bottom - insets.bottom) > 1 ||
    Math.abs(next.right - insets.right) > 1;
  Object.assign(insets, next);
  if (changed || !animate) viewer?.setViewInsets(next.top, next.bottom, next.left, next.right, animate);
}

// ---------------------------------------------------------------------------
// Selection / panel / navigation
// ---------------------------------------------------------------------------

function syncUi(): void {
  if (!viewer) return;
  const mode = viewer.getMode();
  const sel = viewer.getSelected();

  compNav.querySelectorAll<HTMLElement>(".filter-btn").forEach((btn) => {
    const comp = btn.dataset.comp!;
    btn.classList.toggle("active", comp === "all" ? mode === "all" : comp === sel);
  });
  alurChips.querySelectorAll<HTMLElement>(".component-flow-item").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.topicId === activeTopicId);
  });
  hotspots?.setSelected(sel, activeTopicId ? getModelsForTopic(activeTopicId) : []);
  alurChips
    .querySelector<HTMLElement>(".component-flow-item.active")
    ?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function showTopic(modelId: string, topic: LessonTopic): void {
  activeTopicId = topic.id;
  const color = MODEL_LAYOUT[modelId]?.color ?? "#566174";
  panel.style.setProperty("--panel-accent", color);
  infoCategory.textContent = topic.short;
  infoTitle.textContent = topic.context ? topic.title : `${topicNumber(topic)} · ${topic.title}`;
  renderLesson(infoBody, topic);
  panel.scrollTop = 0;

  const topics = getTopicsForModel(modelId);
  if (topics.length > 1) {
    panelTabs.innerHTML = topics
      .map(
        (t) =>
          `<button class="panel-tab ${t.id === topic.id ? "active" : ""}" type="button" data-topic-id="${t.id}" data-model-id="${modelId}">${esc(t.title)}</button>`
      )
      .join("");
    panelTabs.hidden = false;
  } else {
    panelTabs.innerHTML = "";
    panelTabs.hidden = true;
  }

  // models taking part in the topic stay fully visible next to the selected one
  viewer?.setRelated(getModelsForTopic(topic.id));
  panelTabs.querySelector<HTMLElement>(".panel-tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });

  panel.classList.add("open");
  gestureHints.classList.add("hidden");
  syncUi();
  updateInsets(true);
}

function closePanel(): void {
  if (!panel.classList.contains("open")) return;
  panel.classList.remove("open");
  activeTopicId = null;
  viewer?.setRelated([]);
  syncUi();
  updateInsets(true);
}

/** Select one model: manipulation target, highlight, and its learning topics. */
function selectModel(modelId: string, topicId?: string): void {
  if (!viewer) return;
  viewer.select(modelId);
  const topics = getTopicsForModel(modelId);
  const topic = topics.find((t) => t.id === topicId) ?? topics[0];
  if (topic) showTopic(modelId, topic);
  else syncUi();
}

/** SEMUA: group mode, nothing selected, all models fully visible. Transforms are kept. */
function selectAll(): void {
  if (!viewer) return;
  viewer.setMode("all");
  closePanel();
  gestureHints.classList.remove("hidden");
  syncUi();
}

function resetEverything(): void {
  if (!viewer) return;
  viewer.resetView();
  selectAll();
}

compNav.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-comp]");
  if (!btn) return;
  const comp = btn.dataset.comp!;
  if (comp === "all") selectAll();
  else selectModel(comp);
});

alurChips.addEventListener("click", (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-topic-id]");
  if (!chip) return;
  const topicId = chip.dataset.topicId!;
  const modelId = modelOfTopic(topicId);
  if (modelId) selectModel(modelId, topicId);
});

panelTabs.addEventListener("click", (event) => {
  const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-topic-id]");
  if (!tab) return;
  const topic = getTopicsForModel(tab.dataset.modelId!).find((t) => t.id === tab.dataset.topicId);
  if (topic) showTopic(tab.dataset.modelId!, topic); // content only: no transform / selection change
});

panelClose.addEventListener("click", closePanel);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanel();
});

btnResetView.addEventListener("click", resetEverything);


// ---------------------------------------------------------------------------
// AR (state, HUD, buttons)
// ---------------------------------------------------------------------------

function handleARState(state: ARState): void {
  arState = state;
  const inAR = state === "placing" || state === "placed";

  if (state === "starting") {
    closePanel();
    selectAll();
  }

  viewport.classList.toggle("ar-active", inAR);
  modeBadge.hidden = inAR || state === "starting";
  hud.hidden = !inAR;
  btnStartAR.hidden = inAR;
  hudButtons.hidden = state !== "placed";

  const isFallback = viewer?.session.isFallbackActive ?? false;
  let message = "";
  if (state === "placing") {
    message = isFallback ? "Memulai AR..." : "Gerakkan HP perlahan sampai susunan komponen muncul.";
  } else if (state === "placed" && isFallback) {
    message = "Mode cadangan (bukan tracking AR): model hanya mengikuti putaran HP.";
  }
  hudMessage.textContent = message;
  hudMessage.hidden = message === "";
  updateInsets(false);
}

async function startPreviewCamera(): Promise<void> {
  if (!viewer) return;
  const ok = await viewer.startPreviewCamera();
  if (disposed) return;
  if (!ok) setStatus("Kamera tidak tersedia / izin ditolak — pratinjau 3D tanpa kamera.");
  else if (!arSupported) {
    setStatus(
      "WebXR: tidak didukung perangkat ini. Mode cadangan (orientasi perangkat) tersedia — tekan Mulai AR.",
      false,
      7000
    );
  }
}

function handleAREnded(error?: string): void {
  if (disposed) return;
  closePanel();
  selectAll();
  void startPreviewCamera().then(() => {
    if (!error || disposed) return;
    const fb = viewer?.session.isFallbackActive ?? false;
    setStatus(
      fb ? `WebXR: ${error}. Mode cadangan aktif (orientasi perangkat).` : `Sesi AR gagal dimulai: ${error}. Pratinjau 3D aktif.`
    );
  });
}

btnStartAR.addEventListener("click", () => {
  if (!viewer || arState !== "idle") return;
  arStatus.hidden = true;
  void viewer.session.start();
});

hud.querySelector('[data-act="replace"]')?.addEventListener("click", () => viewer?.session.replace());
hud.querySelector('[data-act="reset"]')?.addEventListener("click", () => viewer?.resetView());
hud.querySelector('[data-act="exit"]')?.addEventListener("click", () => viewer?.session.end());

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

function start(): void {
  viewer = createViewer(canvasContainer, viewport, {
    onProgress: (done, total) => {
      loading.textContent = `Memuat model 3D… ${done}/${total}`;
    },
    onError: (message) => setStatus(`${message}. Kotak penanda dipakai sementara.`),
    onReady: () => {
      loading.remove();
      if (!viewer) return;
      hotspots = new HotspotLayer({
        viewport,
        canvas: canvasContainer,
        viewer,
        onSelect: (id) => selectModel(id),
        getBounds: () => ({
          top: insets.top,
          bottom: canvasContainer.clientHeight - insets.bottom,
          left: insets.left,
          right: canvasContainer.clientWidth - insets.right,
        }),
        isActive: () => !(viewer?.sm.arMode && arState !== "placed"),
      });
      updateInsets(false);
      syncUi();
      void startPreviewCamera();
    },
    onModelPick: (id) => selectModel(id),
    // a drag that starts on an unselected model selects it (no panel while dragging)
    onAutoSelect: () => syncUi(),
    onFrame: () => hotspots?.update(),
    onARState: handleARState,
    onAREnded: handleAREnded,
    onARInfo: (info) => console.debug("MODUL9 AR:", info.mode, info.note ?? "", info.reason ?? "", `${info.widthM.toFixed(2)} m`),
  });

  // Development-only inspection hook (removed from production builds by Vite).
  if (import.meta.env.DEV) (window as unknown as { __viewer?: Viewer }).__viewer = viewer;

  void viewer.isARSupported().then((ok) => {
    arSupported = ok;
    btnStartAR.disabled = false;
    btnStartAR.title = ok ? "" : "WebXR tidak didukung — mode cadangan (orientasi perangkat) akan dipakai.";
  });
  syncUi();
  window.addEventListener("resize", () => updateInsets(false));
  window.addEventListener("orientationchange", () => setTimeout(() => updateInsets(false), 250));
}

window.addEventListener("pagehide", () => {
  disposed = true;
  hotspots?.dispose();
  viewer?.dispose();
});

start();
