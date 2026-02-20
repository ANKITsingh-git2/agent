import { ToolExecution } from '@/types';

export class ToolExecutor {
  /**
   * Execute order_lookup tool
   * Simulates 20% random failure rate
   */
  async executeOrderLookup(orderId: string): Promise<ToolExecution> {
    const startTime = Date.now();
    
    // Simulate API call delay
    await this.delay(100, 300);

    // 20% failure rate
    if (Math.random() < 0.2) {
      return {
        toolName: 'order_lookup',
        arguments: { orderId },
        success: false,
        error: 'Order lookup service temporarily unavailable',
        latency: Date.now() - startTime,
      };
    }

    // Mock successful response
    const mockOrders: Record<string, any> = {
      '1234': {
        orderId: '1234',
        status: 'In Transit',
        location: 'Mumbai Distribution Center',
        estimatedDelivery: '2026-02-18',
      },
      '5678': {
        orderId: '5678',
        status: 'Delivered',
        location: 'Delivered to Customer',
        deliveryDate: '2026-02-10',
      },
    };

    const orderData = mockOrders[orderId] || {
      orderId,
      status: 'Not Found',
      message: 'Order not found in system',
    };

    return {
      toolName: 'order_lookup',
      arguments: { orderId },
      success: true,
      result: orderData,
      latency: Date.now() - startTime,
    };
  }

  /**
   * Execute create_ticket tool
   * Fails if description is too short (< 10 characters)
   */
  async executeCreateTicket(
    category: string,
    description: string
  ): Promise<ToolExecution> {
    const startTime = Date.now();
    
    // Simulate API call delay
    await this.delay(150, 400);

    // Validation: description must be at least 10 characters
    if (description.length < 10) {
      return {
        toolName: 'create_ticket',
        arguments: { category, description },
        success: false,
        error: 'Description too short. Minimum 10 characters required.',
        latency: Date.now() - startTime,
      };
    }

    // Mock successful ticket creation
    const ticketId = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    return {
      toolName: 'create_ticket',
      arguments: { category, description },
      success: true,
      result: {
        ticketId,
        category,
        description,
        status: 'Open',
        createdAt: new Date().toISOString(),
        message: 'Ticket created successfully',
      },
      latency: Date.now() - startTime,
    };
  }

  /**
   * Route and execute tool based on name
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolExecution> {
    switch (toolName) {
      case 'order_lookup':
        return await this.executeOrderLookup(args.orderId);
      
      case 'create_ticket':
        return await this.executeCreateTicket(args.category, args.description);
      
      default:
        return {
          toolName,
          arguments: args,
          success: false,
          error: `Unknown tool: ${toolName}`,
          latency: 0,
        };
    }
  }

  /**
   * Simulate network delay
   */
  private delay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const toolExecutor = new ToolExecutor();
