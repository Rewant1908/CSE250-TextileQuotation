# REST API Documentation — KT Impex Textile Quotation System

## Base URL
```
http://localhost:5000
```

## Data Transfer Objects (DTOs)

### POST /api/signup
**Request**
```json
{ "username": "rewant", "password": "secret123", "email": "rewant@ktimpex.com" }
```
**Response 201**
```json
{ "success": true, "user_id": 3 }
```

### POST /api/login
**Request**
```json
{ "username": "admin", "password": "ktimpex" }
```
**Response 200**
```json
{ "success": true, "user_id": 1, "username": "admin", "role": "admin" }
```

### GET /api/products
**Response 200**
```json
[
  { "product_id": 1, "product_name": "Cotton Shirting", "category": "Shirting", "base_price": "250.00" }
]
```

### POST /api/products
**Request** *(admin only — requires MANAGE_PRODUCTS)*
```json
{ "product_name": "Denim Fabric", "category": "Denim", "base_price": 499.99, "user_id": 1 }
```
**Response 201**
```json
{ "success": true, "product_id": 5 }
```

### PUT /api/products/:id
**Request** *(admin only — requires MANAGE_PRODUCTS)*
```json
{ "product_name": "Denim Fabric Updated", "category": "Denim", "base_price": 549.99, "user_id": 1 }
```
**Response 200**
```json
{ "success": true }
```

### DELETE /api/products/:id
**Request** *(admin only — requires MANAGE_PRODUCTS)*
Query: `?user_id=1`
**Response 200**
```json
{ "success": true }
```

### POST /api/enquiry
**Request** *(requires REGISTER_CUSTOMER)*
```json
{ "customer_name": "Pragati Textiles", "contact_phone": "9978852265", "email": "pragati@mail.com", "user_id": 2 }
```
**Response 201**
```json
{ "success": true, "customer_id": 5 }
```

### POST /api/create-quotation
**Request** *(requires CREATE_QUOTATION)*
```json
{
  "customer_id": 5,
  "user_id": 2,
  "items": [
    { "product_id": 1, "quantity": 20 },
    { "product_id": 3, "quantity": 10 }
  ]
}
```
**Response 201**
```json
{ "success": true, "quotation_id": 9 }
```

### GET /api/quotations
**Query params**
- `role=admin&user_id=1` → all quotations
- `role=user&user_id=2`  → own quotations only

**Response 200**
```json
[
  {
    "quotation_id": 9,
    "customer_name": "Pragati Textiles",
    "contact_phone": "9978852265",
    "total_amount": "16560.00",
    "grand_total": "19540.80",
    "status": "pending",
    "created_at": "2026-03-30T00:00:00.000Z",
    "username": "rewant"
  }
]
```

### GET /api/quotations/:id
**Response 200**
```json
{
  "quotation_id": 9,
  "customer_name": "Pragati Textiles",
  "status": "pending",
  "total_amount": "16560.00",
  "gst_18": "2980.80",
  "grand_total": "19540.80",
  "items": [
    { "product_name": "Cotton Shirting", "quantity": 20, "unit_price_at_time": "250.00", "line_total": "5000.00" }
  ]
}
```

### PATCH /api/quotations/:id/status
**Request** *(admin only — requires MANAGE_QUOTATION_STATUS)*
```json
{ "status": "declined", "decline_reason": "Stock unavailable", "user_id": 1 }
```
**Response 200**
```json
{ "success": true }
```
