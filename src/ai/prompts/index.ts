export function buildLeadRiskPrompt(lead: any): string {
  return `Analyze this sales lead and provide a risk assessment in JSON format.

Lead Details:
- Contact: ${lead.contactName}
- Company: ${lead.company}
- Value: $${lead.expectedValue?.toLocaleString() || '0'}
- Stage: ${lead.stage}
- Service Type: ${lead.serviceType?.name || 'Not specified'}
- Urgency: ${lead.urgency}
- Source: ${lead.source}
- Channel: ${lead.channel}
- Likely Start Date: ${lead.likelyStartDate || 'Not set'}
- Notes: ${lead.notes || 'None'}

Please respond with a JSON object containing:
{
  "riskLevel": "Low" | "Medium" | "High",
  "summary": "Brief explanation of the risk assessment",
  "recommendations": ["Array of actionable recommendations"],
  "confidence": 0.0 to 1.0
}

Consider factors like deal size, timeline, engagement level, and any red flags.`;
}

export function buildClientHealthPrompt(client: any): string {
  const metrics = client.metrics || {};
  const activities = client.activities || [];

  // Format recent activities for AI context
  const recentActivitiesText = activities
    .slice(0, 10) // Last 10 activities
    .map((a: any, idx: number) => {
      const daysAgo = a.createdAt
        ? Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : '?';
      return `${idx + 1}. [${a.type}${daysAgo !== '?' ? ` - ${daysAgo} days ago` : ''}] ${a.reason}${a.notes ? ': ' + a.notes : ''}`;
    })
    .join('\n');

  return `Analyze this client's health status and provide a comprehensive assessment in JSON format.

Client Details:
- Name: ${client.name}
- Segment: ${client.segment}
- Industry: ${client.industry}
- Lifetime Revenue: $${client.lifetimeRevenue?.toLocaleString() || '0'}
- Account Manager: ${client.accountManager?.name || 'Unassigned'}
- Current Status: ${client.status}

Engagement Metrics:
- Days Since Last Contact: ${metrics.daysSinceLastContact || 'N/A'}
- Total Activities: ${metrics.totalActivityCount || 0}
- Recent Activities (30 days): ${metrics.recentActivityCount || 0}
- Engagement Score: ${metrics.engagementScore || 'N/A'}/100

Project History:
- Total Projects: ${metrics.totalProjectCount || 0}
- Active Projects: ${metrics.activeProjectCount || 0}
- Completed Projects: ${metrics.completedProjectCount || 0}
- Average Project Value: $${metrics.avgProjectValue?.toLocaleString() || '0'}
- Recent Revenue (12 months): $${metrics.recentRevenue?.toLocaleString() || '0'}

Contact Information:
- Email: ${client.email || 'Not provided'}
- Phone: ${client.phone || 'Not provided'}

Recent Activity Details:
${recentActivitiesText || 'No recent activities recorded'}

Please respond with a JSON object containing:
{
  "healthScore": 0 to 100,
  "summary": "Brief overview of client health (2-3 sentences)",
  "riskFactors": ["Array of specific risk factors based on activity content"],
  "strengths": ["Array of positive indicators from interactions"],
  "recommendations": ["Array of actionable recommendations based on conversation context"]
}

Consider engagement frequency, revenue trends, repeat business, relationship depth, AND the actual content of recent interactions.`;
}

export function buildExecutiveSummaryPrompt(metrics: any): string {
  // Format top clients
  const topClientsText = (metrics.topClients || [])
    .slice(0, 3)
    .map((c: any, idx: number) =>
      `${idx + 1}. ${c.clientName}: $${(c.revenue / 1000).toFixed(0)}k`
    )
    .join('\n') || 'No clients yet';

  // Format stalled leads
  const stalledLeadsText = (metrics.stalledLeads || [])
    .slice(0, 3)
    .map((l: any) =>
      `- ${l.company} (${l.stage}, ${l.daysStalled} days stalled)`
    )
    .join('\n') || 'None';

  // Format projects at risk
  const riskyProjectsText = (metrics.projectsAtRisk || [])
    .slice(0, 3)
    .map((p: any) =>
      `- ${p.projectName}: ${p.reason}`
    )
    .join('\n') || 'None';

  return `Generate an executive summary for this CRM dashboard data in JSON format.

REVENUE & GROWTH:
- Total Revenue: $${(metrics.totalRevenue || 0).toLocaleString()}
- Monthly Revenue: $${(metrics.monthlyRevenue || 0).toLocaleString()}
- Quarterly Revenue: $${(metrics.quarterlyRevenue || 0).toLocaleString()}
- Pipeline Value: $${(metrics.pipelineValue || 0).toLocaleString()}
- Average Deal Size: $${(metrics.avgDealSize || 0).toLocaleString()}

SALES PERFORMANCE:
- Total Leads: ${metrics.totalLeads || 0}
- Won: ${metrics.wonLeads || 0} | Lost: ${metrics.lostLeads || 0}
- Win Rate: ${metrics.winRate || 0}%
- Average Time to Quote: ${metrics.avgTimeToQuote || 0} days
- Average Time to Close: ${metrics.avgTimeToClose || 0} days

CLIENT & PROJECT HEALTH:
- Active Clients: ${metrics.activeClients || 0}
- Total Projects: ${metrics.totalProjects || 0}
- Active Projects: ${metrics.activeProjects || 0}

TOP REVENUE CONTRIBUTORS:
${topClientsText}

REVENUE CONCENTRATION RISK:
- Top Client: ${metrics.revenueConcentration?.topClientPercentage || 0}% of revenue
- Top 5 Clients: ${metrics.revenueConcentration?.top5ClientsPercentage || 0}% of revenue
- Risk Level: ${metrics.revenueConcentration?.isHighRisk ? 'HIGH (>50% from top 5)' : 'HEALTHY'}

STALLED LEADS (30+ days no activity):
${stalledLeadsText}

PROJECTS AT RISK:
${riskyProjectsText}

HIGH-VALUE DEALS IN PIPELINE:
${(metrics.highValueDeals || [])
  .slice(0, 3)
  .map((d: any) =>
    `- ${d.company}: $${(d.value / 1000).toFixed(0)}k (${d.stage})`
  )
  .join('\n') || 'None'}

Please respond with a JSON object containing:
{
  "overview": "2-3 sentence executive summary answering: How are we performing? What changed? What's the overall trajectory?",
  "whatChanged": ["Array of 2-3 key changes from expected patterns or recent developments"],
  "whatIsAtRisk": ["Array of 2-3 specific risks that need attention (deals, clients, projects, revenue concentration)"],
  "whatNeedsAttention": ["Array of 2-3 immediate action items for leadership"],
  "keyInsights": ["Array of 2-3 strategic insights or opportunities"]
}

Focus on:
1. Actionable insights leadership can act on immediately
2. Specific risks with context (which deals, which clients)
3. Revenue concentration and diversification needs
4. Pipeline health and conversion efficiency
5. Time-based trends (are things speeding up or slowing down?)`;
}

export function buildUpsellPrompt(client: any): string {
  const metrics = client.metrics || {};
  const projects = client.projects || [];
  const activities = client.activities || [];

  // Format recent activities for context
  const recentActivitiesText = activities
    .slice(0, 8) // Last 8 activities
    .map((a: any, idx: number) => {
      const daysAgo = a.createdAt
        ? Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : '?';
      return `${idx + 1}. [${a.type}${daysAgo !== '?' ? ` - ${daysAgo} days ago` : ''}] ${a.reason}${a.notes ? ': ' + a.notes : ''}`;
    })
    .join('\n');

  return `Develop an upsell strategy for this client in JSON format.

Client Details:
- Name: ${client.name}
- Segment: ${client.segment}
- Industry: ${client.industry}
- Lifetime Revenue: $${client.lifetimeRevenue?.toLocaleString() || '0'}

Engagement & Performance:
- Engagement Score: ${metrics.engagementScore || 'N/A'}/100
- Active Projects: ${metrics.activeProjectCount || 0}
- Completed Projects: ${metrics.completedProjectCount || 0}
- Recent Revenue (12 months): $${metrics.recentRevenue?.toLocaleString() || '0'}

Project History:
${projects.slice(0, 5).map((p: any) =>
  `- ${p.name}: ${p.status}, $${p.value?.toLocaleString()}`
).join('\n') || '- No projects yet'}

Recent Conversations & Interactions:
${recentActivitiesText || 'No recent activities recorded'}

Please respond with a JSON object containing:
{
  "opportunities": [
    {
      "service": "Service/product name",
      "rationale": "Why this makes sense based on their history AND recent conversations",
      "estimatedValue": "Estimated value range",
      "priority": "High" | "Medium" | "Low"
    }
  ],
  "approach": "Recommended engagement approach based on recent interactions",
  "timing": "Best timing (immediate, 1-3 months, 3-6 months)",
  "talkingPoints": ["Key points to emphasize based on what they've mentioned"]
}

Consider industry-specific needs, project patterns, expansion opportunities, AND insights from recent conversations.`;
}

export function buildEmailDraftPrompt(lead: any, emailType: string): string {
  return `You are a professional sales representative. Draft a ${emailType} email to ${lead.contactName} at ${lead.company}.
Lead details:
- Expected value: $${lead.expectedValue?.toLocaleString() || '0'}
- Stage: ${lead.stage}
- Service: ${lead.serviceType?.name || 'N/A'}
- Notes: ${lead.notes || 'None'}

Email type: ${emailType} (options: 'follow-up', 'introduction', 'proposal', 'check-in', 'closing')

Return JSON: { "subject": "...", "body": "...", "tone": "professional|friendly|urgent" }`;
}

export function buildPipelinePrompt(data: any): string {
  return `Analyze this sales pipeline and provide strategic insights.
Pipeline data:
- Total leads: ${data.totalLeads}
- By stage: ${JSON.stringify(data.byStage)}
- Total pipeline value: $${data.totalValue}
- Average deal size: $${data.avgDealSize}
- Win rate (last 30d): ${data.winRate}%
- Leads with no activity in 7+ days: ${data.staleLeads}
- Leads by urgency: ${JSON.stringify(data.byUrgency)}

Return JSON: { "summary": "...", "bottlenecks": [...], "winProbabilityByStage": {"New": 0.1, ...}, "recommendations": [...], "urgentLeads": [...] }`;
}

export function buildChatPrompt(message: string, context: any): string {
  return `You are an AI assistant for a CRM system. The user is asking: "${message}"

Context:
- Total Leads: ${context.leadsCount || 0}
- Total Clients: ${context.clientsCount || 0}
- User Role: ${context.userRole || 'Unknown'}

Provide a helpful, concise response focused on CRM tasks, insights, and recommendations. Be professional and action-oriented.`;
}
