import { useEffect, useRef, useState } from "react";
import { Joystick, type JoystickDir } from "./Joystick";
import {
  addFootsteps,
  addMessage,
  addProposal,
  isNabilHere,
  isNoshinHere,
  pingPresence,
  pingWalkPos,
  readGhostMessages,
  readMessages,
  readWalkPos,
  useStoreSubscribe,
} from "@/lib/store";

type Mode = "noshin" | "nabil";

type Props = {
  mode: Mode;
  onExit?: () => void;
};

const SPRITE_W = 24;
const SPRITE_H = 32;
const GROUND_Y_RATIO = 0.78;

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#ffe6c2");
  g.addColorStop(0.55, "#ffc097");
  g.addColorStop(1, "#ff9aa8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w * 0.78;
  const cy = h * 0.28;
  ctx.fillStyle = "#fff2d4";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 230, 200, 0.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.13, 0, Math.PI * 2);
  ctx.fill();
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
) {
  const groundY = h * GROUND_Y_RATIO;
  const offset = (scrollX * 0.3) % w;
  ctx.fillStyle = "#c97e6a";
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
) {
  const groundY = h * GROUND_Y_RATIO;
  ctx.fillStyle = "#7a3a4a";
  ctx.fillRect(0, groundY, w, h - groundY);
  // dashed path lines
  ctx.fillStyle = "#ffd9c2";
  const dash = 28;
  const offset = scrollX % (dash * 2);
  for (let x = -offset; x < w; x += dash * 2) {
    ctx.fillRect(x, groundY + (h - groundY) * 0.45, dash, 4);
  }
  // little tufts
  ctx.fillStyle = "#5e2c39";
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
) {
  const groundY = h * GROUND_Y_RATIO;
  const offset = scrollX % (w * 0.8);
  for (let i = -1; i < 4; i++) {
    const baseX = i * (w * 0.4) - offset;
    drawTree(ctx, baseX + 40, groundY);
  }
  const flowerOffset = scrollX % 90;
  for (let x = -flowerOffset; x < w; x += 90) {
    drawFlower(ctx, x, groundY);
  }
}

type Character = {
  x: number;
  y: number;
  facing: 1 | -1;
  walkFrame: number;
  walking: boolean;
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
    facing: 1,
    walkFrame: 0,
    walking: false,
  });
  const otherCharRef = useRef<Character>({
    x: 0,
    y: 0,
    facing: -1,
    walkFrame: 0,
    walking: false,
  });
  const messagesRef = useRef(readMessages());
  const lastMsgIdRef = useRef<string | null>(
    messagesRef.current[messagesRef.current.length - 1]?.id ?? null,
  );
  const ghostMsgsRef = useRef<string[]>(readGhostMessages());
  const ghostIdxRef = useRef(0);
  const ghostNextSwapRef = useRef(performance.now() + 6000);
  const ghostFloatPhaseRef = useRef(Math.random() * Math.PI * 2);

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
      if (down && k === " " && (e.shiftKey || keyDirRef.current === "right")) {
        // D + Space toggles locked walk
        if (keyDirRef.current === "right") {
          e.preventDefault();
          setLockedWalk((v) => !v);
        }
      }
      if (down && k === "escape") {
        setChatOpen(false);
        setProposalOpen(false);
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
      me.y = groundY - SPRITE_H;

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
      // Throttled to every ~120ms.
      if (t - lastPingT > 120) {
        lastPingT = t;
        pingWalkPos(
          mode,
          scrollXRef.current,
          (me.facing as -1 | 1),
          me.walking,
        );
      }

      // Other character: read their broadcast world position.
      const other = otherCharRef.current;
      const otherSide: Mode = mode === "noshin" ? "nabil" : "noshin";
      const otherPos = readWalkPos(otherSide);
      const POS_FRESH_MS = 6000;
      const otherIsPresent =
        !!otherPos && Date.now() - otherPos.ts < POS_FRESH_MS;
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
        other.y = groundY - SPRITE_H;
        other.facing = otherPos.facing;
        other.walking = otherPos.walking;
        if (otherPos.walking) other.walkFrame += dt * 0.04;
      }

      // draw
      drawSky(ctx, w, h);
      drawSun(ctx, w, h);
      drawClouds(ctx, w, h, scrollXRef.current);
      drawHills(ctx, w, h, scrollXRef.current);
      drawScenery(ctx, w, h, scrollXRef.current);
      drawGround(ctx, w, h, scrollXRef.current);

      // characters
      if (mode === "noshin") {
        drawNoshin(ctx, me);
        if (otherIsPresent) drawNabil(ctx, other);
      } else {
        drawNabil(ctx, me);
        if (otherIsPresent) drawNoshin(ctx, other);
      }

      // Sky ghost: when Noshin walks alone (Nabil not here), show his ghost
      // floating in the sky with rotating messages he left from /nabil.
      if (mode === "noshin" && !otherIsPresent) {
        const ghosts = ghostMsgsRef.current;
        if (t > ghostNextSwapRef.current && ghosts.length > 0) {
          ghostIdxRef.current = Math.floor(Math.random() * ghosts.length);
          ghostNextSwapRef.current = t + 6500 + Math.random() * 2500;
        }
        ghostFloatPhaseRef.current += dt * 0.002;
        const gx = w * 0.7;
        const gy = h * 0.22 + Math.sin(ghostFloatPhaseRef.current) * 8;
        drawSkyGhost(ctx, gx, gy);
        const text = ghosts[ghostIdxRef.current] ?? "";
        if (text) {
          ctx.font = "18px VT323, monospace";
          const padX = 10;
          const tw = Math.min(ctx.measureText(text).width, w * 0.55);
          // tail
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#1a1a1a";
          ctx.lineWidth = 3;
          const bw = tw + padX * 2;
          const bh = 28;
          const bx = Math.max(8, gx - bw - 16);
          const by = gy - 8;
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeRect(bx, by, bw, bh);
          // little tail triangle
          ctx.beginPath();
          ctx.moveTo(bx + bw, by + 8);
          ctx.lineTo(bx + bw + 10, by + 12);
          ctx.lineTo(bx + bw, by + 18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#1a1a1a";
          // clip text
          let display = text;
          while (
            ctx.measureText(display).width > tw &&
            display.length > 4
          ) {
            display = display.slice(0, -2);
          }
          if (display !== text) display = display.slice(0, -1) + "…";
          ctx.fillText(display, bx + padX, by + 19);
        }
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
            {(mode === "noshin" ? isNabilHere() : isNoshinHere())
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
        </div>
      </div>

      {/* Bottom controls: joystick */}
      <div
        style={{
          padding: "14px 16px 18px",
          borderTop: "3px solid #1a1a1a",
          background: "#fff",
        }}
      >
        <Joystick
          onChange={(d) => {
            dirRef.current = d;
          }}
          onAction={() => setChatOpen(true)}
        />
        <div
          className="font-pixel"
          style={{
            fontSize: 8,
            textAlign: "center",
            marginTop: 8,
            opacity: 0.7,
          }}
        >
          HOLD ◄ OR ► TO WALK · RELEASE TO STOP
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
          <input
            className="pixel-input"
            value={proposalTime}
            onChange={(e) => setProposalTime(e.target.value)}
            placeholder="e.g. tomorrow 6 pm"
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
