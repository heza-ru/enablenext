const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { createAgent, getAgent } = require('./Agent');
const { Agent } = require('~/db/models');
const { User } = require('~/db/models');

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
 * Ensures the three Whatfix agents exist in MongoDB with the correct
 * model/provider/instructions. Access control is handled entirely in
 * canAccessAgentResource middleware (GLOBAL_AGENT_IDS whitelist) —
 * no ACL entries are needed here.
 */
const seedWhatfixAgents = async () => {
  let authorId;
  try {
    const admin = await User.findOne({ role: 'ADMIN' }).lean();
    authorId = admin?._id ?? (await User.findOne().lean())?._id ?? new mongoose.Types.ObjectId();
  } catch {
    authorId = new mongoose.Types.ObjectId();
  }

  for (const def of WHATFIX_AGENTS) {
    try {
      const instructions = fs.readFileSync(path.join(ROOT, 'agents', def.skillFile), 'utf8');

      // Find by canonical id first, fall back to name (handles agents created before
      // the canonical id was introduced). Never change the id of an existing agent.
      let agentDoc = await getAgent({ id: def.id });
      if (!agentDoc) {
        agentDoc = await Agent.findOne({ name: def.name }).lean();
      }

      if (agentDoc) {
        await Agent.updateOne(
          { _id: agentDoc._id },
          { $set: { name: def.name, description: def.description, instructions, model: 'claude-sonnet-4-6', provider: 'anthropic' } },
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
          author: authorId,
        });
        logger.info(`[seedWhatfixAgents] Created "${def.name}" → ${created.id}`);
      }
    } catch (err) {
      logger.error(`[seedWhatfixAgents] Failed on "${def.name}": ${err.message}`);
    }
  }
};

module.exports = { seedWhatfixAgents };
