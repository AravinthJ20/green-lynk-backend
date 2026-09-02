require('dotenv').config();

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  llmProvider: (process.env.LLM_PROVIDER || '').trim().toLowerCase() || (process.env.OPENAI_API_KEY ? 'openai' : 'fallback'),
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  memoryStore: process.env.AGENT_MEMORY_STORE || 'mongodb',
  rateLimitWindowMs: parseNumber(process.env.AGENT_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  rateLimitMaxRequests: parseNumber(process.env.AGENT_RATE_LIMIT_MAX_REQUESTS, 10)
};