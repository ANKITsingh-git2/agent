import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/mongodb';
import { ConversationLog } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDatabase();
    const { agentId, intent, action, failed } = req.query;

    // Build filter
    const filter: any = {};
    
    if (agentId) {
      filter.agentId = agentId;
    }

    if (intent) {
      filter['response.intent'] = intent;
    }

    if (action) {
      filter['response.action'] = action;
    }

    if (failed === 'true') {
      filter['response.toolExecution.success'] = false;
    }

    // Query logs
    const logs = await db
      .collection<ConversationLog>('logs')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    res.status(200).json({ success: true, logs });
  } catch (error: any) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: error.message });
  }
}
