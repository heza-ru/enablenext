import React, { useEffect, useState, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useParams } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { DollarSign, TrendingUp, Zap, Activity } from 'lucide-react';
import { cn } from '~/utils';
import store from '~/store';

interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number | string;
  requestCount?: number;
  messageCount?: number;
  conversationId?: string;
}

interface ApiUsageData {
  currentSession?: UsageStats;
  currentChat?: UsageStats;
  today: UsageStats;
  currentMonth: UsageStats;
  pricing: {
    model: string;
    description: string;
    inputCostPer1M: number;
    outputCostPer1M: number;
    longContextInputCostPer1M?: number;
    longContextOutputCostPer1M?: number;
  };
  availableModels?: Array<{
    name: string;
    description: string;
    inputCostPer1M: number;
    outputCostPer1M: number;
  }>;
  batchProcessingDiscount?: string;
  lastUpdated?: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(0);
};

const formatCost = (cost: number | string): string => {
  if (typeof cost === 'string') {
    return `$${cost}`;
  }
  return `$${cost.toFixed(4)}`;
};

export default function ApiUsagePanel() {
  const [usageData, setUsageData] = useState<ApiUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get conversation ID from URL params
  const { conversationId } = useParams();
  
  // Watch for submission state to detect new messages
  const isSubmitting = useRecoilValue(store.isSubmitting);

  const fetchUsageData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsRefreshing(true);
      }
      console.log('[ApiUsagePanel] Fetching usage data...', { conversationId });
      const data = await dataService.getApiUsage(conversationId);
      console.log('[ApiUsagePanel] Received data:', data);
      setUsageData(data);
      setError(null);
    } catch (err) {
      console.error('[ApiUsagePanel] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [conversationId]);

  // Initial load
  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Auto-refresh when submission completes (AI responds)
  useEffect(() => {
    // When isSubmitting changes from true to false, it means AI just responded
    if (isSubmitting === false) {
      console.log('[ApiUsagePanel] Submission completed, refreshing usage...');
      // Wait a bit for backend to process the usage
      setTimeout(() => fetchUsageData(true), 1500);
    }
  }, [isSubmitting, fetchUsageData]);

  // Auto-refresh when conversation changes
  useEffect(() => {
    if (conversationId) {
      console.log('[ApiUsagePanel] Conversation changed, refreshing usage...');
      fetchUsageData(true);
    }
  }, [conversationId, fetchUsageData]);

  // Periodic refresh every 10 seconds (silent, real-time)
  useEffect(() => {
    const interval = setInterval(() => fetchUsageData(true), 10000);
    return () => clearInterval(interval);
  }, [fetchUsageData]);

  const handleManualRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fetchUsageData(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !usageData) {
    return (
      <div className="p-4 text-sm text-red-500">
        {error || 'Unable to load usage data'}
      </div>
    );
  }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subtitle,
    className,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subtitle?: string;
    className?: string;
  }) => (
    <div
      className={cn(
        'rounded-lg border border-border-light p-4 dark:border-gray-600',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          API Usage
          {isRefreshing && <span className="ml-2 text-xs text-gray-500">(updating...)</span>}
        </h3>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Current Session Usage */}
      {usageData.currentSession && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Current Session
            <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Zap}
              label="Session Tokens"
              value={formatNumber(usageData.currentSession.totalTokens)}
              subtitle={`In: ${formatNumber(usageData.currentSession.inputTokens)} | Out: ${formatNumber(usageData.currentSession.outputTokens)}`}
              className="border-blue-200 dark:border-blue-800"
            />
            <StatCard
              icon={DollarSign}
              label="Session Cost"
              value={formatCost(usageData.currentSession.totalCost)}
              subtitle={`${usageData.currentSession.requestCount} requests`}
              className="border-blue-200 dark:border-blue-800"
            />
          </div>
        </div>
      )}

      {/* Current Chat Usage */}
      {usageData.currentChat && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">This Chat</h4>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Activity}
              label="Chat Tokens"
              value={formatNumber(usageData.currentChat.totalTokens)}
              subtitle={`In: ${formatNumber(usageData.currentChat.inputTokens)} | Out: ${formatNumber(usageData.currentChat.outputTokens)}`}
              className="border-purple-200 dark:border-purple-800"
            />
            <StatCard
              icon={DollarSign}
              label="Chat Cost"
              value={formatCost(usageData.currentChat.totalCost)}
              subtitle={`${usageData.currentChat.messageCount} messages`}
              className="border-purple-200 dark:border-purple-800"
            />
          </div>
        </div>
      )}

      {/* Today's Usage */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Today</h4>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Zap}
            label="Tokens Used"
            value={formatNumber(usageData.today.totalTokens)}
            subtitle={`In: ${formatNumber(usageData.today.inputTokens)} | Out: ${formatNumber(usageData.today.outputTokens)}`}
          />
          <StatCard
            icon={DollarSign}
            label="Cost"
            value={formatCost(usageData.today.totalCost)}
            subtitle={`${usageData.today.requestCount} requests`}
          />
        </div>
      </div>

      {/* This Month */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">This Month</h4>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Activity}
            label="Total Tokens"
            value={formatNumber(usageData.currentMonth.totalTokens)}
            subtitle={`In: ${formatNumber(usageData.currentMonth.inputTokens)} | Out: ${formatNumber(usageData.currentMonth.outputTokens)}`}
          />
          <StatCard
            icon={TrendingUp}
            label="Total Cost"
            value={formatCost(usageData.currentMonth.totalCost)}
            subtitle={`${usageData.currentMonth.requestCount} requests`}
            className="border-green-200 dark:border-green-800"
          />
        </div>
      </div>

      {/* Pricing Information */}
      <div className="rounded-lg border border-border-light p-4 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Claude API Pricing (2026)
        </h4>
        
        {/* Current Model */}
        <div className="space-y-2 text-xs mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
          <div className="flex items-start justify-between">
            <span className="text-gray-600 dark:text-gray-400">Current Model:</span>
            <div className="text-right">
              <div className="font-medium text-gray-900 dark:text-white">
                {usageData.pricing.model}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {usageData.pricing.description}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Input:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${usageData.pricing.inputCostPer1M.toFixed(2)} / 1M tokens
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Output:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${usageData.pricing.outputCostPer1M.toFixed(2)} / 1M tokens
            </span>
          </div>
          {usageData.pricing.longContextInputCostPer1M && (
            <>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Long-context (over 200K tokens):
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Input:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${usageData.pricing.longContextInputCostPer1M.toFixed(2)} / 1M tokens
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Output:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${usageData.pricing.longContextOutputCostPer1M?.toFixed(2)} / 1M tokens
                </span>
              </div>
            </>
          )}
        </div>

        {/* Available Models */}
        {usageData.availableModels && usageData.availableModels.length > 0 && (
          <div className="space-y-2 text-xs mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
              Available Models:
            </div>
            {usageData.availableModels.map((model, idx) => (
              <div key={idx} className="space-y-1 mb-2">
                <div className="font-medium text-gray-900 dark:text-white">
                  {model.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {model.description}
                </div>
                <div className="flex items-center justify-between pl-2">
                  <span className="text-gray-600 dark:text-gray-400">In/Out:</span>
                  <span className="text-gray-900 dark:text-white">
                    ${model.inputCostPer1M.toFixed(2)} / ${model.outputCostPer1M.toFixed(2)} per 1M
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Batch Processing Discount */}
        {usageData.batchProcessingDiscount && (
          <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-1">
              <span className="text-green-700 dark:text-green-400 font-medium">💡 Batch Processing:</span>
              <span className="text-green-600 dark:text-green-300">{usageData.batchProcessingDiscount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        <div>Updates automatically after each AI response</div>
        <div className="mt-1">Session-based • Chat-based • Real-time (10s refresh)</div>
        {usageData?.lastUpdated && (
          <div className="mt-1 text-gray-400 dark:text-gray-500">
            Last updated: {new Date(usageData.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
