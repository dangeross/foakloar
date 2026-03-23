# Tutorial 10 — Payment Events (Lightning Gates)

Payment events gate progression behind a Lightning Network payment. The player pays a LNURL invoice; on confirmation, the client fires `on-complete` actions — typically giving a receipt item that satisfies a `requires` condition on a portal or feature.

> **Try it:** Import [tides-end-10-payments.json](tutorials/tides-end-10-payments.json) to explore these concepts in a working world.


---

## What Payment Events Do

A `type: payment` event defines a Lightning-gated checkpoint. It specifies an amount, a currency unit, and a LNURL endpoint. When the player triggers the payment (usually through a dialogue option), the client generates a Lightning invoice, displays it, and polls for confirmation. Once paid, `on-complete` actions fire — giving items, setting state, or both.

This is real money, real cryptography. There is no simulation — the LNURL endpoint generates actual invoices and the LUD-11 verify endpoint confirms actual payment.

```json
["type",        "payment"],
["amount",      "100"],
["unit",        "sats"],
["lnurl",       "lnurl1dp68gurn8..."],
["on-complete", "", "give-item", "30078:<pubkey>:world:item:receipt"],
["on-complete", "", "set-state", "paid"]
```

---

## Payment Flow

The client handles the full invoice lifecycle:

1. **Fetch metadata** — The client decodes the LNURL and fetches the LNURL-pay metadata from the endpoint (LUD-06).
2. **Generate invoice** — The client requests an invoice for the specified amount. The LNURL server returns a Lightning invoice (bolt11) and a verify URL.
3. **Store payment hash** — Before the player pays, the client stores the `payment-hash` locally against the payment event's `d`-tag. This is the recovery key.
4. **Display invoice** — The client shows a QR code or copyable invoice string to the player.
5. **Poll for confirmation** — The client polls the LUD-11 verify endpoint until the payment is confirmed or the invoice expires.
6. **Fire on-complete** — On confirmation, all `on-complete` tags on the payment event are dispatched. Items are given, states are set.

```
Player types "talk to keeper"
  → NPC dialogue presents payment option
    → Player selects "Pay the toll"
      → Client fetches LNURL-pay metadata
        → Client generates invoice, stores payment-hash
          → Player pays via Lightning wallet
            → Client polls LUD-11 verify endpoint
              → Confirmed → on-complete fires → receipt item given
```

---

## Receipt Items

The standard pattern for payment gates uses a receipt item — a token given on payment that satisfies a `requires` condition elsewhere:

**Payment event gives the item:**
```json
["on-complete", "", "give-item", "30078:<PUBKEY>:world:item:entry-token"]
```

**Portal requires the item:**
```json
["requires", "30078:<PUBKEY>:world:item:entry-token", "", "You need to pay the toll first."]
```

The receipt item is a normal `type: item` event. It has no special properties — it is simply an inventory entry that proves payment. The player can examine it, and `requires` checks will find it. The pattern is identical to any other item-gated progression.

---

## Design Patterns

Payments work best when they're woven into the story, not bolted on as a paywall.

### The Bribe (short route vs long route)

A guarded door requires an access card to pass. There are two ways to get the card:

- **Long route (free):** Complete a quest — find the harbourmaster's key in the old office, return it to the guard, receive the access card.
- **Short route (paid):** Bribe the guard — pay 100 sats, receive the same access card immediately.

One portal, one `requires` (the access card item), two paths to earn it. The guard NPC's dialogue offers both options: *"I could let you through... for a price. Or you could find the harbourmaster's key — he left it somewhere in the old office."*

The payment's `on-complete` gives the access card. The quest's `on-complete` also gives the access card. Same item, different routes. The portal doesn't care how the player got it.

### The Tip Jar

A non-essential payment that rewards the player with bonus content. A musician NPC plays in the tavern. Tip them (payment) and they give you a clue, a unique item, or reveal a hidden exit. The world is fully completable without paying — the payment adds flavour.

### The Toll Gate

The simplest pattern — pay to enter an area. Works for premium content zones, exclusive quest lines, or author-funded worlds. The tutorial world demonstrates this pattern.

### Monetising without blocking

The best payment integrations feel optional. Players who pay get convenience, exclusivity, or bonus content — never the only path forward. A world that *requires* payment to complete will feel hostile. A world that *rewards* payment feels generous.

---

## Builder Walkthrough

To add a payment gate to your world:

### 1. Create the receipt item

A simple item with a noun tag. No state, no interactions — it exists only as proof of payment.

```json
{
  "kind": 30078,
  "tags": [
    ["d", "my-world:item:entry-token"],
    ["t", "my-world"],
    ["type", "item"],
    ["title", "Entry Token"],
    ["noun", "token", "entry token"]
  ],
  "content": "A brass disc stamped with an anchor. Proof of payment."
}
```

### 2. Create the payment event

Specify the amount, unit, LNURL endpoint, and `on-complete` actions. The `lnurl` value can be a bech32-encoded LNURL or a Lightning Address (e.g. `user@provider.com`).

```json
{
  "kind": 30078,
  "tags": [
    ["d", "my-world:payment:entry-fee"],
    ["t", "my-world"],
    ["type", "payment"],
    ["title", "Entry Fee"],
    ["amount", "100"],
    ["unit", "sats"],
    ["lnurl", "your-lightning-address@provider.com"],
    ["on-complete", "", "give-item", "30078:<PUBKEY>:my-world:item:entry-token"],
    ["on-complete", "", "set-state", "paid"]
  ],
  "content": "A toll of 100 sats for passage."
}
```

### 3. Create a dialogue that offers the payment

Payment events are triggered through dialogue options. A dialogue node's `option` tag can point to a payment event's `d`-tag. When the player selects that option, the client detects the target is a payment event and activates the invoice flow.

```json
{
  "kind": 30078,
  "tags": [
    ["d", "my-world:dialogue:toll-payment"],
    ["t", "my-world"],
    ["type", "dialogue"],
    ["text", "\"Hundred sats for passage. Lightning only.\""],
    ["option", "Pay the toll (100 sats)", "30078:<PUBKEY>:my-world:payment:entry-fee"],
    ["option", "Walk away", ""]
  ],
  "content": ""
}
```

### 4. Gate the portal with the receipt item

Add a `requires` tag on the portal that checks for the receipt item.

```json
["requires", "30078:<PUBKEY>:my-world:item:entry-token", "", "You need to pay the toll first."]
```

### 5. Wire up the trigger

Use a feature (toll booth, gate, NPC) with a verb that starts the dialogue. An NPC with a `dialogue` tag works naturally — the player says `talk to keeper` and the dialogue presents the payment option. A feature can also trigger the dialogue through `on-interact`.

---

## Infrastructure Requirements

Payment events require the world author to operate or use a LNURL server. The following LUD specifications must be supported:

| LUD | Name | Purpose |
|-----|------|---------|
| LUD-01 | LNURL base | Core encoding and request/response format |
| LUD-06 | `payRequest` | LNURL-pay flow — invoice generation |
| LUD-11 | `verify` | Payment status polling keyed on payment hash |

**Options for LNURL infrastructure:**

- **Lightning Address** — Services like Alby, Breez, or WoS provide Lightning Addresses that support LUD-06 pay requests. Some also support LUD-11 verification.
- **Self-hosted** — Run your own LNURL server (e.g. LNbits, BTCPay Server) for full control over invoice generation and verification.
- **Shared platform** — A foakloar-specific payment service could abstract LNURL infrastructure for world authors.

If the verify endpoint goes offline, the payment gate becomes unsolvable for new players. Existing players who have already completed the payment are unaffected (their `complete` status is stored locally). Authors should treat LNURL infrastructure as a long-term hosting commitment.

---

## Tips

### Recovery on reload

The client stores `payment-hash` values locally before the player pays. On reload, any payment with status `pending` or `paid` (but not `complete`) is re-verified by polling LUD-11 with the stored hash. If the endpoint confirms payment, `on-complete` fires. This handles browser crashes, network drops, and interrupted sessions — the payment hash is the persistent proof.

### Invoice expiry

LNURL-pay invoices typically expire after 60 seconds. If the player does not pay before expiry, the client offers to generate a fresh invoice. The old `payment-hash` is discarded and replaced with the new invoice's hash.

### Proof of payment

The player's Lightning wallet holds the preimage as cryptographic proof of payment. The payment hash (stored by the client) is sufficient for verify endpoint queries. If the player disputes a failed `on-complete`, the preimage from their wallet is unforgeable proof to the world author.

### Amount and unit

The `amount` tag is a string containing an integer. The `unit` tag defaults to `sats` if omitted. These are passed to the LNURL endpoint when requesting an invoice.

### Multiple on-complete actions

A single payment event can have multiple `on-complete` tags. Each fires independently on payment confirmation. Common combinations:

- `give-item` + `set-state` — give a receipt token and mark the payment as paid
- Multiple `give-item` — give several items on a single payment
- `set-state` on an external feature — unlock something elsewhere in the world

### Testing without real payments

During world development, you can manually call `engine.completePayment(dtag)` in the browser console to simulate a successful payment and test the `on-complete` flow without a real LNURL endpoint.
