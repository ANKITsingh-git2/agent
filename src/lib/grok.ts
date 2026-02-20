import axios from 'axios';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.x.ai/v1';

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
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY is not set in environment variables');
    }
    this.apiKey = GROK_API_KEY;
    this.baseUrl = GROK_API_URL;
  }

  async chat(messages: GrokMessage[], temperature: number = 0.7): Promise<string> {
    try {
      const response = await axios.post<GrokResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'grok-beta',
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

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ], 0.3);

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

    return await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);
  }
}

export const grokClient = new GrokClient();
