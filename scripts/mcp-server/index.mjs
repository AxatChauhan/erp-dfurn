#!/usr/bin/env node

/**
 * D'furn ERP Tools - Local MCP Server (JSON-RPC 2.0 over stdio)
 * Exposes compliance auditing and performance benchmarking tools to Antigravity.
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

// -------------------------------------------------------------
// TOOL 1: AUDIT OWNER COMPLIANCE
// -------------------------------------------------------------
function auditCompliance(targetDir = 'src') {
  const root = path.resolve(REPO_ROOT, targetDir);
  const violations = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === '.git') continue;
        walk(fullPath);
      } else if (/\.(tsx|ts|js|jsx|css)$/.test(ent.name)) {
        checkFile(fullPath);
      }
    }
  }

  function checkFile(filePath) {
    const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      // 1. Check for "Them" dashes (—) in code/comments
      if (line.includes('—')) {
        violations.push({
          file: relPath,
          line: lineNo,
          type: 'THEM_DASH',
          message: 'Found "them" dash (—). User-facing text must use en dash (–) for empty values or (·) for separators.',
          snippet: line.trim(),
        });
      }

      // 2. Check for raw dimensions like 1200x600x750 without L B H
      const rawDimMatch = line.match(/\b(\d{2,4}\s*[xX*×]\s*\d{2,4}\s*[xX*×]\s*\d{2,4})\b/);
      if (rawDimMatch && !line.includes('L ') && !line.includes('dims') && !line.includes('Dimensions')) {
        violations.push({
          file: relPath,
          line: lineNo,
          type: 'DIMENSION_FORMAT',
          message: `Dimension string "${rawDimMatch[1]}" must follow "L 1400 × B 700 × H 750 mm" (B for Breadth, never W).`,
          snippet: line.trim(),
        });
      }

      // 3. Check for phone duplicate blocking in manual client POST
      if (relPath.includes('api/clients/route.ts') && line.includes('409') && line.toLowerCase().includes('phone number')) {
        violations.push({
          file: relPath,
          line: lineNo,
          type: 'DUPLICATE_PHONE_CHECK',
          message: 'Manual client creation must allow duplicate phones per owner rule (CLAUDE.md §128).',
          snippet: line.trim(),
        });
      }
    });
  }

  walk(root);

  return {
    scannedDirectory: targetDir,
    totalViolations: violations.length,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    violations,
  };
}

// -------------------------------------------------------------
// TOOL 2: BENCHMARK ENDPOINT
// -------------------------------------------------------------
async function benchmarkEndpoint(endpointPath = '/api/clients', iterations = 5, baseUrl = 'https://optimistic-carson-blush.vercel.app') {
  const fullUrl = `${baseUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  const timings = [];
  let status = 200;
  let payloadBytes = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const res = await fetch(fullUrl, {
        headers: { 'User-Agent': 'DFurn-Benchmarker/1.0' },
      });
      status = res.status;
      const text = await res.text();
      const duration = performance.now() - start;
      timings.push(duration);
      if (i === 0) payloadBytes = Buffer.byteLength(text, 'utf8');
    } catch (err) {
      timings.push(9999);
    }
  }

  timings.sort((a, b) => a - b);
  const min = Math.round(timings[0] * 10) / 10;
  const max = Math.round(timings[timings.length - 1] * 10) / 10;
  const median = Math.round(timings[Math.floor(timings.length / 2)] * 10) / 10;
  const avg = Math.round((timings.reduce((a, b) => a + b, 0) / timings.length) * 10) / 10;

  return {
    url: fullUrl,
    iterations,
    statusCode: status,
    payloadSizeKB: Math.round((payloadBytes / 1024) * 10) / 10,
    minMs: min,
    medianMs: median,
    avgMs: avg,
    maxMs: max,
    meetsStandard: median < 400,
    rating: median < 200 ? 'EXCELLENT' : median < 400 ? 'GOOD' : 'NEEDS_OPTIMIZATION',
  };
}

// -------------------------------------------------------------
// MCP JSON-RPC 2.0 PROTOCOL DISPATCHER
// -------------------------------------------------------------
rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    const { id, method, params } = msg;

    if (method === 'initialize') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'dfurn-tools', version: '1.0.0' },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      // Client handshake acknowledged
      return;
    }

    if (method === 'tools/list') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'audit_owner_compliance',
              description: 'Scans source files for violations of the owner\'s design and code mandates (such as "them" dashes, invalid dimension formats, or client duplicate phone rejections).',
              inputSchema: {
                type: 'object',
                properties: {
                  targetDir: {
                    type: 'string',
                    description: 'Target directory relative to repository root to scan (default: "src")',
                  },
                },
              },
            },
            {
              name: 'benchmark_endpoint',
              description: 'Benchmarks an API route or page endpoint over multiple iterations and returns min/median/avg response time and payload size.',
              inputSchema: {
                type: 'object',
                properties: {
                  endpointPath: {
                    type: 'string',
                    description: 'Path of the endpoint to test (e.g. "/api/clients", "/api/quotations")',
                  },
                  iterations: {
                    type: 'number',
                    description: 'Number of sample iterations to execute (default: 5)',
                  },
                  baseUrl: {
                    type: 'string',
                    description: 'Base URL to test against (defaults to live production URL)',
                  },
                },
              },
            },
          ],
        },
      });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};

      if (name === 'audit_owner_compliance') {
        const result = auditCompliance(args?.targetDir);
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
        });
        return;
      }

      if (name === 'benchmark_endpoint') {
        const result = await benchmarkEndpoint(args?.endpointPath, args?.iterations, args?.baseUrl);
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
        });
        return;
      }

      sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Tool not found: ${name}` },
      });
      return;
    }

    // Default unknown method response
    if (id !== undefined) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  } catch (err) {
    // Non-JSON or broken line
  }
});
