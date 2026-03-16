# The Goonies — Complete Event Reference (v1)
*Written against the the-lake schema*

All events: `kind: 30078`, `t: goonies`
Author pubkey placeholder: `<GA>`
A-tag format: `30078:<GA>:goonies:<type>:<n>`

You play as Mikey Walsh. The Goon Docks are being foreclosed. One-Eyed Willy's treasure
is the only thing that can save them. The other Goonies travel with you as companion NPCs.

---

## Schema Quick Reference

```
["exit", "<place-ref>", "<slot>", "<label?>"]
["requires",    "<event-ref>",  "<state-or-blank>", "<description?>"]
["requires-not","<event-ref>",  "<state-or-blank>", "<description?>"]
["verb",        "<canonical>",  "<alias...>"]
["noun",        "<canonical>",  "<alias...>"]
["on-*",        "<target?>",    "<action-type>",    "<action-target?>"]
["transition",  "<from>",       "<to>",             "<text>"]
["option",      "<label>",      "<next-node-ref-or-blank>"]
["dialogue",    "<node-ref>",   "<requires-ref?>",  "<state?>"]
["roams-when",  "<state>"]
```

---

## Places

### The Walsh House

---

```json
// Attic — opening scene, map discovered here
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:attic"], ["t", "goonies"], ["type", "place"],
    ["title", "Walsh House — Attic"],
    ["noun",  "attic", "loft", "upstairs"],
    ["exit", "down"],
    ["feature", "30078:<GA>:goonies:feature:attic-trunk"],
    ["feature", "30078:<GA>:goonies:feature:old-painting"],
    ["feature", "30078:<GA>:goonies:feature:attic-window"],
    ["item",    "30078:<GA>:goonies:item:doubloon"],
    ["npc",     "30078:<GA>:goonies:npc:mouth"],
    ["npc",     "30078:<GA>:goonies:npc:data"],
    ["npc",     "30078:<GA>:goonies:npc:chunk"],
    ["on-enter","player", "set-state", "visited"]
  ],
  "content": "The dusty attic of the Walsh house. Boxes and old furniture crowd the space. The smell of history. Through the window you can see the sheriff's notice on the front door."
}

// Walsh Garage
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:garage"], ["t", "goonies"], ["type", "place"],
    ["title", "Walsh House — Garage"],
    ["noun",  "garage"],
    ["exit", "up"],
    ["exit", "south"],
    ["feature", "30078:<GA>:goonies:feature:bikes"],
    ["feature", "30078:<GA>:goonies:feature:foreclosure-notice"],
    ["npc",     "30078:<GA>:goonies:npc:brand"],
    ["npc",     "30078:<GA>:goonies:npc:andy"],
    ["npc",     "30078:<GA>:goonies:npc:steph"]
  ],
  "content": "The garage smells of oil and old metal. Brand is lifting weights. Andy and Steph arrived with him — unexpected but maybe useful."
}
```

---

### Goon Docks & Fratelli Restaurant

---

```json
// Goon Docks — street exterior
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:goon-docks"], ["t", "goonies"], ["type", "place"],
    ["title", "Goon Docks"],
    ["noun",  "docks", "street", "neighbourhood", "outside"],
    ["exit", "north"],
    ["exit", "east"],
    ["feature", "30078:<GA>:goonies:feature:closed-shops"],
    ["feature", "30078:<GA>:goonies:feature:development-sign"]
  ],
  "content": "The familiar streets of the Goon Docks. Half the shops are already shuttered. A developer's sign promises luxury condominiums. Not if you can help it."
}

// Fratelli Restaurant — exterior
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:restaurant-exterior"], ["t", "goonies"], ["type", "place"],
    ["title", "Fratelli's — Exterior"],
    ["noun",  "restaurant", "exterior", "outside"],
    ["exit", "west"],
    ["exit", "enter"],
    ["feature", "30078:<GA>:goonies:feature:restaurant-sign"],
    ["npc",     "30078:<GA>:goonies:npc:jake-fratelli"]
  ],
  "content": "A run-down roadside restaurant. The parking lot is empty except for a beat-up car. Something feels wrong."
}

// Fratelli Restaurant — interior
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:restaurant-interior"], ["t", "goonies"], ["type", "place"],
    ["title", "Fratelli's — Interior"],
    ["noun",  "restaurant", "inside", "interior", "diner"],
    ["exit", "out"],
    ["feature", "30078:<GA>:goonies:feature:restaurant-counter"],
    ["feature", "30078:<GA>:goonies:feature:cellar-hatch"],
    ["npc",     "30078:<GA>:goonies:npc:mama-fratelli"],
    ["npc",     "30078:<GA>:goonies:npc:francis-fratelli"]
  ],
  "content": "The restaurant is closed but clearly occupied. Dishes in the sink. A smell of something cooking. A hatch behind the counter leads down."
}

// Fratelli Basement — Chunk gets captured here
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:fratelli-basement"], ["t", "goonies"], ["type", "place"],
    ["title", "Fratelli Basement"],
    ["noun",  "basement", "cellar", "below"],
    ["exit", "up"],
    ["exit", "north"],
    ["feature", "30078:<GA>:goonies:feature:freezer"],
    ["feature", "30078:<GA>:goonies:feature:spanish-warning"],
    ["feature", "30078:<GA>:goonies:feature:sloth-chain"],
    ["npc",     "30078:<GA>:goonies:npc:sloth"],
    ["requires","30078:<GA>:goonies:npc:chunk", "distracted", "The Fratellis are blocking the way down."]
  ],
  "content": "A grimy basement. A freezer hums in the corner. Chains hang from the wall — and something huge is chained to them. A Spanish warning is painted on the tunnel door."
}
```

---

### The Underground

---

```json
// Wishing Well Chamber
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:wishing-well"], ["t", "goonies"], ["type", "place"],
    ["title", "Wishing Well"],
    ["noun",  "well", "wishing well", "cave"],
    ["exit", "south"],
    ["exit", "down"],
    ["feature", "30078:<GA>:goonies:feature:wishing-well"],
    ["puzzle",  "30078:<GA>:goonies:puzzle:well-descent"],
    ["requires","30078:<GA>:goonies:feature:spanish-warning", "translated", "A warning blocks the passage. You can't read it."]
  ],
  "content": "A natural cave chamber. A stone well sits at the centre. Coins glint at the bottom. Light filters down from somewhere far above — that's the well near the restaurant."
}

// Upper Tunnels — junction
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:upper-tunnels"], ["t", "goonies"], ["type", "place"],
    ["title", "Upper Tunnels"],
    ["noun",  "tunnels", "passage", "junction"],
    ["exit", "up"],
    ["exit", "west"],
    ["exit", "east"],
    ["requires","30078:<GA>:goonies:item:doubloon", "used", "The well descent requires the doubloon."]
  ],
  "content": "A fork in the underground tunnels. The stone is old — very old. Water drips somewhere in the darkness. The map shows two routes from here."
}

// Trap Room — Data's gadgets needed
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:trap-room"], ["t", "goonies"], ["type", "place"],
    ["title", "Trap Room"],
    ["noun",  "trap room", "chamber", "traps"],
    ["exit", "east"],
    ["exit", "south"],
    ["feature", "30078:<GA>:goonies:feature:blade-pendulum"],
    ["feature", "30078:<GA>:goonies:feature:water-jet"],
    ["feature", "30078:<GA>:goonies:feature:spike-floor"]
  ],
  "content": "A chamber bristling with ancient traps. The ceiling groans. One wrong step and this adventure ends here."
}

// Map Chamber — Steph spots the hidden passage
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:map-chamber"], ["t", "goonies"], ["type", "place"],
    ["title", "Map Chamber"],
    ["noun",  "map chamber", "chamber", "room"],
    ["exit", "west"],
    ["exit", "south"],
    ["feature", "30078:<GA>:goonies:feature:ancient-murals"],
    ["feature", "30078:<GA>:goonies:feature:false-wall"],
    ["npc",     "30078:<GA>:goonies:npc:steph"]
  ],
  "content": "A chamber decorated with ancient murals depicting a ship laden with treasure. One wall looks slightly different from the others."
}

// Waterfall Cave
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:waterfall-cave"], ["t", "goonies"], ["type", "place"],
    ["title", "Waterfall Cave"],
    ["noun",  "waterfall", "cave", "falls"],
    ["exit", "north"],
    ["exit", "down"],
    ["feature", "30078:<GA>:goonies:feature:waterfall"],
    ["feature", "30078:<GA>:goonies:feature:rock-ledge"]
  ],
  "content": "A thundering waterfall fills the cave with mist. The roar is deafening. Behind the falls — is that a passage? The map says to go down."
}

// Bone Organ Chamber — Andy's moment
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:bone-organ-chamber"], ["t", "goonies"], ["type", "place"],
    ["title", "Bone Organ Chamber"],
    ["noun",  "organ chamber", "bones", "organ room"],
    ["exit", "up"],
    ["feature", "30078:<GA>:goonies:feature:bone-organ"],
    ["puzzle",  "30078:<GA>:goonies:puzzle:organ-password"],
    ["npc",     "30078:<GA>:goonies:npc:andy"]
  ],
  "content": "A vast underground chamber. At its centre stands an organ built entirely from human bones. A passage beyond is sealed — the map shows a sequence of notes as the key."
}

// Lower Tunnels
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:lower-tunnels"], ["t", "goonies"], ["type", "place"],
    ["title", "Lower Tunnels"],
    ["noun",  "lower tunnels", "deep tunnels"],
    ["exit", "north"],
    ["exit", "south"],
    ["requires","30078:<GA>:goonies:puzzle:organ-password", "solved", "The passage beyond the organ is sealed."]
  ],
  "content": "Deep tunnels beneath the organ chamber. The air is cold and salt-tinged. The sea is close."
}

// Fratelli Chase Corridor — timed sequence
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:chase-corridor"], ["t", "goonies"], ["type", "place"],
    ["title", "Chase!"],
    ["noun",  "corridor", "tunnel", "passage"],
    ["exit", "north"],
    ["counter",         "fratelli-chase", "10"],
    ["on-move",         "", "decrement",        "fratelli-chase"],
    ["on-counter", "fratelli-chase", "0", "consequence", "30078:<GA>:goonies:consequence:caught-by-fratellis"]
  ],
  "content": "The Fratellis are right behind you! The tunnel stretches north toward the sound of the sea. RUN."
}

// Underground Cove
{
  "kind": 30078, "tags": [
    ["d", "goonies:place:underground-cove"], ["t", "goonies"], ["type", "place"],
    ["title", "Underground Cove"],
    ["noun",  "cove", "cave", "beach", "shore"],
    ["exit", "south"],
    ["exit", "board"],
    ["feature", "30078:<GA>:goonies:feature:cave-beach"],
    ["feature", "30078:<GA>:goonies:feature:ship-gangway"],
    ["npc",     "30078:<GA>:goonies:npc:sloth"],
    ["npc",     "30078:<GA>:goonies:npc:mama-fratelli"],
    ["npc",     "30078:<GA>:goonies:npc:francis-fratelli"],
    ["npc",     "30078:<GA>:goonies:npc:jake-fratelli"]
  ],
  "content": "A vast underground cavern opens into a secret cove. And there — rising from the black water — is the most beautiful thing you have ever seen. One-Eyed Willy's ship."
}

// One-Eyed Willy's Ship — NIP-44 sealed
{
  "kind": 30078, "tags": [
    ["d",            "goonies:place:willy-ship"], ["t", "goonies"], ["type", "place"],
    ["title",        "The Inferno"],
    ["noun",         "ship", "inferno", "willy's ship"],
    ["state",        "sealed"],
    ["content-type", "application/nip44"],
    ["exit", "30078:<GA>:goonies:place:underground-cove", "off", "Back to the cove."],
    ["feature",      "30078:<GA>:goonies:feature:willy-skeleton"],
    ["feature",      "30078:<GA>:goonies:feature:treasure-hold"],
    ["requires",     "30078:<GA>:goonies:npc:sloth", "ally", "The ship's door is sealed. Something enormously strong is needed to open it."]
  ],
  "content": "<NIP-44 encrypted content>"
}
```

---

## Features

---

```json
// Attic Trunk — map and doubloon inside
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:attic-trunk"], ["t", "goonies"], ["type", "feature"],
    ["title", "Old Trunk"],
    ["noun",  "trunk", "chest", "box"],
    ["state",      "closed"],
    ["transition", "closed", "open", "The trunk creaks open. Inside: old papers, a leather map case, and something that glints gold."],
    ["verb",  "open",    "unlock", "pry"],
    ["verb",  "examine", "look", "search"],
    ["on-interact","open", "set-state", "open"],
    ["on-interact","open", "give-item", "30078:<GA>:goonies:item:doubloon"],
    ["on-interact","open", "give-item", "30078:<GA>:goonies:item:map"]
  ],
  "content": "A battered wooden trunk. The lock is rusted but weak."
}}

// Spanish Warning — Mouth must translate
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:spanish-warning"], ["t", "goonies"], ["type", "feature"],
    ["title", "Warning Sign"],
    ["noun",  "sign", "warning", "writing", "spanish"],
    ["state",      "unread"],
    ["transition", "unread",     "translated", "Mouth reads it aloud. 'Beware. The tunnels hold the bones of those who sought Willy's gold.'"],
    ["transition", "translated", "translated", "You know what it says."],
    ["verb",  "examine", "read", "look"],
    ["requires",   "30078:<GA>:goonies:npc:mouth", "present", "It's in Spanish. You can't read it."],
    ["on-interact","examine", "set-state", "translated"]
  ],
  "content": "A painted warning in Spanish. Red letters, urgent."
}}

// Sloth's Chain
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:sloth-chain"], ["t", "goonies"], ["type", "feature"],
    ["title", "Heavy Chain"],
    ["noun",  "chain", "chains", "shackle"],
    ["state",      "locked"],
    ["transition", "locked", "broken", "SLOTH SMASH. The chain tears from the wall like paper."],
    ["verb",  "examine",  "look"],
    ["verb",  "unlock",   "break", "free", "release"],
    ["requires",   "30078:<GA>:goonies:npc:chunk", "befriended-sloth", "Sloth eyes you warily. He doesn't trust you yet."],
    ["on-interact","unlock", "set-state", "broken"],
    ["on-interact","unlock", "set-state", "ally", "30078:<GA>:goonies:npc:sloth"]
  ],
  "content": "Enormous iron chains bolted to the wall. Whatever is chained here is very large."
}}

// Wishing Well
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:wishing-well"], ["t", "goonies"], ["type", "feature"],
    ["title", "Wishing Well"],
    ["noun",  "well", "coins", "water"],
    ["state",      "full"],
    ["transition", "full",  "drained", "You take the coins. The well feels empty now."],
    ["transition", "full",  "left",    "You leave the coins. They belong to someone else's wishes."],
    ["verb",  "examine",  "look"],
    ["verb",  "take",     "grab", "collect"],
    ["verb",  "leave",    "ignore"],
    ["on-interact","examine", "set-state", "visible", "30078:<GA>:goonies:clue:well-coins"],
    ["on-interact","take",    "set-state", "drained"],
    ["on-interact","take",    "consequence","30078:<GA>:goonies:consequence:bad-karma"],
    ["on-interact","leave",   "set-state", "left"],
    ["on-interact","leave",   "consequence","30078:<GA>:goonies:consequence:good-karma"]
  ],
  "content": "A stone wishing well. Coins glint at the bottom. Years of wishes."
}}

// Blade Pendulum trap
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:blade-pendulum"], ["t", "goonies"], ["type", "feature"],
    ["title", "Blade Pendulum"],
    ["noun",  "pendulum", "blade", "trap"],
    ["state",      "active"],
    ["transition", "active", "disabled", "Data's Pinchers of Peril clamp the blade mid-swing."],
    ["verb",  "examine",  "look"],
    ["verb",  "disable",  "stop", "use"],
    ["requires",   "30078:<GA>:goonies:item:pinchers-of-peril", "", "Nothing to stop it with."],
    ["on-interact","disable", "set-state",   "disabled"],
    ["on-interact","disable", "consume-item","30078:<GA>:goonies:item:pinchers-of-peril"]
  ],
  "content": "A huge pendulum blade swings across the passage. Timing it seems impossible."
}}

// Water Jet trap
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:water-jet"], ["t", "goonies"], ["type", "feature"],
    ["title", "Water Jet"],
    ["noun",  "jet", "water", "spray", "trap"],
    ["state",      "active"],
    ["transition", "active", "disabled", "Data's Slick Shoes redirect the jet harmlessly."],
    ["verb",  "examine",  "look"],
    ["verb",  "disable",  "block", "use"],
    ["requires",   "30078:<GA>:goonies:item:slick-shoes", "", "Nothing to redirect it with."],
    ["on-interact","disable", "set-state",   "disabled"],
    ["on-interact","disable", "consume-item","30078:<GA>:goonies:item:slick-shoes"]
  ],
  "content": "A pressurised water jet blasts from the wall at irregular intervals."
}}

// Spike Floor trap
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:spike-floor"], ["t", "goonies"], ["type", "feature"],
    ["title", "Spike Floor"],
    ["noun",  "spikes", "floor", "trap"],
    ["state",      "active"],
    ["transition", "active", "disabled", "Data's Bully Blinders confuse the pressure sensors."],
    ["verb",  "examine",  "look"],
    ["verb",  "disable",  "cross", "use"],
    ["requires",   "30078:<GA>:goonies:item:bully-blinders", "", "Nothing to deal with the spikes."],
    ["on-interact","disable", "set-state",   "disabled"],
    ["on-interact","disable", "consume-item","30078:<GA>:goonies:item:bully-blinders"]
  ],
  "content": "The floor ahead is riddled with pressure plates. One wrong step triggers the spikes."
}}

// False Wall (map chamber)
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:false-wall"], ["t", "goonies"], ["type", "feature"],
    ["title", "False Wall"],
    ["noun",  "wall", "false wall", "stones"],
    ["state",      "hidden"],
    ["transition", "hidden",  "visible", "Steph taps the wall. 'It sounds hollow. There's something behind here.'"],
    ["transition", "visible", "open",    "The false wall swings inward. A passage beyond."],
    ["verb",  "examine",  "look", "tap", "push"],
    ["verb",  "open",     "push through"],
    ["requires",   "30078:<GA>:goonies:npc:steph", "present", "Something seems off about this wall but you can't tell what."],
    ["on-interact","examine", "set-state", "visible"],
    ["on-interact","open",    "set-state", "open"],
    ["on-interact","open",    "set-state", "visible", "30078:<GA>:goonies:portal:map-chamber-to-waterfall"]
  ],
  "content": "One section of the wall looks slightly different. The stones don't quite match."
}}

// Bone Organ
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:bone-organ"], ["t", "goonies"], ["type", "feature"],
    ["title", "Bone Organ"],
    ["noun",  "organ", "bones", "keyboard", "pipes"],
    ["state",      "silent"],
    ["transition", "silent",  "playing",  "Andy sits at the keys. Her fingers find the notes from the map."],
    ["transition", "playing", "solved",   "The final note echoes. The sealed passage grinds open."],
    ["transition", "playing", "wrong",    "A wrong note. The chamber shakes. Something falls from the ceiling."],
    ["transition", "wrong",   "playing",  "Andy steadies herself and continues."],
    ["verb",  "examine",  "look"],
    ["verb",  "play",     "use", "touch"],
    ["requires",   "30078:<GA>:goonies:npc:andy", "present", "Nobody here can play this."],
    ["requires",   "30078:<GA>:goonies:item:map", "full", "The map's note sequence isn't fully revealed yet."],
    ["on-interact","play", "set-state", "playing"]
  ],
  "content": "An organ built from human bones. Keys of finger bones. Pipes of femurs. Beautiful and terrible."
}}

// One-Eyed Willy's skeleton
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:willy-skeleton"], ["t", "goonies"], ["type", "feature"],
    ["title", "One-Eyed Willy"],
    ["noun",  "willy", "skeleton", "pirate", "captain"],
    ["verb",  "examine", "look", "talk to"],
    ["on-interact","examine", "set-state", "visible", "30078:<GA>:goonies:clue:willy-message"]
  ],
  "content": "One-Eyed Willy sits at the helm. He's been waiting a long time. He looks... content."
}}

// Treasure Hold
{
  "kind": 30078, "tags": [
    ["d", "goonies:feature:treasure-hold"], ["t", "goonies"], ["type", "feature"],
    ["title", "Treasure Hold"],
    ["noun",  "treasure", "gold", "hold", "chest"],
    ["state",      "untouched"],
    ["transition", "untouched", "taken",  "You fill your pockets. It's more than enough. The Goon Docks are saved."],
    ["transition", "untouched", "left",   "You leave it. This is Willy's treasure. It belongs here."],
    ["verb",  "examine",  "look"],
    ["verb",  "take",     "grab", "collect"],
    ["verb",  "leave",    "ignore"],
    ["on-interact","take",  "set-state",  "taken"],
    ["on-interact","take",  "consequence","30078:<GA>:goonies:consequence:treasure-taken"],
    ["on-interact","leave", "set-state",  "left"],
    ["on-interact","leave", "consequence","30078:<GA>:goonies:consequence:treasure-left"]
  ],
  "content": "Mountains of gold coins, jewels, and artefacts. More wealth than you can imagine. Centuries of piracy."
}}
```

---

## Items

---

```json
// The Map — progressive reveal, sealed until doubloon used
{
  "kind": 30078, "tags": [
    ["d",            "goonies:item:map"], ["t", "goonies"], ["type", "item"],
    ["title",        "One-Eyed Willy's Map"],
    ["noun",         "map", "treasure map", "willy's map"],
    ["state",        "sealed"],
    ["content-type", "application/nip44"],
    ["transition",   "sealed",  "partial", "The doubloon unlocks the first section. Tunnels beneath Astoria."],
    ["transition",   "partial", "full",    "The organ chamber reveals the final section. The ship awaits."],
    ["verb",         "examine", "look", "read", "unfold"],
    ["verb",         "use",     "open"],
    ["on-interact",  "examine", "set-state", "visible", "30078:<GA>:goonies:clue:map-current-section"]
  ],
  "content": "An old leather map case. Something is sealed inside."
}}

// Doubloon — key for the map and wishing well descent
{
  "kind": 30078, "tags": [
    ["d", "goonies:item:doubloon"], ["t", "goonies"], ["type", "item"],
    ["title", "Spanish Doubloon"],
    ["noun",  "doubloon", "coin", "gold coin"],
    ["state",      "found"],
    ["transition", "found", "used", "The doubloon fits perfectly into the slot."],
    ["verb",  "examine", "look"],
    ["verb",  "use",     "insert", "place"],
    ["on-interact","use", "set-state", "used"],
    ["on-interact","use", "set-state", "partial", "30078:<GA>:goonies:item:map"]
  ],
  "content": "A gold doubloon. One side shows a skull with one eye. This is the key."
}}

// Data's Gadgets — single use items, counter: 1
{
  "kind": 30078, "tags": [
    ["d", "goonies:item:pinchers-of-peril"], ["t", "goonies"], ["type", "item"],
    ["title", "Pinchers of Peril"],
    ["noun",  "pinchers", "pinchers of peril", "gadget", "clamp"],
    ["counter",         "uses", "1"],
    ["transition",      "ready", "spent", "The Pinchers of Peril are used up."],
    ["state",           "ready"],
    ["verb",            "use", "attach", "deploy"],
    ["verb",            "examine", "look"],
    ["on-counter", "uses", "0", "set-state", "spent"]
  ],
  "content": "One of Data's inventions. A spring-loaded clamping device. Single use."
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:item:slick-shoes"], ["t", "goonies"], ["type", "item"],
    ["title", "Slick Shoes"],
    ["noun",  "shoes", "slick shoes", "gadget"],
    ["counter",         "uses", "1"],
    ["state",           "ready"],
    ["transition",      "ready", "spent", "The Slick Shoes are used up."],
    ["verb",            "use",     "wear", "deploy"],
    ["verb",            "examine", "look"],
    ["on-counter", "uses", "0", "set-state", "spent"]
  ],
  "content": "Data's rocket-powered shoes. Redirects water jets. Single use."
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:item:bully-blinders"], ["t", "goonies"], ["type", "item"],
    ["title", "Bully Blinders"],
    ["noun",  "blinders", "bully blinders", "gadget", "glasses"],
    ["counter",         "uses", "1"],
    ["state",           "ready"],
    ["transition",      "ready", "spent", "The Bully Blinders are used up."],
    ["verb",            "use",     "deploy", "throw"],
    ["verb",            "examine", "look"],
    ["on-counter", "uses", "0", "set-state", "spent"]
  ],
  "content": "Data's sensor-confusing goggles. Disables pressure-plate traps. Single use."
}}

// Map clue items
{
  "kind": 30078, "tags": [
    ["d", "goonies:item:marble-bag"], ["t", "goonies"], ["type", "item"],
    ["title", "Bag of Marbles"],
    ["noun",  "marbles", "bag", "bag of marbles"]
  ],
  "content": "A bag of Mikey's marbles. A childhood treasure. Useless — but you'd never throw them away."
}}
```

---

## NPCs

---

```json
// Mouth — translator
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:mouth"], ["t", "goonies"], ["type", "npc"],
    ["title", "Mouth"],
    ["noun",  "mouth", "clark", "kid"],
    ["state",      "present"],
    ["transition", "present", "gone", "Mouth runs off ahead."],
    ["dialogue",   "30078:<GA>:goonies:dialogue:mouth:greeting"]
  ],
  "content": "Clark 'Mouth' Devereaux. Talks too much. Speaks fluent Spanish — which is about to be very useful."
}}

// Data — gadgets
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:data"], ["t", "goonies"], ["type", "npc"],
    ["title", "Data"],
    ["noun",  "data", "richard", "kid"],
    ["state",      "present"],
    ["dialogue",   "30078:<GA>:goonies:dialogue:data:greeting"]
  ],
  "content": "Richard 'Data' Wang. His gadgets have never once worked perfectly. Today might be different."
}}

// Chunk — the distraction, then captured
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:chunk"], ["t", "goonies"], ["type", "npc"],
    ["title", "Chunk"],
    ["noun",  "chunk", "lawrence", "kid"],
    ["state",        "present"],
    ["transition",   "present",          "distracted",      "Chunk launches into his Truffle Shuffle. The Fratellis are transfixed."],
    ["transition",   "distracted",       "captured",        "Too slow. The Fratellis grab Chunk."],
    ["transition",   "captured",         "befriended-sloth","Locked in the basement with Sloth, Chunk does what he does best — he offers food."],
    ["transition",   "befriended-sloth", "reunited",        "Chunk and Sloth arrive together. Best friends."],
    ["dialogue",     "30078:<GA>:goonies:dialogue:chunk:greeting"],
    ["dialogue",     "30078:<GA>:goonies:dialogue:chunk:captured",   "30078:<GA>:goonies:npc:chunk", "captured"],
    ["dialogue",     "30078:<GA>:goonies:dialogue:chunk:reunited",   "30078:<GA>:goonies:npc:chunk", "reunited"]
  ],
  "content": "Lawrence 'Chunk' Cohen. His stomach has gotten him into trouble before. This time it might save everyone."
}}

// Brand — strength
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:brand"], ["t", "goonies"], ["type", "npc"],
    ["title", "Brand"],
    ["noun",  "brand", "walsh", "mikey's brother", "brother"],
    ["state",      "present"],
    ["dialogue",   "30078:<GA>:goonies:dialogue:brand:greeting"]
  ],
  "content": "Brand Walsh. Mikey's older brother. Strong, overprotective, occasionally useful."
}}

// Andy — musician
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:andy"], ["t", "goonies"], ["type", "npc"],
    ["title", "Andy"],
    ["noun",  "andy", "cornwall", "girl"],
    ["state",      "present"],
    ["dialogue",   "30078:<GA>:goonies:dialogue:andy:greeting"]
  ],
  "content": "Andrea 'Andy' Carmichael. Brand's love interest. Piano lessons turn out to be unexpectedly critical."
}}

// Steph — observer
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:steph"], ["t", "goonies"], ["type", "npc"],
    ["title", "Steph"],
    ["noun",  "steph", "stephanie", "girl"],
    ["state",      "present"],
    ["dialogue",   "30078:<GA>:goonies:dialogue:steph:greeting"]
  ],
  "content": "Stephanie Steinbrenner. Sharp eyes. She notices things others miss."
}}

// Sloth — hostile until freed by Chunk
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:sloth"], ["t", "goonies"], ["type", "npc"],
    ["title", "Sloth"],
    ["noun",  "sloth", "fratelli", "big guy", "giant"],
    ["health",     "999"],
    ["damage",     "10"],
    ["state",      "hostile"],
    ["transition", "hostile",  "neutral",  "Sloth cocks his head. Something in Chunk's gesture reaches him."],
    ["transition", "neutral",  "ally",     "HEY YOU GUYS! Sloth tears the chains from the wall."],
    ["transition", "ally",     "ally",     "Sloth grins his crooked grin."],
    ["roams-when", "ally"],
    ["speed",      "1"],
    ["order",      "sequential"],
    ["route",      "30078:<GA>:goonies:place:underground-cove"],
    ["route",      "30078:<GA>:goonies:place:willy-ship"],
    ["on-encounter","player",  "deal-damage", "0"],
    ["dialogue",    "30078:<GA>:goonies:dialogue:sloth:greeting"],
    ["dialogue",    "30078:<GA>:goonies:dialogue:sloth:ally",  "30078:<GA>:goonies:npc:sloth", "ally"]
  ],
  "content": "The misshapen giant chained to the wall. One eye stares at you. There's something kind behind it."
}}

// Mama Fratelli — roaming antagonist
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:mama-fratelli"], ["t", "goonies"], ["type", "npc"],
    ["title", "Mama Fratelli"],
    ["noun",  "mama", "fratelli", "old woman", "mama fratelli"],
    ["health",     "20"],
    ["damage",     "5"],
    ["hit-chance", "0.8"],
    ["state",      "hunting"],
    ["transition", "hunting",  "fled",    "Sloth blocks Mama's path. She backs away."],
    ["transition", "fled",     "fled",    "Mama is blocked."],
    ["speed",      "4"],
    ["order",      "sequential"],
    ["route",      "30078:<GA>:goonies:place:restaurant-interior"],
    ["route",      "30078:<GA>:goonies:place:fratelli-basement"],
    ["route",      "30078:<GA>:goonies:place:lower-tunnels"],
    ["route",      "30078:<GA>:goonies:place:underground-cove"],
    ["on-encounter","player",  "consequence", "30078:<GA>:goonies:consequence:caught-by-fratellis"],
    ["dialogue",    "30078:<GA>:goonies:dialogue:mama:greeting"]
  ],
  "content": "Mama Fratelli. Iron-haired and iron-willed. She runs the family. The family runs crime."
}}

// Francis Fratelli
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:francis-fratelli"], ["t", "goonies"], ["type", "npc"],
    ["title", "Francis Fratelli"],
    ["noun",  "francis", "fratelli", "man"],
    ["health",     "12"],
    ["damage",     "4"],
    ["hit-chance", "0.7"],
    ["state",      "hostile"],
    ["speed",      "5"],
    ["order",      "random"],
    ["route",      "30078:<GA>:goonies:place:fratelli-basement"],
    ["route",      "30078:<GA>:goonies:place:upper-tunnels"],
    ["on-encounter","player", "consequence","30078:<GA>:goonies:consequence:caught-by-fratellis"]
  ],
  "content": "Francis Fratelli. Mean, slow, and currently very interested in finding you."
}}

// Jake Fratelli
{
  "kind": 30078, "tags": [
    ["d", "goonies:npc:jake-fratelli"], ["t", "goonies"], ["type", "npc"],
    ["title", "Jake Fratelli"],
    ["noun",  "jake", "fratelli", "man"],
    ["health",     "10"],
    ["damage",     "3"],
    ["hit-chance", "0.65"],
    ["state",      "hostile"],
    ["speed",      "6"],
    ["order",      "random"],
    ["route",      "30078:<GA>:goonies:place:restaurant-exterior"],
    ["route",      "30078:<GA>:goonies:place:restaurant-interior"],
    ["route",      "30078:<GA>:goonies:place:fratelli-basement"],
    ["on-encounter","player", "consequence","30078:<GA>:goonies:consequence:caught-by-fratellis"]
  ],
  "content": "Jake Fratelli. The younger brother. Jumpier than Francis. No less dangerous."
}}
```

---

## Portals

---

```json
// ── WALSH HOUSE ───────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:attic-to-garage"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:attic", "down", "The stairs lead down to the garage."],
    ["exit", "30078:<GA>:goonies:place:garage", "up", "The attic stairs."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:garage-to-docks"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:garage", "south", "The street outside."],
    ["exit", "30078:<GA>:goonies:place:goon-docks", "north", "Back to the house."]
  ],
  "content": ""
}}

// ── STREET & RESTAURANT ───────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:docks-to-restaurant"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:goon-docks", "east", "The old restaurant is to the east."],
    ["exit", "30078:<GA>:goonies:place:restaurant-exterior", "west", "The docks lie to the west."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:exterior-to-restaurant"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:restaurant-exterior", "enter", "Push through the door."],
    ["exit", "30078:<GA>:goonies:place:restaurant-interior", "out", "Back outside."]
  ],
  "content": ""
}}

// Restaurant to Basement — hidden until Chunk creates distraction
{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:restaurant-to-basement"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:restaurant-interior", "down", "A hatch behind the counter leads down."],
    ["exit", "30078:<GA>:goonies:place:fratelli-basement", "up", "The hatch leads back up."],
    ["state",    "hidden"],
    ["requires", "30078:<GA>:goonies:npc:chunk", "distracted", "The Fratellis are watching. No way through while they're here."]
  ],
  "content": ""
}}

// ── UNDERGROUND ───────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:basement-to-well"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:fratelli-basement", "north", "The tunnel leads north."],
    ["exit", "30078:<GA>:goonies:place:wishing-well", "south", "Back to the basement."],
    ["requires","30078:<GA>:goonies:feature:spanish-warning", "translated", "A warning you can't read blocks the way."]
  ],
  "content": ""
}}

// Wishing Well descent — requires doubloon
{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:well-to-tunnels"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:wishing-well", "down", "Down into the darkness."],
    ["exit", "30078:<GA>:goonies:place:upper-tunnels", "up", "Back up to the well."],
    ["state",    "hidden"],
    ["requires", "30078:<GA>:goonies:item:doubloon", "used", "The well mechanism needs the doubloon."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:tunnels-to-trap-room"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:upper-tunnels", "west", "A passage leads west."],
    ["exit", "30078:<GA>:goonies:place:trap-room", "east", "Back to the junction."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:tunnels-to-map-chamber"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:upper-tunnels", "east", "A passage leads east."],
    ["exit", "30078:<GA>:goonies:place:map-chamber", "west", "Back to the junction."]
  ],
  "content": ""
}}

// Trap Room to Waterfall — all traps must be disabled
{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:trap-room-to-waterfall"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:trap-room", "south", "The passage continues south."],
    ["exit", "30078:<GA>:goonies:place:waterfall-cave", "north", "Back through the trap room."],
    ["requires","30078:<GA>:goonies:feature:blade-pendulum","disabled","The blade pendulum still swings."],
    ["requires","30078:<GA>:goonies:feature:water-jet",    "disabled","The water jet is still firing."],
    ["requires","30078:<GA>:goonies:feature:spike-floor",  "disabled","The spike floor is still active."]
  ],
  "content": ""
}}

// Map Chamber to Waterfall — hidden until false wall opened
{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:map-chamber-to-waterfall"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:map-chamber", "south", "The hidden passage leads south."],
    ["exit", "30078:<GA>:goonies:place:waterfall-cave", "north", "Back through the wall."],
    ["state",    "hidden"],
    ["requires", "30078:<GA>:goonies:feature:false-wall", "open", "The wall is solid."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:waterfall-to-organ"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:waterfall-cave", "down", "A passage descends."],
    ["exit", "30078:<GA>:goonies:place:bone-organ-chamber", "up", "Back up."]
  ],
  "content": ""
}}

// Organ Chamber to Lower Tunnels — sealed until organ solved
{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:organ-to-lower-tunnels"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:bone-organ-chamber", "north", "The sealed passage."],
    ["exit", "30078:<GA>:goonies:place:lower-tunnels", "south", "Back to the organ chamber."],
    ["state",    "hidden"],
    ["requires", "30078:<GA>:goonies:puzzle:organ-password", "solved", "The passage is sealed. The organ holds the key."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:lower-tunnels-to-chase"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:lower-tunnels", "north", "The tunnel continues north."],
    ["exit", "30078:<GA>:goonies:place:chase-corridor", "south", "Back south."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:chase-to-cove"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:chase-corridor", "north", "The cove is ahead!"],
    ["exit", "30078:<GA>:goonies:place:underground-cove", "south", "Back into the tunnels."]
  ],
  "content": ""
}}

// Cove to Ship — requires Sloth as ally
{
  "kind": 30078, "tags": [
    ["d", "goonies:portal:cove-to-ship"], ["t", "goonies"], ["type", "portal"],
    ["exit", "30078:<GA>:goonies:place:underground-cove", "board", "Board the ship."],
    ["exit", "30078:<GA>:goonies:place:willy-ship", "off", "Back to the cove."],
    ["requires","30078:<GA>:goonies:npc:sloth", "ally", "The ship's door is sealed. You need something enormously strong."]
  ],
  "content": ""
}}
```

---

## Puzzles

---

```json
// Well Descent — doubloon activates the mechanism
{
  "kind": 30078, "tags": [
    ["d",           "goonies:puzzle:well-descent"], ["t", "goonies"], ["type", "puzzle"],
    ["puzzle-type", "sequence"],
    ["ordered",     "false"],
    ["requires",    "30078:<GA>:goonies:item:doubloon", "", "The well mechanism needs a coin of the right kind."],
    ["on-complete", "", "set-state",  "solved"],
    ["on-complete", "", "set-state",  "used",    "30078:<GA>:goonies:item:doubloon"],
    ["on-complete", "", "set-state",  "visible", "30078:<GA>:goonies:portal:well-to-tunnels"]
  ],
  "content": "The well has a mechanism at its base — a slot shaped like a coin. Not just any coin."
}

// Organ Password — note sequence from the map
{
  "kind": 30078, "tags": [
    ["d",           "goonies:puzzle:organ-password"], ["t", "goonies"], ["type", "puzzle"],
    ["puzzle-type", "sequence"],
    ["ordered",     "true"],
    ["requires",    "30078:<GA>:goonies:npc:andy",  "present", "Nobody here can play the organ."],
    ["requires",    "30078:<GA>:goonies:item:map",  "full",    "The map's note sequence isn't fully revealed."],
    ["requires",    "30078:<GA>:goonies:feature:bone-organ", "playing", "Andy needs to start playing first."],
    ["on-complete", "", "set-state",  "solved"],
    ["on-complete", "", "set-state",  "visible", "30078:<GA>:goonies:portal:organ-to-lower-tunnels"]
  ],
  "content": "The map shows a sequence of five notes. Andy's fingers find the first key."
}
```

---

## Consequences

---

```json
// Caught by Fratellis
{
  "kind": 30078, "tags": [
    ["d", "goonies:consequence:caught-by-fratellis"], ["t", "goonies"], ["type", "consequence"],
    ["respawn",  "30078:<GA>:goonies:place:fratelli-basement"],
    ["clears",   "crypto-keys"]
  ],
  "content": "Mama's hand clamps down on your shoulder. 'Gotcha, kid.'"
}

// Bad karma (took wishing well coins)
{
  "kind": 30078, "tags": [
    ["d", "goonies:consequence:bad-karma"], ["t", "goonies"], ["type", "consequence"]
  ],
  "content": "You take the coins. Someone made a wish on those. Feels wrong."
}

// Good karma (left wishing well coins)
{
  "kind": 30078, "tags": [
    ["d", "goonies:consequence:good-karma"], ["t", "goonies"], ["type", "consequence"]
  ],
  "content": "You leave the coins. They're not yours to take."
}

// Chunk captured — sets Chunk state and starts Sloth befriend chain
{
  "kind": 30078, "tags": [
    ["d", "goonies:consequence:chunk-captured"], ["t", "goonies"], ["type", "consequence"],
    ["set-state", "captured", "30078:<GA>:goonies:npc:chunk"]
  ],
  "content": "The Truffle Shuffle buys enough time — but not for Chunk. The Fratellis grab him."
}

// Treasure taken — good ending, Goon Docks saved
{
  "kind": 30078, "tags": [
    ["d", "goonies:consequence:treasure-taken"], ["t", "goonies"], ["type", "consequence"],
    ["respawn", "30078:<GA>:goonies:place:end-credits-treasure"]
  ],
  "content": "You stuff your marble bag with jewels. More than enough. The Goon Docks are saved. You did it, Mikey."
}

// Treasure left — bittersweet ending, Willy keeps his gold
{
  "kind": 30078, "tags": [
    ["d", "goonies:consequence:treasure-left"], ["t", "goonies"], ["type", "consequence"],
    ["respawn", "30078:<GA>:goonies:place:end-credits-willy"]
  ],
  "content": "You leave it. This is Willy's treasure. It belongs here, with him. You find another way to save the Goon Docks."
}
```

---

## Dialogue Nodes (selected)

---

```json
// ── MOUTH ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "goonies:dialogue:mouth:greeting"], ["t", "goonies"], ["type", "dialogue"],
    ["text",   "'Mikey, this place is a dump. Let's get out of here before your mum sees the state of the attic.'"],
    ["option", "Show him the map",    "30078:<GA>:goonies:dialogue:mouth:map"],
    ["option", "Ask about Spanish",   "30078:<GA>:goonies:dialogue:mouth:spanish"],
    ["option", "Leave",               ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",        "goonies:dialogue:mouth:map"], ["t", "goonies"], ["type", "dialogue"],
    ["requires", "30078:<GA>:goonies:item:map", "", ""],
    ["text",     "'Holy... Mikey, do you know what this is? One-Eyed Willy! His treasure! We're gonna be rich!'"],
    ["on-enter", "player", "set-state", "visited"],
    ["option",   "Tell him about the doubloon", "30078:<GA>:goonies:dialogue:mouth:doubloon"],
    ["option",   "Leave", ""]
  ],
  "content": ""
}}

// ── CHUNK ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "goonies:dialogue:chunk:greeting"], ["t", "goonies"], ["type", "dialogue"],
    ["text",   "'Mikey! You found something? Is there food? Wait — is that a treasure map?'"],
    ["option", "Show him the map",    "30078:<GA>:goonies:dialogue:chunk:map"],
    ["option", "Ask him to distract the Fratellis", "30078:<GA>:goonies:dialogue:chunk:distract"],
    ["option", "Leave",               ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",        "goonies:dialogue:chunk:distract"], ["t", "goonies"], ["type", "dialogue"],
    ["text",     "'Distract them? With what? ...Oh no. Not the Truffle Shuffle. Mikey, come on...'"],
    ["option",   "Tell him it's the only way", "30078:<GA>:goonies:dialogue:chunk:truffle-shuffle"],
    ["option",   "Leave", ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",       "goonies:dialogue:chunk:truffle-shuffle"], ["t", "goonies"], ["type", "dialogue"],
    ["text",    "'Fine. FINE. You owe me so many Ruths.' He steps forward. 'Hey you guys!'"],
    ["on-enter","player", "set-state", "distracted", "30078:<GA>:goonies:npc:chunk"],
    ["on-enter","player", "consequence","30078:<GA>:goonies:consequence:chunk-captured"],
    ["on-enter","player", "set-state", "visible",   "30078:<GA>:goonies:portal:restaurant-to-basement"],
    ["option",  "", ""]
  ],
  "content": ""
}}

// After capture
{
  "kind": 30078, "tags": [
    ["d",        "goonies:dialogue:chunk:captured"], ["t", "goonies"], ["type", "dialogue"],
    ["requires", "30078:<GA>:goonies:npc:chunk", "captured", ""],
    ["text",     "Chunk is gone. Taken by the Fratellis."],
    ["option",   "", ""]
  ],
  "content": ""
}}

// ── SLOTH ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "goonies:dialogue:sloth:greeting"], ["t", "goonies"], ["type", "dialogue"],
    ["text",   "The giant stares at you. One eye. A crooked face. A sound like a foghorn. He's not threatening you — he's terrified of you."],
    ["option", "Offer food",   "30078:<GA>:goonies:dialogue:sloth:food"],
    ["option", "Back away",    ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",        "goonies:dialogue:sloth:food"], ["t", "goonies"], ["type", "dialogue"],
    ["requires", "30078:<GA>:goonies:npc:chunk", "captured", ""],
    ["text",     "Chunk holds out a Baby Ruth. Sloth's eye softens. Something changes."],
    ["on-enter", "player", "set-state", "befriended-sloth", "30078:<GA>:goonies:npc:chunk"],
    ["on-enter", "player", "set-state", "neutral", "30078:<GA>:goonies:npc:sloth"],
    ["option",   "", ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",        "goonies:dialogue:sloth:ally"], ["t", "goonies"], ["type", "dialogue"],
    ["requires", "30078:<GA>:goonies:npc:sloth", "ally", ""],
    ["text",     "'HEY YOU GUYS!' Sloth grins. He's with you now."],
    ["option",   "Ask him to open the ship door", "30078:<GA>:goonies:dialogue:sloth:door"],
    ["option",   "Leave", ""]
  ],
  "content": ""
}}

// ── MAMA FRATELLI ─────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "goonies:dialogue:mama:greeting"], ["t", "goonies"], ["type", "dialogue"],
    ["text",   "Mama Fratelli fixes you with a stare that could stop a clock. 'What are you doing in my restaurant, kid?'"],
    ["option", "Run",               "30078:<GA>:goonies:dialogue:mama:run"],
    ["option", "Make up a story",   "30078:<GA>:goonies:dialogue:mama:story"]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",       "goonies:dialogue:mama:run"], ["t", "goonies"], ["type", "dialogue"],
    ["text",    "'BOYS! Get them!'"],
    ["on-enter","player", "consequence", "30078:<GA>:goonies:consequence:caught-by-fratellis"],
    ["option",  "", ""]
  ],
  "content": ""
}}
```

---

## Schema Notes

Observations from mapping The Goonies against the schema — a film adapted as a single-character adventure:

- **Non-typical source** — a film, not a game, maps cleanly. The schema is genre-agnostic; any story with locations, characters, objects, and cause-and-effect works.
- **Companion gates at scale** — six different NPCs each gate at least one puzzle via `requires npc present`. All use the same condition shape. No special companion logic in the client.
- **Three-state NPC lifecycle** — Chunk `present → distracted → captured → befriended-sloth → reunited`. A single NPC with a rich state machine expressing the entire story arc of a character.
- **`roams-when`** — Sloth is confined (`hostile`, `neutral`) then freed (`ally`). `roams-when: ally` activates movement only after the state transition. First use of the tag in any reference.
- **Progressive map reveal** — the map item transitions `sealed → partial → full`. Each stage reveals more of the world. A single item as a story progression device.
- **Timed chase** — the chase corridor uses `on-move` counter as a deadline. First true urgency mechanic — distinct from resource counters (lantern battery) because it counts down player actions rather than a depletable resource.
- **Moral choice consequences** — wishing well and treasure ending use the branching puzzle pattern. The client presents the choice; the schema defines both outcomes.
- **Single-use gadgets** — Data's items have `counter: uses, 1`. The counter approach handles disposable items without a special `single-use` tag.
- **Dialogue driving consequence** — Chunk's Truffle Shuffle dialogue node directly fires `set-state`, `consequence`, and `set-state visible` on the portal. Dialogue becomes a mechanic, not just narrative.
- **Film source proves schema generality** — the world graph, state machines, and condition system are not dungeon-specific. Any story with cause and effect maps into these primitives.

*The Goonies © Warner Bros / Amblin Entertainment — reference/analysis document only*
