/**
 * fix-agents.mjs
 * One-shot script: finds the three Whatfix agents by name and patches
 * provider + model directly in MongoDB, regardless of what ID they have.
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/fix-agents.mjs
 *
 * If MONGO_URI is not set it falls back to mongodb://127.0.0.1:27017/LibreChat
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';

const AGENTS_TO_FIX = [
  { name: 'Presentation Creator', model: 'claude-sonnet-4-6', provider: 'anthropic' },
  { name: 'Excel Creator',        model: 'claude-sonnet-4-6', provider: 'anthropic' },
  { name: 'Document Creator',     model: 'claude-sonnet-4-6', provider: 'anthropic' },
];

const client = new MongoClient(MONGO_URI);

async function main() {
  await client.connect();
  console.log('Connected to MongoDB:', MONGO_URI.replace(/:\/\/.*@/, '://***@'));

  const db = client.db();
  const agents = db.collection('agents');

  for (const fix of AGENTS_TO_FIX) {
    // Show current state
    const before = await agents.findOne({ name: fix.name });
    if (!before) {
      console.log(`  NOT FOUND  "${fix.name}" — no document with this name`);
      continue;
    }

    console.log(`  FOUND  "${fix.name}" → id: ${before.id}, provider: "${before.provider}", model: "${before.model}"`);

    const result = await agents.updateMany(
      { name: fix.name },
      { $set: { provider: fix.provider, model: fix.model } },
    );

    console.log(`  PATCHED  ${result.modifiedCount} document(s) for "${fix.name}"`);
  }

  // Show final state
  console.log('\n── Final state ───────────────────────────────────────────────');
  for (const fix of AGENTS_TO_FIX) {
    const docs = await agents.find({ name: fix.name }).toArray();
    for (const doc of docs) {
      console.log(`  "${doc.name}" → id: ${doc.id} | provider: "${doc.provider}" | model: "${doc.model}"`);
    }
  }

  await client.close();
  console.log('\nDone. Refresh LibreChat — agents should now work.');
}

main().catch(err => { console.error(err); process.exit(1); });
