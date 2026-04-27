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
};

export function readPresence(): Presence {
  if (typeof window === "undefined") return { nabilLastSeen: 0, noshinLastSeen: 0 };
  return safeParse<Presence>(localStorage.getItem(PRESENCE_KEY), {
    nabilLastSeen: 0,
    noshinLastSeen: 0,
  });
}

export function pingPresence(who: "noshin" | "nabil") {
  const p = readPresence();
  const next: Presence =
    who === "nabil"
      ? { ...p, nabilLastSeen: Date.now() }
      : { ...p, noshinLastSeen: Date.now() };
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(next));
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
