# MatrixMind Admin Dashboard

Separate admin control panel for the MatrixMind AI Bot.

## Setup

1. Set environment variables:
   - `BOT_API_URL` = Your bot's Render URL (e.g., `https://ai-chat-bot-htn4.onrender.com`)
   - `PORT` = Port to run on (default: 3001)

2. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install && npx vite build
   ```

3. Start:
   ```bash
   cd backend && npm start
   ```

## Deploy on Render

1. Create a new Web Service on Render
2. Connect this repository
3. Build Command: `cd frontend && npm install && npx vite build && cd ../backend && npm install`
4. Start Command: `cd backend && node server.js`
5. Set environment variable: `BOT_API_URL` = your bot's Render URL
