import { IntentType } from '@/types';

/**
 * Hallucination Guard
 * Prevents the agent from generating false information
 */
export class HallucinationGuard {
  /**
   * Check if the answer contains information not present in the source
   */
  checkAnswer(
    answer: string,
    sourceContext: string,
    intent: IntentType,
    safetyMode: 'strict' | 'balanced'
  ): { safe: boolean; reason?: string } {
    
    // In strict mode, answer MUST be based on source context
    if (safetyMode === 'strict') {
      if (!sourceContext || sourceContext.trim().length === 0) {
        return {
          safe: false,
          reason: 'Strict mode: No source context available'
        };
      }

      // Check for suspicious patterns that indicate hallucination
      const suspiciousPatterns = [
        /according to our records/i,
        /our policy states/i,
        /we have found/i,
        /the data shows/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(answer) && !pattern.test(sourceContext)) {
          return {
            safe: false,
            reason: 'Strict mode: Answer contains claims not in source'
          };
        }
      }
    }

    // Check for specific numeric/factual claims
    const numericClaims = answer.match(/\d+/g);
    if (numericClaims && numericClaims.length > 0) {
      // Verify numbers are in source
      for (const num of numericClaims) {
        if (!sourceContext.includes(num)) {
          return {
            safe: false,
            reason: `Numeric claim "${num}" not found in source`
          };
        }
      }
    }

    // Template-based validation for specific intents
    if (intent === 'order_status') {
      const hasOrderInfo = /order|status|delivery|transit/i.test(answer);
      const hasSourceOrderInfo = /order|status|delivery|transit/i.test(sourceContext);
      
      if (hasOrderInfo && !hasSourceOrderInfo) {
        return {
          safe: false,
          reason: 'Order status claims without tool data'
        };
      }
    }

    if (intent === 'create_ticket') {
      const hasTicketInfo = /ticket|created|TKT-/i.test(answer);
      const hasSourceTicketInfo = /ticket|created|TKT-/i.test(sourceContext);
      
      if (hasTicketInfo && !hasSourceTicketInfo) {
        return {
          safe: false,
          reason: 'Ticket creation claims without tool data'
        };
      }
    }

    // Check for abusive content detection
    if (this.containsAbusiveContent(answer)) {
      return {
        safe: false,
        reason: 'Answer contains inappropriate content'
      };
    }

    return { safe: true };
  }

  /**
   * Validate that answer cites proper sources in balanced mode
   */
  validateSourceCitation(answer: string, safetyMode: 'strict' | 'balanced'): boolean {
    if (safetyMode !== 'balanced') {
      return true;
    }

    // In balanced mode, check if answer indicates its source
    const citationPatterns = [
      /based on (faq|tool|our records)/i,
      /according to/i,
      /from (faq|documentation)/i,
      /(faq|tool) (shows|indicates|states)/i,
      /source:\s*(faq|tool|general reasoning)/i,
    ];

    return citationPatterns.some(pattern => pattern.test(answer));
  }

  /**
   * Check for abusive or inappropriate content
   */
  containsAbusiveContent(text: string): boolean {
    const abusivePatterns = [
      /\b(fuck|shit|damn|bitch|asshole)\b/i,
      /\b(idiot|stupid|dumb|moron)\b/i,
      // Add more patterns as needed
    ];

    return abusivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Enforce templated response for high-risk intents
   */
  getTemplatedResponse(intent: IntentType, toolResult?: any): string | null {
    switch (intent) {
      case 'order_status':
        if (toolResult?.status) {
          return `Your order ${toolResult.orderId} is currently ${toolResult.status}. ${
            toolResult.location ? `Location: ${toolResult.location}.` : ''
          } ${
            toolResult.estimatedDelivery 
              ? `Estimated delivery: ${toolResult.estimatedDelivery}.`
              : ''
          }`;
        }
        return null;

      case 'create_ticket':
        if (toolResult?.ticketId) {
          return `Your support ticket ${toolResult.ticketId} has been created successfully. Our team will review it shortly.`;
        }
        return null;

      case 'abusive':
        return 'I understand you may be frustrated. Let me escalate this to a human agent who can better assist you.';

      default:
        return null;
    }
  }
}

export const hallucinationGuard = new HallucinationGuard();
