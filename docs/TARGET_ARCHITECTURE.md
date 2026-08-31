# Platzhirsch target architecture

## Product goal

Platzhirsch should use one restaurant/menu/order core for two customer entry modes:

1. **Dine-in** — guests scan a QR code at a physical table.
2. **Online ordering** — guests open the restaurant publicly from outside the venue.

The two modes share restaurant, menu, product and order data, but have different access rules.

## Core domains

### Restaurant & menu

- Restaurant profile
- Menu/categories/items
- Availability and pricing
- Tables / dine-in locations

### Dine-in

- QR codes contain a signed, non-guessable token.
- A table number or table ID alone is never sufficient authorization.
- Dine-in ordering requires a valid venue-presence session in addition to the QR token.
- Venue presence is intended to be established through the restaurant guest Wi-Fi / captive portal or another server-verifiable on-site mechanism.
- Venue sessions are time-limited.
- A photographed QR code must not be enough to place a dine-in order from outside the venue.

### Online ordering

- Publicly reachable without venue-presence validation.
- No table association.
- Designed for later pickup/delivery/time-slot/payment features.
- Uses the same menu and order core as dine-in.

### Restaurant administration

- Authenticated restaurant users manage restaurant data, menu, tables and orders.
- Kitchen-specific UI/auth remains optional until its product value is confirmed.

## Access model

A future dine-in request should conceptually require:

```text
signed QR token
    +
valid venue-presence session
    +
active restaurant/table
    =
allowed dine-in session
```

Network/IP checks may be used as an additional signal, but not as the sole security boundary. The application must remain deployable behind Docker, reverse proxies and IPv4/IPv6 networks.

## Environment strategy

- `.env.test` is committed and contains test/dummy values only.
- Real `.env` files are never committed.
- Production configuration is supplied by the host at container runtime.
- `DINEIN_QR_SECRET` is unique per production environment and never reused from test.

Current expected variables:

```text
MONGODB_URI
NEXTAUTH_URL
NEXTAUTH_SECRET
DINEIN_QR_SECRET
DINEIN_ACCESS_MODE
```

Legacy/optional AI variables currently present in the codebase:

```text
AI_GROQ_KEY
AI_CEREBRAS_KEY
AI_GOOGLE_KEY
AI_SILICONFLOW_KEY
```

These can be removed when the AI module is removed or isolated.

## Deployment target

- Docker
- Node.js 22
- Next.js standalone output
- Runtime environment supplied by the server, for example via Docker `--env-file` / Compose `env_file`.
- No production secrets baked into the image.

## Refactoring principle

Keep the shared restaurant/menu/order foundation. Remove or isolate functionality that is inherited from OrderWorder but not part of the Platzhirsch product scope, especially demo-only tooling and generic development-agent assets.
