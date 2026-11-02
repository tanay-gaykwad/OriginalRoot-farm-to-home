# OriginalRoot Phase 16: customer order control

## Included

- A customer may cancel an order request while it is still awaiting operator acceptance.
- Account-linked requests can be cancelled only from the owning customer session. Guest requests require both the order reference and checkout mobile number.
- Cancellation uses a write transaction and succeeds only if the order remains in `requested` state. If an operator has already accepted it, the customer is directed to contact the local operator.
- The order status timeline records the cancellation, and the cancelled quantity becomes available to other customers.
- Both the private customer account history and guest tracking view expose the cancellation action only while eligible.
- Customers can refresh account order history, and operators can refresh the shared order queue to reconcile customer cancellations.

## Boundary

This is cancellation of an unaccepted request, before any payment is taken. It does not implement refunds, customer cancellation after acceptance, or a general marketplace return policy. The operator must handle later changes with the customer and record the outcome through the existing support workflow.

## Next phase

Phase 17 adds profile updates and a private account-data download. Verified recovery, an agreed retention/deletion policy, and a rehearsed first-run operator setup remain before expanding the rollout.
