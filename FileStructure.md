
├── server/                      # Node.js + Express Backend
│   ├── src/
│   │   ├── config/              
│   │   │   ├── db.js
│   │   │   ├── redis.js
│   │   │   └── ai.js
│   │   ├── constants/           # Enums, prompt templates, tool schemas
│   │   ├── controllers/         # Request handlers
│   │   │   ├── authController.js
│   │   │   ├── postController.js
│   │   │   ├── requestController.js  # Accept/Reject connect requests
│   │   │   ├── chatController.js
│   │   │   └── agentController.js    # AI Chat & Tool execution
│   │   ├── middlewares/         # Auth JWT, rate limiters, error handling
│   │   │   ├── authMiddleware.js
│   │   │   └── aiRateLimiter.js
│   │   ├── models/              # Database Schemas (MongoDB/PostgreSQL)
│   │   │   ├── User.js
│   │   │   ├── Post.js
│   │   │   ├── Request.js
│   │   │   ├── Message.js
│   │   │   └── AgentMemory.js        # AI session memory/logs
│   │   ├── routes/              # Express API Routes
│   │   │   ├── authRoutes.js
│   │   │   ├── postRoutes.js
│   │   │   ├── requestRoutes.js
│   │   │   ├── chatRoutes.js
│   │   │   └── agentRoutes.js
│   │   ├── services/            # Core Business Logic
│   │   │   ├── authService.js
│   │   │   ├── requestService.js
│   │   │   ├── chatService.js
│   │   │   └── ai/              # AI Agent Engine Core
│   │   │       ├── agentEngine.js    # Agent loop (ReAct / LLM execution)
│   │   │       ├── memoryManager.js  # Conversation context & vector store
│   │   │       └── tools/            # Actions the AI can take on GreenLynk
│   │   │           ├── fetchPostsTool.js
│   │   │           ├── manageRequestsTool.js
│   │   │           ├── searchUsersTool.js
│   │   │           └── index.js
│   │   ├── sockets/             # Real-time WebSocket handlers
│   │   │   ├── chatSocket.js
│   │   │   ├── callSocket.js         # Signaling for WebRTC calls
│   │   │   └── index.js
│   │   ├── utils/               # Helpers, logger, response wrappers
│   │   └── app.js               # Express application initialization
│   ├── server.js                # Server entry point (HTTP + Socket.io)
│   └── .env.example             # API keys, DB string, JWT secrets
│