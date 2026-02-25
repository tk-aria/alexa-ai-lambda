/**
 * Alexa Skill Handler - Voice-based AI conversation
 * Supports both OpenAI and Anthropic backends
 */
const https = require('https');

// Session attribute key for conversation history
const HISTORY_KEY = 'conversationHistory';
const MAX_HISTORY = 10; // Max turns to keep

/**
 * Handle Alexa request
 */
async function handleAlexaRequest(body) {
  const requestType = body.request.type;
  const session = body.session || {};
  const attributes = session.attributes || {};

  switch (requestType) {
    case 'LaunchRequest':
      return buildAlexaResponse(
        'AI会話アシスタントへようこそ。何でも聞いてください。',
        'Welcome to AI Chat. Ask me anything.',
        false,
        attributes
      );

    case 'IntentRequest':
      return await handleIntent(body.request, attributes);

    case 'SessionEndedRequest':
      return buildAlexaResponse('', '', true, {});

    default:
      return buildAlexaResponse(
        'すみません、そのリクエストには対応していません。',
        'Sorry, I cannot handle that request.',
        false,
        attributes
      );
  }
}

/**
 * Handle Alexa intents
 */
async function handleIntent(request, attributes) {
  const intentName = request.intent?.name;

  switch (intentName) {
    case 'ChatIntent':
    case 'AMAZON.FallbackIntent': {
      // Get user's spoken text
      const userText =
        request.intent?.slots?.query?.value ||
        request.intent?.slots?.message?.value ||
        'Hello';

      return await handleChatMessage(userText, attributes);
    }

    case 'AMAZON.HelpIntent':
      return buildAlexaResponse(
        '何でも質問してください。AIが回答します。会話を終了するには「ストップ」と言ってください。',
        'Ask me anything and AI will respond. Say stop to end.',
        false,
        attributes
      );

    case 'AMAZON.StopIntent':
    case 'AMAZON.CancelIntent':
      return buildAlexaResponse(
        'さようなら。またお話しましょう。',
        'Goodbye. Talk to you later.',
        true,
        {}
      );

    default:
      return buildAlexaResponse(
        'すみません、もう一度お願いします。',
        'Sorry, please try again.',
        false,
        attributes
      );
  }
}

/**
 * Handle chat message - send to AI and return response
 */
async function handleChatMessage(userText, attributes) {
  // Build conversation history
  const history = attributes[HISTORY_KEY] || [];
  history.push({ role: 'user', content: userText });

  // Keep history manageable
  while (history.length > MAX_HISTORY * 2) {
    history.shift();
  }

  try {
    const aiResponse = await getAIResponse(history);

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse });

    const newAttributes = { ...attributes, [HISTORY_KEY]: history };

    return buildAlexaResponse(aiResponse, aiResponse, false, newAttributes);
  } catch (error) {
    console.error('AI API error:', error);
    return buildAlexaResponse(
      'すみません、AIからの応答を取得できませんでした。もう一度お試しください。',
      'Sorry, I could not get a response. Please try again.',
      false,
      attributes
    );
  }
}

/**
 * Get AI response from configured backend
 */
async function getAIResponse(messages) {
  const model = process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  const backend = getBackendForModel(model);

  if (backend === 'anthropic') {
    return await callAnthropicForAlexa(model, messages);
  } else {
    return await callOpenAIForAlexa(model, messages);
  }
}

/**
 * Call Anthropic API for Alexa
 */
async function callAnthropicForAlexa(model, messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const systemPrompt =
    process.env.ALEXA_SYSTEM_PROMPT ||
    'You are a helpful voice assistant accessed through Alexa. Keep responses concise and conversational, under 3 sentences when possible. Respond in the same language as the user.';

  const payload = JSON.stringify({
    model,
    messages,
    system: systemPrompt,
    max_tokens: 300,
    temperature: 0.7,
  });

  const result = await httpRequest({
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

  return result.content?.[0]?.text || 'No response received.';
}

/**
 * Call OpenAI API for Alexa
 */
async function callOpenAIForAlexa(model, messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const systemPrompt =
    process.env.ALEXA_SYSTEM_PROMPT ||
    'You are a helpful voice assistant accessed through Alexa. Keep responses concise and conversational, under 3 sentences when possible. Respond in the same language as the user.';

  const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const payload = JSON.stringify({
    model,
    messages: allMessages,
    max_tokens: 300,
    temperature: 0.7,
  });

  const result = await httpRequest({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: payload,
  });

  return result.choices?.[0]?.message?.content || 'No response received.';
}

function getBackendForModel(model) {
  if (!model) return 'anthropic';
  const lower = model.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3')) {
    return 'openai';
  }
  return 'anthropic';
}

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
            reject(err);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error('API request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Build Alexa response
 */
function buildAlexaResponse(speechText, cardText, shouldEndSession, sessionAttributes) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '1.0',
      sessionAttributes: sessionAttributes,
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: speechText,
        },
        card: {
          type: 'Simple',
          title: 'AI Chat',
          content: cardText,
        },
        reprompt: shouldEndSession
          ? undefined
          : {
              outputSpeech: {
                type: 'PlainText',
                text: '他に何か聞きたいことはありますか？',
              },
            },
        shouldEndSession,
      },
    }),
  };
}

module.exports = { handleAlexaRequest };
