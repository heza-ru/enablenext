const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { PrincipalType, ResourceType, AccessRoleIds } = require('librechat-data-provider');
const { Agent } = require('~/db/models');
const { createAgent, getAgent } = require('./Agent');
const { User } = require('~/db/models');
const { grantPermission } = require('~/server/services/PermissionService');

const ROOT = path.resolve(__dirname, '../..');

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
 * Seeds (or patches) the three Whatfix-branded agents at server startup.
 *
 * For existing agents:   patches name/description/instructions/model/provider only.
 *                        The agent `id` is NEVER changed — conversations reference it.
 * For new agents:        creates with the canonical id and sets the admin as author.
 *
 * Permissions (idempotent via PermissionService.grantPermission):
 *   - PUBLIC  → AGENT_VIEWER  (all users can use the agent in chat)
 *   - admin   → AGENT_OWNER   (admin can open the full edit form in the builder)
 */
const seedWhatfixAgents = async () => {
  let adminId = null;

  try {
    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    if (adminUser) {
      adminId = adminUser._id;
    } else {
      const anyUser = await User.findOne().lean();
      if (anyUser) {
        adminId = anyUser._id;
      }
    }
  } catch (err) {
    logger.warn('[seedWhatfixAgents] Could not resolve admin user:', err.message);
  }

  for (const def of WHATFIX_AGENTS) {
    try {
      const instructions = fs.readFileSync(
        path.join(ROOT, 'agents', def.skillFile),
        'utf8',
      );

      // --- find existing agent (by canonical id, then by name) ---
      let agentDoc = await getAgent({ id: def.id });
      if (!agentDoc) {
        agentDoc = await Agent.findOne({ name: def.name }).lean();
      }

      let agentMongoId;

      if (agentDoc) {
        // Patch fields — intentionally skip `id` so existing conversation refs stay valid
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
        agentMongoId = agentDoc._id;
        logger.info(`[seedWhatfixAgents] Patched "${def.name}" (agent id: ${agentDoc.id})`);
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
        agentMongoId = created._id;
        logger.info(`[seedWhatfixAgents] Created "${def.name}" → ${created.id}`);
      }

      // --- grant PUBLIC viewer access (same pattern as seedDefaultAgent) ---
      await grantPermission({
        principalType: PrincipalType.PUBLIC,
        principalId: null,
        resourceType: ResourceType.AGENT,
        resourceId: agentMongoId,
        accessRoleId: AccessRoleIds.AGENT_VIEWER,
        grantedBy: adminId ?? agentMongoId,
      });

      // --- grant admin full ownership so the edit form loads properly ---
      if (adminId) {
        await grantPermission({
          principalType: PrincipalType.USER,
          principalId: adminId,
          resourceType: ResourceType.AGENT,
          resourceId: agentMongoId,
          accessRoleId: AccessRoleIds.AGENT_OWNER,
          grantedBy: adminId,
        });
      }

      logger.info(`[seedWhatfixAgents] Permissions set for "${def.name}"`);
    } catch (err) {
      logger.error(`[seedWhatfixAgents] Failed on "${def.name}": ${err.message}`, err.stack);
    }
  }
};

module.exports = { seedWhatfixAgents };
