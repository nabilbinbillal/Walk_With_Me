const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export type Presence = {
  nabilLastSeen: number;
  noshinLastSeen: number;
  nabilWalking?: boolean;
  noshinWalking?: boolean;
};

export type WalkPos = {
  worldX: number;
  facing: -1 | 1;
  walking: boolean;
  jumpY?: number;
  ts: number;
};

export async function syncPresence(who: 'noshin' | 'nabil'): Promise<Presence> {
  try {
    const res = await fetch(`${API_URL}/api/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who })
    });
    return await res.json();
  } catch {
    return { nabilLastSeen: 0, noshinLastSeen: 0 };
  }
}

export async function syncWalkPos(
  who: 'noshin' | 'nabil',
  pos: WalkPos
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/walk-pos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who, ...pos })
    });
  } catch {
    // Fallback to localStorage
  }
}

export async function getWalkPos(who: 'noshin' | 'nabil'): Promise<WalkPos | null> {
  try {
    const res = await fetch(`${API_URL}/api/walk-pos/${who}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function addChatMessage(from: 'noshin' | 'nabil', text: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, text })
    });
  } catch {
    // Fallback to localStorage
  }
}

export async function getChatMessages(): Promise<Array<{from: 'noshin' | 'nabil', text: string, createdAt: number}>> {
  try {
    const res = await fetch(`${API_URL}/api/messages`);
    return await res.json();
  } catch {
    return [];
  }
}
