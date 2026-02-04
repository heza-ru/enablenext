const { logger } = require('@librechat/data-schemas');
const { Tools } = require('librechat-data-provider');
const { createAgent, getAgent } = require('./Agent');

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
      capabilities: [Tools.web_search],
      model_parameters: {
        temperature: 0.7,
        max_tokens: 4096,
      },
      author: 'system',
      isPublic: true,
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
    });

    return defaultAgent;
  } catch (error) {
    logger.error('[seedDefaultAgent] Failed to create default agent:', error);
    throw error;
  }
};

module.exports = { seedDefaultAgent };
