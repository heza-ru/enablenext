const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { PrincipalType, ResourceType, AccessRoleIds } = require('librechat-data-provider');
const { createAgent, getAgent, updateAgent } = require('./Agent');
const { User } = require('~/db/models');
const { grantPermission } = require('~/server/services/PermissionService');

const ROOT = path.resolve(__dirname, '../..');

function readSkill(filename) {
  return fs.readFileSync(path.join(ROOT, 'agents', filename), 'utf8');
}

const WHATFIX_AGENTS = [
  {
    id: 'whatfix-presentation-creator',
    name: 'Presentation Creator',
    description:
      'Creates Whatfix-branded slide decks and playbooks. Supports dark pitch decks and POC/demo/sales playbooks with white table slides and Crimson/Orange split panels. Ask for any presentation or playbook topic.',
    skillFile: 'presentation-creator.skill.md',
    tools: ['file_search'],
    artifacts: 'default',
  },
  {
    id: 'whatfix-excel-creator',
    name: 'Excel Creator',
    description: 'Generates Whatfix-branded .xlsx spreadsheets, trackers, dashboards and reports.',
    skillFile: 'excel-creator.skill.md',
    tools: [],
    artifacts: 'default',
  },
  {
    id: 'whatfix-doc-creator',
    name: 'Document Creator',
    description:
      'Writes and exports Whatfix-branded .docx reports, proposals, briefs and one-pagers.',
    skillFile: 'doc-creator.skill.md',
    tools: [],
    artifacts: 'default',
  },
];

/**
 * Seeds the three Whatfix-branded agents at server startup.
 * Creates each agent if it doesn't exist; updates instructions if it does.
 * Grants PUBLIC viewer access so all users on the instance can use them.
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

      const existing = await getAgent({ id: def.id });

      if (existing) {
        await updateAgent(
          { id: def.id },
          {
            name: def.name,
            description: def.description,
            instructions,
            tools: def.tools,
            artifacts: def.artifacts,
          },
        );
        logger.info(`[seedWhatfixAgents] Updated "${def.name}"`);
        continue;
      }

      const agent = await createAgent({
        id: def.id,
        name: def.name,
        description: def.description,
        instructions,
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        tools: def.tools,
        tool_resources: {},
        actions: [],
        artifacts: def.artifacts,
        model_parameters: { max_tokens: 8192 },
        author: authorId,
      });

      logger.info(`[seedWhatfixAgents] Created "${def.name}" → ${agent.id}`);

      await grantPermission({
        principalType: PrincipalType.PUBLIC,
        principalId: null,
        resourceType: ResourceType.AGENT,
        resourceId: agent._id,
        accessRoleId: AccessRoleIds.AGENT_VIEWER,
        grantedBy: authorId,
      });

      logger.info(`[seedWhatfixAgents] Public access granted for "${def.name}"`);
    } catch (err) {
      logger.error(`[seedWhatfixAgents] Failed on "${def.name}":`, err.message);
    }
  }
};

module.exports = { seedWhatfixAgents };
