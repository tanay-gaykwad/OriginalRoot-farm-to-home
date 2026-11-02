# OriginalRoot Phase 18: grower dashboard and mandi prices

## Grower workspace

- Signed-in growers get a focused dashboard with counts derived from their own saved offers, navigation to overview, market prices, sell harvest, and offer history.
- Offer totals, published offers, pending review, and crop types come from the grower's authenticated listing response. The UI does not estimate income or combine incompatible units.
- Listing, review, and offer-history workflows continue to use the existing grower account and operator review API.
- Growers can review anonymous household interest pooled by crop and community. It is an early demand-planning signal only; it is not a preorder, group-buy commitment, or a forecast.

## Daily wholesale references

- The workspace can fetch daily minimum, modal, and maximum mandi prices from the Government of India's data.gov.in / AGMARKNET dataset.
- State and commodity filters are sent to a same-origin backend route. The data.gov.in key is read only from `OriginalRoot_DATA_GOV_IN_API_KEY`; it is never sent to the browser or returned by the API.
- A missing key, upstream outage, empty result, and successful response have separate UI states. There are no hard-coded sample rows, predictions, or trend claims.
- Values and arrival dates are displayed as published by the source. Grower payout and farm-gate rates may differ by grade, lot size, transport, and timing.

## Household demand pooling

- Households can optionally share what they might buy through a short anonymous signal in the marketplace.
- Growers see only aggregate quantities by produce and community; no name, phone number, or household identity is collected for this signal.
- Signals are not orders or promised purchases. The interface explicitly warns against treating them as guaranteed demand or manufacturing scarcity.

## Setup

1. Create an API key through the official [data.gov.in account/API setup](https://www.data.gov.in/help).
2. Add `OriginalRoot_DATA_GOV_IN_API_KEY=your-key` to the local `.env` file. Do not commit `.env` or paste the key into frontend settings.
3. Recreate the service with `docker compose up -d --force-recreate`.
4. Open the grower workspace and choose **Market prices**.

Without a key, the rest of the platform continues to work; the price page explains the missing setup.

## Source

- [Current Daily Price of Various Commodities from Various Markets (Mandi)](https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi)
- [Official data.gov.in API help](https://www.data.gov.in/help)
