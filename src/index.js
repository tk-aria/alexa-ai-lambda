/**
 * Lambda handler - routes requests to AI chat or Alexa handlers
 */
const { handleAIChat } = require('./ai-handler');
const { handleAlexaRequest } = require('./alexa-handler');

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    // Determine request type
    const body = parseBody(event);

    // Alexa request detection
    if (isAlexaRequest(body)) {
      return await handleAlexaRequest(body);
    }

    // AI Chat API request
    return await handleAIChat(event, body);
  } catch (error) {
    console.error('Handler error:', error);
    return buildResponse(500, {
      error: {
        message: error.message || 'Internal server error',
        type: 'server_error',
      },
    });
  }
};

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isAlexaRequest(body) {
  return (
    body &&
    body.version &&
    body.session &&
    body.request &&
    (body.request.type === 'LaunchRequest' ||
      body.request.type === 'IntentRequest' ||
      body.request.type === 'SessionEndedRequest')
  );
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}
