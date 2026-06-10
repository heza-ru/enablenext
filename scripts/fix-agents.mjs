/**
 * fix-agents.mjs
 * One-shot script: finds the three Whatfix agents by name, patches
 * provider + model, and grants OWNER access to the admin user.
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/fix-agents.mjs
 *
 * Falls back to mongodb://127.0.0.1:27017/LibreChat if MONGO_URI is unset.
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';

const AGENTS_TO_FIX = [
  { name: 'Presentation Creator', model: 'claude-sonnet-4-6', provider: 'anthropic' },
  { name: 'Excel Creator',        model: 'claude-sonnet-4-6', provider: 'anthropic' },
  { name: 'Document Creator',     model: 'claude-sonnet-4-6', provider: 'anthropic' },
];

// PermissionBits: VIEW=1, EDIT=2, DELETE=4  → OWNER = 7
const OWNER_PERM_BITS = 7;
// Public viewer perm bits
const VIEWER_PERM_BITS = 1;

const client = new MongoClient(MONGO_URI);

async function main() {
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db();
  const agents = db.collection('agents');
  const aclEntries = db.collection('aclentries');
  const users = db.collection('users');

  // Find admin user
  const adminUser = await users.findOne({ role: 'ADMIN' }) ?? await users.findOne({});
  if (!adminUser) {
    console.error('No users found in database — have you registered at least one account?');
    process.exit(1);
  }
  console.log(`Admin user: ${adminUser.email} (${adminUser._id})`);

  for (const fix of AGENTS_TO_FIX) {
    const allDocs = await agents.find({ name: fix.name }).toArray();

    if (allDocs.length === 0) {
      console.log(`\n  NOT FOUND  "${fix.name}"`);
      continue;
    }

    console.log(`\n  "${fix.name}" — ${allDocs.length} document(s) found:`);

    for (const doc of allDocs) {
      console.log(`    id: ${doc.id} | provider: "${doc.provider}" | model: "${doc.model}"`);

      // 1. Fix provider + model
      await agents.updateOne(
        { _id: doc._id },
        { $set: { provider: fix.provider, model: fix.model } },
      );
      console.log(`    → patched provider="${fix.provider}", model="${fix.model}"`);

      // 2. Ensure PUBLIC viewer ACL entry exists
      await aclEntries.updateOne(
        { resourceId: doc._id, principalType: 'public' },
        {
          $set: {
            principalType: 'public',
            resourceType: 'agent',
            resourceId: doc._id,
            permBits: VIEWER_PERM_BITS,
            grantedAt: new Date(),
          },
        },
        { upsert: true },
      );
      console.log(`    → ensured PUBLIC viewer ACL`);

      // 3. Grant OWNER to admin user (upsert so it doesn't duplicate)
      await aclEntries.updateOne(
        {
          resourceId: doc._id,
          principalType: 'user',
          principalId: adminUser._id,
        },
        {
          $set: {
            principalType: 'user',
            principalModel: 'User',
            principalId: adminUser._id,
            resourceType: 'agent',
            resourceId: doc._id,
            permBits: OWNER_PERM_BITS,
            grantedBy: adminUser._id,
            grantedAt: new Date(),
          },
        },
        { upsert: true },
      );
      console.log(`    → granted OWNER to ${adminUser.email}`);
    }
  }

  console.log('\n── Done ────────────────────────────────────────────────────────');
  console.log('Refresh LibreChat — agents should now work and be editable.');
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
