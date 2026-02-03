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
    // For now, return zero values until real usage tracking is implemented
    const usageData = {
      // Current session usage (resets when session ends)
      currentSession: conversationId ? {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: '0.000000',
        requestCount: 0,
        conversationId,
      } : null,
      
      // Current chat/conversation usage
      currentChat: conversationId ? {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: '0.000000',
        messageCount: 0,
      } : null,
      
      // Today's total usage
      today: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: '0.000000',
        requestCount: 0,
      },
      
      // Monthly total usage
      currentMonth: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: '0.000000',
        requestCount: 0,
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
