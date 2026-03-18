export enum AIProviderType {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GEMINI = 'gemini',
}

export interface LeadRiskAnalysis {
  riskLevel: 'Low' | 'Medium' | 'High';
  summary: string;
  recommendations: string[];
  confidence: number;
}

export interface ClientHealthReport {
  healthScore: number; // 0-100
  summary: string;
  riskFactors: string[];
  strengths: string[];
  recommendations: string[];
}

export interface ExecutiveSummary {
  overview: string;
  whatChanged: string[];
  whatIsAtRisk: string[];
  whatNeedsAttention: string[];
  keyInsights: string[];
}

export interface UpsellStrategy {
  opportunities: Array<{
    service: string;
    rationale: string;
    estimatedValue: string;
    priority: 'High' | 'Medium' | 'Low';
  }>;
  approach: string;
  timing: string;
}

export interface ChatResponse {
  message: string;
  suggestions?: string[];
}

export interface EmailDraft {
  subject: string;
  body: string;
  tone: string;
}

export interface PipelineInsights {
  summary: string;
  bottlenecks: string[];
  winProbabilityByStage: Record<string, number>;
  recommendations: string[];
  urgentLeads: string[];
}

export interface AIProvider {
  analyzeLeadRisk(lead: any): Promise<LeadRiskAnalysis>;
  generateClientHealth(client: any): Promise<ClientHealthReport>;
  generateExecutiveSummary(metrics: any): Promise<ExecutiveSummary>;
  generateUpsellStrategy(client: any): Promise<UpsellStrategy>;
  chat(message: string, context: any): Promise<ChatResponse>;
  draftEmail(lead: any, emailType: string): Promise<EmailDraft>;
  analyzePipeline(data: any): Promise<PipelineInsights>;
}
