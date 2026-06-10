/**
 * seed-agents.mjs
 * Creates or updates the default Whatfix agents in LibreChat via the API.
 *
 * Usage:
 *   LIBRECHAT_TOKEN=<your-jwt> node scripts/seed-agents.mjs
 *   LIBRECHAT_TOKEN=<your-jwt> node scripts/seed-agents.mjs --update   # patch existing agents too
 *
 * To get your token: open LibreChat in browser → DevTools → Application →
 * Cookies → find "token" or check localStorage for "__Secure-next-auth..."
 * OR: run with --login flag to authenticate first:
 *   LIBRECHAT_EMAIL=you@example.com LIBRECHAT_PASSWORD=pass node scripts/seed-agents.mjs --login
 *   LIBRECHAT_EMAIL=you@example.com LIBRECHAT_PASSWORD=pass node scripts/seed-agents.mjs --login --update
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BASE_URL = process.env.LIBRECHAT_URL || 'http://localhost:3080';
const TOKEN    = process.env.LIBRECHAT_TOKEN;

// ── Helpers ────────────────────────────────────────────────────────────────

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.LIBRECHAT_EMAIL,
      password: process.env.LIBRECHAT_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

async function api(method, path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function readSkill(filename) {
  return readFileSync(resolve(ROOT, 'agents', filename), 'utf8');
}

// ── Agent definitions ──────────────────────────────────────────────────────

const AGENTS = [
  {
    name: 'Presentation Creator',
    description: 'Creates Whatfix-branded slide decks and playbooks. Supports dark pitch decks and POC/demo/sales playbooks with white table slides and Crimson/Orange split panels. Ask for any presentation or playbook topic.',
    instructions: readSkill('presentation-creator.skill.md'),
    model: 'claude-sonnet-4-6',
    endpoint: 'anthropic',
    tools: [],
    capabilities: ['artifacts', 'file_search'],
    artifacts: true,
    iconURL: null,
  },
  {
    name: 'Excel Creator',
    description: 'Generates Whatfix-branded .xlsx spreadsheets, trackers, dashboards and reports.',
    instructions: readSkill('excel-creator.skill.md'),
    model: 'claude-sonnet-4-6',
    endpoint: 'anthropic',
    tools: [],
    capabilities: ['artifacts'],
    artifacts: true,
    iconURL: null,
  },
  {
    name: 'Document Creator',
    description: 'Writes and exports Whatfix-branded .docx reports, proposals, briefs and one-pagers.',
    instructions: readSkill('doc-creator.skill.md'),
    model: 'claude-sonnet-4-6',
    endpoint: 'anthropic',
    tools: [],
    capabilities: ['artifacts'],
    artifacts: true,
    iconURL: null,
  },
];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  let token = TOKEN;
  const doUpdate = process.argv.includes('--update');

  if (!token || process.argv.includes('--login')) {
    console.log('Logging in...');
    token = await login();
    console.log(`Token: ${token.slice(0, 20)}...`);
  }

  if (!token) {
    console.error('No token. Set LIBRECHAT_TOKEN or use --login with LIBRECHAT_EMAIL + LIBRECHAT_PASSWORD');
    process.exit(1);
  }

  // Fetch existing agents (id + name)
  let existingAgents = [];
  try {
    const data = await api('GET', '/api/agents', null, token);
    existingAgents = data.agents || data || [];
    console.log(`Found ${existingAgents.length} existing agents.${doUpdate ? ' (--update: will patch existing)' : ''}`);
  } catch (e) {
    console.warn('Could not fetch existing agents:', e.message);
  }

  for (const agent of AGENTS) {
    const match = existingAgents.find(a => a.name === agent.name);

    if (match) {
      if (!doUpdate) {
        console.log(`  SKIP  ${agent.name} (already exists — use --update to patch)`);
        continue;
      }
      const agentId = match.id || match._id;
      try {
        await api('PATCH', `/api/agents/${agentId}`, agent, token);
        console.log(`  UPDATE ${agent.name} → id: ${agentId}`);
      } catch (e) {
        console.error(`  FAIL  ${agent.name} (update): ${e.message}`);
      }
      continue;
    }

    try {
      const created = await api('POST', '/api/agents', agent, token);
      console.log(`  CREATE ${agent.name} → id: ${created.id || created._id}`);
    } catch (e) {
      console.error(`  FAIL  ${agent.name}: ${e.message}`);
    }
  }

  console.log('\nDone. Refresh LibreChat to see the agents.');
}

main().catch(err => { console.error(err); process.exit(1); });
