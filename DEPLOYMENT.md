# Deployment Guide

This project is deployed using:
- **Frontend**: Vercel (Vite + React)
- **Backend**: Render (Express + Node)
- **Database**: Neon (PostgreSQL)

## Prerequisites

1. Push your code to GitHub
2. Create accounts on:
   - [Vercel](https://vercel.com) (free)
   - [Render](https://render.com) (free)
   - [Neon](https://neon.tech) (free)

## Step 1: Set up Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string (DATABASE_URL)
4. Save it for later use in Render

## Step 2: Deploy Backend to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `artifacts/api-server`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Runtime**: Node (latest)
5. Add Environment Variables:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `postgresql://neondb_owner:YOUR_PASSWORD@ep-quiet-voice-aobcptzh.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
6. Click "Deploy Web Service"
7. Wait for deployment and copy the backend URL (e.g., `https://your-api.onrender.com`)

## Step 3: Run Database Migrations

After backend is deployed:

1. SSH into the Render service (or use Render shell)
2. Navigate to the api-server directory
3. Run:
   ```bash
   cd lib/db
   pnpm run push
   ```

Or add a build script to handle migrations automatically.

## Step 4: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `artifacts/mockup-sandbox`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables:
   - `PORT`: `3000`
   - `BASE_PATH`: `/`
   - `NODE_ENV`: `production`
   - `VITE_API_URL`: (paste your Render backend URL)
6. Click "Deploy"
7. Wait for deployment and copy the frontend URL

## Step 5: Update Frontend API URL

In your frontend code, ensure API calls use the environment variable:

```typescript
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:10000';
```

## Configuration Files

- `artifacts/mockup-sandbox/vercel.json` - Vercel configuration
- `artifacts/api-server/render.yaml` - Render configuration
- `.env.example` - Environment variable reference

## Troubleshooting

### Backend fails to start
- Check Render logs for errors
- Ensure DATABASE_URL is correct
- Verify port is set to 10000

### Frontend can't reach backend
- Check VITE_API_URL is set correctly in Vercel
- Verify backend is running and accessible
- Check CORS settings in Express backend

### Database connection issues
- Verify Neon DATABASE_URL format
- Ensure SSL is enabled (`sslmode=require`)
- Check Neon console for connection limits

## Local Development

To run locally with production-like setup:

```bash
# Install dependencies
pnpm install

# Set up local environment
cp .env.example .env
# Edit .env with your local values

# Run database migrations
cd lib/db
pnpm run push

# Start backend
cd artifacts/api-server
pnpm run dev

# Start frontend (in another terminal)
cd artifacts/mockup-sandbox
pnpm run dev
```

## Cost Summary

- **Vercel**: Free ( Hobby plan)
- **Render**: Free ( Free tier, spins down after inactivity)
- **Neon**: Free ( 0.5GB storage, auto-hibernates)

Total: **$0/month** for development/small projects.
