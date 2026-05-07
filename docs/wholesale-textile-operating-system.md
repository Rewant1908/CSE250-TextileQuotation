# AI Wholesale Textile Operating System

This project now treats KT Impex as a wholesale textile operating system, not only a quotation tool.

## Phase 1 Foundation

The critical business entities are modeled as relational data:

- `suppliers`: factory and procurement behavior
- `bales`: parent Gathri/Bale purchase units
- `thans`: sellable fabric rolls broken out from bales
- `retailers`: persistent retailer memory and payment behavior
- `transactions`: sales facts for analytics
- `inventory_movements`: stock ledger for stock in, stock out, transfer, return, adjustment, and damage

Existing quotation tables remain intact:

- `users`
- `customers`
- `products`
- `quotations`
- `quotation_items`

## Operating Metrics

The first intelligence layer calculates:

- total bales and Thans
- available meters
- stock cost value
- expected retail value
- unrealized margin
- dead stock value
- category sell-through
- retailer revenue and payment risk
- supplier margin and movement signals

## API Surface

- `GET /api/operations/dashboard?user_id=:id`
  - Admin-only operating dashboard data.
- `GET /api/inventory/search?q=:query&max_price=:price`
  - Inventory search foundation for future WhatsApp and AI-assisted product discovery.

## Frontend Surface

Admins now get an `Operations` tab with:

- stock and margin summary cards
- category movement
- supplier signals
- dead stock watchlist
- retailer memory
- Than inventory search

Seed logins for a fresh database:

- Admin: `admin` / `admin123`
- Dealer: `dealer` / `user123`

## Next Build Stages

1. Add forms for bale intake, Than breakdown, and warehouse movement posting.
2. Link accepted quotations to `transactions` and decrement Than stock automatically.
3. Add photo upload/cataloging for Thans.
4. Add retailer recommendation logic from category affinity and price segment.
5. Add WhatsApp integration after inventory and transaction data are reliable.
6. Add AI agents only after the operating database is consistently populated.
