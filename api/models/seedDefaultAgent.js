const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { Tools, PrincipalType, ResourceType, AccessRoleIds } = require('librechat-data-provider');
const { createAgent, getAgent } = require('./Agent');
const { User } = require('~/db/models');
const { grantPermission } = require('~/server/services/PermissionService');

/**
 * Seeds a default agent with Claude 4.5 and web search enabled
 * Only creates if it doesn't already exist
 */
const seedDefaultAgent = async () => {
  const defaultAgentId = 'default-claude-web-search';
  
  try {
    // Check if default agent already exists
    const existingAgent = await getAgent({ id: defaultAgentId });
    
    if (existingAgent) {
      logger.info('[seedDefaultAgent] Default agent already exists, skipping creation');
      return existingAgent;
    }

    logger.info('[seedDefaultAgent] Creating default Claude 4.5 + Web Search agent...');

    // Find an admin user or any existing user to be the author
    let authorId;
    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    
    if (adminUser) {
      authorId = adminUser._id;
      logger.info('[seedDefaultAgent] Using admin user as author:', authorId.toString());
    } else {
      // No admin found, use the first user in the database
      const anyUser = await User.findOne().lean();
      if (anyUser) {
        authorId = anyUser._id;
        logger.info('[seedDefaultAgent] Using first available user as author:', authorId.toString());
      } else {
        // No users exist yet - this means database is being initialized
        // Create a temporary system ObjectId that can be updated later
        authorId = new mongoose.Types.ObjectId();
        logger.warn('[seedDefaultAgent] No users found, using temporary ObjectId:', authorId.toString());
      }
    }

    // Create default agent with Claude 4.5 and web search
    const defaultAgent = await createAgent({
      id: defaultAgentId,
      name: 'Claude 4.5 with Web Search',
      description: 'Claude Sonnet 4.5 with web search capability for real-time information',
      instructions: 'You are a helpful AI assistant with access to web search. Use web search when you need current information, recent events, or to verify facts. Always provide accurate, well-researched responses.',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      tools: [Tools.web_search],
      tool_resources: {},
      actions: [],
      model_parameters: {
        temperature: 0.7,
        max_tokens: 4096,
      },
      author: authorId,
      category: 'general',
      avatar: {
        source: 'default',
        type: 'icon',
      },
    });

    logger.info('[seedDefaultAgent] ✅ Default agent created successfully:', {
      id: defaultAgent.id,
      name: defaultAgent.name,
      tools: defaultAgent.tools,
      author: authorId.toString(),
    });

    // Grant public access so anyone can use this agent
    try {
      await grantPermission({
        principalType: PrincipalType.PUBLIC,
        principalId: null,
        resourceType: ResourceType.AGENT,
        resourceId: defaultAgent._id,
        accessRoleId: AccessRoleIds.AGENT_VIEWER,
        grantedBy: authorId,
      });
      logger.info('[seedDefaultAgent] ✅ Public access granted for default agent');
    } catch (permError) {
      logger.error('[seedDefaultAgent] Failed to grant public permission:', permError);
      // Don't throw - agent is created, just permission failed
    }

    return defaultAgent;
  } catch (error) {
    logger.error('[seedDefaultAgent] Failed to create default agent:', error);
    throw error;
  }
};

module.exports = { seedDefaultAgent };
