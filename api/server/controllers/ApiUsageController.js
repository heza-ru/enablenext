const { logger } = require('@librechat/data-schemas');

/**
 * Get API usage statistics for the authenticated user
 * @route GET /api/user/usage
 */
const getApiUsageController = async (req, res) => {
  try {
    logger.info('[getApiUsageController] API usage endpoint called');
    const userId = req.user?._id;
    const { conversationId, sessionId } = req.query;

    logger.info('[getApiUsageController] User ID:', userId, 'ConversationId:', conversationId, 'SessionId:', sessionId);

    if (!userId) {
      logger.warn('[getApiUsageController] No user ID found, returning 401');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // In production, this would query a usage tracking collection
    // For now, return mock data that simulates real-time updates
    const now = Date.now();
    const baseTokens = Math.floor(now / 1000) % 10000; // Changes over time
    
    const usageData = {
      // Current session usage (resets when session ends)
      currentSession: conversationId ? {
        totalTokens: baseTokens % 1500,
        inputTokens: Math.floor((baseTokens % 1500) * 0.6),
        outputTokens: Math.floor((baseTokens % 1500) * 0.4),
        totalCost: ((baseTokens % 1500) * 0.000012).toFixed(6),
        requestCount: Math.floor(baseTokens / 300) % 8 + 1,
        conversationId,
      } : null,
      
      // Current chat/conversation usage
      currentChat: conversationId ? {
        totalTokens: baseTokens % 3000,
        inputTokens: Math.floor((baseTokens % 3000) * 0.6),
        outputTokens: Math.floor((baseTokens % 3000) * 0.4),
        totalCost: ((baseTokens % 3000) * 0.000012).toFixed(6),
        messageCount: Math.floor(baseTokens / 200) % 15 + 1,
      } : null,
      
      // Today's total usage
      today: {
        totalTokens: 8500 + (baseTokens % 500),
        inputTokens: 5000 + (baseTokens % 300),
        outputTokens: 3500 + (baseTokens % 200),
        totalCost: (0.0675 + (baseTokens % 500) * 0.000012).toFixed(6),
        requestCount: 5 + Math.floor(baseTokens / 1000) % 3,
      },
      
      // Monthly total usage
      currentMonth: {
        totalTokens: 125000 + (baseTokens % 1000),
        inputTokens: 75000 + (baseTokens % 600),
        outputTokens: 50000 + (baseTokens % 400),
        totalCost: (0.975 + (baseTokens % 1000) * 0.000012).toFixed(6),
        requestCount: 42 + Math.floor(baseTokens / 500) % 5,
      },
      
      pricing: {
        model: 'Claude Sonnet 4.5',
        description: 'Standard requests (up to 200K tokens)',
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        longContextInputCostPer1M: 6.00,
        longContextOutputCostPer1M: 22.50,
      },
      availableModels: [
        {
          name: 'Claude Sonnet 4.5',
          description: 'Standard requests (up to 200K tokens)',
          inputCostPer1M: 3.00,
          outputCostPer1M: 15.00,
        },
        {
          name: 'Claude Sonnet 4.5 (Long Context)',
          description: 'Long-context requests (over 200K tokens)',
          inputCostPer1M: 6.00,
          outputCostPer1M: 22.50,
        },
        {
          name: 'Claude Opus 4.5',
          description: 'Most advanced model',
          inputCostPer1M: 5.00,
          outputCostPer1M: 25.00,
        },
      ],
      batchProcessingDiscount: '50% off standard token prices',
      lastUpdated: new Date().toISOString(),
    };

    logger.info('[getApiUsageController] Returning usage data');
    res.json(usageData);
  } catch (error) {
    logger.error('[getApiUsageController] Error fetching API usage:', error);
    res.status(500).json({ message: 'Error fetching API usage data' });
  }
};

/**
 * Track a new API request (called after each API call)
 * @route POST /api/user/usage/track
 */
const trackApiUsageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { inputTokens, outputTokens, model, cost } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // In production, save to a usage tracking collection
    logger.info('[trackApiUsageController] Tracked usage:', {
      userId,
      inputTokens,
      outputTokens,
      model,
      cost,
      timestamp: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[trackApiUsageController] Error tracking API usage:', error);
    res.status(500).json({ message: 'Error tracking API usage' });
  }
};

module.exports = {
  getApiUsageController,
  trackApiUsageController,
};
