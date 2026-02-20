import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/mongodb';
import { FAQ } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const db = await getDatabase();

  if (req.method === 'POST') {
    // Create FAQ
    try {
      const { agentId, question, answer } = req.body;

      if (!agentId || !question || !answer) {
        return res.status(400).json({ 
          error: 'agentId, question, and answer are required' 
        });
      }

      const faq: FAQ = {
        agentId,
        question,
        answer,
        createdAt: new Date(),
      };

      const result = await db.collection<FAQ>('faqs').insertOne(faq);

      res.status(201).json({ 
        success: true, 
        faq: { ...faq, _id: result.insertedId } 
      });
    } catch (error: any) {
      console.error('Create FAQ error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  else if (req.method === 'GET') {
    // Get FAQs for agent
    try {
      const { agentId } = req.query;

      if (!agentId) {
        return res.status(400).json({ error: 'agentId is required' });
      }

      const faqs = await db
        .collection<FAQ>('faqs')
        .find({ agentId: agentId as string })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({ success: true, faqs });
    } catch (error: any) {
      console.error('Get FAQs error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  else if (req.method === 'DELETE') {
    // Delete FAQ
    try {
      const { faqId } = req.body;

      if (!faqId) {
        return res.status(400).json({ error: 'faqId is required' });
      }

      const { ObjectId } = require('mongodb');
      const result = await db
        .collection<FAQ>('faqs')
        .deleteOne({ _id: new ObjectId(faqId) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'FAQ not found' });
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Delete FAQ error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
