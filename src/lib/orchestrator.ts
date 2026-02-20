import { 
  AgentConfig, 
  AgentResponse, 
  IntentType, 
  ActionType,
  FAQ,
  ToolConfig
} from '@/types';
import { grokClient } from './grok';
import { toolExecutor } from './toolExecutor';
import { hallucinationGuard } from './hallucinationGuard';
import { getDatabase } from './mongodb';
import { createDefaultToolConfigs } from './defaultToolConfigs';

export class AgentOrchestrator {
  private failureCount: Map<string, number> = new Map();

  private ensureBalancedCitation(
    answer: string,
    safetyMode: AgentConfig['safetyMode'],
    answerSource: 'faq' | 'tool' | 'generated' | 'escalated'
  ): string {
    if (safetyMode !== 'balanced') return answer;
    if (hallucinationGuard.validateSourceCitation(answer, 'balanced')) return answer;

    const sourceLabel =
      answerSource === 'faq'
        ? 'FAQ'
        : answerSource === 'tool'
          ? 'Tool'
          : 'General reasoning';

    return `${answer}\n\nSource: ${sourceLabel}`;
  }

  /**
   * Main orchestration method
   */
  async processMessage(
    agentId: string,
    message: string,
    sessionId: string
  ): Promise<AgentResponse> {
    const totalStart = Date.now();

    try {
      // Load agent configuration
      const agent = await this.loadAgentConfig(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Step 1: Intent Classification
      const intentStart = Date.now();
      const intentResult = await grokClient.classifyIntent(
        message,
        agent.languageMode
      );
      const intentLatency = Date.now() - intentStart;

      const intent: IntentType = intentResult.intent;
      const confidence: number = intentResult.confidence;

      // Step 2: Check for abusive content
      if (intent === 'abusive' || hallucinationGuard.containsAbusiveContent(message)) {
        return this.createEscalationResponse(
          intent,
          confidence,
          'Abusive language detected',
          { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
        );
      }

      // Step 3: Confidence threshold check
      if (confidence < agent.confidenceThreshold) {
        return this.createEscalationResponse(
          intent,
          confidence,
          'Confidence below threshold',
          { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
        );
      }

      // Step 4: Check repeated failures
      const failureKey = `${sessionId}-${intent}`;
      const failures = this.failureCount.get(failureKey) || 0;
      if (failures >= 2) {
        return this.createEscalationResponse(
          intent,
          confidence,
          'Repeated tool failures',
          { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
        );
      }

      // Step 5: Determine action and execute
      const action = this.determineAction(intent, confidence, agent);
      
      if (action === 'tool_call') {
        return await this.handleToolCall(
          agentId,
          intent,
          confidence,
          message,
          agent,
          intentLatency,
          totalStart,
          failureKey
        );
      } else if (action === 'answer') {
        return await this.handleAnswerGeneration(
          agentId,
          intent,
          confidence,
          message,
          agent,
          intentLatency,
          totalStart
        );
      } else {
        return this.createEscalationResponse(
          intent,
          confidence,
          'Intent requires human assistance',
          { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
        );
      }

    } catch (error: any) {
      console.error('Agent orchestration error:', error);
      throw error;
    }
  }

  /**
   * Determine the action based on intent and confidence
   */
  private determineAction(
    intent: IntentType,
    confidence: number,
    agent: AgentConfig
  ): ActionType {
    // Tool-requiring intents
    if (intent === 'order_status' || intent === 'create_ticket') {
      return 'tool_call';
    }

    // Escalation intents
    if (intent === 'abusive' || intent === 'unknown') {
      return 'escalate';
    }

    // Answer from FAQ or generate
    return 'answer';
  }

  /**
   * Handle tool-based interactions
   */
  private async handleToolCall(
    agentId: string,
    intent: IntentType,
    confidence: number,
    message: string,
    agent: AgentConfig,
    intentLatency: number,
    totalStart: number,
    failureKey: string
  ): Promise<AgentResponse> {
    
    // Extract tool parameters from message
    const toolParams = this.extractToolParameters(intent, message);
    
    if (!toolParams.valid) {
      return this.createEscalationResponse(
        intent,
        confidence,
        toolParams.reason || 'Missing required parameters',
        { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
      );
    }

    const toolConfig = await this.loadToolConfig(agentId, toolParams.toolName as ToolConfig['name']);
    if (!toolConfig) {
      return this.createEscalationResponse(
        intent,
        confidence,
        `Tool config failure: missing configuration for ${toolParams.toolName}`,
        { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
      );
    }
    if (!toolConfig.enabled) {
      return this.createEscalationResponse(
        intent,
        confidence,
        `Tool config failure: ${toolParams.toolName} is disabled`,
        { intentClassification: intentLatency, answerGeneration: 0, total: Date.now() - totalStart }
      );
    }

    // Execute tool
    const toolStart = Date.now();
    const toolExecution = await toolExecutor.executeTool(
      toolParams.toolName!,
      toolParams.args!
    );
    const toolLatency = toolExecution.latency;

    // Handle tool failure
    if (!toolExecution.success) {
      // Increment failure count
      const currentFailures = this.failureCount.get(failureKey) || 0;
      this.failureCount.set(failureKey, currentFailures + 1);

      return {
        intent,
        confidence,
        action: 'escalate',
        toolExecution,
        answer: `I encountered an error: ${toolExecution.error}. Let me connect you with a human agent.`,
        answerSource: 'escalated',
        safetyStatus: 'escalated',
        hallucinationBlocked: false,
        timing: {
          intentClassification: intentLatency,
          toolExecution: toolLatency,
          answerGeneration: 0,
          total: Date.now() - totalStart,
        }
      };
    }

    // Reset failure count on success
    this.failureCount.set(failureKey, 0);

    // Generate answer from tool result
    const answerStart = Date.now();
    
    // Use templated response for safety
    let answer = hallucinationGuard.getTemplatedResponse(intent, toolExecution.result);
    
    if (!answer) {
      // Generate with AI if no template
      const context = JSON.stringify(toolExecution.result);
      answer = await grokClient.generateAnswer(
        message,
        context,
        agent.persona,
        agent.languageMode,
        agent.safetyMode
      );

      // Validate for hallucination
      const guardCheck = hallucinationGuard.checkAnswer(
        answer,
        context,
        intent,
        agent.safetyMode
      );

      if (!guardCheck.safe) {
        return {
          intent,
          confidence,
          action: 'escalate',
          toolExecution,
          answer: 'I need to verify this information with a human agent to ensure accuracy.',
          answerSource: 'escalated',
          safetyStatus: 'blocked',
          hallucinationBlocked: true,
          timing: {
            intentClassification: intentLatency,
            toolExecution: toolLatency,
            answerGeneration: Date.now() - answerStart,
            total: Date.now() - totalStart,
          },
          metadata: { blockReason: guardCheck.reason }
        };
      }
    }

    const answerLatency = Date.now() - answerStart;
    answer = this.ensureBalancedCitation(answer, agent.safetyMode, 'tool');

    return {
      intent,
      confidence,
      action: 'tool_call',
      toolExecution,
      answer,
      answerSource: 'tool',
      safetyStatus: 'safe',
      hallucinationBlocked: false,
      timing: {
        intentClassification: intentLatency,
        toolExecution: toolLatency,
        answerGeneration: answerLatency,
        total: Date.now() - totalStart,
      }
    };
  }

  /**
   * Handle answer generation from FAQ or AI
   */
  private async handleAnswerGeneration(
    agentId: string,
    intent: IntentType,
    confidence: number,
    message: string,
    agent: AgentConfig,
    intentLatency: number,
    totalStart: number
  ): Promise<AgentResponse> {
    
    const answerStart = Date.now();

    // Try to find answer in FAQ
    const faqAnswer = await this.findFAQAnswer(agentId, message);
    
    if (faqAnswer) {
      const cited = this.ensureBalancedCitation(faqAnswer, agent.safetyMode, 'faq');
      return {
        intent,
        confidence,
        action: 'answer',
        answer: cited,
        answerSource: 'faq',
        safetyStatus: 'safe',
        hallucinationBlocked: false,
        timing: {
          intentClassification: intentLatency,
          answerGeneration: Date.now() - answerStart,
          total: Date.now() - totalStart,
        }
      };
    }

    // Generate answer with AI
    if (agent.safetyMode === 'strict') {
      // In strict mode, escalate if no FAQ match
      return this.createEscalationResponse(
        intent,
        confidence,
        'No FAQ match in strict mode',
        { 
          intentClassification: intentLatency, 
          answerGeneration: Date.now() - answerStart, 
          total: Date.now() - totalStart 
        }
      );
    }

    // Balanced mode: generate answer
    const context = 'General knowledge and reasoning';
    const answer = await grokClient.generateAnswer(
      message,
      context,
      agent.persona,
      agent.languageMode,
      agent.safetyMode
    );

    const answerLatency = Date.now() - answerStart;
    const cited = this.ensureBalancedCitation(answer, agent.safetyMode, 'generated');

    return {
      intent,
      confidence,
      action: 'answer',
      answer: cited,
      answerSource: 'generated',
      safetyStatus: 'safe',
      hallucinationBlocked: false,
      timing: {
        intentClassification: intentLatency,
        answerGeneration: answerLatency,
        total: Date.now() - totalStart,
      }
    };
  }

  /**
   * Extract tool parameters from message
   */
  private extractToolParameters(
    intent: IntentType,
    message: string
  ): { valid: boolean; toolName?: string; args?: any; reason?: string } {
    
    if (intent === 'order_status') {
      // Extract order ID from message
      const orderIdMatch = message.match(/\b(\d{4,})\b/);
      if (!orderIdMatch) {
        return { 
          valid: false, 
          reason: 'Please provide your order number' 
        };
      }
      return {
        valid: true,
        toolName: 'order_lookup',
        args: { orderId: orderIdMatch[1] }
      };
    }

    if (intent === 'create_ticket') {
      // Extract category and description
      const category = 'general'; // Could be enhanced with better extraction
      const description = message;
      
      return {
        valid: true,
        toolName: 'create_ticket',
        args: { category, description }
      };
    }

    return { valid: false, reason: 'Unknown tool for intent' };
  }

  /**
   * Find matching FAQ answer
   */
  private async findFAQAnswer(agentId: string, message: string): Promise<string | null> {
    try {
      const db = await getDatabase();
      const faqs = await db
        .collection<FAQ>('faqs')
        .find({ agentId })
        .toArray();

      // Simple keyword matching (can be enhanced)
      const messageLower = message.toLowerCase();
      
      for (const faq of faqs) {
        const questionLower = faq.question.toLowerCase();
        const keywords = questionLower.split(' ').filter(w => w.length > 3);
        
        const matchCount = keywords.filter(k => messageLower.includes(k)).length;
        if (matchCount >= Math.ceil(keywords.length * 0.5)) {
          return faq.answer;
        }
      }

      return null;
    } catch (error) {
      console.error('FAQ lookup error:', error);
      return null;
    }
  }

  /**
   * Load agent configuration
   */
  private async loadAgentConfig(agentId: string): Promise<AgentConfig | null> {
    try {
      const db = await getDatabase();
      const agent = await db
        .collection<AgentConfig>('agents')
        .findOne({ agentId });
      return agent;
    } catch (error) {
      console.error('Failed to load agent config:', error);
      return null;
    }
  }

  private async loadToolConfig(agentId: string, toolName: ToolConfig['name']): Promise<ToolConfig | null> {
    try {
      const db = await getDatabase();
      const existing = await db.collection<ToolConfig>('tools').findOne({ agentId, name: toolName });
      if (existing) return existing;

      const defaults = createDefaultToolConfigs(agentId);
      await db.collection<ToolConfig>('tools').bulkWrite(
        defaults.map(t => ({
          updateOne: {
            filter: { agentId: t.agentId, name: t.name },
            update: { $setOnInsert: t },
            upsert: true,
          },
        })),
        { ordered: false }
      );

      return await db.collection<ToolConfig>('tools').findOne({ agentId, name: toolName });
    } catch (error) {
      console.error('Failed to load tool config:', error);
      return null;
    }
  }

  /**
   * Create escalation response
   */
  private createEscalationResponse(
    intent: IntentType,
    confidence: number,
    reason: string,
    timing: any
  ): AgentResponse {
    return {
      intent,
      confidence,
      action: 'escalate',
      answer: 'I need to connect you with a human agent for better assistance.',
      answerSource: 'escalated',
      safetyStatus: 'escalated',
      hallucinationBlocked: false,
      timing,
      metadata: { escalationReason: reason }
    };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
