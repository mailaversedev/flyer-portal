# KPay Online integration

The Express backend implements KPay's fully managed checkout flow:

1. An authenticated company user creates a payment order.
2. The backend signs and sends the order to KPay.
3. The client redirects to the returned KPay checkout URL.
4. KPay sends a signed payment result to the public webhook.
5. The backend verifies the exact request body, checks the order and amount, then credits the company's HKD wallet exactly once.

## Deployment configuration

Set the variables shown in [.env.example](../.env.example) in the web server's environment. Do not commit either PEM key or KPay test card data.

- `KPAY_MERCHANT_CODE`, `KPAY_PRIVATE_KEY`, and `KPAY_PLATFORM_PUBLIC_KEY` come from KPay's Online Integration email.
- `KPAY_APP_ID` is required only for KPay service-provider mode. Leave it blank for merchant mode.
- UAT defaults to `https://payment.uat.kpay-group.com`; set `KPAY_API_BASE_URL=https://payment.kpay-group.com` only for the KPay production environment.
- `KPAY_NOTIFY_URL` must be the externally reachable HTTPS URL `https://<api-host>/api/payment/kpay/notify`, with no query string. Give KPay the web server's outbound IP for their UAT/production allow list.
- `KPAY_RETURN_URL` is where KPay returns the payer after checkout. For WeChat H5 testing, KPay requires its domain to match the order URL domain; use the domain KPay directs for that test case.

The production process must preserve the default system clock accuracy because KPay rejects stale signed requests. The webhook accepts signed requests only within five minutes of their timestamp.

## API

All authenticated endpoints require the application's Bearer token and a token containing a `companyId`.

### Create a checkout order

`POST /api/payment/kpay/orders`

Request body:

```json
{
  "amount": 100.0,
  "idempotencyKey": "a-unique-key-per-payment-attempt",
  "description": "Optional receipt description",
  "language": "zh-HK"
}
```

`amount` is HKD and must have no more than two decimal places. Re-use the same `idempotencyKey` after a client retry; while the order is pending the endpoint returns the same KPay order with a freshly signed checkout URL.

Successful response:

```json
{
  "success": true,
  "data": {
    "paymentId": "<opaque-payment-id>",
    "status": "PENDING",
    "managedOrderNo": "<kpay-managed-order-number>",
    "checkoutUrl": "https://payment.uat.kpay-group.com/v1/web/managed/order?..."
  }
}
```

Redirect the browser to `checkoutUrl`. The URL contains a short-lived KPay signature and must not be modified.

### Read locally processed payment status

`GET /api/payment/kpay/orders/:paymentId`

The response status is `CREATING`, `PENDING`, `PAID`, `FAILED`, or `CREATION_FAILED`. `PAID` means the signed KPay webhook passed validation and the wallet credit transaction was committed.

### KPay webhook

`POST /api/payment/kpay/notify`

This endpoint is public by design, but it verifies KPay's `K-Signature`, merchant code, app ID, timestamp, managed order number, currency, and amount before accepting a payment. Do not place authentication middleware, a redirect, or a body-rewriting proxy in front of it. It returns an empty HTTP `200` only after processing a valid callback.

The webhook is idempotent: duplicate KPay callbacks do not create more than one HKD wallet credit. Failed or unavailable callbacks are retried by KPay; monitor `PENDING` records and reconcile any that remain pending using KPay's managed-order result API as required by KPay's certification checklist.

## UAT checklist

1. Configure UAT credentials and public URLs, deploy, and provide the outbound IP to KPay for allow listing.
2. Create an order with the API and open the returned checkout URL in the KPay sandbox flow.
3. Complete a KPay-provided test case.
4. Confirm the webhook reaches the service and that `GET /api/payment/kpay/orders/:paymentId` returns `PAID`.
5. Confirm the company wallet's HKD credit increased by exactly the paid amount and its transaction metadata has `source: "kpay_online"`.