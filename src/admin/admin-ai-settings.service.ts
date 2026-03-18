import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

@Injectable()
export class AdminAiSettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Encryption helpers ─────────────────────────────────────────────────────
  // Format v2 (new): "v2:<salt_hex>:<iv_hex>:<ciphertext_hex>" — random salt per ciphertext
  // Format v1 (legacy): "<iv_hex>:<ciphertext_hex>" — static salt 'salt' (backward compat)

  private encryptApiKey(text: string): string {
    if (!text) return '';

    const encryptionKey = this.config.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required for API key encryption');
    }
    const salt = randomBytes(16);
    const key = scryptSync(encryptionKey, salt, 32);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `v2:${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
  }

  private decryptApiKey(encrypted: string): string {
    if (!encrypted) return '';

    try {
      const encryptionKey = this.config.get('ENCRYPTION_KEY');
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is required for API key decryption');
      }

      if (encrypted.startsWith('v2:')) {
        const parts = encrypted.split(':');
        const salt = Buffer.from(parts[1], 'hex');
        const iv = Buffer.from(parts[2], 'hex');
        const ciphertext = parts.slice(3).join(':');
        const key = scryptSync(encryptionKey, salt, 32);
        const decipher = createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } else {
        // Legacy format: <iv_hex>:<ciphertext_hex> — static salt 'salt'
        const key = scryptSync(encryptionKey, 'salt', 32);
        const [ivHex, encryptedText] = encrypted.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch {
      return '';
    }
  }

  private maskApiKey(key: string): string {
    if (!key || key.length < 8) return '';
    return key.substring(0, 4) + '•'.repeat(20) + key.substring(key.length - 4);
  }

  private getDefaultPrompts() {
    return {
      leadRiskPrompt: `Analyze this sales lead and provide a risk assessment in JSON format.

Lead Details:
- Contact: ${'{{contactName}}'}
- Company: ${'{{company}}'}
- Value: $${'{{value}}'}
- Stage: ${'{{stage}}'}
- Service Type: ${'{{serviceType}}'}
- Urgency: ${'{{urgency}}'}
- Source: ${'{{source}}'}
- Channel: ${'{{channel}}'}
- Likely Start: ${'{{likelyStartDate}}'}
- Notes: ${'{{notes}}'}

Please respond with a JSON object containing:
{
  "riskLevel": "Low" | "Medium" | "High",
  "summary": "Brief explanation of the risk assessment",
  "recommendations": ["Array of actionable recommendations"],
  "confidence": 0.0 to 1.0
}

Consider factors like deal size, timeline, engagement level, and any red flags.`,

      clientHealthPrompt: `Analyze this client's health status and provide a comprehensive assessment in JSON format.

Client Details:
- Name: ${'{{name}}'}
- Segment: ${'{{segment}}'}
- Industry: ${'{{industry}}'}
- Lifetime Revenue: $${'{{lifetimeRevenue}}'}
- Account Manager: ${'{{accountManager}}'}
- Current Status: ${'{{status}}'}

Engagement Metrics:
- Days Since Last Contact: ${'{{daysSinceLastContact}}'}
- Total Activities: ${'{{totalActivityCount}}'}
- Recent Activities (30 days): ${'{{recentActivityCount}}'}
- Engagement Score: ${'{{engagementScore}}'}/100

Project History:
- Total Projects: ${'{{totalProjectCount}}'}
- Active Projects: ${'{{activeProjectCount}}'}
- Completed Projects: ${'{{completedProjectCount}}'}
- Average Project Value: $${'{{avgProjectValue}}'}
- Recent Revenue (12 months): $${'{{recentRevenue}}'}

Contact Information:
- Email: ${'{{email}}'}
- Phone: ${'{{phone}}'}

Recent Activity Details:
${'{{recentActivities}}'}

Please respond with a JSON object containing:
{
  "healthScore": 0 to 100,
  "summary": "Brief overview of client health (2-3 sentences)",
  "riskFactors": ["Array of specific risk factors based on activity content"],
  "strengths": ["Array of positive indicators from interactions"],
  "recommendations": ["Array of actionable recommendations based on conversation context"]
}

Consider engagement frequency, revenue trends, repeat business, relationship depth, AND the actual content of recent interactions.`,

      executiveSummaryPrompt: `Generate an executive summary for this CRM dashboard data in JSON format.

REVENUE & GROWTH:
- Total Revenue: $${'{{totalRevenue}}'}
- Monthly Revenue: $${'{{monthlyRevenue}}'}
- Quarterly Revenue: $${'{{quarterlyRevenue}}'}
- Pipeline Value: $${'{{pipelineValue}}'}
- Average Deal Size: $${'{{avgDealSize}}'}

SALES PERFORMANCE:
- Total Leads: ${'{{totalLeads}}'}
- Won: ${'{{wonLeads}}'} | Lost: ${'{{lostLeads}}'}
- Win Rate: ${'{{winRate}}'}%
- Average Time to Quote: ${'{{avgTimeToQuote}}'} days
- Average Time to Close: ${'{{avgTimeToClose}}'} days

CLIENT & PROJECT HEALTH:
- Active Clients: ${'{{activeClients}}'}
- Total Projects: ${'{{totalProjects}}'}
- Active Projects: ${'{{activeProjects}}'}

TOP REVENUE CONTRIBUTORS:
${'{{topClients}}'}

REVENUE CONCENTRATION RISK:
- Top Client: ${'{{topClientPercentage}}'}% of revenue
- Top 5 Clients: ${'{{top5ClientsPercentage}}'}% of revenue
- Risk Level: ${'{{concentrationRiskLevel}}'}

STALLED LEADS (30+ days no activity):
${'{{stalledLeads}}'}

PROJECTS AT RISK:
${'{{projectsAtRisk}}'}

HIGH-VALUE DEALS IN PIPELINE:
${'{{highValueDeals}}'}

Please respond with a JSON object containing:
{
  "overview": "2-3 sentence executive summary",
  "whatChanged": ["Array of 2-3 key changes"],
  "whatIsAtRisk": ["Array of 2-3 specific risks"],
  "whatNeedsAttention": ["Array of 2-3 immediate action items"],
  "keyInsights": ["Array of 2-3 strategic insights"]
}`,

      upsellPrompt: `Develop an upsell strategy for this client in JSON format.

Client Details:
- Name: ${'{{name}}'}
- Segment: ${'{{segment}}'}
- Industry: ${'{{industry}}'}
- Lifetime Revenue: $${'{{lifetimeRevenue}}'}

Engagement & Performance:
- Engagement Score: ${'{{engagementScore}}'}/100
- Active Projects: ${'{{activeProjectCount}}'}
- Completed Projects: ${'{{completedProjectCount}}'}
- Recent Revenue (12 months): $${'{{recentRevenue}}'}

Project History:
${'{{projects}}'}

Recent Conversations & Interactions:
${'{{recentActivities}}'}

Please respond with a JSON object containing:
{
  "opportunities": [
    {
      "service": "Service/product name",
      "rationale": "Why this makes sense",
      "estimatedValue": "Estimated value range",
      "priority": "High" | "Medium" | "Low"
    }
  ],
  "approach": "Recommended engagement approach",
  "timing": "Best timing",
  "talkingPoints": ["Key points to emphasize"]
}`,

      chatPrompt: `You are an AI assistant for a CRM system. The user is asking: "${'{{message}}'}"

Context:
- Total Leads: ${'{{leadsCount}}'}
- Total Clients: ${'{{clientsCount}}'}
- User Role: ${'{{userRole}}'}

Provide a helpful, concise response focused on CRM tasks, insights, and recommendations.`,
    };
  }

  // ── Public methods ─────────────────────────────────────────────────────────

  async getAISettings(organizationId: string) {
    let settings = await this.prisma.aISettings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      const defaults = this.getDefaultPrompts();
      settings = await this.prisma.aISettings.create({
        data: {
          organizationId,
          defaultProvider: 'openai',
          anthropicKeyValid: !!this.config.get('ANTHROPIC_API_KEY'),
          openaiKeyValid: !!this.config.get('OPENAI_API_KEY'),
          geminiKeyValid: !!this.config.get('GEMINI_API_KEY'),
          ...defaults,
        },
      });
    }

    const response: any = {
      ...settings,
      anthropicApiKey: settings.anthropicApiKey
        ? this.maskApiKey(this.decryptApiKey(settings.anthropicApiKey))
        : '',
      openaiApiKey: settings.openaiApiKey
        ? this.maskApiKey(this.decryptApiKey(settings.openaiApiKey))
        : '',
      geminiApiKey: settings.geminiApiKey
        ? this.maskApiKey(this.decryptApiKey(settings.geminiApiKey))
        : '',
    };

    const defaults = this.getDefaultPrompts();
    response.leadRiskPrompt = settings.leadRiskPrompt || defaults.leadRiskPrompt;
    response.clientHealthPrompt = settings.clientHealthPrompt || defaults.clientHealthPrompt;
    response.executiveSummaryPrompt = settings.executiveSummaryPrompt || defaults.executiveSummaryPrompt;
    response.upsellPrompt = settings.upsellPrompt || defaults.upsellPrompt;
    response.chatPrompt = settings.chatPrompt || defaults.chatPrompt;

    response.storageInfo = {
      apiKeys: 'Encrypted in database (ai_settings table)',
      prompts: 'Stored in database (ai_settings table)',
      encryptionMethod: 'AES-256-CBC',
    };

    return response;
  }

  async updateAISettings(data: any, organizationId: string) {
    const updateData: any = { ...data };

    if (data.anthropicApiKey && !data.anthropicApiKey.includes('•')) {
      updateData.anthropicApiKey = this.encryptApiKey(data.anthropicApiKey);
      updateData.anthropicKeyValid = !!data.anthropicApiKey;
    }

    if (data.openaiApiKey && !data.openaiApiKey.includes('•')) {
      updateData.openaiApiKey = this.encryptApiKey(data.openaiApiKey);
      updateData.openaiKeyValid = !!data.openaiApiKey;
    }

    if (data.geminiApiKey && !data.geminiApiKey.includes('•')) {
      updateData.geminiApiKey = this.encryptApiKey(data.geminiApiKey);
      updateData.geminiKeyValid = !!data.geminiApiKey;
    }

    return this.prisma.aISettings.upsert({
      where: { organizationId },
      update: updateData,
      create: { organizationId, ...updateData },
    });
  }

  async checkAPIKeys(organizationId: string) {
    const settings = await this.prisma.aISettings.findUnique({
      where: { organizationId },
    });

    return {
      anthropic: settings?.anthropicKeyValid || !!this.config.get('ANTHROPIC_API_KEY'),
      openai: settings?.openaiKeyValid || !!this.config.get('OPENAI_API_KEY'),
      gemini: settings?.geminiKeyValid || !!this.config.get('GEMINI_API_KEY'),
    };
  }
}
