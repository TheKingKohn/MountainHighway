# Mountain Highway API - Postman Testing Guide

## Base URL
```
http://localhost:4000
```

## Authentication
Most endpoints require JWT authentication. Include in headers:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API Endpoints

### 1. Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 2. Listings CRUD

#### Create Listing (Auth Required)
```http
POST /listings
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Professional Camera Equipment",
  "description": "High-end DSLR camera with multiple lenses",
  "priceCents": 125000,
  "photos": [
    "https://example.com/camera1.jpg",
    "https://example.com/camera2.jpg"
  ]
}
```

#### Get All Listings
```http
GET /listings
```

#### Get All Listings with Filters
```http
GET /listings?search=camera&minPrice=50000&maxPrice=200000&limit=10&offset=0
```

#### Get Specific Listing
```http
GET /listings/{listingId}
```

#### Update Listing (Seller Only)
```http
PATCH /listings/{listingId}
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "description": "Updated description with more details",
  "priceCents": 120000
}
```

#### Delete Listing (Seller Only)
```http
DELETE /listings/{listingId}
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Get My Listings (Auth Required)
```http
GET /listings/user/me
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. Stripe Connect

#### Create Stripe Connect Account
```http
POST /stripe/create-account
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "seller@example.com",
  "business_type": "individual",
  "country": "US"
}
```

#### Create Account Link
```http
POST /stripe/account-link
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "account_id": "acct_1234567890",
  "return_url": "http://localhost:3000/success",
  "refresh_url": "http://localhost:3000/refresh"
}
```

### 4. Payments

#### Get Payment Methods
```http
GET /payments/methods
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Create Payment (Stripe)
```http
POST /payments/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "listingId": "listing_id_here",
  "amount": 1250.00,
  "currency": "usd",
  "paymentMethod": "stripe"
}
```

#### Create Payment (PayPal)
```http
POST /payments/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "listingId": "listing_id_here",
  "amount": 850.00,
  "currency": "USD",
  "paymentMethod": "paypal"
}
```

#### Test Payment Integration
```http
GET /payments/test
Authorization: Bearer YOUR_JWT_TOKEN
```

### 5. Health Check
```http
GET /health
```

## Example Test Flow

1. **Register/Login** as seller
2. **Create Stripe Connect Account** for seller
3. **Create a listing** with the seller account
4. **Register/Login** as buyer
5. **Browse listings** without auth
6. **View specific listing** details
7. **Create payment** for the listing
8. **Test search and filtering**

## Price Format
- All prices stored as **integer cents** (e.g., $12.50 = 1250)
- API accepts dollars in payment creation, converts to cents for storage
- Responses show cents, convert to dollars for display

## Mock Mode
- System runs in mock mode with dummy API keys
- No real Stripe/PayPal API calls made
- Perfect for testing and development

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not authorized for this resource)
- `404` - Not Found
- `500` - Internal Server Error

## Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": [] // For validation errors
}
```

## Success Response Format
```json
{
  "success": true,
  "listing": {...}, // or other data
  "pagination": {...} // for list endpoints
}
```
