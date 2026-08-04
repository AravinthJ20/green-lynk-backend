const https = require('https');
const { getToolNames, getToolPrompt } = require('./toolRegistry');

const resolveProvider = () => {
  const configuredProvider = `${process.env.LLM_PROVIDER || ''}`.trim().toLowerCase();
  if (configuredProvider) return configuredProvider;
  if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) return 'gemini';
  return 'openai';
};

const LLM_PROVIDER = resolveProvider();
const OPENAI_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_HOST = process.env.OPENAI_API_HOST || 'api.openai.com';
const GEMINI_MODEL = process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_HOST = process.env.GEMINI_API_HOST || 'generativelanguage.googleapis.com';

const ALLOWED_TOOLS = new Set(getToolNames());

const buildSystemInstructions = () => `You are the Green Lynk AI agent planner.
Choose exactly one available Green Lynk tool and extract its arguments.
You do not execute tools yourself. You only plan the next tool call.
Do not answer conversationally. Do not include markdown.

Available tools:
${getToolPrompt()}

Return shape:
{"tool":"send_message","confidence":0.92,"arguments":{"username":"Rahul","content":"I'll be online at 8 PM"},"reason":"User asked to send Rahul a message."}

Rules:
- Extract names, locations, interests, message text, status text, and reminder time naturally.
- For reminders, keep the user's time phrase in whenText, for example "tomorrow at 6 PM".
- If required arguments are missing, use tool "unknown" with confidence below 0.5.
- Never invent usernames, message content, status text, or reminder times.`;

const requestJson = ({ hostname, path, headers, payload }) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers
        },
        timeout: 12000
      },
      (response) => {
        let data = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (error) {
            reject(new Error('AI planner returned an invalid response.'));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(parsed.error?.message || 'AI planner request failed.'));
            return;
          }

          resolve(parsed);
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('AI planner request timed out.'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });

const extractOpenAiText = (response) => {
  if (typeof response.output_text === 'string') return response.output_text;

  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
};

const extractGeminiText = (response) =>
  (response.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text)
    .filter((text) => typeof text === 'string')
    .join('\n')
    .trim();

const parsePlannerJson = (text) => {
  const cleaned = `${text || ''}`
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  return JSON.parse(cleaned);
};

const normalizePlan = (plan) => {
  const tool = `${plan?.tool || plan?.intent || 'unknown'}`.trim();
  if (!ALLOWED_TOOLS.has(tool)) return null;

  const confidence = Number(plan.confidence);
  return {
    tool,
    intent: tool,
    confidence: Number.isFinite(confidence) ? confidence : 0.7,
    arguments: plan.arguments && typeof plan.arguments === 'object'
      ? plan.arguments
      : plan.slots && typeof plan.slots === 'object'
        ? plan.slots
        : {},
    reason: typeof plan.reason === 'string' ? plan.reason : '',
    source: 'ai'
  };
};

const buildFinalAgentInstructions = ({ message, plan, toolResult }) => `You are the Green Lynk AI assistant.
The user asked: "${message.trim()}"
The selected tool is: ${plan.tool}
Tool arguments: ${JSON.stringify(plan.arguments || {}, null, 2)}
Tool execution result: ${JSON.stringify(toolResult || {}, null, 2)}

Use the tool result to answer the user clearly and helpfully. If the tool failed, explain the failure and suggest what the user can do next.
Do not invent additional actions. Do not output JSON. Keep the response short and direct.`;

const finalizeResponseWithOpenAi = async ({ message, plan, toolResult }) => {
  if (!OPENAI_API_KEY) return null;

  const response = await requestJson({
    hostname: OPENAI_API_HOST,
    path: '/v1/responses',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    payload: {
      model: OPENAI_MODEL,
      instructions: buildFinalAgentInstructions({ message, plan, toolResult }),
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: message }]
        }
      ],
      max_output_tokens: 250
    }
  });

  return extractOpenAiText(response);
};

const finalizeResponseWithGemini = async ({ message, plan, toolResult }) => {
  if (!GEMINI_API_KEY) return null;

  const response = await requestJson({
    hostname: GEMINI_API_HOST,
    path: `/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    headers: { 'x-goog-api-key': GEMINI_API_KEY },
    payload: {
      system_instruction: {
        parts: [{ text: buildFinalAgentInstructions({ message, plan, toolResult }) }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 250,
        responseMimeType: 'text/plain'
      }
    }
  });

  return extractGeminiText(response);
};

const finalizeAgentResponse = async ({ message, plan, toolResult }) => {
  if (LLM_PROVIDER === 'gemini') {
    return finalizeResponseWithGemini({ message, plan, toolResult });
  }

  if (LLM_PROVIDER === 'openai') {
    return finalizeResponseWithOpenAi({ message, plan, toolResult });
  }

  return null;
};

const planWithOpenAi = async ({ message }) => {
  if (!OPENAI_API_KEY) return null;

  const response = await requestJson({
    hostname: OPENAI_API_HOST,
    path: '/v1/responses',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    payload: {
      model: OPENAI_MODEL,
      instructions: buildSystemInstructions(),
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: message }]
        }
      ],
      max_output_tokens: 350
    }
  });

  return normalizePlan(parsePlannerJson(extractOpenAiText(response)));
};

const planWithGemini = async ({ message }) => {
  if (!GEMINI_API_KEY) return null;

  const response = await requestJson({
    hostname: GEMINI_API_HOST,
    path: `/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    headers: { 'x-goog-api-key': GEMINI_API_KEY },
    payload: {
      system_instruction: {
        parts: [{ text: buildSystemInstructions() }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 350,
        responseMimeType: 'application/json'
      }
    }
  });

  return normalizePlan(parsePlannerJson(extractGeminiText(response)));
};

const planWithAi = async ({ message }) => {
  if (LLM_PROVIDER === 'gemini') {
    return planWithGemini({ message });
  }

  if (LLM_PROVIDER === 'openai') {
    return planWithOpenAi({ message });
  }

  throw new Error(`Unsupported LLM_PROVIDER "${LLM_PROVIDER}". Use "openai" or "gemini".`);
};

const getPlannerConfig = () => ({
  provider: LLM_PROVIDER,
  model: LLM_PROVIDER === 'gemini' ? GEMINI_MODEL : OPENAI_MODEL,
  configured: LLM_PROVIDER === 'gemini' ? Boolean(GEMINI_API_KEY) : Boolean(OPENAI_API_KEY)
});

module.exports = {
  getPlannerConfig,
  planWithAi
};
