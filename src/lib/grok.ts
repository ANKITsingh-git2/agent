import axios from 'axios';

const GROK_API_URL = process.env.GROK_API_URL || 'https://api.x.ai/v1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-2-latest';
const GROK_MODEL_FALLBACKS = process.env.GROK_MODEL_FALLBACKS;

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class GrokClient {
  private apiKey: string | null;
  private baseUrl: string;
  private model: string;
  private modelFallbacks: string[];

  constructor() {
    this.apiKey = process.env.GROK_API_KEY || null;
    this.baseUrl = GROK_API_URL;
    this.model = GROK_MODEL;
    this.modelFallbacks = (GROK_MODEL_FALLBACKS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  private normalize(text: string): string {
    return (text || '').toLowerCase().trim();
  }

  private getModelsToTry(): string[] {
    const defaults = ['grok-4', 'grok-3', 'grok-3-mini', 'grok-3-mini-beta'];
    const all = [this.model, ...this.modelFallbacks, ...defaults];
    const unique: string[] = [];
    for (const m of all) {
      if (!m) continue;
      if (!unique.includes(m)) unique.push(m);
    }
    return unique;
  }

  private async requestChat(
    model: string,
    messages: GrokMessage[],
    temperature: number
  ): Promise<string> {
    const response = await axios.post<GrokResponse>(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  private fallbackClassifyIntent(message: string): { intent: string; confidence: number; reasoning: string } {
    const m = this.normalize(message);

    if (!m) return { intent: 'unknown', confidence: 0.4, reasoning: 'Empty message' };

    const abusive = /\b(fuck|shit|damn|bitch|asshole|idiot|stupid|dumb|moron)\b/i;
    if (abusive.test(m)) return { intent: 'abusive', confidence: 0.9, reasoning: 'Abusive language detected (fallback)' };

    const greeting = /\b(hi|hello|hey|good morning|good afternoon|good evening|namaste)\b/i;
    if (greeting.test(m)) return { intent: 'greeting', confidence: 0.85, reasoning: 'Greeting keywords matched (fallback)' };

    const hasOrderKeyword = /\b(order|track|tracking|status|delivery|shipment)\b/i.test(m) || /\b(mera|mere)\s+order\b/i.test(m);
    const orderIdMatch = m.match(/\b(\d{4,})\b/);
    if (hasOrderKeyword && orderIdMatch) {
      return { intent: 'order_status', confidence: 0.85, reasoning: 'Order keywords + order id found (fallback)' };
    }
    if (hasOrderKeyword) {
      return { intent: 'order_status', confidence: 0.65, reasoning: 'Order keywords found (fallback)' };
    }

    const ticketKeywords = /\b(ticket|complaint|issue|problem|support|help)\b/i.test(m) || /\b(shikayat|complain)\b/i.test(m);
    if (ticketKeywords) return { intent: 'create_ticket', confidence: 0.75, reasoning: 'Support/ticket keywords matched (fallback)' };

    const refundKeywords = /\b(refund|return|cancel)\b/i.test(m);
    if (refundKeywords) return { intent: 'refund_request', confidence: 0.75, reasoning: 'Refund/return keywords matched (fallback)' };

    const complaintKeywords = /\b(unacceptable|disappointed|angry|terrible|worst|bad experience)\b/i.test(m) || /\b(bura|kharab)\b/i.test(m);
    if (complaintKeywords) return { intent: 'complaint', confidence: 0.7, reasoning: 'Complaint keywords matched (fallback)' };

    const accountKeywords = /\b(account|login|sign in|password|access)\b/i.test(m);
    if (accountKeywords) return { intent: 'account_issue', confidence: 0.7, reasoning: 'Account keywords matched (fallback)' };

    const productKeywords = /\b(product|price|spec|specs|details|warranty)\b/i.test(m);
    if (productKeywords) return { intent: 'product_inquiry', confidence: 0.65, reasoning: 'Product keywords matched (fallback)' };

    const generalKeywords = /\b(hours|business hours|open|close|ship|shipping|international|policy|terms)\b/i.test(m);
    if (generalKeywords) return { intent: 'general_query', confidence: 0.6, reasoning: 'General info keywords matched (fallback)' };

    return { intent: 'unknown', confidence: 0.45, reasoning: 'No clear keywords matched (fallback)' };
  }

  async chat(messages: GrokMessage[], temperature: number = 0.7): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY is not set in environment variables');
    }
    try {
      const modelsToTry = this.getModelsToTry();
      let lastError: any = null;

      for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        try {
          return await this.requestChat(model, messages, temperature);
        } catch (error: any) {
          lastError = error;
          const isLast = i === modelsToTry.length - 1;
          const apiError = error.response?.data?.error;
          const canRetryModel =
            typeof apiError === 'string' && /model not found/i.test(apiError) && !isLast;

          if (canRetryModel) {
            console.warn(`Grok model not found: ${model}. Trying fallback model...`);
            continue;
          }
          if (!isLast) continue;
          throw error;
        }
      }

      throw lastError || new Error('Grok API call failed');
    } catch (error: any) {
      console.error('Grok API Error:', error.response?.data || error.message);
      throw new Error(`Grok API call failed: ${error.message}`);
    }
  }

  async classifyIntent(message: string, language: string): Promise<any> {
    const systemPrompt = `You are an intent classifier for a customer support agent. Classify the user message into one of these intents:
- order_status: User asking about their order location/status
- create_ticket: User wants to create a support ticket
- general_query: General questions about products/services
- greeting: Simple greetings or hello
- complaint: User is complaining about something
- refund_request: User wants a refund
- product_inquiry: Asking about product details
- account_issue: Problems with their account
- feedback: Providing feedback
- abusive: Abusive, offensive, or inappropriate language
- unknown: Cannot determine intent

Respond ONLY with valid JSON in this exact format:
{
  "intent": "intent_name",
  "confidence": 0.85,
  "reasoning": "brief explanation"
}

Language context: ${language}`;

    let response = '';
    try {
      response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        0.3
      );
    } catch (error: any) {
      console.error('Intent classification fallback:', error.message);
      return this.fallbackClassifyIntent(message);
    }

    try {
      // Clean response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse intent classification:', response);
      return {
        intent: 'unknown',
        confidence: 0.5,
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  async generateAnswer(
    message: string,
    context: string,
    persona: string,
    language: string,
    safetyMode: string
  ): Promise<string> {
    const systemPrompt = `${persona}

Language: ${language}
Safety Mode: ${safetyMode}

Context: ${context}

${safetyMode === 'strict' 
  ? 'STRICT MODE: Only answer using the provided context. If information is not in context, say you need to escalate or clarify.'
  : 'BALANCED MODE: You may generate responses but MUST cite your source (FAQ/Tool/General reasoning). Refuse if required information is missing.'
}

Keep responses concise and helpful.`;

    try {
      return await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]);
    } catch (error: any) {
      console.error('Answer generation fallback:', error.message);
      return `I’m having trouble reaching the model right now. If you can share a bit more detail, I can help, or I can escalate this to a human agent.\n\nSource: General reasoning`;
    }
  }
}

export const grokClient = new GrokClient();
