const ROLE_CONTEXTS = {
  solutions_consultant: {
    title: 'Solutions Consultant Context',
    focus: 'Focus on demos, storytelling, business outcomes, and value mapping.',
    approach:
      'Prioritize customer-facing narratives, ROI discussions, and translating technical features into business value.',
  },
  sales_engineer: {
    title: 'Sales Engineer Context',
    focus: 'Focus on technical architecture, integrations, security, APIs, and technical validation.',
    approach:
      'Provide detailed technical implementations, answer security/compliance questions, and validate technical feasibility.',
  },
};

const WHATFIX_PRODUCT_KNOWLEDGE = `
# Whatfix Product Knowledge

## Core Platform Capabilities
- **Digital Adoption Platform (DAP)**: In-app guidance, tooltips, walkthroughs, and user onboarding
- **Analytics & Insights**: User behavior tracking, adoption metrics, task completion rates
- **ActionBot**: Task automation and RPA-lite capabilities for repetitive workflows
- **Self-Help & Knowledge Base**: Contextual help widget with search
- **Enterprise Integrations**: SSO (SAML, OAuth), HRIS (Workday, SAP SuccessFactors), CRM (Salesforce, HubSpot)

## Key Differentiators
- No-code content creation with browser extension
- Multi-language support (40+ languages)
- Role-based content targeting
- A/B testing for guidance flows
- Advanced segmentation and personalization

## Common Use Cases
- Employee onboarding and training
- Software rollouts and change management
- Process standardization and compliance
- Self-service support deflection
- Product adoption acceleration

## Competitor Landscape
- **WalkMe**: Enterprise-focused, higher price point
- **Pendo**: Product analytics + guidance
- **Appcues**: Developer-focused, SMB market
- **Userpilot**: SaaS onboarding focus

## Security & Compliance
- SOC 2 Type II certified
- GDPR and CCPA compliant
- Enterprise-grade encryption
- On-premise deployment options available
`;

function buildWhatfixContext(onboarding, user) {
  const roleContext = ROLE_CONTEXTS[onboarding.role] || {};
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let contextParts = [
    `# User Profile & Context`,
    `**Name**: ${user?.name || user?.username || 'User'}`,
    `**Email**: ${user?.email || 'Not provided'}`,
    `**Role**: ${onboarding.role ? onboarding.role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Team Member'}`,
    `**Today's Date**: ${today}`,
    ``,
    `# ${roleContext.title || 'Professional Context'}`,
    roleContext.focus || '',
    roleContext.approach || '',
  ];

  if (onboarding.useCases?.length > 0) {
    contextParts.push(`\n## Primary Use Cases:\n- ${onboarding.useCases.join('\n- ')}`);
  }

  if (onboarding.focusAreas?.length > 0) {
    contextParts.push(`\n## Whatfix Focus Areas:\n- ${onboarding.focusAreas.join('\n- ')}`);
  }

  if (onboarding.customInstructions) {
    contextParts.push(`\n## Custom Instructions:\n${onboarding.customInstructions}`);
  }

  contextParts.push(
    `\n## Important Guidelines:`,
    `- Address the user by their name (${user?.name || user?.username || 'their name'}) when appropriate`,
    `- Keep track of today's date (${today}) for time-sensitive queries`,
    `- Remember their role and context throughout the conversation`,
    `- Tailor responses to their specific use cases and focus areas`,
  );

  contextParts.push(WHATFIX_PRODUCT_KNOWLEDGE);

  return contextParts.join('\n\n');
}

module.exports = { buildWhatfixContext, WHATFIX_PRODUCT_KNOWLEDGE, ROLE_CONTEXTS };
