/**
 * AI Chat Handler - supports OpenAI and Anthropic API formats
 */
const https = require('https');

// Supported API formats
const API_FORMAT = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
};

/**
 * Main AI chat handler
 */
async function handleAIChat(event, body) {
  const path = event.rawPath || event.requestContext?.http?.path || '/';
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';

  // Health check
  if (path === '/health' || path === '/') {
    if (method === 'GET') {
      return buildResponse(200, {
        status: 'ok',
        service: 'alexa-ai-lambda',
        endpoints: {
          openai: '/v1/chat/completions',
          anthropic: '/v1/messages',
          alexa: '/ (POST with Alexa request body)',
        },
      });
    }
  }

  if (method !== 'POST') {
    return buildResponse(405, { error: { message: 'Method not allowed', type: 'invalid_request_error' } });
  }

  // Route by path
  if (path === '/v1/chat/completions') {
    return await handleOpenAIFormat(body);
  } else if (path === '/v1/messages') {
    return await handleAnthropicFormat(body);
  }

  // Auto-detect format from body
  const format = detectFormat(body);
  if (format === API_FORMAT.OPENAI) {
    return await handleOpenAIFormat(body);
  } else if (format === API_FORMAT.ANTHROPIC) {
    return await handleAnthropicFormat(body);
  }

  return buildResponse(400, {
    error: {
      message: 'Could not determine API format. Use /v1/chat/completions for OpenAI or /v1/messages for Anthropic format.',
      type: 'invalid_request_error',
    },
  });
}

/**
 * Detect API format from request body
 */
function detectFormat(body) {
  if (!body) return null;
  // OpenAI format has 'messages' array with role/content objects
  if (body.messages && body.model && !body.max_tokens && !body.system) {
    return API_FORMAT.OPENAI;
  }
  // Anthropic format has 'messages' + 'max_tokens' and optional 'system'
  if (body.messages && body.max_tokens !== undefined) {
    return API_FORMAT.ANTHROPIC;
  }
  // Default: try OpenAI
  if (body.messages) return API_FORMAT.OPENAI;
  return null;
}

/**
 * Handle OpenAI Chat Completion format
 * POST /v1/chat/completions
 */
async function handleOpenAIFormat(body) {
  const { model, messages, temperature, max_tokens, stream } = body;

  if (!messages || !Array.isArray(messages)) {
    return buildResponse(400, {
      error: { message: 'messages is required and must be an array', type: 'invalid_request_error' },
    });
  }

  if (stream) {
    return buildResponse(400, {
      error: { message: 'Streaming is not supported in Lambda', type: 'invalid_request_error' },
    });
  }

  // Determine backend
  const backendModel = model || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  const backend = getBackendForModel(backendModel);

  let result;
  if (backend === 'anthropic') {
    // Convert OpenAI format to Anthropic and call
    const anthropicMessages = [];
    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }

    result = await callAnthropicAPI({
      model: backendModel,
      messages: anthropicMessages,
      system: systemPrompt || undefined,
      max_tokens: max_tokens || 1024,
      temperature: temperature,
    });

    // Convert Anthropic response to OpenAI format
    return buildResponse(200, {
      id: `chatcmpl-${result.id || Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content?.[0]?.text || '',
          },
          finish_reason: mapStopReason(result.stop_reason),
        },
      ],
      usage: {
        prompt_tokens: result.usage?.input_tokens || 0,
        completion_tokens: result.usage?.output_tokens || 0,
        total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
      },
    });
  } else {
    // Call OpenAI API directly
    result = await callOpenAIAPI({
      model: backendModel,
      messages,
      temperature,
      max_tokens,
    });
    return buildResponse(200, result);
  }
}

/**
 * Handle Anthropic Messages format
 * POST /v1/messages
 */
async function handleAnthropicFormat(body) {
  const { model, messages, system, max_tokens, temperature, stream } = body;

  if (!messages || !Array.isArray(messages)) {
    return buildResponse(400, {
      error: {
        type: 'invalid_request_error',
        message: 'messages is required and must be an array',
      },
    });
  }

  if (stream) {
    return buildResponse(400, {
      error: {
        type: 'invalid_request_error',
        message: 'Streaming is not supported in Lambda',
      },
    });
  }

  const backendModel = model || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  const backend = getBackendForModel(backendModel);

  if (backend === 'openai') {
    // Convert Anthropic format to OpenAI and call
    const openaiMessages = [];
    if (system) {
      openaiMessages.push({ role: 'system', content: system });
    }
    for (const msg of messages) {
      openaiMessages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : msg.content.map((c) => c.text).join(''),
      });
    }

    const result = await callOpenAIAPI({
      model: backendModel,
      messages: openaiMessages,
      temperature,
      max_tokens: max_tokens || 1024,
    });

    // Convert OpenAI response to Anthropic format
    const choice = result.choices?.[0];
    return buildResponse(200, {
      id: result.id || `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: choice?.message?.content || '' }],
      model: result.model,
      stop_reason: mapFinishReason(choice?.finish_reason),
      usage: {
        input_tokens: result.usage?.prompt_tokens || 0,
        output_tokens: result.usage?.completion_tokens || 0,
      },
    });
  } else {
    // Call Anthropic API directly
    const result = await callAnthropicAPI({
      model: backendModel,
      messages,
      system,
      max_tokens: max_tokens || 1024,
      temperature,
    });
    return buildResponse(200, result);
  }
}

/**
 * Determine backend based on model name
 */
function getBackendForModel(model) {
  if (!model) return 'anthropic';
  const lower = model.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3')) {
    return 'openai';
  }
  return 'anthropic';
}

/**
 * Call Anthropic Messages API
 */
async function callAnthropicAPI(params) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const payload = JSON.stringify({
    model: params.model,
    messages: params.messages,
    system: params.system,
    max_tokens: params.max_tokens || 1024,
    temperature: params.temperature,
  });

  return await httpRequest({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: payload,
  });
}

/**
 * Call OpenAI Chat Completions API
 */
async function callOpenAIAPI(params) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const payload = JSON.stringify({
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
  });

  return await httpRequest({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: payload,
  });
}

/**
 * Generic HTTPS request helper
 */
function httpRequest({ hostname, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(parsed.error?.message || `API returned ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('API request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Map Anthropic stop_reason to OpenAI finish_reason
 */
function mapStopReason(stopReason) {
  const map = { end_turn: 'stop', max_tokens: 'length', stop_sequence: 'stop' };
  return map[stopReason] || 'stop';
}

/**
 * Map OpenAI finish_reason to Anthropic stop_reason
 */
function mapFinishReason(finishReason) {
  const map = { stop: 'end_turn', length: 'max_tokens', content_filter: 'end_turn' };
  return map[finishReason] || 'end_turn';
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

module.exports = { handleAIChat };
