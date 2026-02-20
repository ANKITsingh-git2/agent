import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/mongodb';
import { ToolConfig } from '@/types';
import { createDefaultToolConfigs } from '@/lib/defaultToolConfigs';

const ALLOWED_TOOL_NAMES = new Set<ToolConfig['name']>(['order_lookup', 'create_ticket']);

function validateToolConfig(tool: Partial<ToolConfig>): { ok: boolean; error?: string } {
  if (!tool.agentId) return { ok: false, error: 'agentId is required' };
  if (!tool.name || !ALLOWED_TOOL_NAMES.has(tool.name as any)) return { ok: false, error: 'Invalid tool name' };
  if (typeof tool.enabled !== 'boolean') return { ok: false, error: 'enabled must be boolean' };
  if (!tool.description || typeof tool.description !== 'string' || tool.description.trim().length < 5) {
    return { ok: false, error: 'description is required (min 5 chars)' };
  }
  if (!Array.isArray(tool.parameters) || tool.parameters.length === 0) {
    return { ok: false, error: 'parameters are required' };
  }
  for (const param of tool.parameters) {
    if (!param?.name || typeof param.name !== 'string') return { ok: false, error: 'parameter.name is required' };
    if (!param?.type || typeof param.type !== 'string') return { ok: false, error: 'parameter.type is required' };
    if (typeof param?.required !== 'boolean') return { ok: false, error: 'parameter.required must be boolean' };
    if (!param?.description || typeof param.description !== 'string' || param.description.trim().length < 3) {
      return { ok: false, error: 'parameter.description is required (min 3 chars)' };
    }
  }

  const paramNames = new Set(tool.parameters.map(p => p.name));
  if (tool.name === 'order_lookup' && (!paramNames.has('orderId') || !tool.parameters.find(p => p.name === 'orderId')?.required)) {
    return { ok: false, error: 'order_lookup must require parameter: orderId' };
  }
  if (tool.name === 'create_ticket') {
    const required = new Set(tool.parameters.filter(p => p.required).map(p => p.name));
    if (!required.has('category') || !required.has('description')) {
      return { ok: false, error: 'create_ticket must require parameters: category, description' };
    }
  }

  return { ok: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await getDatabase();

  if (req.method === 'GET') {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== 'string') {
      return res.status(400).json({ error: 'agentId is required' });
    }

    const tools = await db.collection<ToolConfig>('tools').find({ agentId }).sort({ name: 1 }).toArray();
    if (tools.length > 0) {
      return res.status(200).json({ success: true, tools });
    }

    // First-time initialization
    const defaults = createDefaultToolConfigs(agentId);
    await db.collection<ToolConfig>('tools').insertMany(defaults);
    return res.status(200).json({ success: true, tools: defaults });
  }

  if (req.method === 'PUT') {
    const { tools } = req.body as { tools?: Partial<ToolConfig>[] };
    if (!Array.isArray(tools) || tools.length === 0) {
      return res.status(400).json({ error: 'tools array is required' });
    }

    for (const tool of tools) {
      const validation = validateToolConfig(tool);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const now = new Date();
    const ops = tools.map(tool => ({
      updateOne: {
        filter: { agentId: tool.agentId, name: tool.name },
        update: { $set: { ...tool, updatedAt: now } },
        upsert: true,
      },
    }));

    await db.collection<ToolConfig>('tools').bulkWrite(ops, { ordered: true });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

