# Green Lynk Backend

## Setup

1. Copy `.env` to `.env` and update values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start backend:
   ```bash
   npm run dev
   ```

### Google OAuth

Create OAuth credentials in Google Cloud Console and add this authorized redirect URI:

```bash
http://localhost:3000/auth/google/callback
```

Set these backend environment variables:

```bash
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## AI Agent

The Green Lynk agent uses a planner-tool-executor architecture:

- `agent/aiPlanner.js` asks the configured AI model to choose one Green Lynk tool and extract arguments.
- `agent/toolRegistry.js` defines every tool the agent is allowed to call.
- `agent/agentExecutor.js` validates the planned tool and executes it with the authenticated user context.
- `agent/greenLynkAgent.js` is the agent runtime that orchestrates planning, fallback, and execution.
- `agent/runAgent.js` is a thin compatibility wrapper used by the controller.

The AI planner never writes directly to the database. It can only choose registered tools, and those tools enforce Green Lynk rules such as connection checks.

```bash
AGENT_FEATURE_ENABLED=true
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-mini
```

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/google/url`
- `POST /api/auth/google/callback`
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/chat/chats`
- `GET /api/chat/messages/:userId`
- `GET /api/groups`
- `GET /api/groups/:groupId/messages`
- `GET /api/agent/capabilities`
- `POST /api/agent/chat`

Socket.IO uses the backend server URL and respects `FRONTEND_URL` / `CORS_ORIGIN` from `.env`.
