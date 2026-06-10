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
  },
  {
    id: 'whatfix-excel-creator',
    name: 'Excel Creator',
    description: 'Create Whatfix-branded spreadsheets, trackers, and dashboards.',
    skillFile: 'excel-creator.skill.md',
  },
  {
    id: 'whatfix-doc-creator',
    name: 'Document Creator',
    description: 'Create Whatfix-branded documents, reports, and proposals.',
    skillFile: 'doc-creator.skill.md',
  },
];

/**
 * Upserts a PUBLIC viewer ACL entry (permBits=1) for the given agent _id.
 * Safe to call on every boot.
 */
async function ensurePublicView(agentMongoId, grantedBy) {
  await AclEntry.findOneAndUpdate(
    {
      principalType: PrincipalType.PUBLIC,
      resourceType: ResourceType.AGENT,
      resourceId: agentMongoId,
    },
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
 * Upserts an OWNER ACL entry (permBits=7 = VIEW+EDIT+DELETE) for the admin user.
 * This allows the admin to see the full edit form (expanded agent query).
 */
async function ensureAdminOwnership(agentMongoId, adminId) {
  await AclEntry.findOneAndUpdate(
    {
      principalType: PrincipalType.USER,
      principalId: adminId,
      resourceType: ResourceType.AGENT,
      resourceId: agentMongoId,
    },
    {
      $set: {
        principalType: PrincipalType.USER,
        principalModel: 'User',
        principalId: adminId,
        resourceType: ResourceType.AGENT,
        resourceId: agentMongoId,
        permBits: 7, // VIEW + EDIT + DELETE
        grantedBy: adminId,
        grantedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

/**
 * Seeds the three Whatfix-branded agents at server startup.
 * - Finds each agent by canonical ID then by name (preserves existing agent IDs so
 *   conversations don't break).
 * - Patches provider, model, description, and instructions.
 * - Grants PUBLIC view access so all users can use the agents in chat.
 * - Grants admin OWNER access so the admin can open and edit them in the builder.
 */
const seedWhatfixAgents = async () => {
  let adminId;

  try {
    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    if (adminUser) {
      adminId = adminUser._id;
    } else {
      const anyUser = await User.findOne().lean();
      adminId = anyUser ? anyUser._id : null;
    }
  } catch (err) {
    logger.warn('[seedWhatfixAgents] Could not resolve admin user:', err.message);
    adminId = null;
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

      // Find by canonical ID first, then fall back to name.
      // NEVER change the id field of an existing agent — conversations reference it.
      let agentDoc = await Agent.findOne({ id: def.id }).lean();
      if (!agentDoc) {
        agentDoc = await Agent.findOne({ name: def.name }).lean();
      }

      if (agentDoc) {
        await Agent.updateOne(
          { _id: agentDoc._id },
          {
            $set: {
              name: def.name,
              description: def.description,
              instructions,
              model: 'claude-sonnet-4-6',
              provider: 'anthropic',
            },
          },
        );
        logger.info(`[seedWhatfixAgents] Patched "${def.name}" (id: ${agentDoc.id})`);
      } else {
        const created = await createAgent({
          id: def.id,
          name: def.name,
          description: def.description,
          instructions,
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          tools: [],
          tool_resources: {},
          actions: [],
          model_parameters: { max_tokens: 8192 },
          author: adminId ?? new mongoose.Types.ObjectId(),
        });
        agentDoc = { _id: created._id, id: created.id };
        logger.info(`[seedWhatfixAgents] Created "${def.name}" → ${created.id}`);
      }

      await ensurePublicView(agentDoc._id, adminId);
      if (adminId) {
        await ensureAdminOwnership(agentDoc._id, adminId);
      }
      logger.info(`[seedWhatfixAgents] ACL set for "${def.name}"`);
    } catch (err) {
      logger.error(`[seedWhatfixAgents] Failed on "${def.name}":`, err.message, err.stack);
    }
  }
};

module.exports = { seedWhatfixAgents };
