# Mountain Highway API - Complete Endpoint Reference

## Base URL: `http://localhost:4000`

---

## 🔐 Authentication Endpoints

### Register User
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: { "success": true, "token": "jwt_token", "user": {...} }
```

### Login User
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "password123"
}

Response: { "success": true, "token": "jwt_token", "user": {...} }
```

---

## 📋 Listings CRUD Endpoints

### Create Listing (Auth Required)
```
POST /listings
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "title": "Professional Camera Equipment",
  "description": "High-end DSLR camera with multiple lenses and accessories",
  "priceCents": 125000,
  "photos": ["camera1.jpg", "camera2.jpg", "camera3.jpg"]
}

Response: { "success": true, "listing": {...} }
```

### Get All Active Listings
```
GET /listings
Optional Query Parameters:
- search=keyword (searches title/description)
- minPrice=50000 (minimum price in cents)
- maxPrice=200000 (maximum price in cents)  
- limit=20 (max results, default 20, max 100)
- offset=0 (pagination offset, default 0)

Example: GET /listings?search=camera&minPrice=50000&maxPrice=200000&limit=10

Response: { 
  "success": true, 
  "listings": [...],
  "pagination": { "total": 45, "limit": 10, "offset": 0, "hasMore": true }
}
```

### Get Specific Listing
```
GET /listings/{listingId}

Response: { 
  "success": true, 
  "listing": {
    "id": "...",
    "title": "...",
    "description": "...", 
    "priceCents": 125000,
    "photos": [...],
    "status": "ACTIVE",
    "seller": { "id": "...", "email": "..." },
    "isPurchased": false
  }
}
```

### Update Listing (Seller Only)
```
PATCH /listings/{listingId}
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "description": "Updated description with more details",
  "priceCents": 120000,
  "status": "INACTIVE"
}

Response: { "success": true, "listing": {...} }
```

### Delete Listing (Seller Only, Not Sold)
```
DELETE /listings/{listingId}
Authorization: Bearer JWT_TOKEN

Response: { "success": true, "message": "Listing deleted successfully" }
```

### Get My Listings (Auth Required)
```
GET /listings/user/me
Authorization: Bearer JWT_TOKEN

Response: { 
  "success": true, 
  "listings": [
    {
      "id": "...",
      "title": "...",
      "priceCents": 125000,
      "status": "ACTIVE",
      "salesCount": 2,
      "totalRevenue": 250000,
      "photos": [...]
    }
  ]
}
```

---

## 🔗 Stripe Connect Endpoints

### Create Stripe Connect Account
```
POST /stripe/create-account
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "email": "seller@example.com",
  "business_type": "individual",
  "country": "US"
}

Response: { "success": true, "accountId": "acct_...", "message": "..." }
```

### Create Account Onboarding Link
```
POST /stripe/account-link
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "account_id": "acct_1234567890",
  "return_url": "http://localhost:3000/success",
  "refresh_url": "http://localhost:3000/refresh"
}

Response: { "success": true, "url": "https://..." }
```

### Get Account Status
```
GET /stripe/account/{accountId}
Authorization: Bearer JWT_TOKEN

Response: { 
  "success": true, 
  "account": {
    "id": "acct_...",
    "charges_enabled": true,
    "payouts_enabled": true,
    "requirements": {...}
  }
}
```

---

## 💳 Payment Endpoints

### Get Available Payment Methods
```
GET /payments/methods
Authorization: Bearer JWT_TOKEN

Response: { 
  "success": true, 
  "methods": {
    "stripe": "Available",
    "paypal": "Available"
  }
}
```

### Create Payment Intent
```
POST /payments/create
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "listingId": "listing_id_here",
  "amount": 1250.00,
  "currency": "usd",
  "paymentMethod": "stripe"
}

Response: { 
  "success": true, 
  "paymentIntent": {
    "id": "pi_...",
    "client_secret": "pi_..._secret_...",
    "amount": 125000,
    "currency": "usd"
  },
  "order": { "id": "order_id", "status": "PENDING" }
}
```

### Test Payment Integration
```
GET /payments/test
Authorization: Bearer JWT_TOKEN

Response: { 
  "success": true, 
  "tests": {
    "stripe": { "id": "pi_mock_...", "status": "requires_payment_method" },
    "paypal": { "id": "PAYPAL_ORDER_...", "status": "CREATED" }
  }
}
```

---

## 🔍 System Endpoints

### Health Check
```
GET /health

Response: { "ok": true }
```

### Database Test
```
GET /db-test

Response: { 
  "database": "connected", 
  "userCount": 5, 
  "listingCount": 12 
}
```

---

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "listing": {...},        // or other data
  "pagination": {...}      // for list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [...]         // for validation errors
}
```

---

## 🏷️ Status Codes

- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not authorized for this resource)
- `404` - Not Found
- `409` - Conflict (duplicate email, etc.)
- `500` - Internal Server Error

---

## 💰 Price Format

**All prices stored as integer cents:**
- `$12.50` = `1250` cents
- `$1,250.00` = `125000` cents
- API accepts dollars in payment creation
- Database stores everything in cents
- Frontend should convert for display

---

## 🧪 Mock Mode

The system runs in **mock mode** by default:
- ✅ No real Stripe API calls
- ✅ No real PayPal API calls  
- ✅ Perfect for development/testing
- ✅ Realistic mock responses
- ✅ All functionality testable

---

## 🚀 Getting Started

1. **Start the server:** `cd packages/api && npm run dev`
2. **Register a user:** `POST /auth/register`
3. **Create a listing:** `POST /listings` (with auth token)
4. **Browse listings:** `GET /listings`
5. **Test payments:** `POST /payments/create`

The API is fully functional and ready for Postman testing!
