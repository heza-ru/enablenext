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
# Whatfix Product Knowledge (Updated Feb 2026)

## Product Suite (3 Core Products)
1. **Digital Adoption Platform (DAP)**
   - In-app guidance: Flows, Smart Tips, Pop-ups, Task Lists, Beacons, Tooltips
   - Contextual help widget and self-service knowledge base
   - Interactive walkthroughs and user onboarding
   - Available for web, desktop, mobile, and operating systems
   - Feedback collection and surveys
   
2. **Product Analytics**
   - No-code event tracking for desktop and web applications
   - Track, Analyze, and Act capabilities
   - User engagement insights and journey analysis
   - Real-time usage analytics and adoption metrics
   
3. **Mirror**
   - Application replication for hands-on training
   - AI-powered roleplaying exercises
   - Safe training environment without production data

## 2026 AI & Innovation
- **AI Agents**: Embedded across product suite to accelerate user productivity
- **ScreenSense**: AI technology for next-gen digital adoption
- AI-powered analytics and predictive insights
- Automated content suggestions and optimization

## Key Differentiators
- No-code content creation with browser extension
- Multi-language support (40+ languages)
- Role-based content targeting and personalization
- Advanced segmentation and A/B testing
- Cross-application guidance (desktop, web, mobile, OS)
- Task automation and workflow optimization (not "ActionBot" - that's WalkMe)

## Common Use Cases
- AI adoption and change acceleration
- Digital transformation initiatives
- Employee onboarding and training
- Software rollouts and change management
- Feature adoption and product launches
- Self-service support deflection
- Compliance and process standardization
- Workflow optimization

## Competitor Landscape (2026)
- **WalkMe**: Enterprise DAP with ActionBot chatbot, DeepUI AI automation, FedRAMP Ready, higher price point, emphasizes security certifications
- **Pendo**: Analytics-first platform, strong product analytics, basic guidance, lacks advanced automation
- **Appcues**: Code-optional platform, in-app messaging, targets SMB/mid-market, developer-friendly
- **Userpilot**: SaaS onboarding specialist, user segmentation, churn prevention, product adoption analytics
- **UserGuiding**: Cost-effective alternative, user onboarding focus, growing competitor
- **Apty**: Process automation focus, enterprise DAP, compliance tracking
- **Chameleon**: Product-led growth focus, in-app surveys and tours

## Whatfix Market Position
- Trusted by 150+ Fortune 1000 companies
- Comprehensive product suite (DAP + Analytics + Training)
- Strong enterprise capabilities with mid-market accessibility
- Balance of automation, analytics, and training
- Global presence: US, UK, Germany, Australia, Singapore, India

## Security & Compliance
- SOC 2 Type II certified
- GDPR and CCPA compliant
- Enterprise-grade encryption
- On-premise and cloud deployment options
- SSO support (SAML, OAuth)
- Role-based access control (RBAC)

## Enterprise Integrations
- HRIS: Workday, SAP SuccessFactors, Oracle HCM, ADP
- CRM: Salesforce, HubSpot, Microsoft Dynamics
- Communication: Slack, Microsoft Teams, Zendesk
- LMS: Cornerstone, Docebo, SAP Litmos
- Analytics: Google Analytics, Mixpanel, Amplitude
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
    `- **TODAY'S DATE IS: ${today}** - Always remember the current date for time-sensitive queries`,
    `- Remember their role and context throughout the conversation`,
    `- Tailor responses to their specific use cases and focus areas`,
    ``,
    `## CRITICAL: Web Search Tool Instructions:`,
    `- **YOU HAVE web_search TOOL AVAILABLE** - Never say you cannot access real-time information`,
    `- **IMMEDIATELY USE web_search** for: current events, latest news, recent updates, "what's happening now"`,
    `- **ALWAYS USE web_search** when questions contain: "latest", "recent", "current", "today", "this week", "new"`,
    `- **USE web_search** for: product announcements, industry trends, competitor news, market data, breaking news`,
    `- **USE web_search** when information might have changed after your knowledge cutoff`,
    `- Web search is FREE, ENABLED, and ALWAYS available - use it proactively without asking`,
    `- DO NOT say "I'm unable to retrieve real-time information" - YOU CAN via web_search tool`,
    `- Examples requiring web_search: "latest Whatfix features", "recent AI trends", "current market news", "what's happening today"`,
  );

  contextParts.push(WHATFIX_PRODUCT_KNOWLEDGE);

  return contextParts.join('\n\n');
}

module.exports = { buildWhatfixContext, WHATFIX_PRODUCT_KNOWLEDGE, ROLE_CONTEXTS };
