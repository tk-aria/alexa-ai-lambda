#!/usr/bin/env node
/**
 * Local test - validates handler routing without actual API calls
 */
const { handler } = require('../src/index');

async function test(name, event, validator) {
  try {
    const result = await handler(event);
    const body = JSON.parse(result.body);
    const pass = validator(result, body);
    console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}`);
    if (!pass) {
      console.log(`  Status: ${result.statusCode}`);
      console.log(`  Body: ${JSON.stringify(body).substring(0, 200)}`);
    }
    return pass;
  } catch (e) {
    console.log(`ERROR: ${name} - ${e.message}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let total = 0;

  // Test 1: Health check
  total++;
  if (await test('Health check GET /', {
    requestContext: { http: { method: 'GET', path: '/' } },
    rawPath: '/',
  }, (res, body) => res.statusCode === 200 && body.status === 'ok')) passed++;

  // Test 2: Missing messages (OpenAI format)
  total++;
  if (await test('OpenAI format - missing messages', {
    requestContext: { http: { method: 'POST', path: '/v1/chat/completions' } },
    rawPath: '/v1/chat/completions',
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514' }),
  }, (res, body) => res.statusCode === 400 && body.error)) passed++;

  // Test 3: Missing messages (Anthropic format)
  total++;
  if (await test('Anthropic format - missing messages', {
    requestContext: { http: { method: 'POST', path: '/v1/messages' } },
    rawPath: '/v1/messages',
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514' }),
  }, (res, body) => res.statusCode === 400 && body.error)) passed++;

  // Test 4: Alexa Launch Request
  total++;
  if (await test('Alexa Launch Request', {
    requestContext: { http: { method: 'POST', path: '/' } },
    rawPath: '/',
    body: JSON.stringify({
      version: '1.0',
      session: { new: true, sessionId: 'test', application: { applicationId: 'test' }, user: { userId: 'test' }, attributes: {} },
      request: { type: 'LaunchRequest', requestId: 'test', timestamp: new Date().toISOString(), locale: 'ja-JP' },
    }),
  }, (res, body) => {
    const inner = typeof body === 'string' ? JSON.parse(body) : body;
    return res.statusCode === 200 && inner.response?.outputSpeech;
  })) passed++;

  // Test 5: Alexa Stop Intent
  total++;
  if (await test('Alexa Stop Intent', {
    requestContext: { http: { method: 'POST', path: '/' } },
    rawPath: '/',
    body: JSON.stringify({
      version: '1.0',
      session: { new: false, sessionId: 'test', application: { applicationId: 'test' }, user: { userId: 'test' }, attributes: {} },
      request: { type: 'IntentRequest', requestId: 'test', timestamp: new Date().toISOString(), locale: 'ja-JP', intent: { name: 'AMAZON.StopIntent' } },
    }),
  }, (res, body) => {
    const inner = typeof body === 'string' ? JSON.parse(body) : body;
    return res.statusCode === 200 && inner.response?.shouldEndSession === true;
  })) passed++;

  // Test 6: Method not allowed
  total++;
  if (await test('Method not allowed PUT', {
    requestContext: { http: { method: 'PUT', path: '/v1/chat/completions' } },
    rawPath: '/v1/chat/completions',
    body: JSON.stringify({}),
  }, (res, body) => res.statusCode === 405)) passed++;

  // Test 7: Streaming not supported
  total++;
  if (await test('Streaming not supported (OpenAI)', {
    requestContext: { http: { method: 'POST', path: '/v1/chat/completions' } },
    rawPath: '/v1/chat/completions',
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }, (res, body) => res.statusCode === 400 && body.error?.message?.includes('Streaming'))) passed++;

  // Test 8: Unknown path auto-detection
  total++;
  if (await test('Unknown path returns 400', {
    requestContext: { http: { method: 'POST', path: '/unknown' } },
    rawPath: '/unknown',
    body: JSON.stringify({ foo: 'bar' }),
  }, (res, body) => res.statusCode === 400)) passed++;

  console.log(`\n=== Results: ${passed}/${total} passed ===`);
  return passed === total;
}

runTests().then((ok) => process.exit(ok ? 0 : 1));
