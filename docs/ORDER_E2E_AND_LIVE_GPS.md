# SHAKH — End-to-end order flow and live captain GPS

## Database integration test

On 2026-11-18 the database order flow was exercised in one transaction and rolled back. It used a temporary merchant/product/zone and temporarily changed one existing customer profile into a merchant and then a SHAKH captain. No test accounts, orders, products, zones, wallet entries, or profile changes were retained.

Passed checks:
- Merchant checkout and retry idempotency.
- SHAKH Store checkout.
- Stock reservation for both catalog types.
- Merchant acceptance, preparation, and ready-for-pickup.
- Super-admin captain assignment.
- Captain pickup and delivered transitions.
- Settlement: 800 IQD captain wallet credit and 200 IQD platform delivery share for a 1,000 IQD test delivery fee.
- Duplicate settlement rejection.
- Cancellation restores reserved inventory.

This is a database/RPC integration test, not a browser-authenticated end-to-end test. The live project currently has one customer profile, one super-admin profile, no approved merchant profile, and no active captain profile. A real customer/merchant/captain browser test still requires those actual user accounts and merchant/captain approval.

## Live location design

- Captain GPS is opt-in and starts only after the captain presses “Start sharing location” on an assigned or picked-up delivery.
- Browser location permission is required; the page sends one latest location at most every 20 seconds.
- The captain can stop sharing manually. Leaving the deliveries page also attempts to clear the live point.
- Delivered, rejected, or cancelled orders have their live location row deleted by the database.
- The latest point is readable only by the order customer, assigned captain, owning merchant, and super-admin.
- The map is an OpenStreetMap embed with attribution. This pilot implementation shows the captain marker; it does not provide background tracking, customer delivery pins, or turn-by-turn routing.
- Browser geolocation may pause when the app is backgrounded or the device locks. Keep the deliveries page open during the trip.
- OpenStreetMap standard tiles are a best-effort community service without an SLA. Before high-volume commercial launch, choose a hosted tile provider or self-hosted map service and configure its approved tile URL and terms.
