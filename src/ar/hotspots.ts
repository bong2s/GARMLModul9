import * as THREE from "three";

import type { Viewer } from "./engine";

const SVG_NS = "http://www.w3.org/2000/svg";

interface Hotspot {
  id: string;
  dot: HTMLButtonElement;
  label: HTMLButtonElement;
  leader: SVGLineElement;
  smoothedX: number;
  smoothedY: number;
  smoothedVisible: boolean;
  occluded: boolean;
}

export interface HotspotOptions {
  /** Element that contains dots, labels and the leader SVG (position: relative/absolute). */
  viewport: HTMLElement;
  /** The canvas container (defines the projection rectangle). */
  canvas: HTMLElement;
  viewer: Viewer;
  onSelect: (modelId: string) => void;
  /** Free region for labels, px relative to the canvas container. */
  getBounds: () => { top: number; bottom: number; left: number; right: number };
  /** false → hide everything (e.g. while AR is still searching for the placement). */
  isActive: () => boolean;
}

/**
 * Dots, labels and dashed leader lines. Ported from the Modul 6 hotspot layer with
 * these differences: anchors live in each model's own pivot group (so they follow
 * individual moves/rotations/zoom), label size is measured instead of assumed, and the
 * free band is supplied from the real DOM layout instead of fixed pixel constants.
 */
export class HotspotLayer {
  private readonly hotspots: Hotspot[] = [];
  private readonly svg: SVGSVGElement;
  private frame = 0;
  private selected: string | null = null;
  private related = new Set<string>();

  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly boxes = new Map<string, THREE.Box3>();

  constructor(private readonly o: HotspotOptions) {
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("hotspot-leaders");
    o.viewport.appendChild(this.svg);

    for (const part of o.viewer.parts) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "hotspot-dot";
      dot.style.setProperty("--hotspot-color", part.color);
      dot.setAttribute("aria-label", part.label);

      const label = document.createElement("button");
      label.type = "button";
      label.className = "hotspot-label";
      label.style.setProperty("--hotspot-color", part.color);
      label.textContent = part.label;

      const leader = document.createElementNS(SVG_NS, "line");
      leader.classList.add("hotspot-leader");
      leader.setAttribute("stroke", part.color);
      this.svg.appendChild(leader);

      const dispatch = (event: Event) => {
        event.stopPropagation();
        o.onSelect(part.id);
      };
      dot.addEventListener("click", dispatch);
      label.addEventListener("click", dispatch);

      o.viewport.appendChild(dot);
      o.viewport.appendChild(label);
      this.boxes.set(part.id, new THREE.Box3());
      this.hotspots.push({
        id: part.id,
        dot,
        label,
        leader,
        smoothedX: 0,
        smoothedY: 0,
        smoothedVisible: false,
        occluded: false,
      });
    }
  }

  /** Highlight the selected model's hotspot and mute the others. */
  setSelected(id: string | null, related: string[] = []): void {
    this.selected = id;
    this.related = new Set(related);
    for (const h of this.hotspots) {
      const muted = id !== null && h.id !== id && !this.related.has(h.id);
      h.dot.classList.toggle("muted", muted);
      h.label.classList.toggle("muted", muted);
      h.dot.classList.toggle("active", id === h.id);
      h.label.classList.toggle("active", id === h.id);
    }
  }

  update(): void {
    const { viewer, canvas } = this.o;
    const sm = viewer.sm;
    const camera = sm.activeCamera;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || viewer.parts.length === 0) return;

    if (!this.o.isActive()) {
      for (const h of this.hotspots) {
        h.dot.classList.add("offscreen");
        h.label.classList.add("offscreen");
        h.leader.style.opacity = "0";
        h.smoothedVisible = false;
      }
      return;
    }

    this.frame++;
    this.svg.setAttribute("width", String(rect.width));
    this.svg.setAttribute("height", String(rect.height));

    sm.modelRoot.updateMatrixWorld(true);

    // ---- screen box of the models: projected corners of each model's OWN (oriented) box ----
    for (const part of viewer.parts) this.boxes.get(part.id)!.setFromObject(part.group); // occlusion boxes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const corner = new THREE.Vector3();
    for (const part of viewer.parts) {
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? part.half.x : -part.half.x, i & 2 ? part.half.y : -part.half.y, i & 4 ? part.half.z : -part.half.z);
        part.group.localToWorld(corner);
        corner.project(camera);
        const sx = (corner.x * 0.5 + 0.5) * rect.width;
        const sy = (-corner.y * 0.5 + 0.5) * rect.height;
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
    }
    const modelCenterX = (minX + maxX) / 2;
    const modelCenterY = (minY + maxY) / 2;

    const MODEL_MARGIN = 40;
    const bounds = this.o.getBounds();
    const CLAMP_LEFT = bounds.left + 8;
    const CLAMP_RIGHT = Math.max(bounds.right - 8, CLAMP_LEFT + 80);
    const CLAMP_TOP = bounds.top;
    const CLAMP_BOTTOM = Math.max(bounds.bottom, CLAMP_TOP + 40);
    const LERP = 0.2;
    const checkOcclusion = this.frame % 6 === 0;

    interface Placement {
      dotX: number;
      dotY: number;
      targetX: number;
      targetY: number;
      visible: boolean;
      w: number;
      h: number;
    }
    const placements: Placement[] = [];
    const camOrigin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

    for (let i = 0; i < this.hotspots.length; i++) {
      const hotspot = this.hotspots[i];
      const part = viewer.parts[i];
      const w = hotspot.label.offsetWidth || 90;
      const h = hotspot.label.offsetHeight || 26;

      const world = part.anchor.clone();
      part.group.localToWorld(world);

      if (checkOcclusion) {
        const toPoint = world.clone().sub(camOrigin);
        const dist = toPoint.length();
        this.ray.set(camOrigin, toPoint.normalize());
        const margin = Math.max(0.05 * sm.modelRoot.scale.x, dist * 0.01);
        let blocked = false;
        for (const other of viewer.parts) {
          if (other.id === part.id) continue;
          const box = this.boxes.get(other.id)!;
          const hit = this.ray.intersectBox(box, this.hit);
          if (hit && hit.distanceTo(camOrigin) < dist - margin) {
            blocked = true;
            break;
          }
        }
        hotspot.occluded = blocked;
      }

      world.project(camera);
      const dotX = (world.x * 0.5 + 0.5) * rect.width;
      const dotY = (-world.y * 0.5 + 0.5) * rect.height;
      const visible = world.z > -1 && world.z < 1 && Number.isFinite(dotX) && Number.isFinite(dotY);

      let dirX = dotX - modelCenterX;
      let dirY = dotY - modelCenterY;
      const dirLen = Math.hypot(dirX, dirY);
      if (dirLen < 0.001) {
        dirX = 0;
        dirY = -1;
      } else {
        dirX /= dirLen;
        dirY /= dirLen;
      }

      // push the label out of the models' screen box
      let labelX = dotX;
      let labelY = dotY;
      for (let step = 0; step < 60; step++) {
        const outsideX = dirX > 0 ? labelX > maxX + MODEL_MARGIN : labelX < minX - MODEL_MARGIN;
        const outsideY = dirY > 0 ? labelY > maxY + MODEL_MARGIN : labelY < minY - MODEL_MARGIN;
        if (outsideX || outsideY) break;
        labelX += dirX * 12;
        labelY += dirY * 12;
      }

      // models fill the free band: attach to the nearest edge of the band
      const insideX = labelX >= minX - MODEL_MARGIN && labelX <= maxX + MODEL_MARGIN;
      const insideY = labelY >= minY - MODEL_MARGIN && labelY <= maxY + MODEL_MARGIN;
      if (insideX && insideY) {
        const dLeft = Math.abs(dotX - CLAMP_LEFT);
        const dRight = Math.abs(dotX - CLAMP_RIGHT);
        const dTop = Math.abs(dotY - CLAMP_TOP);
        const dBottom = Math.abs(dotY - CLAMP_BOTTOM);
        const nearest = Math.min(dLeft, dRight, dTop, dBottom);
        if (nearest === dLeft) labelX = CLAMP_LEFT + w / 2;
        else if (nearest === dRight) labelX = CLAMP_RIGHT - w / 2;
        else if (nearest === dTop) labelY = CLAMP_TOP + h / 2;
        else labelY = CLAMP_BOTTOM - h / 2;
      }

      labelX = Math.max(CLAMP_LEFT + w / 2, Math.min(CLAMP_RIGHT - w / 2, labelX));
      labelY = Math.max(CLAMP_TOP + h / 2, Math.min(CLAMP_BOTTOM - h / 2, labelY));
      placements.push({ dotX, dotY, targetX: labelX, targetY: labelY, visible, w, h });
    }

    // labels must not overlap each other
    const clampY = (y: number, h: number) => Math.max(CLAMP_TOP + h / 2, Math.min(CLAMP_BOTTOM - h / 2, y));
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        if (!a.visible || !b.visible) continue;
        const overlapX = Math.abs(a.targetX - b.targetX) < (a.w + b.w) / 2 + 4;
        const overlapY = Math.abs(a.targetY - b.targetY) < (a.h + b.h) / 2 + 2;
        if (overlapX && overlapY) {
          if (a.targetY <= b.targetY) b.targetY = a.targetY + (a.h + b.h) / 2 + 4;
          else a.targetY = b.targetY + (a.h + b.h) / 2 + 4;
          a.targetY = clampY(a.targetY, a.h);
          b.targetY = clampY(b.targetY, b.h);
        }
      }
    }

    // apply with smoothing
    const gesture = viewer.isGestureActive();
    for (let i = 0; i < this.hotspots.length; i++) {
      const hotspot = this.hotspots[i];
      const p = placements[i];
      if (!hotspot.smoothedVisible) {
        hotspot.smoothedX = p.targetX;
        hotspot.smoothedY = p.targetY;
      } else {
        hotspot.smoothedX += (p.targetX - hotspot.smoothedX) * LERP;
        hotspot.smoothedY += (p.targetY - hotspot.smoothedY) * LERP;
      }
      hotspot.smoothedVisible = p.visible;

      const dotHalf = (hotspot.dot.offsetWidth || 14) / 2;
      hotspot.dot.style.transform = `translate3d(${p.dotX - dotHalf}px, ${p.dotY - dotHalf}px, 0)`;
      hotspot.label.style.transform = `translate3d(${hotspot.smoothedX - p.w / 2}px, ${hotspot.smoothedY - p.h / 2}px, 0)`;

      hotspot.dot.classList.toggle("offscreen", !p.visible);
      hotspot.label.classList.toggle("offscreen", !p.visible);
      hotspot.dot.classList.toggle("occluded", hotspot.occluded);
      hotspot.label.classList.toggle("gesture-hidden", gesture);

      if (p.visible) {
        hotspot.leader.setAttribute("x1", String(p.dotX));
        hotspot.leader.setAttribute("y1", String(p.dotY));
        hotspot.leader.setAttribute("x2", String(hotspot.smoothedX));
        hotspot.leader.setAttribute("y2", String(hotspot.smoothedY));
        hotspot.leader.style.opacity = gesture ? "0" : this.selected && this.selected !== hotspot.id && !this.related.has(hotspot.id) ? "0.2" : "0.55";
      } else {
        hotspot.leader.style.opacity = "0";
      }
    }
  }

  dispose(): void {
    for (const h of this.hotspots) {
      h.dot.remove();
      h.label.remove();
    }
    this.svg.remove();
    this.hotspots.length = 0;
  }
}
