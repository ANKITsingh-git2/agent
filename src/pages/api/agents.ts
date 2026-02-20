import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/mongodb';
import { AgentConfig, ToolConfig } from '@/types';
import { createDefaultToolConfigs } from '@/lib/defaultToolConfigs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const db = await getDatabase();

  if (req.method === 'POST') {
    // Create new agent
    try {
      const { name, persona, languageMode, safetyMode, confidenceThreshold } = req.body;

      if (!name || !persona) {
        return res.status(400).json({ error: 'Name and persona are required' });
      }

      const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const agent: AgentConfig = {
        agentId,
        name,
        persona,
        languageMode: languageMode || 'english',
        safetyMode: safetyMode || 'balanced',
        confidenceThreshold: confidenceThreshold || 0.7,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection<AgentConfig>('agents').insertOne(agent);
      await db.collection<ToolConfig>('tools').insertMany(createDefaultToolConfigs(agentId));

      res.status(201).json({ success: true, agent });
    } catch (error: any) {
      console.error('Create agent error:', error);
      res.status(500).json({ error: error.message });
    }
  } 
  else if (req.method === 'GET') {
    // Get all agents
    try {
      const agents = await db
        .collection<AgentConfig>('agents')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({ success: true, agents });
    } catch (error: any) {
      console.error('Get agents error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  else if (req.method === 'PUT') {
    // Update agent
    try {
      const { agentId, ...updates } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const result = await db
        .collection<AgentConfig>('agents')
        .updateOne(
          { agentId },
          { $set: { ...updates, updatedAt: new Date() } }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Update agent error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
