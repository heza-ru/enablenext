const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { PrincipalType, ResourceType } = require('librechat-data-provider');
const { Agent, AclEntry } = require('~/db/models');
const { createAgent } = require('./Agent');
const { User } = require('~/db/models');

const ROOT = path.resolve(__dirname, '../..');

function readSkill(filename) {
  return fs.readFileSync(path.join(ROOT, 'agents', filename), 'utf8');
}

const WHATFIX_AGENTS = [
  {
    id: 'whatfix-presentation-creator',
    name: 'Presentation Creator',
    description: 'Create polished Whatfix-branded presentations and playbooks for any topic.',
    skillFile: 'presentation-creator.skill.md',
    tools: ['file_search'],
    artifacts: 'default',
  },
  {
    id: 'whatfix-excel-creator',
    name: 'Excel Creator',
    description: 'Create Whatfix-branded spreadsheets, trackers, and dashboards.',
    skillFile: 'excel-creator.skill.md',
    tools: [],
    artifacts: 'default',
  },
  {
    id: 'whatfix-doc-creator',
    name: 'Document Creator',
    description: 'Create Whatfix-branded documents, reports, and proposals.',
    skillFile: 'doc-creator.skill.md',
    tools: [],
    artifacts: 'default',
  },
];

/**
 * Ensures a PUBLIC viewer ACL entry exists for the given agent _id.
 * Uses a raw upsert so it's safe to call on every boot.
 */
async function ensurePublicAccess(agentMongoId, grantedBy) {
  await AclEntry.findOneAndUpdate(
    { principalType: PrincipalType.PUBLIC, resourceType: ResourceType.AGENT, resourceId: agentMongoId },
    {
      $set: {
        principalType: PrincipalType.PUBLIC,
        resourceType: ResourceType.AGENT,
        resourceId: agentMongoId,
        permBits: 1, // VIEW
        grantedBy,
        grantedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

/**
 * Seeds the three Whatfix-branded agents at server startup.
 * Finds agents by canonical ID or name, fixes provider/model, and ensures
 * PUBLIC viewer access so all users on the instance can use them.
 */
const seedWhatfixAgents = async () => {
  let authorId;

  try {
    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    if (adminUser) {
      authorId = adminUser._id;
    } else {
      const anyUser = await User.findOne().lean();
      authorId = anyUser ? anyUser._id : new mongoose.Types.ObjectId();
    }
  } catch (err) {
    logger.warn('[seedWhatfixAgents] Could not resolve author user:', err.message);
    authorId = new mongoose.Types.ObjectId();
  }

  for (const def of WHATFIX_AGENTS) {
    try {
      let instructions;
      try {
        instructions = readSkill(def.skillFile);
      } catch (err) {
        logger.error(`[seedWhatfixAgents] Cannot read ${def.skillFile}:`, err.message);
        continue;
      }

      const patch = {
        name: def.name,
        description: def.description,
        instructions,
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        tools: def.tools,
        artifacts: def.artifacts,
      };

      // Find by canonical ID first, then fall back to name
      let agentDoc = await Agent.findOne({ id: def.id }).lean();

      if (!agentDoc) {
        agentDoc = await Agent.findOne({ name: def.name }).lean();
      }

      if (agentDoc) {
        // Patch in place — use raw $set to bypass versioning complexity
        await Agent.updateOne(
          { _id: agentDoc._id },
          { $set: { ...patch, id: def.id } },
        );
        logger.info(`[seedWhatfixAgents] Patched "${def.name}" (${agentDoc.id} → ${def.id})`);

        await ensurePublicAccess(agentDoc._id, authorId);
        logger.info(`[seedWhatfixAgents] Public access ensured for "${def.name}"`);
        continue;
      }

      // Create from scratch
      const created = await createAgent({
        id: def.id,
        ...patch,
        tool_resources: {},
        actions: [],
        model_parameters: { max_tokens: 8192 },
        author: authorId,
      });

      logger.info(`[seedWhatfixAgents] Created "${def.name}" → ${created.id}`);

      await ensurePublicAccess(created._id, authorId);
      logger.info(`[seedWhatfixAgents] Public access granted for "${def.name}"`);
    } catch (err) {
      logger.error(`[seedWhatfixAgents] Failed on "${def.name}":`, err.message);
    }
  }
};

module.exports = { seedWhatfixAgents };
