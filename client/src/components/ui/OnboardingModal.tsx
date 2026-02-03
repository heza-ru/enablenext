import React, { useState } from 'react';
import { OGDialog, OGDialogTemplate } from '@librechat/client';
import { useUpdateOnboardingMutation, useCompleteOnboardingMutation, dataService } from 'librechat-data-provider';
import { cn } from '~/utils';

const USE_CASES = [
  'Demo preparation',
  'RFP or security questionnaire support',
  'Technical validation and architecture discussions',
  'Customer-specific enablement or walkthrough creation',
];

const FOCUS_AREAS = [
  'Digital Adoption Platform core',
  'Analytics and Insights',
  'Automation and ActionBot',
  'Integrations and enterprise security',
];

const ROLE_SUGGESTIONS = {
  solutions_consultant: [
    'Focus on business outcomes and ROI',
    'Use storytelling and customer success examples',
    'Emphasize ease of use and quick wins',
    'Highlight demo-friendly features',
    'Connect features to business value',
  ],
  sales_engineer: [
    'Provide detailed technical specifications',
    'Focus on integration capabilities and APIs',
    'Emphasize security and compliance features',
    'Include architecture diagrams and technical depth',
    'Address scalability and performance considerations',
  ],
};

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [formData, setFormData] = useState<{
    role: 'solutions_consultant' | 'sales_engineer' | '';
    useCases: string[];
    focusAreas: string[];
    customInstructions: string;
  }>({
    role: '',
    useCases: [],
    focusAreas: [],
    customInstructions: '',
  });

  const updateMutation = useUpdateOnboardingMutation();
  const completeMutation = useCompleteOnboardingMutation();

  const validateApiKey = async (key: string): Promise<boolean> => {
    if (!key || !key.startsWith('sk-ant-')) {
      setApiKeyError('Please enter a valid Claude API key (starts with sk-ant-)');
      return false;
    }

    setIsValidatingKey(true);
    setApiKeyError('');

    try {
      // Save the API key to the backend
      await dataService.updateUserKey({
        name: 'anthropic',
        value: key,
      });
      console.log('[Onboarding] API key saved successfully');
      setApiKeyError('');
      return true;
    } catch (error: any) {
      console.error('[Onboarding] Error saving API key:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to save API key. Please try again.';
      setApiKeyError(errorMsg);
      return false;
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleComplete = async () => {
    // Validate API key if provided
    if (apiKey) {
      const isValid = await validateApiKey(apiKey);
      if (!isValid) {
        return; // Don't proceed if API key is invalid
      }
    }

    try {
      setGeneralError('');
      console.log('[Onboarding] Starting completion process');
      
      if (formData.role) {
        console.log('[Onboarding] Updating onboarding data');
        await updateMutation.mutateAsync({
          role: formData.role as 'solutions_consultant' | 'sales_engineer',
          useCases: formData.useCases,
          focusAreas: formData.focusAreas,
          customInstructions: formData.customInstructions,
        });
      }
      
      console.log('[Onboarding] Marking as complete');
      await completeMutation.mutateAsync(false);
      
      console.log('[Onboarding] Completed successfully, closing modal');
      onOpenChange(false);
    } catch (error: any) {
      console.error('[Onboarding] Error completing onboarding:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to complete setup. Please try again.';
      setGeneralError(errorMsg);
    }
  };

  const handleSkip = async () => {
    try {
      await completeMutation.mutateAsync(true);
      onOpenChange(false);
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  const handleUseCaseToggle = (useCase: string) => {
    setFormData((prev) => ({
      ...prev,
      useCases: prev.useCases.includes(useCase)
        ? prev.useCases.filter((uc) => uc !== useCase)
        : [...prev.useCases, useCase],
    }));
  };

  const handleFocusAreaToggle = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter((fa) => fa !== area)
        : [...prev.focusAreas, area],
    }));
  };

  const applySuggestion = (suggestion: string) => {
    setFormData((prev) => ({
      ...prev,
      customInstructions: prev.customInstructions
        ? `${prev.customInstructions}\n${suggestion}`
        : suggestion,
    }));
  };

  const canProceedFromStep1 = formData.role !== '';
  const currentSuggestions = formData.role ? ROLE_SUGGESTIONS[formData.role] : [];

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        showCloseButton={false}
        className="max-w-2xl"
        main={
        <div className="flex flex-col gap-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  'h-2 w-16 rounded-full transition-colors',
                  step >= s ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600',
                )}
                aria-label={`Step ${s}`}
              />
            ))}
          </div>

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">Welcome to Whatfix AI Assistant! 🎉</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Let&apos;s personalize your experience in just 3 quick steps.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setFormData((prev) => ({ ...prev, role: 'solutions_consultant' }))}
                  className={cn(
                    'rounded-lg border-2 p-6 text-left transition-all hover:border-green-500',
                    formData.role === 'solutions_consultant'
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600',
                  )}
                >
                  <h3 className="mb-2 text-lg font-semibold">Solutions Consultant</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Focus on demos, storytelling, business outcomes, and value mapping
                  </p>
                </button>

                <button
                  onClick={() => setFormData((prev) => ({ ...prev, role: 'sales_engineer' }))}
                  className={cn(
                    'rounded-lg border-2 p-6 text-left transition-all hover:border-green-500',
                    formData.role === 'sales_engineer'
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600',
                  )}
                >
                  <h3 className="mb-2 text-lg font-semibold">Sales Engineer</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Focus on technical architecture, integrations, security, and APIs
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Use Cases and Focus Areas - Consolidated */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">Customize Your Experience</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Tell us what matters most to you (optional but recommended)
                </p>
              </div>

              {/* Use Cases */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Primary Use Cases
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {USE_CASES.map((useCase) => (
                    <label
                      key={useCase}
                      className="flex items-start gap-2 rounded-lg border p-3 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.useCases.includes(useCase)}
                        onChange={() => handleUseCaseToggle(useCase)}
                        className="mt-0.5 flex-shrink-0 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-xs">{useCase}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Focus Areas */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Whatfix Products
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_AREAS.map((area) => (
                    <label
                      key={area}
                      className="flex items-start gap-2 rounded-lg border p-3 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.focusAreas.includes(area)}
                        onChange={() => handleFocusAreaToggle(area)}
                        className="mt-0.5 flex-shrink-0 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-xs">{area}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Custom Instructions and API Key */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">Final Setup</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Almost done! Add your preferences and API key.
                </p>
              </div>

              {/* Custom Instructions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Custom Instructions (Optional)
                  </label>
                  {currentSuggestions.length > 0 && (
                    <span className="text-xs text-gray-500">
                      Quick suggestions for {formData.role === 'solutions_consultant' ? 'Solutions Consultants' : 'Sales Engineers'}:
                    </span>
                  )}
                </div>

                {currentSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {currentSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                        className="text-xs px-3 py-1.5 rounded-full border border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  value={formData.customInstructions}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customInstructions: e.target.value }))
                  }
                  placeholder="E.g., Focus on healthcare industry, avoid technical jargon, prioritize quick wins..."
                  className="min-h-24 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                  rows={4}
                />
              </div>

              {/* Claude API Key */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Claude API Key (Optional)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Add your API key now or skip and add it later in Settings
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiKeyError('');
                    setGeneralError('');
                  }}
                  placeholder="sk-ant-api03-..."
                  className={cn(
                    'w-full rounded-lg border p-3 text-sm focus:outline-none dark:bg-gray-800',
                    apiKeyError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:border-green-500 dark:border-gray-600',
                  )}
                />
                {apiKeyError && (
                  <span className="text-xs text-red-500">{apiKeyError}</span>
                )}
              </div>
              
              {/* General Error Display */}
              {generalError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{generalError}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between border-t pt-4 dark:border-gray-600">
            <div className="flex-shrink-0">
              {step === 1 && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors whitespace-nowrap"
                >
                  Skip setup
                </button>
              )}
            </div>
            <div className="flex gap-3 flex-shrink-0 ml-auto">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !canProceedFromStep1}
                  className={cn(
                    'px-5 py-2 rounded-lg text-white font-medium transition-colors whitespace-nowrap',
                    step === 1 && !canProceedFromStep1
                      ? 'opacity-50 cursor-not-allowed bg-gray-400'
                      : 'bg-green-600 hover:bg-green-700',
                  )}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={updateMutation.isLoading || completeMutation.isLoading || isValidatingKey}
                  className="px-5 py-2 rounded-lg text-white font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isValidatingKey
                    ? 'Validating Key...'
                    : updateMutation.isLoading
                      ? 'Saving...'
                      : completeMutation.isLoading
                        ? 'Finalizing...'
                        : 'Complete Setup'}
                </button>
              )}
            </div>
          </div>
        </div>
        }
      />
    </OGDialog>
  );
}
