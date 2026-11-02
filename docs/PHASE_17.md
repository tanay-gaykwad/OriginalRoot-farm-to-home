# OriginalRoot Phase 17: customer profile and data access

## Included

- Signed-in customers can update their display name and mobile number. Profile changes apply to future order snapshots; existing orders keep the contact details recorded when placed.
- The customer account page can download a JSON export containing the account profile, account-linked order details (including delivery address), order status history, and customer support records associated with those orders.
- The export route is session-protected and uses the API's `Cache-Control: no-store` response header. Password hashes, session tokens, and guest orders are never included.
- Mobile numbers remain explicitly marked as unverified; changing a number does not imply phone ownership verification.

## Boundary

This adds access and correction for profile data, not account deletion or a claim of legal compliance. Guest orders are not attached to an account based on a matching phone number. Account recovery, verified contact channels, and an operator-managed data-retention workflow remain future work.

## Next phase

Implement a documented operator setup and recovery procedure, then agree a retention/deletion policy for order and support records before adding customer account deletion. Add verified account recovery only after selecting and configuring an actual provider.
