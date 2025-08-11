import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mountain Highway Marketplace API',
      version: '1.0.0',
      description: 'A comprehensive marketplace API for outdoor gear and equipment',
      contact: {
        name: 'Mountain Highway Development Team',
        email: 'api@mountainhighway.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.mountainhighway.com'
          : 'http://localhost:4000',
        description: process.env.NODE_ENV === 'production' 
          ? 'Production server'
          : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Unique identifier' },
            email: { type: 'string', format: 'email', description: 'User email address' },
            username: { type: 'string', description: 'Unique username' },
            fullName: { type: 'string', description: 'Full name' },
            bio: { type: 'string', nullable: true, description: 'User biography' },
            location: { type: 'string', nullable: true, description: 'User location' },
            profileImage: { type: 'string', nullable: true, description: 'Profile image URL' },
            role: { 
              type: 'string', 
              enum: ['user', 'admin', 'moderator'],
              description: 'User role'
            },
            isActive: { type: 'boolean', description: 'Account status' },
            isEmailVerified: { type: 'boolean', description: 'Email verification status' },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last login date' }
          },
          required: ['id', 'email', 'role', 'isActive', 'createdAt']
        },
        Listing: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Unique identifier' },
            sellerId: { type: 'string', format: 'uuid', description: 'Seller user ID' },
            title: { type: 'string', description: 'Listing title' },
            description: { type: 'string', description: 'Detailed description' },
            priceCents: { type: 'integer', minimum: 100, description: 'Price in cents' },
            photos: { type: 'string', description: 'JSON array of photo URLs' },
            video: { type: 'string', nullable: true, description: 'Video URL' },
            status: { 
              type: 'string', 
              enum: ['ACTIVE', 'SOLD', 'INACTIVE'],
              description: 'Listing status'
            },
            createdAt: { type: 'string', format: 'date-time', description: 'Creation date' },
            seller: { $ref: '#/components/schemas/User' }
          },
          required: ['id', 'sellerId', 'title', 'description', 'priceCents', 'status', 'createdAt']
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Unique identifier' },
            listingId: { type: 'string', format: 'uuid', description: 'Associated listing ID' },
            buyerId: { type: 'string', format: 'uuid', description: 'Buyer user ID' },
            amountCents: { type: 'integer', description: 'Order amount in cents' },
            paymentMethod: { 
              type: 'string', 
              enum: ['stripe', 'paypal'],
              description: 'Payment method used'
            },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'HELD', 'PAID', 'CANCELLED', 'REFUNDED'],
              description: 'Order status'
            },
            deliveryStatus: { 
              type: 'string', 
              enum: ['NOT_SHIPPED', 'SHIPPED', 'DELIVERED', 'CONFIRMED'],
              description: 'Delivery status'
            },
            createdAt: { type: 'string', format: 'date-time', description: 'Order creation date' },
            paidAt: { type: 'string', format: 'date-time', nullable: true, description: 'Payment date' },
            listing: { $ref: '#/components/schemas/Listing' },
            buyer: { $ref: '#/components/schemas/User' }
          },
          required: ['id', 'listingId', 'buyerId', 'amountCents', 'status', 'createdAt']
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error code' },
            message: { type: 'string', description: 'Error message' },
            details: { type: 'object', nullable: true, description: 'Additional error details' }
          },
          required: ['error', 'message']
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string', description: 'JWT authentication token' },
            message: { type: 'string', description: 'Success message' }
          },
          required: ['user', 'token', 'message']
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, description: 'Current page number' },
            limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Items per page' },
            total: { type: 'integer', minimum: 0, description: 'Total items' },
            pages: { type: 'integer', minimum: 0, description: 'Total pages' }
          },
          required: ['page', 'limit', 'total', 'pages']
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/middleware/*.ts'
  ]
};

// Generate swagger specification
const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * Setup Swagger documentation for Express app
 */
export const setupSwagger = (app: Express): void => {
  // Swagger UI endpoint
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info hgroup.main h2 { color: #2c5aa0; }
      .swagger-ui .info .description { font-size: 14px; }
    `,
    customSiteTitle: 'Mountain Highway API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));

  // Raw JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`📚 API Documentation available at: http://localhost:${process.env.PORT || 4000}/api-docs`);
};

export default swaggerSpec;
