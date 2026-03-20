"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";

interface VennNode {
  id: string;
  label: string;
  description?: string;
  children?: VennNode[];
}

interface VennRelation {
  sets: string[];
  label?: string;
  sharedConcepts: string[];
}

interface VennData {
  title?: string;
  summary?: string;
  nodes: VennNode[];
  relations: VennRelation[];
}

interface Props {
  data: VennData;
}

interface SelectionInfo {
  node: VennNode;
  parentNode?: VennNode;
  colorIndex: number;
}

const FILLS = [
  "hsl(210, 70%, 35%)",
  "hsl(340, 65%, 38%)",
  "hsl(150, 55%, 30%)",
  "hsl(45, 70%, 35%)",
  "hsl(270, 55%, 38%)",
];

const HSL_VALUES: [number, number, number][] = [
  [210, 70, 35],
  [340, 65, 38],
  [150, 55, 30],
  [45, 70, 35],
  [270, 55, 38],
];

const STROKES = [
  "hsl(210, 80%, 50%)",
  "hsl(340, 75%, 52%)",
  "hsl(150, 65%, 45%)",
  "hsl(45, 80%, 50%)",
  "hsl(270, 65%, 52%)",
];

const TEXT_COLORS = [
  "hsl(210, 100%, 88%)",
  "hsl(340, 100%, 90%)",
  "hsl(150, 90%, 85%)",
  "hsl(45, 100%, 88%)",
  "hsl(270, 100%, 90%)",
];

const CSS_COLORS = [
  "#93c5fd", "#f9a8d4", "#86efac", "#fde047", "#d8b4fe",
];

function countDescendants(node: VennNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countDescendants(c), 0);
}

function blendHSL(ci1: number, ci2: number): string {
  const [h1, s1, l1] = HSL_VALUES[ci1 % HSL_VALUES.length];
  const [h2, s2, l2] = HSL_VALUES[ci2 % HSL_VALUES.length];
  let hDiff = h2 - h1;
  if (hDiff > 180) hDiff -= 360;
  if (hDiff < -180) hDiff += 360;
  let hAvg = h1 + hDiff / 2;
  if (hAvg < 0) hAvg += 360;
  const sAvg = (s1 + s2) / 2;
  const lAvg = (l1 + l2) / 2 + 5;
  return `hsl(${Math.round(hAvg)}, ${Math.round(sAvg)}%, ${Math.round(lAvg)}%)`;
}

function blendTextColor(ci1: number, ci2: number): string {
  const [h1, s1] = HSL_VALUES[ci1 % HSL_VALUES.length];
  const [h2, s2] = HSL_VALUES[ci2 % HSL_VALUES.length];
  let hDiff = h2 - h1;
  if (hDiff > 180) hDiff -= 360;
  if (hDiff < -180) hDiff += 360;
  let hAvg = h1 + hDiff / 2;
  if (hAvg < 0) hAvg += 360;
  const sAvg = Math.min(100, (s1 + s2) / 2 + 20);
  return `hsl(${Math.round(hAvg)}, ${Math.round(sAvg)}%, 88%)`;
}

function lensPath(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): string | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= r1 + r2 || d <= Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const mx = x1 + a * dx / d;
  const my = y1 + a * dy / d;
  const ix1 = mx + h * dy / d;
  const iy1 = my - h * dx / d;
  const ix2 = mx - h * dy / d;
  const iy2 = my + h * dx / d;
  const largeArc1 = d < r1 ? 1 : 0;
  const largeArc2 = d < r2 ? 1 : 0;
  return [
    `M ${ix1} ${iy1}`,
    `A ${r1} ${r1} 0 ${largeArc1} 1 ${ix2} ${iy2}`,
    `A ${r2} ${r2} 0 ${largeArc2} 1 ${ix1} ${iy1}`,
    "Z",
  ].join(" ");
}

export default function VennDiagram({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBorders, setShowBorders] = useState(false);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const zoomedInRef = useRef(false);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !data) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const tooltipEl = d3.select("#venn-tooltip");

    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "float-shadow")
      .attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 6).attr("stdDeviation", 12).attr("flood-color", "rgba(0,0,0,0.6)");

    const g = svg.append("g");
    const circleContainer = g.append("g");
    const lensLayer = g.append("g");
    const childOverlay = g.append("g");
    const selectLayer = g.append("g");

    // Title layer — on top of everything, fixed position (not affected by zoom)
    const titleLayer = svg.append("g").attr("pointer-events", "none");
    if (data.title) {
      titleLayer.append("text")
        .attr("x", width / 2).attr("y", 20)
        .attr("text-anchor", "middle").attr("dominant-baseline", "hanging")
        .attr("fill", "hsl(0, 0%, 90%)").attr("font-size", "20px").attr("font-weight", "800")
        .text(data.title);
    }
    if (data.summary) {
      titleLayer.append("text")
        .attr("x", width / 2).attr("y", data.title ? 46 : 20)
        .attr("text-anchor", "middle").attr("dominant-baseline", "hanging")
        .attr("fill", "hsl(0, 0%, 50%)").attr("font-size", "11px").attr("font-weight", "400")
        .text(data.summary);
    }

    let currentScale = 0.85;
    const CHILD_SHOW_SCALE = 2.5;
    const GRANDCHILD_SHOW_SCALE = 6;
    let activeId: string | null = null;
    let expandedChildId: string | null = null; // Track which child's grandchildren are visible
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    let lastZoomTarget: { level: number; parentId?: string; x: number; y: number; spread: number } | null = null;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 15])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        currentScale = event.transform.k;
        updateVisibility();
      });

    svg.call(zoom).on("dblclick.zoom", null);

    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.35;
    const nodeCount = data.nodes.length;

    interface NodePos {
      id: string; x: number; y: number; r: number;
      node: VennNode; colorIndex: number;
    }

    // Build a set of pairs that have relations
    const relatedPairs = new Set<string>();
    data.relations.forEach((rel) => {
      for (let a = 0; a < rel.sets.length; a++)
        for (let b = a + 1; b < rel.sets.length; b++)
          relatedPairs.add([rel.sets[a], rel.sets[b]].sort().join("|"));
    });

    // First pass: compute radii
    const totalWeight = data.nodes.reduce((s, n) => s + countDescendants(n), 0);
    const radii = data.nodes.map((node) => {
      const weight = countDescendants(node);
      return baseRadius * 0.5 + baseRadius * 0.3 * (weight / totalWeight) * nodeCount;
    });

    // Determine spread so that ALL related pairs geometrically overlap
    // For pairs at angle θ apart, distance = 2*spread*sin(θ/2)
    // Need distance < r1 + r2 for overlap → spread < (r1+r2) / (2*sin(θ/2))
    let spread = nodeCount <= 2 ? baseRadius * 0.7 : baseRadius * 0.85;
    data.relations.forEach((rel) => {
      for (let a = 0; a < rel.sets.length; a++) {
        for (let b = a + 1; b < rel.sets.length; b++) {
          const idxA = data.nodes.findIndex(n => n.id === rel.sets[a]);
          const idxB = data.nodes.findIndex(n => n.id === rel.sets[b]);
          if (idxA < 0 || idxB < 0) continue;
          const angleA = (2 * Math.PI * idxA) / nodeCount - Math.PI / 2;
          const angleB = (2 * Math.PI * idxB) / nodeCount - Math.PI / 2;
          const halfAngle = Math.abs(angleB - angleA) / 2;
          const sinHalf = Math.sin(halfAngle) || 0.01;
          const rSum = radii[idxA] + radii[idxB];
          // Need 2*spread*sinHalf < rSum * 0.85 (0.85 to ensure visible overlap)
          const maxSpread = (rSum * 0.85) / (2 * sinHalf);
          spread = Math.min(spread, maxSpread);
        }
      }
    });

    const topPositions: NodePos[] = [];
    data.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      const x = cx + Math.cos(angle) * spread;
      const y = cy + Math.sin(angle) * spread;
      topPositions.push({ id: node.id, x, y, r: radii[i], node, colorIndex: i });
    });

    const relationMap = new Map<string, VennRelation>();
    data.relations.forEach((rel) => {
      for (let a = 0; a < rel.sets.length; a++) {
        for (let b = a + 1; b < rel.sets.length; b++) {
          relationMap.set([rel.sets[a], rel.sets[b]].sort().join("|"), rel);
        }
      }
    });

    interface GrandchildInfo {
      group: d3.Selection<SVGGElement, unknown, null, undefined>;
      label: d3.Selection<SVGTextElement, unknown, null, undefined>;
      center: { x: number; y: number; spread: number };
    }

    const grandchildMap = new Map<string, GrandchildInfo>();

    const circleGroupMap = new Map<string, {
      group: d3.Selection<SVGGElement, unknown, null, undefined>;
      circle: d3.Selection<SVGCircleElement, unknown, null, undefined>;
      childGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null;
      label: d3.Selection<SVGTextElement, unknown, null, undefined>;
      pos: NodePos;
      childCenter: { x: number; y: number; spread: number } | null;
    }>();

    topPositions.forEach((pos, idx) => {
      const { id, x, y, r, colorIndex, node } = pos;
      const ci = colorIndex % FILLS.length;

      const group = circleContainer.append("g")
        .style("transition", "opacity 0.3s, filter 0.3s")
        .style("transform-origin", `${x}px ${y}px`);

      const circle = group.append("circle")
        .attr("cx", x).attr("cy", y).attr("r", r)
        .attr("fill", FILLS[ci]).attr("stroke", STROKES[ci]).attr("stroke-width", 2)
        .style("cursor", "pointer").style("transition", "r 0.3s, stroke-width 0.3s");

      // ── Children layout ──
      let childGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
      let childCenter: { x: number; y: number; spread: number } | null = null;

      if (node.children && node.children.length > 0) {
        const childCount = node.children.length;
        const [ch, cs, cl] = HSL_VALUES[ci];

        let childR: number, positions: { cx: number; cy: number; leafR?: number }[];

        if (showBorders) {
          // ── Borders mode: horizontal grid inside parent circle ──
          // 2→横排, 3→上2下1三角, 4+→每行3个网格
          const cols = childCount <= 2 ? childCount : childCount === 3 ? 2 : 3;
          const rowCount = Math.ceil(childCount / cols);
          // Size to fit inside parent with padding
          const maxRByWidth = (r * 1.7) / (cols * 2.4);
          const maxRByHeight = (r * 1.5) / (rowCount * 2.6);
          childR = Math.min(maxRByWidth, maxRByHeight, r * 0.36);
          const gap = childR * 0.4;

          childGroup = group.append("g").attr("opacity", 1);

          // Label placed on the outward side of parent circle (relative to diagram center)
          const dirX = x - cx; const dirY = y - cy;
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
          const normX = dirX / dirLen; const normY = dirY / dirLen;
          // Determine dominant direction for anchor/baseline
          const isMainlyHorizontal = Math.abs(normX) > Math.abs(normY);
          let labelX: number, labelY: number, anchor: string, baseline: string;
          if (isMainlyHorizontal) {
            // Left or right
            labelX = x + (normX > 0 ? r + 10 : -r - 10);
            labelY = y;
            anchor = normX > 0 ? "start" : "end";
            baseline = "middle";
          } else {
            // Top or bottom
            labelX = x;
            labelY = y + (normY > 0 ? r + 20 : -r - 10);
            anchor = "middle";
            baseline = normY > 0 ? "hanging" : "auto";
          }
          const sideLabel = group.append("text")
            .attr("x", labelX).attr("y", labelY)
            .attr("text-anchor", anchor).attr("dominant-baseline", baseline)
            .attr("fill", TEXT_COLORS[ci]).attr("font-size", "18px").attr("font-weight", "800")
            .attr("pointer-events", "none").attr("opacity", 1)
            .attr("stroke", FILLS[ci]).attr("stroke-width", 3).attr("paint-order", "stroke")
            .text(node.label);
          // Colored accent line under the label
          const labelBBox = (sideLabel.node() as SVGTextElement).getBBox?.();
          if (labelBBox) {
            const lineY = labelBBox.y + labelBBox.height + 2;
            group.append("line")
              .attr("x1", labelBBox.x).attr("x2", labelBBox.x + labelBBox.width)
              .attr("y1", lineY).attr("y2", lineY)
              .attr("stroke", STROKES[ci]).attr("stroke-width", 2.5)
              .attr("opacity", 0.7).attr("pointer-events", "none");
          }

          // Calculate away direction from intersection areas
          let awayAngle = 0;
          const others = topPositions.filter((_, j) => j !== idx);
          if (others.length > 0) {
            let avgDx = 0, avgDy = 0;
            others.forEach((o) => {
              const dx2 = o.x - x; const dy2 = o.y - y;
              const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
              avgDx += dx2 / dist; avgDy += dy2 / dist;
            });
            awayAngle = Math.atan2(-avgDy, -avgDx);
          }

          // Separate children: those with grandchildren (grid centered) vs leaf children (pushed away)
          const withGC: number[] = [];
          const leafOnly: number[] = [];
          node.children!.forEach((child, i) => {
            if (child.children && child.children.length > 0) withGC.push(i);
            else leafOnly.push(i);
          });

          positions = new Array(childCount);

          // Away-axis unit vector (perpendicular to the "toward others" direction)
          const awayX = Math.cos(awayAngle);
          const awayY = Math.sin(awayAngle);
          // Perpendicular axis for spreading children
          const perpX = -awayY;
          const perpY = awayX;

          // Layout children WITH grandchildren: distribute along perp axis, centered in parent
          if (withGC.length > 0) {
            const nGC = withGC.length;
            const totalGCLen = nGC * childR * 2 + (nGC - 1) * gap;
            const startGC = -totalGCLen / 2 + childR;
            for (let gi = 0; gi < nGC; gi++) {
              const offset = startGC + gi * (childR * 2 + gap);
              positions[withGC[gi]] = { cx: x + perpX * offset, cy: y + perpY * offset };
            }
          }

          // Layout LEAF children: smaller, pushed along away-axis toward edge
          if (leafOnly.length > 0) {
            const leafR = Math.min(childR * 0.45, r * 0.12);
            const leafGap2 = leafR * 0.8;
            const nLeaf = leafOnly.length;
            const totalLeafLen = nLeaf * leafR * 2 + (nLeaf - 1) * leafGap2;
            const leafHalfLen = totalLeafLen / 2;
            // Push center along away direction, clamp inside parent
            const leafOffsetDist = Math.min(r * 0.55, r - leafHalfLen - leafR - 2);
            const leafCX = x + awayX * leafOffsetDist;
            const leafCY = y + awayY * leafOffsetDist;
            const startLeaf = -totalLeafLen / 2 + leafR;
            for (let li = 0; li < nLeaf; li++) {
              const offset = startLeaf + li * (leafR * 2 + leafGap2);
              positions[leafOnly[li]] = { cx: leafCX + perpX * offset, cy: leafCY + perpY * offset, leafR };
            }
          }
        } else {
          // ── Clean mode: away from other circles ──
          childR = r * 0.12 * Math.min(1, 3 / childCount);
          const gap = childR * 0.6;

          let awayAngle = 0;
          const others = topPositions.filter((_, j) => j !== idx);
          if (others.length > 0) {
            let avgDx = 0, avgDy = 0;
            others.forEach((o) => {
              const dx = o.x - x; const dy = o.y - y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              avgDx += dx / dist; avgDy += dy / dist;
            });
            awayAngle = Math.atan2(-avgDy, -avgDx);
          }
          const rowCenterX = x + Math.cos(awayAngle) * r * 0.35;
          const rowCenterY = y + Math.sin(awayAngle) * r * 0.35;

          childGroup = group.append("g").attr("opacity", 0);

          const cols = Math.min(childCount, 4);
          const rowCount = Math.ceil(childCount / cols);
          positions = [];
          for (let i = 0; i < childCount; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const colsInRow = row < rowCount - 1 ? cols : childCount - row * cols;
            const rowWidth = colsInRow * childR * 2 + (colsInRow - 1) * gap;
            const sx = -rowWidth / 2 + childR;
            const lx = sx + col * (childR * 2 + gap);
            const ly = (row - (rowCount - 1) / 2) * (childR * 2 + gap);
            positions.push({ cx: rowCenterX + lx, cy: rowCenterY + ly });
          }
        }

        node.children.forEach((child, i) => {
          const posData = positions[i];
          const childX = posData.cx, childY = posData.cy;
          const thisChildR = posData.leafR || childR; // use leafR for leaf children in borders mode
          const childCircleG = childGroup!.append("g").style("cursor", "pointer");

          // Level 2: lighter fill, more saturation contrast
          const childFill = `hsl(${ch}, ${Math.max(cs - 15, 20)}%, ${cl + 18}%)`;
          const hasGC = child.children && child.children.length > 0;
          childCircleG.append("circle")
            .attr("cx", childX).attr("cy", childY).attr("r", thisChildR)
            .attr("fill", childFill)
            .attr("stroke", STROKES[ci]).attr("stroke-width", showBorders ? 1.5 : 1)
            .attr("stroke-dasharray", showBorders ? "4,2" : "none")
            .style("transition", "stroke-width 0.2s");

          const childFontSize = showBorders ? (hasGC ? "10px" : "8px") : "8px";
          // In borders mode: if no grandchildren, label goes inside ellipse; if has grandchildren, label goes above circle
          const childLabelY = showBorders ? (hasGC ? childY - thisChildR - 4 : childY) : childY;
          const childLabel = childCircleG.append("text")
            .attr("x", childX).attr("y", childLabelY)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .attr("fill", TEXT_COLORS[ci])
            .attr("font-size", childFontSize).attr("font-weight", "600")
            .attr("pointer-events", "none")
            .text(child.label);

          if (hasGC) {
            if (!showBorders) {
              childCircleG.append("text")
                .attr("x", childX).attr("y", childY + 10)
                .attr("text-anchor", "middle")
                .attr("fill", TEXT_COLORS[ci])
                .attr("font-size", "6px").attr("opacity", 0.5)
                .attr("pointer-events", "none")
                .attr("class", "grandchild-hint-" + child.id)
                .text(`+${child.children!.length}`);
            }

            // ── Render grandchildren (level 3) ──
            const gcCount = child.children!.length;
            let gcR: number, gcPositions: { cx: number; cy: number }[];

            if (showBorders) {
              // Layout inside child circle
              gcPositions = [];
              if (gcCount === 3) {
                // Triangle: 1 on top, 2 on bottom
                gcR = childR * 0.18;
                const gcCenterY = childY + childR * 0.05;
                const rowGap = gcR * 3.2;
                // Top center
                gcPositions.push({ cx: childX, cy: gcCenterY - rowGap / 2 });
                // Bottom two
                const bottomSpacing = gcR * 5.5;
                gcPositions.push({ cx: childX - bottomSpacing / 2, cy: gcCenterY + rowGap / 2 });
                gcPositions.push({ cx: childX + bottomSpacing / 2, cy: gcCenterY + rowGap / 2 });
              } else {
                const gcCols = gcCount <= 2 ? gcCount : 3;
                const gcRows = Math.ceil(gcCount / gcCols);
                const maxGcRW = (childR * 1.5) / (gcCols * 2.6);
                const maxGcRH = (childR * 1.1) / (gcRows * 2.8);
                gcR = Math.min(maxGcRW, maxGcRH, childR * 0.26);
                const gcGap = gcR * 2.0;
                const gcCenterY = childY + childR * 0.12;
                for (let gi = 0; gi < gcCount; gi++) {
                  const grow = Math.floor(gi / gcCols);
                  const gcol = gi % gcCols;
                  const gColsInRow = grow < gcRows - 1 ? gcCols : gcCount - grow * gcCols;
                  const gRowWidth = gColsInRow * gcR * 2 + (gColsInRow - 1) * gcGap;
                  const gsx = -gRowWidth / 2 + gcR;
                  const glx = gsx + gcol * (gcR * 2 + gcGap);
                  const gly = (grow - (gcRows - 1) / 2) * (gcR * 2 + gcGap);
                  gcPositions.push({ cx: childX + glx, cy: gcCenterY + gly });
                }
              }
            } else {
              gcPositions = [];
              if (gcCount === 3) {
                // Triangle: 1 on top, 2 on bottom
                gcR = childR * 0.22;
                const rowGap = gcR * 2.8;
                gcPositions.push({ cx: childX, cy: childY - rowGap / 2 });
                const bottomSpacing = gcR * 5.2;
                gcPositions.push({ cx: childX - bottomSpacing / 2, cy: childY + rowGap / 2 });
                gcPositions.push({ cx: childX + bottomSpacing / 2, cy: childY + rowGap / 2 });
              } else {
                gcR = childR * 0.3 * Math.min(1, 3 / gcCount);
                const gcGap = gcR * 1.0;
                const gcCols = Math.min(gcCount, 3);
                const gcRows = Math.ceil(gcCount / gcCols);
                for (let gi = 0; gi < gcCount; gi++) {
                  const grow = Math.floor(gi / gcCols);
                  const gcol = gi % gcCols;
                  const gColsInRow = grow < gcRows - 1 ? gcCols : gcCount - grow * gcCols;
                  const gRowWidth = gColsInRow * gcR * 2 + (gColsInRow - 1) * gcGap;
                  const gsx = -gRowWidth / 2 + gcR;
                  const glx = gsx + gcol * (gcR * 2 + gcGap);
                  const gly = (grow - (gcRows - 1) / 2) * (gcR * 2 + gcGap);
                  gcPositions.push({ cx: childX + glx, cy: childY + gly });
                }
              }
            }

            const gcGroup = childCircleG.append("g").attr("opacity", showBorders ? 1 : 0);

            child.children!.forEach((gc, gi) => {
              const { cx: gcX, cy: gcY } = gcPositions[gi];
              const gcCircleG = gcGroup.append("g").style("cursor", "pointer");

              // Level 3: even lighter, less saturated
              const gcFill = `hsl(${ch}, ${Math.max(cs - 25, 15)}%, ${cl + 30}%)`;
              gcCircleG.append("circle")
                .attr("cx", gcX).attr("cy", gcY).attr("r", gcR)
                .attr("fill", gcFill)
                .attr("stroke", STROKES[ci]).attr("stroke-width", showBorders ? 1 : 0.5)
                .attr("stroke-dasharray", showBorders ? "2,1" : "none");

              const gcFontSize = showBorders ? Math.min(7, gcR * 0.8) + "px" : "4px";
              gcCircleG.append("text")
                .attr("x", gcX).attr("y", gcY)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .attr("fill", TEXT_COLORS[ci])
                .attr("font-size", gcFontSize).attr("font-weight", "600")
                .attr("pointer-events", "none")
                .text(gc.label);

              gcCircleG.on("click", (event) => {
                event.stopPropagation();
                setSelection({ node: gc, parentNode: child, colorIndex });
              });
            });

            // Grandchild center for zoom
            let gcSumX = 0, gcSumY = 0, gcMaxDist = 0;
            gcPositions.forEach(({ cx: px, cy: py }) => {
              gcSumX += px; gcSumY += py;
              const gd = Math.sqrt((px - childX) ** 2 + (py - childY) ** 2) + gcR;
              if (gd > gcMaxDist) gcMaxDist = gd;
            });
            grandchildMap.set(child.id, {
              group: gcGroup,
              label: childLabel,
              center: { x: gcSumX / gcCount, y: gcSumY / gcCount, spread: Math.max(gcMaxDist, gcR * 2) },
            });
          }

          // Click child circle to show its note card, delayed to distinguish from dblclick
          childCircleG.on("click", (event) => {
            event.stopPropagation();
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
              setSelection({ node: child, parentNode: node, colorIndex });
              clickTimer = null;
            }, 250);
          });

          // Double-click child circle to zoom into grandchildren
          childCircleG.on("dblclick", (event) => {
            event.stopPropagation();
            if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
            const gcInfo = grandchildMap.get(child.id);
            if (gcInfo) {
              setSelection(null);
              expandedChildId = child.id; // Only expand this child's grandchildren
              lastZoomTarget = { level: 3, parentId: id, x: gcInfo.center.x, y: gcInfo.center.y, spread: gcInfo.center.spread };
              zoomToGrandchild(gcInfo.center.x, gcInfo.center.y, gcInfo.center.spread);
              updateVisibility();
            }
          });
        });

        // Child center for zoom
        let sumX = 0, sumY = 0, maxDist = 0;
        positions.forEach((p) => {
          sumX += p.cx; sumY += p.cy;
          const cr = p.leafR || childR;
          const d = Math.sqrt((p.cx - x) ** 2 + (p.cy - y) ** 2) + cr;
          if (d > maxDist) maxDist = d;
        });
        childCenter = { x: sumX / childCount, y: sumY / childCount, spread: maxDist };
      }

      const hasNestedChildren = showBorders && node.children && node.children.length > 0;
      // In clean mode: label centered in circle
      // In borders mode with children: label on the outward side
      let lbX: number, lbY: number, lbAnchor: string, lbBaseline: string;
      if (hasNestedChildren) {
        const ldx = x - cx; const ldy = y - cy;
        const ldLen = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
        const lnx = ldx / ldLen; const lny = ldy / ldLen;
        const isHoriz = Math.abs(lnx) > Math.abs(lny);
        if (isHoriz) {
          lbX = x + (lnx > 0 ? r + 10 : -r - 10);
          lbY = y;
          lbAnchor = lnx > 0 ? "start" : "end";
          lbBaseline = "middle";
        } else {
          lbX = x;
          lbY = y + (lny > 0 ? r + 20 : -r - 10);
          lbAnchor = "middle";
          lbBaseline = lny > 0 ? "hanging" : "auto";
        }
      } else {
        lbX = x;
        lbY = y;
        lbAnchor = "middle";
        lbBaseline = "middle";
      }
      const label = group.append("text")
        .attr("x", lbX).attr("y", lbY)
        .attr("text-anchor", lbAnchor).attr("dominant-baseline", lbBaseline)
        .attr("fill", TEXT_COLORS[ci])
        .attr("font-size", "18px").attr("font-weight", "700")
        .attr("pointer-events", "none")
        .attr("stroke", FILLS[ci]).attr("stroke-width", 3).attr("paint-order", "stroke")
        .attr("opacity", hasNestedChildren ? 0 : 1)
        .attr("data-hidden", hasNestedChildren ? "true" : "false")
        .text(node.label);

      circleGroupMap.set(id, { group, circle, childGroup, label, pos, childCenter });

      // Click: lift and show panel (only when not zoomed in), delayed to distinguish from dblclick
      group.on("click", (event) => {
        event.stopPropagation();
        if (currentScale >= CHILD_SHOW_SCALE) return;
        if (activeId === id) return;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          activeId = id;
          liftCircle(id);
          setSelection({ node, colorIndex });
          clickTimer = null;
        }, 250);
      });

      // Double click
      group.on("dblclick", (event) => {
        event.stopPropagation();
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }

        if (currentScale >= CHILD_SHOW_SCALE) {
          // Check if hit child
          const [mx, my] = d3.pointer(event, g.node());
          let hitChild = false;
          if (childCenter && node.children) {
            const childCount = node.children.length;
            // Recompute positions (same logic as layout)
            if (showBorders) {
              // Recompute same axis-based layout as rendering
              const cols2 = childCount <= 2 ? childCount : childCount === 3 ? 2 : 3;
              const rowCount2 = Math.ceil(childCount / cols2);
              const maxRW = (r * 1.7) / (cols2 * 2.4);
              const maxRH = (r * 1.5) / (rowCount2 * 2.6);
              const childR2 = Math.min(maxRW, maxRH, r * 0.36);
              const gap2 = childR2 * 0.4;
              let awayAng2 = 0;
              const oth2 = topPositions.filter((_, j) => j !== idx);
              if (oth2.length > 0) {
                let ax3 = 0, ay3 = 0;
                oth2.forEach((o) => { const ddx = o.x-x, ddy=o.y-y, dist=Math.sqrt(ddx*ddx+ddy*ddy)||1; ax3+=ddx/dist; ay3+=ddy/dist; });
                awayAng2 = Math.atan2(-ay3, -ax3);
              }
              const awX=Math.cos(awayAng2), awY=Math.sin(awayAng2);
              const ppX=-awY, ppY=awX;
              const wgc: number[] = [], lf: number[] = [];
              node.children!.forEach((ch2, i2) => { if (ch2.children && ch2.children.length > 0) wgc.push(i2); else lf.push(i2); });
              // Hit-test withGC children (along perp axis, centered)
              if (wgc.length > 0) {
                const tl=wgc.length*childR2*2+(wgc.length-1)*gap2, st=-tl/2+childR2;
                for (let gi=0; gi<wgc.length && !hitChild; gi++) {
                  const off=st+gi*(childR2*2+gap2);
                  const hx=x+ppX*off, hy=y+ppY*off;
                  if ((mx-hx)**2+(my-hy)**2 <= childR2*childR2) hitChild=true;
                }
              }
              // Hit-test leaf children (along perp axis, pushed away)
              if (lf.length > 0) {
                const leafR2=Math.min(childR2*0.45, r*0.12), lg2=leafR2*0.8;
                const tll=lf.length*leafR2*2+(lf.length-1)*lg2, hlf=tll/2;
                const offD=Math.min(r*0.55, r-hlf-leafR2-2);
                const lcx2=x+awX*offD, lcy2=y+awY*offD;
                const stl=-tll/2+leafR2;
                for (let li=0; li<lf.length && !hitChild; li++) {
                  const off=stl+li*(leafR2*2+lg2);
                  const hx=lcx2+ppX*off, hy=lcy2+ppY*off;
                  if ((mx-hx)**2+(my-hy)**2 <= leafR2*leafR2) hitChild=true;
                }
              }
            } else {
              const childR2 = r * 0.12 * Math.min(1, 3 / childCount);
              const gap = childR2 * 0.6;
              let awayAng = 0;
              const oth = topPositions.filter((_, j) => j !== idx);
              if (oth.length > 0) {
                let ax2 = 0, ay2 = 0;
                oth.forEach((o) => { const ddx = o.x-x, ddy=o.y-y, dist=Math.sqrt(ddx*ddx+ddy*ddy)||1; ax2+=ddx/dist; ay2+=ddy/dist; });
                awayAng = Math.atan2(-ay2, -ax2);
              }
              const rcx = x + Math.cos(awayAng)*r*0.35, rcy = y + Math.sin(awayAng)*r*0.35;
              const cols = Math.min(childCount, 4), rows2 = Math.ceil(childCount/cols);
              for (let i2=0; i2<childCount; i2++) {
                const row=Math.floor(i2/cols), col=i2%cols;
                const colsInRow = row<rows2-1?cols:childCount-row*cols;
                const rw=colsInRow*childR2*2+(colsInRow-1)*gap, sx=-rw/2+childR2;
                const lxx=sx+col*(childR2*2+gap), lyy=(row-(rows2-1)/2)*(childR2*2+gap);
                if ((mx-(rcx+lxx))**2+(my-(rcy+lyy))**2 <= childR2*childR2) { hitChild=true; break; }
              }
            }
          }
          if (!hitChild) {
            activeId = null; setSelection(null); resetAllCircles();
            expandedChildId = null; // Clear expanded child when stepping back
            // Step back one level
            if (currentScale >= GRANDCHILD_SHOW_SCALE && lastZoomTarget?.level === 3 && lastZoomTarget.parentId) {
              const entry = circleGroupMap.get(lastZoomTarget.parentId);
              if (entry?.childCenter) {
                lastZoomTarget = { level: 2, parentId: lastZoomTarget.parentId, x: entry.childCenter.x, y: entry.childCenter.y, spread: entry.childCenter.spread };
                zoomToCircle(entry.childCenter.x, entry.childCenter.y, entry.childCenter.spread, true);
                return;
              }
            }
            lastZoomTarget = null;
            const s = 0.85;
            svg.transition().duration(750).ease(d3.easeCubicInOut)
              .call(zoom.transform, d3.zoomIdentity.translate(width*(1-s)/2, height*(1-s)/2).scale(s));
            return;
          }
        }

        activeId = null; expandedChildId = null; setSelection(null); resetAllCircles(); zoomedInRef.current = true;
        const entry = circleGroupMap.get(id);
        if (entry?.childCenter) {
          lastZoomTarget = { level: 2, parentId: id, x: entry.childCenter.x, y: entry.childCenter.y, spread: entry.childCenter.spread };
          zoomToCircle(entry.childCenter.x, entry.childCenter.y, entry.childCenter.spread, true);
        } else {
          lastZoomTarget = null;
          zoomToCircle(x, y, r, true);
        }
      });
    });

    // ── Lift / dim ──
    function liftCircle(id: string) {
      lensLayer.style("opacity", "0").style("pointer-events", "none");
      circleGroupMap.forEach((entry, key) => {
        if (key === id) {
          circleContainer.node()!.appendChild(entry.group.node()!);
          g.node()!.appendChild(selectLayer.node()!);
          entry.group.style("filter", "url(#float-shadow)").style("opacity", "1");
          entry.circle.transition().duration(250).attr("r", entry.pos.r * 1.04).attr("stroke-width", 3);
        } else {
          entry.group.style("opacity", "0.25").style("filter", "none");
          entry.circle.transition().duration(250).attr("r", entry.pos.r).attr("stroke-width", 2);
        }
      });
    }

    function resetAllCircles() {
      lensLayer.style("opacity", "1").style("pointer-events", "auto");
      circleGroupMap.forEach((entry) => {
        entry.group.style("opacity", "1").style("filter", "none");
        entry.circle.transition().duration(250).attr("r", entry.pos.r).attr("stroke-width", 2);
      });
    }

    // ── Intersection lenses ──
    for (let a = 0; a < topPositions.length; a++) {
      for (let b = a + 1; b < topPositions.length; b++) {
        const p1 = topPositions[a]; const p2 = topPositions[b];
        const path = lensPath(p1.x, p1.y, p1.r, p2.x, p2.y, p2.r);
        if (!path) continue;

        const pairKey = [p1.id, p2.id].sort().join("|");
        const rel = relationMap.get(pairKey);
        const hasMeaning = rel && rel.sharedConcepts.length > 0;
        const fillColor = hasMeaning ? blendHSL(p1.colorIndex, p2.colorIndex) : "none";

        const lensG = lensLayer.append("g").style("cursor", hasMeaning ? "pointer" : "default");
        lensG.append("path").attr("d", path).attr("fill", fillColor)
          .attr("stroke", !hasMeaning && showBorders ? "hsla(0,0%,100%,0.2)" : "none")
          .attr("stroke-width", !hasMeaning && showBorders ? 1.5 : 0)
          .attr("stroke-dasharray", !hasMeaning && showBorders ? "6,4" : "none");

        if (hasMeaning) {
          // Compute lens geometric center (weighted toward the smaller circle)
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          const a1 = (p1.r*p1.r - p2.r*p2.r + d*d) / (2*d);
          const hh = Math.sqrt(Math.max(0, p1.r*p1.r - a1*a1));
          const lensCenterX = p1.x + (a1/d)*dx;
          const lensCenterY = p1.y + (a1/d)*dy;

          const mixedFill = blendHSL(p1.colorIndex, p2.colorIndex);
          const mixedTextColor = blendTextColor(p1.colorIndex, p2.colorIndex);

          const concepts = rel!.sharedConcepts;

          // ── Lens long axis (perpendicular to circle-center line) ──
          const lensWidth = hh * 2;
          const longX = -dy / d;
          const longY = dx / d;
          const labelText = rel!.label || concepts[0] || "";
          const n = concepts.length;

          // Concept circles along long axis (label placed outside)
          const maxTotalLen = lensWidth * 0.8;
          const conceptR = Math.min(maxTotalLen / (n * 2.8), 14);
          const conceptGap = conceptR * 0.8;
          const totalLen = n * conceptR * 2 + (n - 1) * conceptGap;
          const startOffset = -totalLen / 2 + conceptR;

          let slotIdx = 0;

          // Label outside the lens — toward the outward direction from diagram center
          if (labelText) {
            const outDx = lensCenterX - cx;
            const outDy = lensCenterY - cy;
            const outLen = Math.sqrt(outDx * outDx + outDy * outDy) || 1;
            const outNx = outDx / outLen;
            const outNy = outDy / outLen;
            // Place label outside lens along outward direction
            const labelDist = Math.min(p1.r, p2.r) * 0.45;
            const llX = lensCenterX + outNx * labelDist;
            const llY = lensCenterY + outNy * labelDist;
            lensG.append("text")
              .attr("x", llX).attr("y", llY)
              .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
              .attr("fill", mixedTextColor)
              .attr("font-size", "11px").attr("font-weight", "700")
              .attr("pointer-events", "none")
              .attr("opacity", 0.9)
              .attr("stroke", mixedFill).attr("stroke-width", 2.5).attr("paint-order", "stroke")
              .text(labelText);
          }

          // Concept sub-circles along remaining slots
          if (n > 0) {
            const conceptGroup = lensG.append("g")
              .attr("opacity", showBorders ? 1 : 0)
              .attr("class", "lens-concepts");

            concepts.forEach((concept) => {
              const cOff = startOffset + slotIdx * (conceptR * 2 + conceptGap);
              const ccx = lensCenterX + longX * cOff;
              const ccy = lensCenterY + longY * cOff;

              conceptGroup.append("circle")
                .attr("cx", ccx).attr("cy", ccy).attr("r", conceptR)
                .attr("fill", mixedFill).attr("stroke", mixedTextColor)
                .attr("stroke-width", 0.8).attr("opacity", 0.7);
              conceptGroup.append("text")
                .attr("x", ccx).attr("y", ccy)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .attr("fill", mixedTextColor)
                .attr("font-size", Math.min(9, conceptR * 0.8) + "px").attr("font-weight", "600")
                .attr("pointer-events", "none")
                .text(concept);
              slotIdx++;
            });
          }

          const highlight = lensG.append("path").attr("d", path)
            .attr("fill", "hsla(0,0%,100%,0)").attr("stroke", "hsla(0,0%,100%,0)")
            .attr("stroke-width", 2).style("transition", "fill 0.2s, stroke 0.2s")
            .style("pointer-events", "none");

          lensG.on("click", (event) => {
            event.stopPropagation();
            const isVisible = tooltipEl.style("display") === "block" && tooltipEl.attr("data-pair") === pairKey;
            if (isVisible) {
              tooltipEl.style("display", "none").attr("data-pair", "");
              highlight.attr("fill", "hsla(0,0%,100%,0)").attr("stroke", "hsla(0,0%,100%,0)");
            } else {
              highlight.attr("fill", "hsla(0,0%,100%,0.12)").attr("stroke", "hsla(0,0%,100%,0.4)");
              tooltipEl.style("display", "block").attr("data-pair", pairKey)
                .style("left", event.pageX+14+"px").style("top", event.pageY-10+"px")
                .style("border-color", mixedTextColor)
                .html(`<div style="color:${mixedTextColor};font-weight:700;margin-bottom:4px;font-size:11px">${p1.node.label} ∩ ${p2.node.label}</div>`
                  + concepts.map(c => `<div style="color:${mixedTextColor};padding:2px 0">${c}</div>`).join(""));
            }
          });
          lensG.on("mouseenter", () => {
            highlight.attr("fill", "hsla(0,0%,100%,0.08)").attr("stroke", "hsla(0,0%,100%,0.25)");
          }).on("mouseleave", () => {
            if (tooltipEl.attr("data-pair") !== pairKey) {
              highlight.attr("fill", "hsla(0,0%,100%,0)").attr("stroke", "hsla(0,0%,100%,0)");
            }
          });

          lensG.on("dblclick", (event) => {
            event.stopPropagation();
            zoomToCircle(lensCenterX, lensCenterY, Math.min(p1.r, p2.r)*0.5, false);
          });
        }
      }
    }

    // ── Triple intersections (3-circle overlap) ──
    for (let a = 0; a < topPositions.length; a++) {
      for (let b = a + 1; b < topPositions.length; b++) {
        for (let c = b + 1; c < topPositions.length; c++) {
          const pa = topPositions[a], pb = topPositions[b], pc = topPositions[c];
          const pathAB = lensPath(pa.x, pa.y, pa.r, pb.x, pb.y, pb.r);
          const pathAC = lensPath(pa.x, pa.y, pa.r, pc.x, pc.y, pc.r);
          const pathBC = lensPath(pb.x, pb.y, pb.r, pc.x, pc.y, pc.r);
          if (!pathAB || !pathAC || !pathBC) continue;

          // Draw AB lens clipped to circle C = A∩B∩C
          const tripleId = `triple-${a}-${b}-${c}`;
          const clipC = defs.append("clipPath").attr("id", tripleId);
          clipC.append("circle").attr("cx", pc.x).attr("cy", pc.y).attr("r", pc.r);

          // Blend three colors
          const [h1, s1, l1] = HSL_VALUES[pa.colorIndex % HSL_VALUES.length];
          const [h2, s2, l2] = HSL_VALUES[pb.colorIndex % HSL_VALUES.length];
          const [h3, s3, l3] = HSL_VALUES[pc.colorIndex % HSL_VALUES.length];
          let hSum = 0;
          [h1, h2, h3].forEach((h, i) => {
            let diff = h - h1;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            hSum += h1 + diff;
          });
          let hAvg = hSum / 3;
          if (hAvg < 0) hAvg += 360;
          if (hAvg >= 360) hAvg -= 360;
          const tripleFill = `hsl(${Math.round(hAvg)}, ${Math.round((s1+s2+s3)/3)}%, ${Math.round((l1+l2+l3)/3 + 8)}%)`;

          lensLayer.append("path")
            .attr("d", pathAB)
            .attr("clip-path", `url(#${tripleId})`)
            .attr("fill", tripleFill)
            .attr("stroke", "hsla(0,0%,100%,0.3)")
            .attr("stroke-width", 1);
        }
      }
    }

    // ── Visibility ──
    function updateVisibility() {
      const isZoomed = currentScale >= CHILD_SHOW_SCALE;
      const isDeepZoomed = currentScale >= GRANDCHILD_SHOW_SCALE;

      if (showBorders) {
        // Borders mode: all levels always visible
        circleGroupMap.forEach((entry) => {
          if (entry.childGroup) entry.childGroup.attr("opacity", 1);
          // Don't show center label if it was replaced by top label
          if (entry.label.attr("data-hidden") !== "true") {
            entry.label.attr("opacity", 1);
          }
        });
        grandchildMap.forEach((info) => {
          info.group.attr("opacity", 1);
          info.label.attr("opacity", 1);
        });
        svg.selectAll("[class^='grandchild-hint-']").attr("opacity", 0);
      } else {
        // Clean mode: progressive zoom reveal
        const childOpacity = isZoomed ? Math.min(1, (currentScale-CHILD_SHOW_SCALE)/1) : 0;
        circleGroupMap.forEach((entry) => { if (entry.childGroup) entry.childGroup.attr("opacity", childOpacity); });

        const labelOpacity = isZoomed ? Math.max(0.03, 1-(currentScale-CHILD_SHOW_SCALE)/0.6) : 1;
        circleGroupMap.forEach((entry) => entry.label.attr("opacity", labelOpacity));

        const gcOpacity = isDeepZoomed ? Math.min(1, (currentScale-GRANDCHILD_SHOW_SCALE)/2) : 0;
        grandchildMap.forEach((info, childId) => {
          // Only show grandchildren of the expanded child
          const isExpanded = expandedChildId === childId;
          info.group.attr("opacity", isExpanded ? gcOpacity : 0);
          const childLabelOpacity = isExpanded && isDeepZoomed ? Math.max(0.03, 1-(currentScale-GRANDCHILD_SHOW_SCALE)/1.5) : 1;
          info.label.attr("opacity", childLabelOpacity);
        });
        // Lens concept sub-circles: show when zoomed in
        svg.selectAll(".lens-concepts").attr("opacity", childOpacity);

        if (isDeepZoomed && expandedChildId) {
          // Only hide the hint for the expanded child
          svg.selectAll("[class^='grandchild-hint-']").each(function() {
            const el = d3.select(this);
            const cls = el.attr("class") || "";
            const isExpandedHint = cls === "grandchild-hint-" + expandedChildId;
            el.attr("opacity", isExpandedHint ? 0 : 0.5);
          });
        } else if (isZoomed) {
          svg.selectAll("[class^='grandchild-hint-']").attr("opacity", 0.5);
        }
      }

      zoomedInRef.current = isZoomed;
    }

    function zoomToCircle(tx: number, ty: number, tr: number, showChildren: boolean) {
      const minScale = showChildren ? CHILD_SHOW_SCALE+1.5 : 1;
      const fitScale = Math.min(15, Math.min(width, height)/(tr*2*1.2));
      const targetScale = Math.max(minScale, fitScale);
      svg.transition().duration(750).ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity.translate(width/2-tx*targetScale, height/2-ty*targetScale).scale(targetScale));
    }

    function zoomToGrandchild(tx: number, ty: number, tr: number) {
      const minScale = GRANDCHILD_SHOW_SCALE + 2;
      const fitScale = Math.min(15, Math.min(width, height)/(tr*2*1.2));
      const targetScale = Math.max(minScale, fitScale);
      svg.transition().duration(750).ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity.translate(width/2-tx*targetScale, height/2-ty*targetScale).scale(targetScale));
    }

    svg.on("click", () => {
      // Close lens tooltip
      tooltipEl.style("display", "none").attr("data-pair", "");
      if (activeId) {
        activeId = null; setSelection(null); resetAllCircles();
      }
    });
    svg.on("dblclick", (event) => {
      event.preventDefault();
      activeId = null; expandedChildId = null; setSelection(null); resetAllCircles();

      // Step back one level
      if (currentScale >= GRANDCHILD_SHOW_SCALE && lastZoomTarget?.level === 3 && lastZoomTarget.parentId) {
        // From level 3 → back to level 2
        const entry = circleGroupMap.get(lastZoomTarget.parentId);
        if (entry?.childCenter) {
          lastZoomTarget = { level: 2, parentId: lastZoomTarget.parentId, x: entry.childCenter.x, y: entry.childCenter.y, spread: entry.childCenter.spread };
          zoomToCircle(entry.childCenter.x, entry.childCenter.y, entry.childCenter.spread, true);
          return;
        }
      }

      // From level 2 → back to level 1 (or already at level 1)
      lastZoomTarget = null;
      const s = 0.85;
      svg.transition().duration(750).ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity.translate(width*(1-s)/2, height*(1-s)/2).scale(s));
    });

    const s = 0.85;
    svg.call(zoom.transform, d3.zoomIdentity.translate(width*(1-s)/2, height*(1-s)/2).scale(s));
  }, [data, showBorders]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  const selColor = selection ? CSS_COLORS[selection.colorIndex % CSS_COLORS.length] : "#fff";

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* View toggle */}
      <div className="absolute top-4 right-4 z-10 flex gap-1 bg-gray-900/80 backdrop-blur rounded-lg p-1">
        <button onClick={() => setShowBorders(false)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${!showBorders ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
          简洁
        </button>
        <button onClick={() => setShowBorders(true)}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${showBorders ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
          边框
        </button>
      </div>

      {/* Selection panel */}
      {selection && (
        <div className="absolute top-4 left-4 z-10 w-72 bg-gray-900/95 backdrop-blur border rounded-xl overflow-hidden"
          style={{ borderColor: selColor + "60" }}>
          {/* Header */}
          <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: selColor + "30" }}>
            {selection.parentNode ? (
              <>
                <div className="text-xs text-gray-500 mb-1.5">子概念</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-500">{selection.parentNode.label}</span>
                  <span className="text-gray-600 text-xs">→</span>
                  <span className="text-sm font-bold" style={{ color: selColor }}>{selection.node.label}</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-500 mb-1.5">概念层级</div>
                {selection.node.children && selection.node.children.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-sm font-bold" style={{ color: selColor }}>{selection.node.label}</span>
                    <span className="text-gray-600 text-xs">→</span>
                    {selection.node.children.map((child) => (
                      <span key={child.id} className="text-xs px-1.5 py-0.5 rounded" style={{ color: selColor, background: selColor + "15" }}>
                        {child.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm font-bold" style={{ color: selColor }}>{selection.node.label}</span>
                )}
              </>
            )}
          </div>

          {/* Description */}
          {selection.node.description && (
            <div className="px-4 py-2 border-b text-xs text-gray-400" style={{ borderColor: selColor + "20" }}>
              {selection.node.description}
            </div>
          )}

          {/* Related intersections for top-level nodes */}
          {!selection.parentNode && data.relations.filter(r => r.sets.includes(selection.node.id)).length > 0 && (
            <div className="px-4 py-2 border-b text-xs" style={{ borderColor: selColor + "20" }}>
              <div className="text-gray-500 mb-1.5">交叉领域</div>
              {data.relations.filter(r => r.sets.includes(selection.node.id)).map((rel, ri) => {
                const otherId = rel.sets.find(s => s !== selection.node.id);
                const otherNode = data.nodes.find(n => n.id === otherId);
                const otherIdx = data.nodes.findIndex(n => n.id === otherId);
                const otherColor = otherIdx >= 0 ? CSS_COLORS[otherIdx % CSS_COLORS.length] : "#888";
                return (
                  <div key={ri} className="mb-2 last:mb-0">
                    <div className="flex items-center gap-1 mb-1">
                      <span style={{ color: selColor }}>{selection.node.label}</span>
                      <span className="text-gray-600">∩</span>
                      <span style={{ color: otherColor }}>{otherNode?.label}</span>
                      {rel.label && <span className="text-gray-500 ml-1">— {rel.label}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rel.sharedConcepts.map((c, ci) => (
                        <span key={ci} className="px-1.5 py-0.5 rounded text-gray-300" style={{ background: "hsla(0,0%,100%,0.08)" }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-children list (if child has its own children) */}
          {selection.parentNode && selection.node.children && selection.node.children.length > 0 && (
            <div className="px-4 py-2 border-b text-xs" style={{ borderColor: selColor + "20" }}>
              <div className="text-gray-500 mb-1">下级概念</div>
              <div className="flex flex-wrap gap-1">
                {selection.node.children.map((c) => (
                  <span key={c.id} className="px-1.5 py-0.5 rounded" style={{ color: selColor, background: selColor + "15" }}>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Editable notes */}
          <div className="px-4 py-2">
            <div className="text-xs text-gray-500 mb-1.5">笔记</div>
            <textarea
              value={notes[selection.node.id] || ""}
              onChange={(e) => setNotes({ ...notes, [selection.node.id]: e.target.value })}
              placeholder="在此添加笔记..."
              className="w-full h-24 bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 resize-none focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
            />
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-10 text-xs text-gray-600 bg-gray-900/60 px-2 py-1 rounded">
        单击聚焦 / 双击放大 / 滚轮缩放 / 拖拽移动
      </div>
      <svg ref={svgRef} className="w-full h-full" />
      <div id="venn-tooltip"
        className="fixed bg-gray-900 border border-gray-600 text-xs px-3 py-2 rounded-lg shadow-xl pointer-events-none max-w-xs z-50 leading-relaxed"
        style={{ display: "none" }} />
    </div>
  );
}
