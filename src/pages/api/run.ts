import { NextApiRequest, NextApiResponse } from 'next';
import { agentOrchestrator } from '@/lib/orchestrator';
import { getDatabase } from '@/lib/mongodb';
import { ConversationLog } from '@/types';

// Concurrency control
const activeSessions = new Set<string>();
const MAX_CONCURRENT_SESSIONS = 2;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agentId, message, sessionId } = req.body;

    // Validation
    if (!agentId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: agentId, message' 
      });
    }

    const session = sessionId || `session-${Date.now()}`;

    // Concurrency check
    if (activeSessions.size >= MAX_CONCURRENT_SESSIONS && !activeSessions.has(session)) {
      return res.status(429).json({ 
        error: 'Maximum concurrent sessions reached. Please try again.' 
      });
    }

    // Mark session as active
    activeSessions.add(session);

    try {
      // Process message through orchestrator
      const response = await agentOrchestrator.processMessage(
        agentId,
        message,
        session
      );

      // Log conversation
      await logConversation(agentId, session, message, response);

      // Return response
      res.status(200).json({
        success: true,
        sessionId: session,
        ...response
      });

    } finally {
      // Release session
      activeSessions.delete(session);
    }

  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

async function logConversation(
  agentId: string,
  sessionId: string,
  message: string,
  response: any
): Promise<void> {
  try {
    const db = await getDatabase();
    
    const log: ConversationLog = {
      agentId,
      sessionId,
      message,
      response,
      timestamp: new Date(),
    };

    await db.collection<ConversationLog>('logs').insertOne(log);
  } catch (error) {
    console.error('Failed to log conversation:', error);
    // Don't throw - logging failure shouldn't break the response
  }
}
