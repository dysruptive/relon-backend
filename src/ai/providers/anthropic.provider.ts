import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  LeadRiskAnalysis,
  ClientHealthReport,
  ExecutiveSummary,
  UpsellStrategy,
  ChatResponse,
  EmailDraft,
  PipelineInsights,
} from '../interfaces/provider.interface';
import {
  buildLeadRiskPrompt,
  buildClientHealthPrompt,
  buildExecutiveSummaryPrompt,
  buildUpsellPrompt,
  buildChatPrompt,
  buildEmailDraftPrompt,
  buildPipelinePrompt,
} from '../prompts';

@Injectable()
export class AnthropicProvider implements AIProvider {
  private client: Anthropic | null = null;

  constructor(configOrApiKey: ConfigService | string) {
    let apiKey: string | undefined;
    if (typeof configOrApiKey === 'string') {
      apiKey = configOrApiKey;
    } else {
      apiKey = configOrApiKey.get<string>('ANTHROPIC_API_KEY');
    }
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  private isAvailable(): boolean {
    return !!this.client;
  }

  async analyzeLeadRisk(lead: any): Promise<LeadRiskAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: buildLeadRiskPrompt(lead),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJson<LeadRiskAnalysis>(content, {
      riskLevel: 'Medium',
      summary: content,
      recommendations: [],
      confidence: 0.75,
    });
  }

  async generateClientHealth(client: any): Promise<ClientHealthReport> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: buildClientHealthPrompt(client),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJson<ClientHealthReport>(content, {
      healthScore: 75,
      summary: content,
      riskFactors: [],
      strengths: [],
      recommendations: [],
    });
  }

  async generateExecutiveSummary(metrics: any): Promise<ExecutiveSummary> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1536,
      messages: [
        {
          role: 'user',
          content: buildExecutiveSummaryPrompt(metrics),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJson<ExecutiveSummary>(content, {
      overview: content,
      whatChanged: [],
      whatIsAtRisk: [],
      whatNeedsAttention: [],
      keyInsights: [],
    });
  }

  async generateUpsellStrategy(client: any): Promise<UpsellStrategy> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: buildUpsellPrompt(client),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJson<UpsellStrategy>(content, {
      opportunities: [],
      approach: content,
      timing: 'Immediate',
    });
  }

  async chat(message: string, context: any): Promise<ChatResponse> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: buildChatPrompt(message, context),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return { message: content };
  }

  async draftEmail(lead: any, emailType: string): Promise<EmailDraft> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: buildEmailDraftPrompt(lead, emailType),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJson<EmailDraft>(content, {
      subject: `${emailType} email`,
      body: content,
      tone: 'professional',
    });
  }

  async analyzePipeline(data: any): Promise<PipelineInsights> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client!.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1536,
      messages: [
        {
          role: 'user',
          content: buildPipelinePrompt(data),
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJson<PipelineInsights>(content, {
      summary: content,
      bottlenecks: [],
      winProbabilityByStage: {},
      recommendations: [],
      urgentLeads: [],
    });
  }

  private parseJson<T>(content: string, fallback: T): T {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
}
