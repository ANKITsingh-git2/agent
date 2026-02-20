import { ToolConfig } from '@/types';

export function createDefaultToolConfigs(agentId: string): ToolConfig[] {
  const now = new Date();

  return [
    {
      agentId,
      name: 'order_lookup',
      enabled: true,
      description: 'Look up order status and location by order ID',
      parameters: [
        {
          name: 'orderId',
          type: 'string',
          required: true,
          description: 'Order number to lookup (e.g., 1234)',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      agentId,
      name: 'create_ticket',
      enabled: true,
      description: 'Create a customer support ticket',
      parameters: [
        {
          name: 'category',
          type: 'string',
          required: true,
          description: 'Ticket category (e.g., refund, account, product)',
        },
        {
          name: 'description',
          type: 'string',
          required: true,
          description: 'Issue description (min 10 characters)',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

