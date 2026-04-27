# Writing for Stokanker — reference for story writers

You write dialogue. The engine reads it. This document tells you everything you need to know to write content that works without guessing at implementation.

---

## The shipyard

| Building ID | Name on map |
|-------------|-------------|
| `romney-loods` | De romneyloods |
| `fabriek` | De fabriek |
| `werkplaats` | De werkplaats |
| `ons-huis` | Ons huis |
| `schuur-complex` | Schuur / archief / vriezer |
| `portal-crane` | Portaalkraan |
| `drijvende-bok` | Drijvende bok |
| `boomgaard` | Boomgaard |
| `smalspoor-cart` | De kar |

Opening hours are set in a data file outside your scope. If a building needs different hours, flag it to the developer.

---

## One file per building

`content/conversations/<building-id>.json`

The filename must match the building ID exactly.

```json
{
  "building": "romney-loods",
  "npc": "jan",
  "npcName": "Jan",
  "entry": "root",
  "nodes": {
    "root": { ... },
    "other-node": { ... }
  }
}
```

- **`npcName`** — shown above the dialogue text. Omit for narrator-only conversations.
- **`entry`** — the node ID where every visit starts. Unlocks can redirect this (see below).
- **`nodes`** — all nodes, keyed by ID. IDs must be unique within the file.

---

## Node types

### `npc` — NPC speaks

```json
"root": {
  "type": "npc",
  "flag": "talked:jan-root",
  "text": "Anchors and chains. Steel parts with no name you would know.",
  "choices": [
    { "label": "What kind of anchors?", "next": "anchors" },
    { "label": "I'll look around.",     "next": "end" }
  ]
}
```

- `text` — what the NPC says.
- `flag` — optional. Written to memory on visit. See the flags section.
- `choices` — what the player can say next. `"next": "end"` closes the dialogue.

### `narrate` — narrator voice

```json
"locked": {
  "type": "narrate",
  "text": "The door is padlocked. A hand-written note: back Monday.",
  "choices": [{ "label": "OK.", "next": "end" }]
}
```

No speaker name shown. Use for atmosphere, stage direction, environment. Works the same as `npc` — just no name header.

### `gate` — invisible branch

```json
"sale-gate": {
  "type": "gate",
  "condition": { "buildingOpen": "romney-loods" },
  "yes": "sale",
  "no": "sale-closed"
}
```

The player never sees this node. The engine checks the condition silently and jumps to `yes` or `no`. Use gates to branch on world state or player memory.

**Available conditions:**

| Condition | Meaning |
|-----------|---------|
| `{ "buildingOpen": "building-id" }` | Is this building currently open? |
| `{ "shipInPort": "ship-id" }` | Is this ship in port right now? |
| `{ "isWeekend": true }` | Is today Saturday or Sunday? |
| `{ "flag": "talked:jan-root" }` | Has this flag been set in a past visit? |

Gates are the only mechanism for branching on player history or time of day. If you want the NPC to remember something, use a flag on an earlier node and check it with a gate later.

### `inventory` — show listed items

```json
"inventory": {
  "type": "inventory",
  "flag": "talked:jan-inventory",
  "filter": { "location": "romney-loods" },
  "fallback": "Nothing listed right now. Ask anyway.",
  "choices": [{ "label": "Thanks.", "next": "end" }]
}
```

Pulls from the inventory data for this building. `fallback` is shown when nothing is listed. You don't control inventory contents — coordinate with the developer.

---

## Flags

Flags are the game's memory. Set a flag on a node, and it's remembered across sessions until the player resets their data.

**Convention: `scope:subject`** — lowercase, hyphen-separated.

| Scope | When to use |
|-------|-------------|
| `talked:jan-root` | Player reached this specific conversation node |
| `met:jan` | First contact with this NPC (any node) |
| `seen:romney-loods` | Player clicked the building |
| `viewed:delta-anchor` | Player viewed a specific inventory item |

**Rules:**
- Once a flag ID is in production, never rename it. Renaming silently breaks the memory of anyone who already has it.
- Flag IDs are global — the same ID must not mean different things in different buildings.
- Only flag nodes that matter for future branching or unlocks. Not every node needs one.

---

## Unlocks

`content/unlocks.json` — the only place where past actions change future possibilities. You edit this file alongside the conversation files.

```json
{
  "unlocks": [
    {
      "id": "jan-trusts-you",
      "requires": ["talked:jan-anchors", "talked:jan-sale"],
      "any": [],
      "grants": {
        "narrator": null,
        "nodes": { "romney-loods": "jan-trusted" },
        "flags": []
      }
    }
  ]
}
```

| Field | Logic | Meaning |
|-------|-------|---------|
| `requires` | AND — all must be set | Must have done every one of these |
| `any` | OR — at least one | Must have done at least one of these (omit or leave empty if unused) |
| `grants.narrator` | — | Replaces the world narrator line while this unlock is active. Set to `null` if unused. |
| `grants.nodes` | — | Redirects a building's entry point for players who have this unlock |
| `grants.flags` | — | Auto-sets additional flags when this unlock triggers |

### How `grants.nodes` works

If an unlock sets `"nodes": { "romney-loods": "jan-trusted" }`, players who have triggered the unlock enter romney-loods at `"jan-trusted"` instead of `"root"`. Players without the unlock still enter at `"root"`. You write `"jan-trusted"` as a normal node in the conversation file.

Only one alternate entry per unlock per building. If multiple unlocks apply, the last one in the table wins.

---

## End-to-end example

Player visits Jan, asks about anchors and sale. On the next visit, Jan is warmer and mentions something unlisted.

**romney-loods.json** (extract):
```json
"root": {
  "type": "npc",
  "flag": "talked:jan-root",
  "text": "Anchors and chains.",
  "choices": [
    { "label": "What kind of anchors?", "next": "anchors" },
    { "label": "Anything for sale?",    "next": "sale-gate" },
    { "label": "I'll look around.",     "next": "end" }
  ]
},
"anchors": {
  "type": "npc",
  "flag": "talked:jan-anchors",
  "text": "Delta, fisherman, a few Bruce copies. Some going back thirty years. All worked.",
  "choices": [
    { "label": "Anything for sale?", "next": "sale-gate" },
    { "label": "Thanks.",            "next": "end" }
  ]
},
"sale-gate": {
  "type": "gate",
  "condition": { "buildingOpen": "romney-loods" },
  "yes": "sale",
  "no": "sale-closed"
},
"sale": {
  "type": "npc",
  "flag": "talked:jan-sale",
  "text": "Depends what you need. Ask.",
  "choices": [{ "label": "I'll come back.", "next": "end" }]
},
"sale-closed": {
  "type": "narrate",
  "text": "The building is locked. Come back Monday.",
  "choices": [{ "label": "Understood.", "next": "end" }]
},
"jan-trusted": {
  "type": "npc",
  "flag": "talked:jan-trusted",
  "text": "You again. The Delta in the back — not listed, but it's there if you want it.",
  "choices": [
    { "label": "Show me.",          "next": "inventory" },
    { "label": "Maybe next time.",  "next": "end" }
  ]
}
```

**unlocks.json** (extract):
```json
{
  "id": "jan-trusts-you",
  "requires": ["talked:jan-anchors", "talked:jan-sale"],
  "any": [],
  "grants": {
    "narrator": null,
    "nodes": { "romney-loods": "jan-trusted" },
    "flags": []
  }
}
```

After the player has asked about anchors AND asked about buying (in any order, any session), the next visit to romney-loods starts at `jan-trusted`.

---

## Checklist before handing off

- [ ] Filename matches an existing building ID
- [ ] All `next` values point to a node ID that exists in this file, or `"end"`
- [ ] All gate `yes` / `no` values point to real node IDs
- [ ] Flag IDs follow `scope:subject` and are not reused elsewhere
- [ ] Any node referenced in `grants.nodes` exists in the conversation file
- [ ] No node ID is duplicated within the file
- [ ] `entry` points to a node that exists
