// Agent Configuration Types
export type LanguageMode = 'english' | 'hinglish';
export type SafetyMode = 'strict' | 'balanced';
export type ActionType = 'answer' | 'tool_call' | 'escalate';

export interface AgentConfig {
  _id?: string;
  agentId: string;
  name: string;
  persona: string;
  languageMode: LanguageMode;
  safetyMode: SafetyMode;
  confidenceThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

// FAQ Types
export interface FAQ {
  _id?: string;
  agentId: string;
  question: string;
  answer: string;
  createdAt: Date;
}

// Tool Types
export interface ToolConfig {
  _id?: string;
  agentId: string;
  name: 'order_lookup' | 'create_ticket';
  enabled: boolean;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Intent Types
export type IntentType = 
  | 'order_status'
  | 'create_ticket'
  | 'general_query'
  | 'greeting'
  | 'complaint'
  | 'refund_request'
  | 'product_inquiry'
  | 'account_issue'
  | 'feedback'
  | 'abusive'
  | 'unknown';

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  reasoning?: string;
}

// Tool Execution Types
export interface ToolExecution {
  toolName: string;
  arguments: Record<string, any>;
  success: boolean;
  result?: any;
  error?: string;
  latency: number;
}

// Agent Response Types
export interface AgentResponse {
  intent: IntentType;
  confidence: number;
  action: ActionType;
  toolExecution?: ToolExecution;
  answer: string;
  answerSource: 'faq' | 'tool' | 'generated' | 'escalated';
  safetyStatus: 'safe' | 'blocked' | 'escalated';
  hallucinationBlocked: boolean;
  timing: {
    intentClassification: number;
    toolExecution?: number;
    answerGeneration: number;
    total: number;
  };
  metadata?: Record<string, any>;
}

// Log Types
export interface ConversationLog {
  _id?: string;
  agentId: string;
  sessionId: string;
  message: string;
  response: AgentResponse;
  timestamp: Date;
}

// Evaluation Types
export interface EvaluationQuery {
  query: string;
  expectedIntent: IntentType;
  expectedAction: ActionType;
  language: LanguageMode;
}

export interface EvaluationResult {
  query: string;
  expectedIntent: IntentType;
  predictedIntent: IntentType;
  intentCorrect: boolean;
  expectedAction: ActionType;
  predictedAction: ActionType;
  actionCorrect: boolean;
  confidence: number;
  hallucinationBlocked: boolean;
  toolSuccess: boolean | null;
  latency: number;
}

export interface EvaluationSummary {
  threshold: number;
  totalQueries: number;
  intentAccuracy: number;
  actionAccuracy: number;
  escalationRate: number;
  toolSuccessRate: number;
  hallucinationBlockCount: number;
  averageLatency: number;
  averageConfidence: number;
  results: EvaluationResult[];
}
