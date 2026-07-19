# Safe-zone shops plan

## Status

- **Document status:** implementation-ready plan
- **Scope:** buy + sell basics at existing safe zones
- **Not in this version:** a dedicated town/hub scene, per-location or
  per-scroll stock variation, haggling, and buy-back of just-sold items

## Goal

Let the party spend and earn coin at the safe zones that already exist
(inn, brothel, cave-pool, oasis, rock-shelter). At a safe zone the leader can
open a shop, **buy** gear/consumables into a chosen member's inventory, and
**sell** carried items and loose treasure for coin. Shopping never changes
combat, movement, or generation rules.

The feature is complete when, standing in a safe zone, a player can open the
shop by interaction (keyboard or pointer), buy at least one stocked item into a
member with room for it, sell a carried item, see their spendable balance
change correctly, close the shop, and have the result survive save/load.

## Current state we build on

- Safe zones are already selected per dungeon (`safeZoneId`) with a placed
  anchor (`safeZoneAnchor`) and a themed presentation (`safeZonePresentation`).
- The party already has an interact prompt (`interactPrompt` /
  `updateInteractPrompt`) and modal-overlay flags (`gearOverlayOpen`,
  `statsOverlayOpen`) with matching HUD overlays (`showGearOverlay`,
  `showStatsOverlay`) — the shop overlay mirrors these.
- Inventory is per character with slot costs and `canAdd` / `add` / `remove` /
  `all` (`src/engine/inventory.ts`).
- Items are defined once in `src/data/items.ts` (`ItemDef`); treasure-table
  rows already carry a `valueGp`, but `ItemDef` itself has **no price**.

## The central design decision: coins are XP

`GameContext.bankCoins` awards **1 XP per 100-coin threshold crossed**, and
`coinsBanked` (exposed as `ctx.totalCoins`) is cumulative. If a shop simply
decremented `coinsBanked`, a player could spend coins and then re-loot across
the same threshold to farm XP again — and reducing it would also read as
"losing XP."

**Decision — a separate `spendableGold` wallet.**

- `coinsBanked` stays exactly as it is: lifetime treasure, monotonic, the sole
  driver of coin XP. Never decremented.
- Add `spendableGold`, the party wallet. Picking up coins adds to **both**
  (coins are both XP and money, tracked independently). Buying subtracts from
  the wallet. Selling adds to the wallet. XP is never touched by shopping.

This keeps the Shadowdark "treasure is XP" identity intact, lets the hoard be
spent, and makes the buy-cheap/sell exploit impossible (selling only moves the
wallet, never `coinsBanked`).

Rejected alternative: `coinsSpent` ledger with `spendable = banked - spent`.
Works for buying, but selling has no clean home and the two-number derivation
is harder to reason about than one honest wallet.

## Data model changes

### Item pricing (`src/data/items.ts`, `ItemDef`)

- Add optional `valueGp?: number` to `ItemDef` — the item's base coin value.
- Buy price = `valueGp`. Sell price = `floor(valueGp * SELL_RATE)` with
  `SELL_RATE = 0.5` (a single named constant, no per-item overrides yet).
- An item with no `valueGp` is **not sellable and not stocked** (throws if a
  shop ever tries to price it — no silent zero).
- Populate `valueGp` for the shop's stock and for any item the player can
  plausibly carry and sell. Treasure items (`coins`, `gem`, `jeweled-idol`)
  keep selling through their existing treasure `valueGp` numbers.

### Wallet (`GameContext`)

- Add `spendableGold: number` with `earnGold(qty)` / `spendGold(qty)`;
  `spendGold` throws if `qty` exceeds the balance (no negative wallet).
- Coin pickup (`Dungeon.collectPickup` coin branch) calls `earnGold(qty)`
  alongside the existing `bankCoins(qty)`.

### Persistence

- Add `spendableGold?: number` to the save state (`src/game/state.ts`),
  validate it in `SaveRepository` (finite, `>= 0`), write it in the Dungeon
  snapshot, and restore it on load next to `coinsBanked`.
- Migration: a save without `spendableGold` starts the wallet at its
  `coinsBanked` (existing hoards remain spendable) — decide explicitly rather
  than defaulting to 0 and stranding old runs.

## Stock

- One shared stock list for the first version: torches, rations, rope,
  grappling hook, iron spikes, a healing potion, and one martial weapon and
  one armor as a splurge. A short `SHOP_STOCK: readonly string[]` of item ids
  resolved through `item()`.
- Stock is fixed and unlimited per visit; no stock counts to persist yet.
- Class/slot legality is enforced by inventory `canAdd` at purchase time, not
  by hiding items — the shop can show "no room" / "can't use" inline.

## Interaction and UI

- **Open:** when the leader is inside the safe-zone room near the anchor, the
  interact prompt reads e.g. `E — Shop (THE MASKED INN)`; interact opens the
  shop overlay and sets a `shopOverlayOpen` modal flag that suppresses gameplay
  input like the gear/stats overlays do.
- **Overlay (HUD):** two columns — **Buy** (stock with buy price and an
  affordability/room state) and **Sell** (the active member's sellable items +
  loose treasure with sell price). A header shows `Gold: N` and the active
  member; a control cycles which member is buying/selling. Close via a visible
  Back control and via the same key/Esc.
- **Buy:** disabled when `spendableGold < price` or the member fails `canAdd`;
  on confirm, `spendGold(price)` then `inventory.add`.
- **Sell:** on confirm, `inventory.remove` then `earnGold(sellPrice)`.
- Keyboard and pointer both drive it (mobile plan wants no keyboard-only flows);
  reuse the overlay navigation the gear overlay already uses.
- Every transaction posts a message (`ctx.say`) and updates the header live.

## Testing

Unit (no Phaser):
- `earnGold` / `spendGold` math, and `spendGold` throwing past the balance.
- Coin pickup increments both `coinsBanked` (XP) and `spendableGold`, and
  spending never changes `coinsBanked` or awarded XP.
- Buy price / sell price from `valueGp` and `SELL_RATE`; unpriced item throws.
- Buy blocked by insufficient gold and by `canAdd`; sell removes and pays.
- Save round-trips `spendableGold`; a legacy save seeds the wallet from
  `coinsBanked`.

Scene smoke (where tooling permits): open shop at a safe zone, buy, sell,
close, confirm balances and inventory, save/load.

## Phases

- **S1 — Economy core:** `ItemDef.valueGp`, prices, `spendableGold` +
  earn/spend, coin-pickup wiring, persistence, unit tests. No UI. *Exit: wallet
  and pricing correct and saved; XP behavior unchanged; all tests pass.*
- **S2 — Shop overlay + interaction:** safe-zone interact, buy/sell overlay,
  member cycling, messages. *Exit: a full buy+sell visit works by keyboard and
  pointer and survives save/load.*
- **S3 — Polish:** affordability/room states, sell confirmation for valuables,
  copy, and README controls. *Exit: no confusing dead-ends; touch-operable.*

## Estimate

- S1 economy core: ~0.5–1 day.
- S2 overlay + interaction: ~1–1.5 days.
- S3 polish: ~0.5 day.

Roughly 2–3 days for a tested buy+sell safe-zone shop.

## Risks

- Coin/XP coupling is the main correctness risk; the separate wallet is the
  guard, and the XP-invariance test is mandatory.
- Adding `valueGp` across items is easy to leave incomplete — the throw-on-
  unpriced rule surfaces gaps instead of hiding them.
- The 960×540 HUD is already tight (see mobile plan); the shop overlay must be
  a full modal, not a HUD strip, and must be touch-reachable.
