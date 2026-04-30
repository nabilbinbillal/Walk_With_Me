import { useEffect, useRef, useState } from "react";
import { Joystick, type JoystickDir } from "./Joystick";
import {
  addFootsteps,
  addMessage,
  addProposal,
  isNabilHereSync,
  isNoshinHereSync,
  pingPresence,
  pingWalkPos,
  readGhostMessages,
  readMessages,
  readPresence,
  readWalkPos,
  readWorldScene,
  TIME_PERIODS,
  useStoreSubscribe,
  type TimePeriod,
  type Weather,
  type Theme,
  type WorldScene,
} from "@/lib/store";
import { getWalkPos } from "@/lib/api";

type Mode = "noshin" | "nabil";

type Props = {
  mode: Mode;
  onExit?: () => void;
};

const SPRITE_W = 24;
const SPRITE_H = 32;
const GROUND_Y_RATIO = 0.78;

type SkyPalette = {
  top: string;
  mid: string;
  bottom: string;
  ground: string;
  groundShadow: string;
  hill: string;
  pathDash: string;
};

function paletteFor(time: TimePeriod): SkyPalette {
  switch (time) {
    case "morning":
      return {
        top: "#ffe6c2",
        mid: "#ffc097",
        bottom: "#ff9aa8",
        ground: "#7a3a4a",
        groundShadow: "#5e2c39",
        hill: "#c97e6a",
        pathDash: "#ffd9c2",
      };
    case "noon":
      return {
        top: "#a7d8ff",
        mid: "#cfe9ff",
        bottom: "#ffe7c2",
        ground: "#6e4631",
        groundShadow: "#4d3122",
        hill: "#9a7d54",
        pathDash: "#ffe9c2",
      };
    case "afternoon":
      return {
        top: "#ffd6a2",
        mid: "#ffb47d",
        bottom: "#ff8aa6",
        ground: "#7a3a4a",
        groundShadow: "#5e2c39",
        hill: "#c97e6a",
        pathDash: "#ffd9c2",
      };
    case "evening":
      return {
        top: "#7a4f99",
        mid: "#cf6e93",
        bottom: "#ff8a73",
        ground: "#3d2440",
        groundShadow: "#27172a",
        hill: "#7a3f5c",
        pathDash: "#ffc1c8",
      };
    case "night":
      return {
        top: "#0e1530",
        mid: "#1f254a",
        bottom: "#3e2c5b",
        ground: "#1c1430",
        groundShadow: "#0e0a1d",
        hill: "#3a2c5a",
        pathDash: "#cfb8ff",
      };
  }
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: SkyPalette,
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  // Deterministic star field — twinkles using time.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 70; i++) {
    const sx = (i * 53) % w;
    const sy = (i * 89) % (h * 0.55);
    const tw = 0.6 + 0.4 * Math.sin(t * 0.003 + i);
    const s = Math.max(1, Math.round(tw * 2));
    ctx.globalAlpha = 0.4 + 0.6 * tw;
    ctx.fillRect(sx, sy, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawSunOrMoon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: TimePeriod,
) {
  // Position varies slightly with time of day.
  let cx = w * 0.78;
  let cy = h * 0.28;
  if (time === "morning") cy = h * 0.36;
  if (time === "evening") cy = h * 0.42;
  if (time === "noon") cy = h * 0.18;
  const r = Math.min(w, h) * 0.09;
  if (time === "night") {
    // Moon
    ctx.fillStyle = "#f1ecd0";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // crescent shadow
    ctx.fillStyle = "rgba(14,21,48,0.85)";
    ctx.beginPath();
    ctx.arc(cx + r * 0.45, cy - r * 0.15, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    // glow
    ctx.fillStyle = "rgba(241, 236, 208, 0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#fff2d4";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 230, 200, 0.5)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRainbow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.5;
  const cy = h * 0.95;
  const baseR = Math.min(w, h) * 0.55;
  const colors = ["#ff6b8a", "#ffa64a", "#ffe066", "#7be59a", "#5ec6ff", "#a880ff"];
  ctx.lineWidth = 8;
  for (let i = 0; i < colors.length; i++) {
    ctx.strokeStyle = colors[i];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR - i * 8, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  intense: boolean,
) {
  // tile-based animated rain
  const count = intense ? 140 : 80;
  ctx.strokeStyle = intense ? "rgba(220,230,255,0.85)" : "rgba(220,230,255,0.65)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const seedX = (i * 73) % w;
    const seedY = (i * 47) % h;
    const fall = ((t * 0.6 + seedY) % h);
    const x = (seedX + i * 11) % w;
    ctx.moveTo(x, fall);
    ctx.lineTo(x - 6, fall + 12);
  }
  ctx.stroke();
}

function drawLightning(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  // Flash every ~3.5s for ~120ms
  const phase = (t % 3500) / 3500;
  if (phase > 0.04) return;
  ctx.fillStyle = `rgba(255,255,255,${0.6 - phase * 10})`;
  ctx.fillRect(0, 0, w, h);
  // bolt
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const bx = w * (0.3 + (t % 7) / 9);
  ctx.moveTo(bx, 0);
  ctx.lineTo(bx - 18, h * 0.18);
  ctx.lineTo(bx + 4, h * 0.22);
  ctx.lineTo(bx - 26, h * 0.42);
  ctx.stroke();
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scrollX: number,
) {
  const offset = (scrollX * 0.15) % w;
  ctx.fillStyle = "#ffffff";
  for (let i = -1; i < 3; i++) {
    const baseX = i * (w * 0.55) - offset;
    const baseY = h * (0.16 + 0.07 * (i % 2));
    pixelCloud(ctx, baseX, baseY, 14);
    pixelCloud(ctx, baseX + 200, baseY + 30, 10);
  }
}

function pixelCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
) {
  ctx.fillStyle = "#ffffff";
  const blocks = [
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 1],
    [4, 1],
    [2, -1],
  ];
  for (const [bx, by] of blocks) {
    ctx.fillRect(x + bx * s, y + by * s, s, s);
  }
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scrollX: number,
  pal: SkyPalette,
) {
  const groundY = h * GROUND_Y_RATIO;
  const offset = (scrollX * 0.3) % w;
  ctx.fillStyle = pal.hill;
  for (let i = -1; i < 4; i++) {
    const baseX = i * (w * 0.5) - offset;
    pixelHill(ctx, baseX, groundY, w * 0.5, h * 0.18);
  }
}

function pixelHill(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  width: number,
  height: number,
) {
  const step = 8;
  for (let i = 0; i < width; i += step) {
    const t = i / width;
    const y = groundY - Math.sin(t * Math.PI) * height;
    ctx.fillRect(x + i, y, step, groundY - y);
  }
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scrollX: number,
  pal: SkyPalette,
) {
  const groundY = h * GROUND_Y_RATIO;
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, groundY, w, h - groundY);
  // dashed path lines
  ctx.fillStyle = pal.pathDash;
  const dash = 28;
  const offset = scrollX % (dash * 2);
  for (let x = -offset; x < w; x += dash * 2) {
    ctx.fillRect(x, groundY + (h - groundY) * 0.45, dash, 4);
  }
  // little tufts
  ctx.fillStyle = pal.groundShadow;
  const tuftOffset = scrollX % 60;
  for (let x = -tuftOffset; x < w; x += 60) {
    ctx.fillRect(x, groundY + 8, 4, 4);
    ctx.fillRect(x + 4, groundY + 4, 4, 4);
    ctx.fillRect(x + 8, groundY + 8, 4, 4);
  }
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
) {
  ctx.fillStyle = "#3a1f25";
  ctx.fillRect(x, groundY - 36, 6, 36);
  ctx.fillStyle = "#ff7aa2";
  for (const [bx, by] of [
    [-12, -56],
    [-6, -62],
    [0, -66],
    [6, -62],
    [12, -56],
    [-12, -48],
    [-6, -42],
    [0, -38],
    [6, -42],
    [12, -48],
  ]) {
    ctx.fillRect(x + bx, groundY + by, 8, 8);
  }
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
) {
  ctx.fillStyle = "#3a1f25";
  ctx.fillRect(x + 2, groundY - 8, 2, 8);
  ctx.fillStyle = "#fff5fb";
  ctx.fillRect(x, groundY - 12, 2, 2);
  ctx.fillRect(x + 4, groundY - 12, 2, 2);
  ctx.fillRect(x + 2, groundY - 14, 2, 2);
  ctx.fillRect(x + 2, groundY - 10, 2, 2);
  ctx.fillStyle = "#ffe066";
  ctx.fillRect(x + 2, groundY - 12, 2, 2);
}

function drawScenery(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scrollX: number,
  theme: Theme,
  time: TimePeriod,
) {
  const groundY = h * GROUND_Y_RATIO;

  if (theme === "cherry") {
    const offset = scrollX % (w * 0.8);
    for (let i = -1; i < 4; i++) {
      const baseX = i * (w * 0.4) - offset;
      drawTree(ctx, baseX + 40, groundY);
    }
    const flowerOffset = scrollX % 90;
    for (let x = -flowerOffset; x < w; x += 90) {
      drawFlower(ctx, x, groundY);
    }
  } else if (theme === "garden") {
    // hedges + lots of mixed flowers + a butterfly
    const hedgeOffset = scrollX % 220;
    for (let x = -hedgeOffset; x < w; x += 220) {
      drawHedge(ctx, x, groundY);
    }
    const flowerOffset = scrollX % 32;
    const palette = ["#fff5fb", "#ffe066", "#ffb1d4", "#c5a8ff", "#ffffff"];
    for (let x = -flowerOffset, i = 0; x < w; x += 32, i++) {
      drawFlowerColored(ctx, x, groundY, palette[(i + Math.floor(scrollX / 32)) % palette.length]);
    }
    // butterfly that drifts
    const bx = (w * 0.3 + Math.sin(scrollX * 0.01) * 60);
    const by = h * 0.55 + Math.sin(scrollX * 0.04) * 8;
    drawButterfly(ctx, bx, by);
  } else if (theme === "market") {
    const stallOffset = scrollX % (w * 0.5);
    for (let i = -1; i < 3; i++) {
      const baseX = i * (w * 0.5) - stallOffset;
      drawStall(ctx, baseX + 30, groundY, i % 2 === 0);
    }
    // a few lanterns hanging
    const lanternOffset = scrollX % 110;
    for (let x = -lanternOffset; x < w; x += 110) {
      drawLantern(ctx, x, groundY - 110, time === "night" || time === "evening");
    }
  } else if (theme === "park") {
    const benchOffset = scrollX % (w * 0.45);
    for (let i = -1; i < 3; i++) {
      const baseX = i * (w * 0.45) - benchOffset;
      drawLamp(ctx, baseX + 30, groundY, time === "night" || time === "evening");
      drawBench(ctx, baseX + 160, groundY);
    }
    const flowerOffset = scrollX % 70;
    for (let x = -flowerOffset; x < w; x += 70) {
      drawFlower(ctx, x, groundY);
    }
  }
}

function drawHedge(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  ctx.fillStyle = "#3e7a4a";
  ctx.fillRect(x, groundY - 22, 70, 22);
  ctx.fillStyle = "#5aa365";
  for (let i = 0; i < 70; i += 6) {
    ctx.fillRect(x + i, groundY - 24, 4, 4);
  }
  ctx.fillStyle = "#ffb1d4";
  ctx.fillRect(x + 12, groundY - 26, 3, 3);
  ctx.fillRect(x + 38, groundY - 26, 3, 3);
  ctx.fillRect(x + 56, groundY - 26, 3, 3);
}

function drawFlowerColored(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  color: string,
) {
  ctx.fillStyle = "#3a1f25";
  ctx.fillRect(x + 2, groundY - 8, 2, 8);
  ctx.fillStyle = color;
  ctx.fillRect(x, groundY - 12, 2, 2);
  ctx.fillRect(x + 4, groundY - 12, 2, 2);
  ctx.fillRect(x + 2, groundY - 14, 2, 2);
  ctx.fillRect(x + 2, groundY - 10, 2, 2);
  ctx.fillStyle = "#ffe066";
  ctx.fillRect(x + 2, groundY - 12, 2, 2);
}

function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ff7aa2";
  ctx.fillRect(x, y, 4, 4);
  ctx.fillRect(x + 6, y, 4, 4);
  ctx.fillStyle = "#ffd6e6";
  ctx.fillRect(x - 2, y + 2, 2, 2);
  ctx.fillRect(x + 10, y + 2, 2, 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 4, y + 1, 2, 4);
}

function drawStall(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  altColor: boolean,
) {
  // posts
  ctx.fillStyle = "#3a1f25";
  ctx.fillRect(x, groundY - 60, 4, 60);
  ctx.fillRect(x + 60, groundY - 60, 4, 60);
  // roof — striped
  const a = altColor ? "#d94e7c" : "#4ea3ff";
  const b = "#fff5fb";
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(x + i * 8, groundY - 70, 8, 12);
  }
  // counter
  ctx.fillStyle = "#a06a4a";
  ctx.fillRect(x, groundY - 30, 64, 8);
  // goods (apples / fish)
  ctx.fillStyle = altColor ? "#ff5050" : "#ffd86b";
  ctx.fillRect(x + 6, groundY - 36, 6, 6);
  ctx.fillRect(x + 18, groundY - 36, 6, 6);
  ctx.fillRect(x + 30, groundY - 36, 6, 6);
  ctx.fillRect(x + 42, groundY - 36, 6, 6);
  // sign
  ctx.fillStyle = "#fff5fb";
  ctx.fillRect(x + 18, groundY - 56, 28, 10);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 22, groundY - 52, 4, 2);
  ctx.fillRect(x + 30, groundY - 52, 4, 2);
  ctx.fillRect(x + 38, groundY - 52, 4, 2);
}

function drawLantern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glow: boolean,
) {
  ctx.fillStyle = "#3a1f25";
  ctx.fillRect(x + 4, y, 2, 14);
  ctx.fillStyle = glow ? "#ffd86b" : "#cf8a4a";
  ctx.fillRect(x, y + 14, 10, 10);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, y + 14, 10, 2);
  ctx.fillRect(x, y + 22, 10, 2);
  if (glow) {
    ctx.fillStyle = "rgba(255, 216, 107, 0.35)";
    ctx.beginPath();
    ctx.arc(x + 5, y + 19, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  glow: boolean,
) {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 2, groundY - 60, 4, 60);
  ctx.fillRect(x - 2, groundY - 64, 12, 4);
  ctx.fillStyle = glow ? "#ffe066" : "#cfcfcf";
  ctx.fillRect(x, groundY - 70, 8, 6);
  if (glow) {
    ctx.fillStyle = "rgba(255, 224, 102, 0.3)";
    ctx.beginPath();
    ctx.arc(x + 4, groundY - 67, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  ctx.fillStyle = "#7a4f2c";
  ctx.fillRect(x, groundY - 22, 44, 4);
  ctx.fillRect(x, groundY - 14, 44, 4);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 2, groundY - 10, 3, 10);
  ctx.fillRect(x + 38, groundY - 10, 3, 10);
}

type Character = {
  x: number;
  y: number;
  worldX: number;
  facing: 1 | -1;
  walkFrame: number;
  walking: boolean;
  jumpY: number;
  jumpVy: number;
};

function drawNoshin(
  ctx: CanvasRenderingContext2D,
  c: Character,
) {
  const { x, y, facing, walkFrame, walking } = c;
  const px = (dx: number) => x + (facing === 1 ? dx : SPRITE_W - dx - 2);
  const skin = "#ffd9b8";
  const hair = "#3a1f25";
  const dress = "#ff7aa2";
  const ribbon = "#ff3b6e";
  const ribbonLight = "#ff85a8";
  const shoe = "#3a1f25";
  const eyeC = "#1a1a1a";
  // shadow
  ctx.fillStyle = "rgba(58,31,37,0.35)";
  ctx.fillRect(x - 2, y + SPRITE_H + 2, SPRITE_W + 4, 3);

  // hair back
  ctx.fillStyle = hair;
  ctx.fillRect(x + 4, y + 2, 16, 14);
  ctx.fillRect(x + 2, y + 6, 4, 14);
  ctx.fillRect(x + 18, y + 6, 4, 14);
  // face
  ctx.fillStyle = skin;
  ctx.fillRect(x + 6, y + 8, 12, 10);
  // bangs
  ctx.fillStyle = hair;
  ctx.fillRect(x + 6, y + 8, 12, 4);
  // ribbon (big & visible)
  ctx.fillStyle = ribbon;
  ctx.fillRect(px(2), y + 0, 6, 4);
  ctx.fillRect(px(14), y + 0, 6, 4);
  ctx.fillRect(px(8), y + 2, 6, 2);
  ctx.fillStyle = ribbonLight;
  ctx.fillRect(px(3), y + 1, 2, 2);
  ctx.fillRect(px(15), y + 1, 2, 2);
  // eyes
  ctx.fillStyle = eyeC;
  ctx.fillRect(px(8), y + 12, 2, 2);
  ctx.fillRect(px(14), y + 12, 2, 2);
  // mouth
  ctx.fillRect(px(11), y + 16, 2, 1);
  // dress
  ctx.fillStyle = dress;
  ctx.fillRect(x + 4, y + 18, 16, 10);
  // arms
  ctx.fillStyle = skin;
  const armSwing = walking ? Math.sin(walkFrame * 0.4) * 2 : 0;
  ctx.fillRect(x + 2, y + 18 + armSwing, 3, 8);
  ctx.fillRect(x + 19, y + 18 - armSwing, 3, 8);
  // legs
  ctx.fillStyle = shoe;
  const legA = walking ? Math.sin(walkFrame * 0.4) * 2 : 0;
  const legB = -legA;
  ctx.fillRect(x + 6, y + 28 + Math.max(0, legA), 4, 4 - Math.max(0, legA));
  ctx.fillRect(x + 14, y + 28 + Math.max(0, legB), 4, 4 - Math.max(0, legB));
}

function drawSkyGhost(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
) {
  // floaty white ghost with Nabil's blue ribbon and dark hair
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  // glow
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(x + 12, y + 16, 22, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 4, y + 4, 20, 22);
  ctx.fillRect(x + 2, y + 8, 24, 14);
  // wavy bottom
  ctx.fillRect(x + 2, y + 26, 4, 4);
  ctx.fillRect(x + 10, y + 26, 4, 4);
  ctx.fillRect(x + 18, y + 26, 4, 4);
  ctx.fillRect(x + 6, y + 22, 4, 4);
  ctx.fillRect(x + 14, y + 22, 4, 4);
  ctx.fillRect(x + 22, y + 22, 4, 4);
  // hair (so it's identifiable as Nabil)
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 6, y + 4, 16, 6);
  // ribbon (blue)
  ctx.fillStyle = "#4ea3ff";
  ctx.fillRect(x + 4, y + 0, 6, 4);
  ctx.fillRect(x + 18, y + 0, 6, 4);
  ctx.fillRect(x + 10, y + 2, 8, 2);
  ctx.fillStyle = "#a8d4ff";
  ctx.fillRect(x + 5, y + 1, 2, 2);
  ctx.fillRect(x + 19, y + 1, 2, 2);
  // eyes
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x + 9, y + 14, 2, 3);
  ctx.fillRect(x + 17, y + 14, 2, 3);
  // shy smile
  ctx.fillRect(x + 12, y + 19, 4, 1);
  ctx.fillRect(x + 11, y + 18, 1, 1);
  ctx.fillRect(x + 16, y + 18, 1, 1);
}

function drawNabil(
  ctx: CanvasRenderingContext2D,
  c: Character,
  ghost = false,
) {
  const { x, y, facing, walkFrame, walking } = c;
  const px = (dx: number) => x + (facing === 1 ? dx : SPRITE_W - dx - 2);
  const skin = ghost ? "rgba(255,217,184,0.45)" : "#e8b894";
  const hair = ghost ? "rgba(26,26,26,0.4)" : "#1a1a1a";
  const shirt = ghost ? "rgba(60,90,160,0.45)" : "#3a5aa0";
  const ribbon = ghost ? "rgba(80,150,255,0.5)" : "#4ea3ff";
  const ribbonLight = ghost ? "rgba(180,220,255,0.6)" : "#a8d4ff";
  const pants = ghost ? "rgba(40,40,80,0.4)" : "#1a1a3a";
  const eyeC = ghost ? "rgba(0,0,0,0.5)" : "#1a1a1a";

  if (!ghost) {
    ctx.fillStyle = "rgba(58,31,37,0.35)";
    ctx.fillRect(x - 2, y + SPRITE_H + 2, SPRITE_W + 4, 3);
  }

  // hair
  ctx.fillStyle = hair;
  ctx.fillRect(x + 4, y + 2, 16, 12);
  // face
  ctx.fillStyle = skin;
  ctx.fillRect(x + 6, y + 8, 12, 10);
  // bangs
  ctx.fillStyle = hair;
  ctx.fillRect(x + 6, y + 8, 12, 3);
  // ribbon on head (per user)
  ctx.fillStyle = ribbon;
  ctx.fillRect(px(2), y + 0, 6, 4);
  ctx.fillRect(px(14), y + 0, 6, 4);
  ctx.fillRect(px(8), y + 2, 6, 2);
  ctx.fillStyle = ribbonLight;
  ctx.fillRect(px(3), y + 1, 2, 2);
  ctx.fillRect(px(15), y + 1, 2, 2);
  // eyes
  ctx.fillStyle = eyeC;
  ctx.fillRect(px(8), y + 12, 2, 2);
  ctx.fillRect(px(14), y + 12, 2, 2);
  // mouth
  ctx.fillRect(px(11), y + 16, 2, 1);
  // shirt
  ctx.fillStyle = shirt;
  ctx.fillRect(x + 4, y + 18, 16, 8);
  // arms
  ctx.fillStyle = skin;
  const armSwing = walking ? Math.sin(walkFrame * 0.4) * 2 : 0;
  ctx.fillRect(x + 2, y + 18 + armSwing, 3, 8);
  ctx.fillRect(x + 19, y + 18 - armSwing, 3, 8);
  // pants/legs
  ctx.fillStyle = pants;
  const legA = walking ? Math.sin(walkFrame * 0.4) * 2 : 0;
  const legB = -legA;
  ctx.fillRect(x + 6, y + 26 + Math.max(0, legA), 4, 6 - Math.max(0, legA));
  ctx.fillRect(x + 14, y + 26 + Math.max(0, legB), 4, 6 - Math.max(0, legB));
}

export function WalkingGame({ mode, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalTime, setProposalTime] = useState("");
  const [proposalNote, setProposalNote] = useState("");
  const [lockedWalk, setLockedWalk] = useState(false);
  const [bubble, setBubble] = useState<{ from: Mode; text: string } | null>(
    null,
  );
  const [, force] = useState(0);

  // refs for game loop
  const dirRef = useRef<JoystickDir>(null);
  const keyDirRef = useRef<JoystickDir>(null);
  const lockedWalkRef = useRef(false);
  const scrollXRef = useRef(0);
  const myCharRef = useRef<Character>({
    x: 0,
    y: 0,
    worldX: 0,
    facing: -1,
    walkFrame: 0,
    walking: false,
    jumpY: 0,
    jumpVy: 0,
  });
  const otherCharRef = useRef<Character>({
    x: 0,
    y: 0,
    worldX: 0,
    facing: -1,
    walkFrame: 0,
    walking: false,
    jumpY: 0,
    jumpVy: 0,
  });
  const messagesRef = useRef(readMessages());
  const lastMsgIdRef = useRef<string | null>(
    messagesRef.current[messagesRef.current.length - 1]?.id ?? null,
  );
  const ghostMsgsRef = useRef<string[]>(readGhostMessages());
  const ghostIdxRef = useRef(0);
  const ghostNextSwapRef = useRef(performance.now() + 6000);
  const ghostFloatPhaseRef = useRef(Math.random() * Math.PI * 2);
  const sceneRef = useRef<WorldScene>(readWorldScene());
  const [scene, setScene] = useState<WorldScene>(sceneRef.current);

  useEffect(() => {
    lockedWalkRef.current = lockedWalk;
  }, [lockedWalk]);

  // Subscribe to store changes — show bubble on new other-side messages
  useEffect(() => {
    const off = useStoreSubscribe(() => {
      const msgs = readMessages();
      messagesRef.current = msgs;
      ghostMsgsRef.current = readGhostMessages();
      const last = msgs[msgs.length - 1];
      if (last && last.id !== lastMsgIdRef.current) {
        lastMsgIdRef.current = last.id;
        const otherSide: Mode = mode === "noshin" ? "nabil" : "noshin";
        if (last.from === otherSide) {
          setBubble({ from: last.from, text: last.text });
          window.setTimeout(() => setBubble(null), 4500);
        }
      }
      force((v) => v + 1);
    });
    return off;
  }, [mode]);

  // Presence ping
  useEffect(() => {
    pingPresence(mode);
    const id = window.setInterval(() => pingPresence(mode), 3000);
    return () => window.clearInterval(id);
  }, [mode]);

  // Scene rotation — poll readWorldScene which auto-rotates after expiry,
  // and also listen to store changes for instant cross-tab sync.
  useEffect(() => {
    const refresh = () => {
      const next = readWorldScene();
      sceneRef.current = next;
      setScene(next);
    };
    refresh();
    const id = window.setInterval(refresh, 5000);
    const off = useStoreSubscribe(refresh);
    return () => {
      window.clearInterval(id);
      off();
    };
  }, []);

  // API polling for real-time multiplayer sync
  useEffect(() => {
    const pollServer = async () => {
      try {
        const otherSide: Mode = mode === "noshin" ? "nabil" : "noshin";
        const otherPos = await getWalkPos(otherSide);
        
        if (otherPos) {
          // Update the other character's position from server
          const other = otherCharRef.current;
          other.worldX = otherPos.worldX;
          other.facing = otherPos.facing;
          other.walking = otherPos.walking;
          other.jumpY = otherPos.jumpY || 0;
        }
      } catch (error) {
        // Silently fail - fallback to localStorage
      }
    };

    // Poll every 2 seconds for real-time updates
    const id = window.setInterval(pollServer, 2000);
    return () => window.clearInterval(id);
  }, [mode]);

  // Keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "a"].includes(k)) {
        keyDirRef.current = down ? "left" : keyDirRef.current === "left" ? null : keyDirRef.current;
        if (!down && keyDirRef.current === "left") keyDirRef.current = null;
      }
      if (["arrowright", "d"].includes(k)) {
        keyDirRef.current = down ? "right" : keyDirRef.current === "right" ? null : keyDirRef.current;
        if (!down && keyDirRef.current === "right") keyDirRef.current = null;
      }
      if (down && k === " ") {
        // Don't steal Space from inputs / textareas
        const tag = (e.target as HTMLElement | null)?.tagName ?? "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (e.shiftKey) {
          setLockedWalk((v) => !v);
        } else {
          // Jump only when on the ground (jumpY === 0)
          const c = myCharRef.current;
          if (c.jumpY === 0) c.jumpVy = -0.42;
        }
      }
      if (down && k === "escape") {
        setChatOpen(false);
        setProposalOpen(false);
        setKeysOpen(false);
      }
    };
    const dn = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    let lastT = performance.now();
    let stepAccumulator = 0;
    let lastPingT = 0;

    const tick = (t: number) => {
      const dt = Math.min(64, t - lastT);
      lastT = t;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // input direction (joystick wins, then keyboard, then locked walk)
      const inputDir =
        dirRef.current ?? keyDirRef.current ?? (lockedWalkRef.current ? "right" : null);

      const speed = 0.16; // px/ms
      const me = myCharRef.current;
      const groundY = h * GROUND_Y_RATIO;

      // Jump physics: jumpY > 0 means above ground (subtract from y).
      // Gravity pulls jumpVy positive; landing clamps at 0.
      me.jumpVy += 0.0014 * dt;
      me.jumpY = Math.max(0, me.jumpY - me.jumpVy * dt);
      if (me.jumpY === 0 && me.jumpVy > 0) me.jumpVy = 0;

      me.y = groundY - SPRITE_H - me.jumpY;

      if (inputDir === "right") {
        scrollXRef.current += speed * dt;
        me.facing = 1;
        me.walking = true;
        me.walkFrame += dt * 0.04;
      } else if (inputDir === "left") {
        scrollXRef.current -= speed * dt;
        me.facing = -1;
        me.walking = true;
        me.walkFrame += dt * 0.04;
      } else {
        me.walking = false;
      }

      stepAccumulator += me.walking ? dt : 0;
      while (stepAccumulator > 250) {
        stepAccumulator -= 250;
        addFootsteps(1);
      }

      me.x = Math.floor(w * 0.4);

      // Broadcast my world position so the other side can see me move.
      // Throttled to every ~120ms (but fire immediately while jumping).
      const pingNow = t - lastPingT > 120 || me.jumpY > 0;
      if (pingNow) {
        lastPingT = t;
        // Check if walking alone (only show to other person if not alone)
        const otherIsPresent = isNabilHereSync() || isNoshinHereSync();
        const isAlone = mode === "noshin" && !otherIsPresent;
        
        pingWalkPos(
          mode,
          scrollXRef.current,
          (me.facing as -1 | 1),
          me.walking,
          me.jumpY,
          isAlone,
        );
      }

      // Other character: read their broadcast world position.
      const other = otherCharRef.current;
      const otherSide: Mode = mode === "noshin" ? "nabil" : "noshin";
      const otherPos = readWalkPos(otherSide);
      const POS_FRESH_MS = 6000;
      const presence = readPresence();
      
      // Hide Noshin from Nabil if she's walking alone
      let otherIsPresent = !!otherPos && Date.now() - otherPos.ts < POS_FRESH_MS;
      if (mode === "nabil" && otherSide === "noshin" && presence.noshinWalkingAlone) {
        otherIsPresent = false;
      }
      if (otherIsPresent && otherPos) {
        // Their screen X = where they'd appear in my world, given the
        // difference between our world-X positions. Clamp to keep on-screen
        // when they're far so they walk in from the side instead of vanishing.
        const targetScreenX = me.x + (otherPos.worldX - scrollXRef.current);
        const minX = -SPRITE_W;
        const maxX = w + SPRITE_W;
        let drawX = targetScreenX;
        if (drawX < minX) drawX = minX;
        if (drawX > maxX) drawX = maxX;
        // Smooth interpolate toward target for a less jittery look.
        other.x = other.x === 0
          ? drawX
          : other.x + (drawX - other.x) * Math.min(1, dt * 0.02);
        other.jumpY = otherPos.jumpY ?? 0;
        other.y = groundY - SPRITE_H - other.jumpY;
        other.facing = otherPos.facing;
        other.walking = otherPos.walking;
        if (otherPos.walking) other.walkFrame += dt * 0.04;
      }

      // draw — scene-aware
      const scene = sceneRef.current;
      const pal = paletteFor(scene.timeOfDay);
      drawSky(ctx, w, h, pal);
      if (scene.timeOfDay === "night") drawStars(ctx, w, h, t);
      drawSunOrMoon(ctx, w, h, scene.timeOfDay);
      if (scene.weather === "rainbow") drawRainbow(ctx, w, h);
      // Clouds dim during night/storm
      if (scene.weather !== "storm") {
        drawClouds(ctx, w, h, scrollXRef.current);
      } else {
        // dark storm clouds
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#2a2638";
        for (let i = -1; i < 3; i++) {
          const baseX = (i * (w * 0.55) - (scrollXRef.current * 0.15) % w);
          const baseY = h * (0.12 + 0.05 * (i % 2));
          pixelCloud(ctx, baseX, baseY, 16);
          pixelCloud(ctx, baseX + 220, baseY + 28, 12);
        }
        ctx.globalAlpha = 1;
      }
      drawHills(ctx, w, h, scrollXRef.current, pal);
      drawScenery(ctx, w, h, scrollXRef.current, scene.theme, scene.timeOfDay);
      drawGround(ctx, w, h, scrollXRef.current, pal);
      // Weather overlay (drawn before characters so they stand out clearly)
      if (scene.weather === "rain") drawRain(ctx, w, h, t, false);
      if (scene.weather === "storm") {
        drawRain(ctx, w, h, t, true);
        drawLightning(ctx, w, h, t);
      }
      // Night vignette
      if (scene.timeOfDay === "night") {
        ctx.fillStyle = "rgba(8, 10, 26, 0.25)";
        ctx.fillRect(0, 0, w, h);
      }

      // characters
      if (mode === "noshin") {
        drawNoshin(ctx, me);
        if (otherIsPresent) drawNabil(ctx, other);
      } else {
        drawNabil(ctx, me);
        if (otherIsPresent) drawNoshin(ctx, other);
      }

      // When Noshin walks alone (Nabil not here), Nabil's voice calls out
      // from off-screen on the LEFT — "noshin wait for me i am coming gurl".
      // A tiny Nabil head peeks in from the left edge with a speech bubble.
      if (mode === "noshin" && !otherIsPresent) {
        ghostFloatPhaseRef.current += dt * 0.003;
        const peekBob = Math.sin(ghostFloatPhaseRef.current) * 2;
        const peekX = 4;
        const peekY = groundY - SPRITE_H + peekBob;
        // Tiny Nabil head poking in from off-screen (only right half visible)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, peekY - 4, SPRITE_W * 0.55, SPRITE_H + 12);
        ctx.clip();
        drawNabil(ctx, {
          x: peekX - SPRITE_W * 0.45,
          y: peekY,
          worldX: 0,
          facing: 1,
          walkFrame: 0,
          walking: false,
          jumpY: 0,
          jumpVy: 0,
        });
        ctx.restore();
        const text = "noshin wait for me i am coming gurl ♡";
        ctx.font = "18px VT323, monospace";
        const padX = 10;
        const tw = Math.min(ctx.measureText(text).width, w * 0.55);
        const bw = tw + padX * 2;
        const bh = 28;
        // anchor bubble UP-AND-RIGHT of the peeking head
        const bx = peekX + SPRITE_W * 0.55 + 12;
        const by = peekY - bh - 4;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 3;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        // tail pointing back-left toward head
        ctx.beginPath();
        ctx.moveTo(bx, by + 8);
        ctx.lineTo(bx - 10, by + 16);
        ctx.lineTo(bx, by + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1a1a1a";
        let display = text;
        while (ctx.measureText(display).width > tw && display.length > 4) {
          display = display.slice(0, -2);
        }
        if (display !== text) display = display.slice(0, -1) + "…";
        ctx.fillText(display, bx + padX, by + 19);
      }

      // HUD bubble
      if (bubble) {
        const bx = (mode === "noshin" ? me.x : other.x) - 60;
        const by = me.y - 36;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 3;
        const text = bubble.text.slice(0, 40);
        ctx.font = "16px VT323, monospace";
        const tw = ctx.measureText(text).width + 16;
        ctx.fillRect(bx, by - 22, tw, 24);
        ctx.strokeRect(bx, by - 22, tw, 24);
        ctx.fillStyle = "#1a1a1a";
        ctx.fillText(text, bx + 8, by - 6);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [mode, bubble]);

  const sendMessage = () => {
    const t = chatText.trim();
    if (!t) return;
    addMessage(mode, t);
    setChatText("");
    setBubble({ from: mode, text: t });
    window.setTimeout(() => setBubble(null), 3500);
  };

  const sendProposal = () => {
    if (!proposalTime.trim()) return;
    addProposal({
      from: mode,
      time: proposalTime.trim(),
      message: proposalNote.trim() || "let's walk",
      responded: null,
    });
    setProposalTime("");
    setProposalNote("");
    setProposalOpen(false);
  };

  const otherName = mode === "noshin" ? "Nabil" : "Noshin";
  const meName = mode === "noshin" ? "Noshin" : "Nabil";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top HUD */}
      <div
        className="font-pixel"
        style={{
          padding: "10px 14px",
          background: "#fff",
          borderBottom: "3px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
        }}
      >
        <button onClick={onExit} className="pixel-btn" style={{ fontSize: 9, padding: "6px 10px", boxShadow: "2px 2px 0 0 #1a1a1a" }}>
          ◄ HOME
        </button>
        <div style={{ textAlign: "center" }}>
          {meName.toUpperCase()}'S WALK
          <div style={{ fontSize: 8, marginTop: 2, opacity: 0.7 }}>
            {(mode === "noshin" ? isNabilHereSync() : isNoshinHereSync())
              ? `${otherName.toUpperCase()} IS HERE`
              : `${otherName.toUpperCase()} NOT HERE`}
          </div>
        </div>
        <button
          onClick={() => setLockedWalk((v) => !v)}
          className="pixel-btn"
          style={{
            fontSize: 9,
            padding: "6px 10px",
            boxShadow: "2px 2px 0 0 #1a1a1a",
            background: lockedWalk ? "#ff7aa2" : "#fff",
            color: lockedWalk ? "#fff" : "#1a1a1a",
          }}
        >
          {lockedWalk ? "AUTO ON" : "AUTO OFF"}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            imageRendering: "pixelated",
          }}
        />

        {/* Scene chip (top-left) */}
        <div
          className="font-pixel"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(255,255,255,0.85)",
            border: "2px solid #1a1a1a",
            padding: "6px 10px",
            fontSize: 9,
            lineHeight: 1.4,
            boxShadow: "2px 2px 0 0 #1a1a1a",
            maxWidth: 200,
          }}
        >
          ♡ {scene.timeOfDay.toUpperCase()}
          {" · "}
          {scene.weather === "clear" ? "CLEAR" : scene.weather.toUpperCase()}
          {" · "}
          {scene.theme.toUpperCase()}
        </div>

        {/* On-screen action buttons (top right of game) */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            className="pixel-btn"
            onClick={() => setChatOpen(true)}
            style={{ fontSize: 9, padding: "8px 10px", boxShadow: "2px 2px 0 0 #1a1a1a" }}
          >
            MSG
          </button>
          <button
            className="pixel-btn"
            onClick={() => setProposalOpen(true)}
            style={{ fontSize: 9, padding: "8px 10px", boxShadow: "2px 2px 0 0 #1a1a1a" }}
          >
            PLAN
          </button>
          <button
            className="pixel-btn"
            onClick={() => setKeysOpen(true)}
            style={{ fontSize: 9, padding: "8px 10px", boxShadow: "2px 2px 0 0 #1a1a1a" }}
            title="Show keyboard controls"
          >
            KEYS
          </button>
          {mode === "nabil" && (
            <button
              className="pixel-btn pixel-btn-primary"
              onClick={async () => {
                try {
                  // Try API first for cross-network teleport
                  const otherPos = await getWalkPos("noshin");
                  if (otherPos) {
                    scrollXRef.current = otherPos.worldX + (otherPos.facing === 1 ? -100 : 100);
                  }
                } catch {
                  // Fallback to localStorage
                  const otherPos = readWalkPos("noshin");
                  if (otherPos) {
                    scrollXRef.current = otherPos.worldX + (otherPos.facing === 1 ? -100 : 100);
                  }
                }
              }}
              style={{ fontSize: 9, padding: "8px 10px", boxShadow: "2px 2px 0 0 #1a1a1a" }}
              title="Teleport to Noshin"
            >
              TP ♡
            </button>
          )}
        </div>

        {/* Nabil's contextual quick-send chips — only on Nabil's walk page */}
        {mode === "nabil" && (
          <QuickSendChips
            scene={scene}
            onSend={(text) => {
              addMessage("nabil", text);
              setBubble({ from: "nabil", text });
              window.setTimeout(() => setBubble(null), 4000);
            }}
          />
        )}
      </div>

      {/* Bottom controls: joystick */}
      <div
        style={{
          padding: "14px 16px 18px",
          borderTop: "3px solid #1a1a1a",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <Joystick
            onChange={(d) => {
              dirRef.current = d;
            }}
            onAction={() => setChatOpen(true)}
          />
          <button
            className="pixel-btn"
            onClick={() => {
              const c = myCharRef.current;
              if (c.jumpY === 0) c.jumpVy = -0.42;
            }}
            style={{
              fontSize: 11,
              padding: "16px 14px",
              boxShadow: "3px 3px 0 0 #1a1a1a",
              background: "#ffd6e6",
            }}
            aria-label="Jump"
            title="Jump (or press SPACE)"
          >
            ♡ JUMP
          </button>
        </div>
        <div
          className="font-pixel"
          style={{
            fontSize: 8,
            textAlign: "center",
            marginTop: 8,
            opacity: 0.7,
          }}
        >
          HOLD ◄ OR ► TO WALK · TAP ♡ JUMP OR PRESS SPACE TO HOP
        </div>
      </div>

      {/* Chat modal */}
      {chatOpen && (
        <Modal onClose={() => setChatOpen(false)} title="SEND A MESSAGE">
          <div
            className="font-mono-retro"
            style={{
              maxHeight: 180,
              overflowY: "auto",
              padding: 10,
              border: "3px solid #1a1a1a",
              marginBottom: 10,
              background: "#fff8f3",
              fontSize: 18,
            }}
          >
            {messagesRef.current.length === 0 && (
              <div style={{ opacity: 0.6 }}>no messages yet...</div>
            )}
            {messagesRef.current.slice(-20).map((m) => (
              <div key={m.id} style={{ marginBottom: 4 }}>
                <strong style={{ color: m.from === "noshin" ? "#d94e7c" : "#3a5aa0" }}>
                  {m.from}:
                </strong>{" "}
                {m.text}
              </div>
            ))}
          </div>
          <input
            className="pixel-input"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder={`say something to ${otherName.toLowerCase()}...`}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <button className="pixel-btn" onClick={() => setChatOpen(false)}>
              CLOSE
            </button>
            <button className="pixel-btn pixel-btn-primary" onClick={sendMessage}>
              SEND
            </button>
          </div>
        </Modal>
      )}

      {/* Proposal modal */}
      {proposalOpen && (
        <Modal onClose={() => setProposalOpen(false)} title="PROPOSE A WALK">
          <div className="font-mono-retro" style={{ fontSize: 18, marginBottom: 8 }}>
            when do you want to walk together?
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {TIME_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setProposalTime(p)}
                className="font-pixel"
                style={{
                  fontSize: 9,
                  padding: "6px 10px",
                  border: "2px solid #1a1a1a",
                  background: proposalTime === p ? "#ff7aa2" : "#fff",
                  color: proposalTime === p ? "#fff" : "#1a1a1a",
                  cursor: "pointer",
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            className="pixel-input"
            value={proposalTime}
            onChange={(e) => setProposalTime(e.target.value)}
            placeholder="or type a time, e.g. 6:30 pm"
            style={{ marginBottom: 10 }}
            autoFocus
          />
          <input
            className="pixel-input"
            value={proposalNote}
            onChange={(e) => setProposalNote(e.target.value)}
            placeholder="a sweet note (optional)"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <button className="pixel-btn" onClick={() => setProposalOpen(false)}>
              CANCEL
            </button>
            <button className="pixel-btn pixel-btn-primary" onClick={sendProposal}>
              PROPOSE
            </button>
          </div>
        </Modal>
      )}

      {/* Keyboard guide modal */}
      {keysOpen && (
        <Modal onClose={() => setKeysOpen(false)} title="HOW TO PLAY">
          <div
            className="font-mono-retro"
            style={{ fontSize: 18, lineHeight: 1.5 }}
          >
            <KeyRow keys={["←", "A"]} action="walk left" />
            <KeyRow keys={["→", "D"]} action="walk right" />
            <KeyRow keys={["SPACE"]} action="jump ♡" />
            <KeyRow keys={["SHIFT", "+", "SPACE"]} action="toggle auto-walk" />
            <KeyRow keys={["ESC"]} action="close menus" />
            <div
              className="font-pixel"
              style={{ fontSize: 9, marginTop: 12, color: "#7a3a4a" }}
            >
              ON MOBILE: USE THE JOYSTICK BELOW. TAP THE LITTLE ♡ JUMP BUTTON
              TO HOP.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              justifyContent: "flex-end",
            }}
          >
            <button
              className="pixel-btn pixel-btn-primary"
              onClick={() => setKeysOpen(false)}
            >
              GOT IT
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KeyRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      {keys.map((k, i) =>
        k === "+" ? (
          <span key={i} className="font-mono-retro" style={{ fontSize: 18 }}>
            +
          </span>
        ) : (
          <span
            key={i}
            className="font-pixel"
            style={{
              fontSize: 9,
              padding: "4px 8px",
              border: "2px solid #1a1a1a",
              background: "#fff5fb",
              boxShadow: "2px 2px 0 0 #1a1a1a",
              minWidth: 18,
              textAlign: "center",
              display: "inline-block",
            }}
          >
            {k}
          </span>
        ),
      )}
      <span style={{ marginLeft: 8 }}>{action}</span>
    </div>
  );
}

function QuickSendChips({
  scene,
  onSend,
}: {
  scene: WorldScene;
  onSend: (text: string) => void;
}) {
  const chips: { label: string; text: string }[] = [];
  // Weather-aware chips
  if (scene.weather === "rain") {
    chips.push({
      label: "♡ rain reminds me of you",
      text: "rain reminds me of you noshin ♡",
    });
    chips.push({
      label: "stay dry pls",
      text: "wherever you are, stay dry noshin ♡",
    });
  }
  if (scene.weather === "rainbow") {
    chips.push({
      label: "♡ look up, rainbow!",
      text: "noshin look up, a rainbow! that's for us ♡",
    });
  }
  if (scene.weather === "storm") {
    chips.push({
      label: "stay safe ♡",
      text: "the sky is wild, stay safe pretty noshin",
    });
  }
  // Time-of-day chips
  if (scene.timeOfDay === "morning") {
    chips.push({
      label: "good morning",
      text: "good morning my pretty noshin ☀ ♡",
    });
  }
  if (scene.timeOfDay === "evening") {
    chips.push({
      label: "this sunset is for you",
      text: "this sunset reminds me of you noshin ♡",
    });
  }
  if (scene.timeOfDay === "night") {
    chips.push({
      label: "the stars 🌙",
      text: "the stars are pretty tonight, but you're prettier noshin ♡",
    });
  }
  // Theme-aware chips
  if (scene.theme === "garden") {
    chips.push({
      label: "this garden is you",
      text: "this whole garden is full of you noshin ♡",
    });
  }
  if (scene.theme === "market") {
    chips.push({
      label: "buy you everything",
      text: "i'd buy you everything in this market noshin",
    });
  }
  if (scene.theme === "park") {
    chips.push({
      label: "let's sit a while",
      text: "let's sit on a park bench together someday noshin ♡",
    });
  }
  if (scene.theme === "cherry") {
    chips.push({
      label: "petals are pink like you",
      text: "the petals are as pink as your cheeks noshin ♡",
    });
  }
  // always-available "miss you" fallback
  chips.push({ label: "♡ miss you", text: "i miss you noshin ♡" });

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        right: 12,
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        maxWidth: "70%",
      }}
    >
      {chips.slice(0, 4).map((c) => (
        <button
          key={c.label}
          className="font-pixel"
          onClick={() => onSend(c.text)}
          style={{
            fontSize: 9,
            padding: "8px 10px",
            border: "2px solid #1a1a1a",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "2px 2px 0 0 #1a1a1a",
            cursor: "pointer",
            lineHeight: 1.2,
          }}
        >
          {c.label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pixel-border"
        style={{
          background: "#fff",
          padding: 16,
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div
          className="font-pixel"
          style={{
            fontSize: 11,
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: "2px dashed #1a1a1a",
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
