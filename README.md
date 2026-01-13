# Nexus-AI-Backend-
# Nexus AI Backend

Secure backend API for Nexus AI project management platform.

## Setup

1. Clone repo
2. `npm install`
3. Create `.env` file (see `.env.example`)
4. `npm start`

## Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key
- `PORT` - Server port (default: 3001)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend URLs

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/test` - Test Gemini connection
- `POST /api/project-hints` - Generate project hints
- `POST /api/chat` - Chat with Nexus AI
- `POST /api/roadmap` - Generate project roadmap

## Deploy to Vercel

1. Import this repo in Vercel
2. Add environment variables
3. Deploy!