import React, { useState } from 'react';
import OnboardingModal from '~/components/ui/OnboardingModal';

export default function Onboarding() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="pb-3">
        <div className="text-sm font-semibold text-text-primary mb-1">Whatfix AI Setup</div>
        <div className="text-xs text-text-secondary">
          Customize how the AI assistant helps you based on your role and focus areas
        </div>
      </div>

      <div className="rounded-lg border border-border-medium p-4 dark:border-gray-600">
        <h3 className="mb-2 font-medium text-text-primary">Personalization Setup</h3>
        <p className="mb-4 text-sm text-text-secondary">
          Re-run the onboarding wizard to update your role, use cases, and AI preferences
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700"
        >
          Restart Onboarding Setup
        </button>
      </div>

      <OnboardingModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}
