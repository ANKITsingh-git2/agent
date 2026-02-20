import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/mongodb';
import { AgentConfig, FAQ, ToolConfig } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    const db = await getDatabase();

    // Get agent config
    const agent = await db
      .collection<AgentConfig>('agents')
      .findOne({ agentId: agentId as string });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get FAQs
    const faqs = await db
      .collection<FAQ>('faqs')
      .find({ agentId: agentId as string })
      .toArray();

    const tools = await db
      .collection<ToolConfig>('tools')
      .find({ agentId: agentId as string })
      .sort({ name: 1 })
      .toArray();

    // Build export JSON
    const exportData = {
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        persona: agent.persona,
        languageMode: agent.languageMode,
        safetyMode: agent.safetyMode,
        confidenceThreshold: agent.confidenceThreshold,
      },
      faqs: faqs.map(faq => ({
        question: faq.question,
        answer: faq.answer,
      })),
      tools: tools.map(t => ({
        name: t.name,
        enabled: t.enabled,
        description: t.description,
        parameters: t.parameters,
      })),
      exportedAt: new Date().toISOString(),
    };

    res.status(200).json(exportData);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
}
