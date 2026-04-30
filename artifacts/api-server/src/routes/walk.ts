import { Router, type IRouter } from "express";

const router: IRouter = Router();

// In-memory store for real-time data (in production, use Redis/database)
const presence = {
  nabilLastSeen: 0,
  noshinLastSeen: 0,
  nabilWalking: false,
  noshinWalking: false,
  noshinWalkingAlone: false
};

const walkPositions: Record<string, any> = {};
const messages: Array<{from: string, text: string, createdAt: number}> = [];

// Sync presence
router.post('/presence', (req, res) => {
  const { who } = req.body;
  if (who === 'noshin') {
    presence.noshinLastSeen = Date.now();
  } else if (who === 'nabil') {
    presence.nabilLastSeen = Date.now();
  }
  res.json(presence);
});

// Get presence
router.get('/presence', (req, res) => {
  res.json(presence);
});

// Sync walk position
router.post('/walk-pos', (req, res) => {
  const { who, worldX, facing, walking, jumpY, ts, isAlone } = req.body;
  if (who === 'noshin') {
    presence.noshinWalking = walking;
    presence.noshinWalkingAlone = isAlone || false;
    walkPositions[who] = { worldX, facing, walking, jumpY, ts };
  } else if (who === 'nabil') {
    presence.nabilWalking = walking;
    walkPositions[who] = { worldX, facing, walking, jumpY, ts };
  }
  res.json({ success: true });
});

// Get walk position
router.get('/walk-pos/:who', (req, res) => {
  const { who } = req.params;
  const pos = walkPositions[who] || null;
  res.json(pos);
});

// Add chat message
router.post('/messages', (req, res) => {
  const { from, text } = req.body;
  if ((from === 'noshin' || from === 'nabil') && text?.trim()) {
    messages.push({
      from,
      text: text.trim(),
      createdAt: Date.now()
    });
    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }
  }
  res.json({ success: true });
});

// Get chat messages
router.get('/messages', (req, res) => {
  res.json(messages);
});

export default router;
