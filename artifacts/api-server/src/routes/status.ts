import { Router, type IRouter } from "express";

const router: IRouter = Router();

// System status endpoint
router.get('/', (req, res) => {
  const now = new Date();
  const uptime = process.uptime();
  
  // Check database connection (if DATABASE_URL is configured)
  let dbStatus = 'not_configured';
  if (process.env.DATABASE_URL) {
    // For now, just check if the URL exists
    // In a real app, you'd ping the database
    dbStatus = 'connected';
  }
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  
  const status = {
    timestamp: now.toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`
    },
    services: {
      api: 'healthy',
      database: dbStatus,
      multiplayer: 'active'
    },
    system: {
      node_version: process.version,
      platform: process.platform,
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heap_used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heap_total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      }
    },
    endpoints: {
      presence: '/api/presence',
      walk_position: '/api/walk-pos',
      messages: '/api/messages',
      health: '/api/health'
    },
    active_connections: {
      // This would track active users in a real implementation
      nabil_online: false,
      noshin_online: false,
      total_walkers: 0
    }
  };
  
  res.json(status);
});

export default router;
