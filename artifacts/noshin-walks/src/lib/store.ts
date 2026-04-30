export type Proposal = {
  id: string;
  from: "noshin" | "nabil";
  message: string;
  time: string;
  createdAt: number;
  responded?: "accepted" | "declined" | null;
};

export type ChatMessage = {
  id: string;
  from: "noshin" | "nabil";
  text: string;
  createdAt: number;
};

const PROPOSAL_KEY = "noshin.proposals.v1";
const MESSAGE_KEY = "noshin.messages.v1";
const PRESENCE_KEY = "noshin.presence.v1";
const FOOTSTEPS_KEY = "noshin.footsteps.v1";
const GHOST_KEY = "noshin.ghostMessages.v1";
const WALKPOS_NOSHIN_KEY = "noshin.walkpos.noshin.v1";
const WALKPOS_NABIL_KEY = "noshin.walkpos.nabil.v1";
const SCENE_KEY = "noshin.scene.v1";

const DEFAULT_GHOSTS = [
  "hi noshin ♡ keep walking, you're doing great",
  "i'm somewhere, but i'm with you",
  "look at the sky for me, is it pink today?",
  "drink some water, please ♡",
  "one more step, that's my girl",
  "miss you a tiny bit. okay, a lot.",
];

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function readProposals(): Proposal[] {
  if (typeof window === "undefined") return [];
  return safeParse<Proposal[]>(localStorage.getItem(PROPOSAL_KEY), []);
}

export function writeProposals(items: Proposal[]) {
  localStorage.setItem(PROPOSAL_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("noshin-store-change"));
}

export function addProposal(p: Omit<Proposal, "id" | "createdAt">) {
  const all = readProposals();
  const item: Proposal = {
    ...p,
    id: Math.random().toString(36).slice(2),
    createdAt: Date.now(),
  };
  all.unshift(item);
  writeProposals(all.slice(0, 30));
}

export function respondProposal(
  id: string,
  responded: "accepted" | "declined",
) {
  const all = readProposals();
  const next = all.map((p) => (p.id === id ? { ...p, responded } : p));
  writeProposals(next);
}

export function readMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  return safeParse<ChatMessage[]>(localStorage.getItem(MESSAGE_KEY), []);
}

export function writeMessages(items: ChatMessage[]) {
  localStorage.setItem(MESSAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("noshin-store-change"));
}

export function addMessage(from: "noshin" | "nabil", text: string) {
  if (!text.trim()) return;
  const all = readMessages();
  all.push({
    id: Math.random().toString(36).slice(2),
    from,
    text: text.trim(),
    createdAt: Date.now(),
  });
  writeMessages(all.slice(-100));
}

type Presence = {
  nabilLastSeen: number;
  noshinLastSeen: number;
  nabilWalking?: boolean;
  noshinWalking?: boolean;
  noshinWalkingAlone?: boolean;
};

export function readPresence(): Presence {
  if (typeof window === "undefined") return { nabilLastSeen: 0, noshinLastSeen: 0 };
  return safeParse<Presence>(localStorage.getItem(PRESENCE_KEY), {
    nabilLastSeen: 0,
    noshinLastSeen: 0,
  });
}

export function pingPresence(who: "noshin" | "nabil") {
  // Update localStorage for fallback
  const p = readPresence();
  const next: Presence =
    who === "nabil"
      ? { ...p, nabilLastSeen: Date.now() }
      : { ...p, noshinLastSeen: Date.now() };
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(next));
  
  // Try to sync with API for multiplayer
  import('./api').then(({ syncPresence }) => {
    syncPresence(who).catch(() => {});
  });
  
  window.dispatchEvent(new Event("noshin-store-change"));
}

export function isNabilHere(graceMs = 8000): boolean {
  const p = readPresence();
  return Date.now() - p.nabilLastSeen < graceMs;
}

export function isNoshinHere(graceMs = 8000): boolean {
  const p = readPresence();
  return Date.now() - p.noshinLastSeen < graceMs;
}

export function nabilLastSeenAgo(): number {
  const p = readPresence();
  if (!p.nabilLastSeen) return Infinity;
  return Date.now() - p.nabilLastSeen;
}

export function nabilStatusText(): string {
  const ago = nabilLastSeenAgo();
  if (ago < 8000) return "yes he's here ♡";
  if (ago < 60_000) return "here a moment ago";
  if (ago === Infinity) return "will come, soon ♡";
  const mins = Math.floor(ago / 60_000);
  if (mins < 60) return `seen ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `seen ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `seen ${days} day${days === 1 ? "" : "s"} ago`;
}

export function readGhostMessages(): string[] {
  if (typeof window === "undefined") return DEFAULT_GHOSTS.slice();
  const raw = localStorage.getItem(GHOST_KEY);
  if (!raw) return DEFAULT_GHOSTS.slice();
  const parsed = safeParse<string[]>(raw, DEFAULT_GHOSTS.slice());
  return parsed.length > 0 ? parsed : DEFAULT_GHOSTS.slice();
}

export function writeGhostMessages(items: string[]) {
  localStorage.setItem(GHOST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("noshin-store-change"));
}

export function addGhostMessage(text: string) {
  const t = text.trim();
  if (!t) return;
  const all = readGhostMessages();
  all.unshift(t);
  writeGhostMessages(all.slice(0, 30));
}

export function removeGhostMessage(idx: number) {
  const all = readGhostMessages();
  all.splice(idx, 1);
  writeGhostMessages(all);
}

export type WalkPos = {
  worldX: number;
  facing: -1 | 1;
  walking: boolean;
  jumpY?: number;
  ts: number;
};

export function pingWalkPos(
  who: "noshin" | "nabil",
  worldX: number,
  facing: -1 | 1,
  walking: boolean,
  jumpY = 0,
  isAlone = false,
) {
  const key = who === "noshin" ? WALKPOS_NOSHIN_KEY : WALKPOS_NABIL_KEY;
  const data: WalkPos = { worldX, facing, walking, jumpY, ts: Date.now() };
  localStorage.setItem(key, JSON.stringify(data));
  
  // Update presence to track walking state and alone status
  const p = readPresence();
  if (who === "noshin") {
    p.noshinWalking = walking;
    p.noshinWalkingAlone = isAlone;
  } else {
    p.nabilWalking = walking;
  }
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(p));
  
  // Try to sync with API for multiplayer
  import('./api').then(({ syncWalkPos }) => {
    syncWalkPos(who, data).catch(() => {});
  });
  
  window.dispatchEvent(new Event("noshin-store-change"));
}

export function readWalkPos(who: "noshin" | "nabil"): WalkPos | null {
  if (typeof window === "undefined") return null;
  const key = who === "noshin" ? WALKPOS_NOSHIN_KEY : WALKPOS_NABIL_KEY;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return safeParse<WalkPos | null>(raw, null);
}

// Parses freeform proposal time strings into Date for "join now" detection.
// Supports: "HH:MM", "H:MM AM/PM", "HHMM", "now", "asap".
// Returns null if unparseable. When parsed time has already passed today,
// returns today's instance (so we can decide "it's time").
export function parseProposalTime(s: string): Date | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t || t === "now" || t === "asap" || t === "right now") return new Date();
  let h: number | null = null;
  let m = 0;
  let pm: boolean | null = null;
  const ampm = t.match(/\b(am|pm)\b/);
  if (ampm) pm = ampm[1] === "pm";
  const cleaned = t.replace(/\b(am|pm)\b/g, "").trim();
  let mm = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (mm) {
    h = Number(mm[1]);
    m = Number(mm[2]);
  } else {
    mm = cleaned.match(/^(\d{1,2})$/);
    if (mm) {
      h = Number(mm[1]);
      m = 0;
    } else {
      mm = cleaned.match(/^(\d{3,4})$/);
      if (mm) {
        const v = mm[1];
        h = Number(v.slice(0, v.length - 2));
        m = Number(v.slice(-2));
      }
    }
  }
  if (h === null || isNaN(h) || isNaN(m) || m > 59) return null;
  if (pm === true && h < 12) h += 12;
  if (pm === false && h === 12) h = 0;
  if (h > 23) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// "It's time": within JOIN_WINDOW_MS before scheduled time, up to JOIN_TAIL_MS after.
const JOIN_WINDOW_MS = 15 * 60 * 1000;
const JOIN_TAIL_MS = 60 * 60 * 1000;

// Named time-of-day periods used both in proposals and in scene.
export const TIME_PERIODS = ["morning", "noon", "afternoon", "evening", "night"] as const;
export type TimePeriod = (typeof TIME_PERIODS)[number];

const PERIOD_HOURS: Record<TimePeriod, [number, number]> = {
  morning: [6, 11],
  noon: [11, 14],
  afternoon: [14, 17],
  evening: [17, 20],
  night: [20, 24],
};

function periodFromString(s: string): TimePeriod | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  for (const p of TIME_PERIODS) if (t === p || t.includes(p)) return p;
  return null;
}

export function currentPeriod(): TimePeriod {
  const h = new Date().getHours();
  for (const p of TIME_PERIODS) {
    const [a, b] = PERIOD_HOURS[p];
    if (h >= a && h < b) return p;
  }
  return "night";
}

export function isJoinTime(p: Proposal): boolean {
  if (p.responded !== "accepted") return false;
  // Named period proposals: it's "time" the entire period today.
  const period = periodFromString(p.time);
  if (period) return currentPeriod() === period;
  const target = parseProposalTime(p.time);
  if (!target) return true; // unparseable → always offer join after accept
  const now = Date.now();
  const t = target.getTime();
  return now >= t - JOIN_WINDOW_MS && now <= t + JOIN_TAIL_MS;
}

// World scene: time-of-day, weather, theme. Stored shared so both sides
// see the same world. Rotates every SCENE_DURATION_MS so the walk feels alive.
export type Weather = "clear" | "rain" | "storm" | "rainbow";
export type Theme = "cherry" | "garden" | "market" | "park";

export type WorldScene = {
  timeOfDay: TimePeriod;
  weather: Weather;
  theme: Theme;
  startedAt: number;
  rotateAt: number;
};

const SCENE_DURATION_MS = 4 * 60 * 1000;

function pickWeighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

function rollScene(prev?: WorldScene | null): WorldScene {
  const timeOfDay = currentPeriod();
  // Weighted weather — clear most common, rain occasional, storm/rainbow rare.
  const weather = pickWeighted<Weather>([
    ["clear", 60],
    ["rain", 22],
    ["rainbow", 10],
    ["storm", 8],
  ]);
  // Theme — pick something different from previous when possible.
  const themes: Theme[] = ["cherry", "garden", "market", "park"];
  const choices = prev ? themes.filter((t) => t !== prev.theme) : themes;
  const theme = choices[Math.floor(Math.random() * choices.length)];
  const now = Date.now();
  return {
    timeOfDay,
    weather,
    theme,
    startedAt: now,
    rotateAt: now + SCENE_DURATION_MS,
  };
}

export function readWorldScene(): WorldScene {
  if (typeof window === "undefined") {
    return rollScene();
  }
  const raw = localStorage.getItem(SCENE_KEY);
  const prev = raw ? safeParse<WorldScene | null>(raw, null) : null;
  if (!prev || Date.now() >= prev.rotateAt) {
    const next = rollScene(prev);
    localStorage.setItem(SCENE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("noshin-store-change"));
    return next;
  }
  // If real time-of-day no longer matches stored, refresh that field
  // without rotating weather/theme — keeps sky correct as hours pass.
  const now = currentPeriod();
  if (prev.timeOfDay !== now) {
    const updated: WorldScene = { ...prev, timeOfDay: now };
    localStorage.setItem(SCENE_KEY, JSON.stringify(updated));
    return updated;
  }
  return prev;
}

export function forceRollScene(): WorldScene {
  const prev = typeof window !== "undefined"
    ? safeParse<WorldScene | null>(localStorage.getItem(SCENE_KEY), null)
    : null;
  const next = rollScene(prev);
  if (typeof window !== "undefined") {
    localStorage.setItem(SCENE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("noshin-store-change"));
  }
  return next;
}

export function readFootsteps(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(FOOTSTEPS_KEY);
  return v ? Number(v) || 0 : 0;
}

export function addFootsteps(n: number) {
  const cur = readFootsteps();
  localStorage.setItem(FOOTSTEPS_KEY, String(cur + n));
}

export function useStoreSubscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("noshin-store-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("noshin-store-change", handler);
    window.removeEventListener("storage", handler);
  };
}
