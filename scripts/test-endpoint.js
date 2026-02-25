#!/usr/bin/env node
/**
 * Test script for the Lambda endpoint
 * Usage: LAMBDA_URL=https://xxx.lambda-url.ap-northeast-1.on.aws node scripts/test-endpoint.js
 */

const https = require('https');
const http = require('http');

const LAMBDA_URL = process.env.LAMBDA_URL;

if (!LAMBDA_URL) {
  console.error('ERROR: Set LAMBDA_URL environment variable');
  console.error('Example: LAMBDA_URL=https://xxx.lambda-url.ap-northeast-1.on.aws node scripts/test-endpoint.js');
  process.exit(1);
}

const baseUrl = new URL(LAMBDA_URL);
const client = baseUrl.protocol === 'https:' ? https : http;

async function request(method, path, body) {
  const url = new URL(path, LAMBDA_URL);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log(`Testing endpoint: ${LAMBDA_URL}\n`);
  let passed = 0;
  let failed = 0;

  // Test 1: Health check
  console.log('--- Test 1: Health Check (GET /) ---');
  try {
    const res = await request('GET', '/');
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(res.body, null, 2)}`);
    if (res.status === 200 && res.body.status === 'ok') {
      console.log('PASS\n');
      passed++;
    } else {
      console.log('FAIL\n');
      failed++;
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}\nFAIL\n`);
    failed++;
  }

  // Test 2: OpenAI format
  console.log('--- Test 2: OpenAI Chat Completion Format ---');
  try {
    const res = await request('POST', '/v1/chat/completions', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(res.body, null, 2).substring(0, 500)}`);
    if (res.status === 200 && res.body.choices) {
      console.log('PASS\n');
      passed++;
    } else {
      console.log(`FAIL (status=${res.status})\n`);
      failed++;
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}\nFAIL\n`);
    failed++;
  }

  // Test 3: Anthropic format
  console.log('--- Test 3: Anthropic Messages Format ---');
  try {
    const res = await request('POST', '/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
      max_tokens: 100,
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(res.body, null, 2).substring(0, 500)}`);
    if (res.status === 200 && res.body.content) {
      console.log('PASS\n');
      passed++;
    } else {
      console.log(`FAIL (status=${res.status})\n`);
      failed++;
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}\nFAIL\n`);
    failed++;
  }

  // Test 4: Alexa Launch Request
  console.log('--- Test 4: Alexa Launch Request ---');
  try {
    const res = await request('POST', '/', {
      version: '1.0',
      session: {
        new: true,
        sessionId: 'test-session',
        application: { applicationId: 'test-app' },
        user: { userId: 'test-user' },
        attributes: {},
      },
      request: {
        type: 'LaunchRequest',
        requestId: 'test-req',
        timestamp: new Date().toISOString(),
        locale: 'ja-JP',
      },
    });
    console.log(`Status: ${res.status}`);
    const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    console.log(`Response: ${JSON.stringify(body, null, 2).substring(0, 500)}`);
    if (res.status === 200 && body.response?.outputSpeech) {
      console.log('PASS\n');
      passed++;
    } else {
      console.log(`FAIL\n`);
      failed++;
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}\nFAIL\n`);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
