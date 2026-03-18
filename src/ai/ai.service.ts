import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, scryptSync } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  AIProviderType,
  AIProvider,
  EmailDraft,
  PipelineInsights,
} from './interfaces/provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { PLAN_LIMITS } from '../billing/plans';

interface OrgSettings {
  defaultProvider: string;
  leadRiskProvider: string | null;
  clientHealthProvider: string | null;
  executiveSummaryProvider: string | null;
  chatProvider: string | null;
  emailProvider: string | null;
  pipelineProvider: string | null;
  anthropicKey: string;
  openaiKey: string;
  geminiKey: string;
  leadRiskPrompt: string | null;
  clientHealthPrompt: string | null;
  executiveSummaryPrompt: string | null;
  upsellPrompt: string | null;
  chatPrompt: string | null;
}

interface OrgCache {
  settings: OrgSettings;
  providers: Map<string, AIProvider>;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AiService {
  private providers: Map<AIProviderType, AIProvider>;
  private defaultProvider: AIProviderType;
  private orgCache: Map<string, OrgCache> = new Map();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    // Initialize global providers using env var keys
    this.providers = new Map<AIProviderType, AIProvider>([
      [AIProviderType.ANTHROPIC, new AnthropicProvider(config)],
      [AIProviderType.OPENAI, new OpenAIProvider(config)],
      [AIProviderType.GEMINI, new GeminiProvider(config)],
    ]);

    // Set default provider from config
    const configuredDefault = config.get<string>('AI_DEFAULT_PROVIDER');
    this.defaultProvider =
      AIProviderType[
        configuredDefault?.toUpperCase() as keyof typeof AIProviderType
      ] || AIProviderType.OPENAI;

    console.log(
      `AI Service initialized with default provider: ${this.defaultProvider}`
    );
  }

  // ─── Decryption helper (mirrors AdminService) ────────────────────────────────

  private decryptApiKey(encrypted: string): string {
    if (!encrypted) return '';
    try {
      const encryptionKey = this.config.get<string>('ENCRYPTION_KEY');
      if (!encryptionKey) return '';

      if (encrypted.startsWith('v2:')) {
        // New format: v2:<salt_hex>:<iv_hex>:<ciphertext_hex>
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

  // ─── Org settings resolution ─────────────────────────────────────────────────

  private async getOrgSettings(organizationId: string): Promise<OrgSettings> {
    const cached = this.orgCache.get(organizationId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.settings;
    }

    const record = await this.prisma.aISettings.findUnique({
      where: { organizationId },
    });

    const settings: OrgSettings = {
      defaultProvider: record?.defaultProvider || this.defaultProvider,
      leadRiskProvider: record?.leadRiskProvider || null,
      clientHealthProvider: record?.clientHealthProvider || null,
      executiveSummaryProvider: record?.executiveSummaryProvider || null,
      chatProvider: record?.chatProvider || null,
      emailProvider: null,
      pipelineProvider: null,
      anthropicKey: record?.anthropicApiKey
        ? this.decryptApiKey(record.anthropicApiKey)
        : '',
      openaiKey: record?.openaiApiKey
        ? this.decryptApiKey(record.openaiApiKey)
        : '',
      geminiKey: record?.geminiApiKey
        ? this.decryptApiKey(record.geminiApiKey)
        : '',
      leadRiskPrompt: record?.leadRiskPrompt || null,
      clientHealthPrompt: record?.clientHealthPrompt || null,
      executiveSummaryPrompt: record?.executiveSummaryPrompt || null,
      upsellPrompt: record?.upsellPrompt || null,
      chatPrompt: record?.chatPrompt || null,
    };

    // Store with empty providers map (providers created on demand)
    this.orgCache.set(organizationId, {
      settings,
      providers: new Map(),
      cachedAt: Date.now(),
    });

    return settings;
  }

  // ─── Per-org provider instantiation ──────────────────────────────────────────

  private getProviderForOrg(
    feature: string,
    orgSettings: OrgSettings,
    organizationId: string,
  ): AIProvider {
    const cacheEntry = this.orgCache.get(organizationId);

    // Resolve which provider type to use
    const featureKey = `${feature}Provider` as keyof OrgSettings;
    const providerTypeStr =
      (orgSettings[featureKey] as string | null) ||
      orgSettings.defaultProvider ||
      this.defaultProvider;

    const providerType: AIProviderType =
      AIProviderType[
        providerTypeStr.toUpperCase() as keyof typeof AIProviderType
      ] || AIProviderType.OPENAI;

    // Resolve the API key: org key takes precedence over env var
    let apiKey: string;
    switch (providerType) {
      case AIProviderType.ANTHROPIC:
        apiKey =
          orgSettings.anthropicKey ||
          this.config.get<string>('ANTHROPIC_API_KEY') ||
          '';
        break;
      case AIProviderType.GEMINI:
        apiKey =
          orgSettings.geminiKey ||
          this.config.get<string>('GEMINI_API_KEY') ||
          '';
        break;
      case AIProviderType.OPENAI:
      default:
        apiKey =
          orgSettings.openaiKey ||
          this.config.get<string>('OPENAI_API_KEY') ||
          '';
        break;
    }

    // Cache key for this provider+key combination within this org
    const cacheKey = `${providerType}:${apiKey.slice(-8)}`;

    if (cacheEntry?.providers.has(cacheKey)) {
      return cacheEntry.providers.get(cacheKey)!;
    }

    // Instantiate new provider with the resolved key
    let provider: AIProvider;
    switch (providerType) {
      case AIProviderType.ANTHROPIC:
        provider = new AnthropicProvider(apiKey);
        break;
      case AIProviderType.GEMINI:
        provider = new GeminiProvider(apiKey);
        break;
      case AIProviderType.OPENAI:
      default:
        provider = new OpenAIProvider(apiKey);
        break;
    }

    cacheEntry?.providers.set(cacheKey, provider);
    return provider;
  }

  // ─── Global provider (no org context) ────────────────────────────────────────

  private getProvider(type?: AIProviderType | string): AIProvider {
    let providerType: AIProviderType;

    if (typeof type === 'string') {
      providerType =
        AIProviderType[
          type.toUpperCase() as keyof typeof AIProviderType
        ] || this.defaultProvider;
    } else {
      providerType = type || this.defaultProvider;
    }

    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not found`);
    }

    return provider;
  }

  // ─── Plan gate ───────────────────────────────────────────────────────────────

  private async assertAiEnabled(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, planStatus: true },
    });
    const plan = (org?.plan || 'trial') as string;
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.trial;
    if (!limits.aiEnabled) {
      throw new ForbiddenException(
        'AI features are not available on your current plan. Please upgrade to Growth or Scale.',
      );
    }
  }

  // ─── Public methods ───────────────────────────────────────────────────────────

  async analyzeLeadRisk(
    lead: any,
    organizationId?: string,
    provider?: AIProviderType | string,
  ) {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'leadRisk',
        orgSettings,
        organizationId,
      );
      return selectedProvider.analyzeLeadRisk(lead);
    }
    return this.getProvider(provider).analyzeLeadRisk(lead);
  }

  async generateClientHealth(
    client: any,
    organizationId?: string,
    provider?: AIProviderType | string,
  ) {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'clientHealth',
        orgSettings,
        organizationId,
      );
      return selectedProvider.generateClientHealth(client);
    }
    return this.getProvider(provider).generateClientHealth(client);
  }

  async generateExecutiveSummary(
    metrics: any,
    organizationId?: string,
    provider?: AIProviderType | string,
  ) {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'executiveSummary',
        orgSettings,
        organizationId,
      );
      return selectedProvider.generateExecutiveSummary(metrics);
    }
    return this.getProvider(provider).generateExecutiveSummary(metrics);
  }

  async generateUpsellStrategy(
    client: any,
    organizationId?: string,
    provider?: AIProviderType | string,
  ) {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'clientHealth',
        orgSettings,
        organizationId,
      );
      return selectedProvider.generateUpsellStrategy(client);
    }
    return this.getProvider(provider).generateUpsellStrategy(client);
  }

  async chat(
    message: string,
    context: any,
    organizationId?: string,
    provider?: AIProviderType | string,
  ) {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'chat',
        orgSettings,
        organizationId,
      );
      return selectedProvider.chat(message, context);
    }
    return this.getProvider(provider).chat(message, context);
  }

  async draftEmail(
    lead: any,
    emailType: string,
    organizationId?: string,
    provider?: AIProviderType | string,
  ): Promise<EmailDraft> {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'leadRisk',
        orgSettings,
        organizationId,
      );
      return selectedProvider.draftEmail(lead, emailType);
    }
    return this.getProvider(provider).draftEmail(lead, emailType);
  }

  async analyzePipeline(
    data: any,
    organizationId?: string,
    provider?: AIProviderType | string,
  ): Promise<PipelineInsights> {
    if (organizationId) {
      await this.assertAiEnabled(organizationId);
      const orgSettings = await this.getOrgSettings(organizationId);
      const selectedProvider = this.getProviderForOrg(
        'executiveSummary',
        orgSettings,
        organizationId,
      );
      return selectedProvider.analyzePipeline(data);
    }
    return this.getProvider(provider).analyzePipeline(data);
  }

  // Get available providers
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  // Get default provider
  getDefaultProvider(): string {
    return this.defaultProvider;
  }
}
