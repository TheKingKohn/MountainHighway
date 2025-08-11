import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';

const prisma = new PrismaClient();
const router = Router();

// Validation schema for message creation
const createMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(1000, 'Message too long')
});

// POST /orders/:orderId/messages - Send a message (auth, must be buyer or seller)
router.post('/:orderId/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate request body
    const validation = createMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const { body } = validation.data;

    // Find the order and verify user is buyer or seller
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { sellerId: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is buyer or seller
    const isBuyer = order.buyerId === userId;
    const isSeller = order.listing.sellerId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Only buyer and seller can send messages for this order'
      });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        orderId,
        senderId: userId,
        body
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: {
        id: message.id,
        orderId: message.orderId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        sender: message.sender
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// GET /orders/:orderId/messages - Get messages for an order (auth, must be buyer or seller)
router.get('/:orderId/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Find the order and verify user is buyer or seller
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { sellerId: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is buyer or seller
    const isBuyer = order.buyerId === userId;
    const isSeller = order.listing.sellerId === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Only buyer and seller can view messages for this order'
      });
    }

    // Get messages, newest first
    const messages = await prisma.message.findMany({
      where: { orderId },
      include: {
        sender: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      messages: messages.map(message => ({
        id: message.id,
        orderId: message.orderId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        sender: message.sender
      }))
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

export default router;
