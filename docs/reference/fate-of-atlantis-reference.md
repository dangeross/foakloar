# Indiana Jones and the Fate of Atlantis — Complete Event Reference (v1)
*Written against the the-lake schema*

All events: `kind: 30078`, `t: fate`  
Author pubkey placeholder: `<FA>`  
A-tag format: `30078:<FA>:fate:<type>:<n>`

---

## Schema Quick Reference

```
["exit", "<place-ref>", "<slot>", "<label?>"]
["requires",   "<event-ref>",  "<state-or-blank>", "<description?>"]
["requires-not","<event-ref>", "<state-or-blank>", "<description?>"]
["verb",       "<canonical>",  "<alias...>"]
["noun",       "<canonical>",  "<alias...>"]
["on-*",       "<target?>",    "<action-type>",    "<action-target?>"]
["transition", "<from>",       "<to>",             "<text>"]
["option",     "<label>",      "<next-node-ref-or-blank>"]
["dialogue",   "<node-ref>",   "<requires-ref?>",  "<state?>"]
```

---

## Path System

Fate of Atlantis has three distinct play paths chosen early in the game. Rather than three separate world instances, the schema models this as **player state** — a notional path item held in inventory. Place contents, portals, and puzzles carry `requires` tags checking which path is active. The world graph is one graph; path choice gates visibility within it.

```json
// Path items — one is given based on player choice at Tikal
["d", "fate:item:path-wits"],  // Wits path — solo, puzzle-heavy
["d", "fate:item:path-fists"], // Fists path — solo, action-heavy  
["d", "fate:item:path-team"],  // Team path — with Sophia, balanced
```

Path-conditional content uses standard `requires`:
```json
// Only visible on Wits path
["requires", "30078:<FA>:fate:item:path-wits", "", "This path is not available to you."]

// Only visible on Team path (Sophia present)
["requires", "30078:<FA>:fate:item:path-team", "", "You need Sophia for this."]

// Available on both Fists and Team
["requires-not", "30078:<FA>:fate:item:path-wits", "", ""]
```

---

## Places

### Barnett College (Opening)

---

```json
// Barnett College — Indy's Office (opening scene)
{
  "kind": 30078, "tags": [
    ["d", "fate:place:barnett-office"], ["t", "fate"], ["type", "place"],
    ["title", "Barnett College — Indy's Office"],
    ["noun",  "office", "indy's office", "room"],
    ["exit", "south"],
    ["exit", "east"],
    ["feature", "30078:<FA>:fate:feature:desk"],
    ["feature", "30078:<FA>:fate:feature:filing-cabinet"],
    ["feature", "30078:<FA>:fate:feature:office-bookshelf"],
    ["item",    "30078:<FA>:fate:item:journal"],
    ["on-enter","player", "set-state", "visited"]
  ],
  "content": "Your cluttered office at Barnett College. Papers and artefacts cover every surface. A stone idol sits on the desk."
}

// Barnett College — Hallway
{
  "kind": 30078, "tags": [
    ["d", "fate:place:barnett-hallway"], ["t", "fate"], ["type", "place"],
    ["title", "Barnett College — Hallway"],
    ["noun",  "hallway", "corridor", "hall"],
    ["exit", "north"],
    ["exit", "west"],
    ["npc",   "30078:<FA>:fate:npc:marcus"]
  ],
  "content": "The main hallway of Barnett College. Portraits of former deans line the walls."
}

// Barnett College — Library
{
  "kind": 30078, "tags": [
    ["d", "fate:place:barnett-library"], ["t", "fate"], ["type", "place"],
    ["title", "Barnett College — Library"],
    ["noun",  "library", "reading room"],
    ["exit", "west"],
    ["feature", "30078:<FA>:fate:feature:library-shelves"],
    ["feature", "30078:<FA>:fate:feature:plato-display"],
    ["item",    "30078:<FA>:fate:item:plato-lost-dialogue"]
  ],
  "content": "The college library. Rows of books stretch to the ceiling. A special display case holds a rare text."
}
```

---

### New York — Sophia's Apartment

---

```json
// Sophia's Apartment — Living Room
{
  "kind": 30078, "tags": [
    ["d", "fate:place:sophia-apartment"], ["t", "fate"], ["type", "place"],
    ["title", "Sophia's Apartment"],
    ["noun",  "apartment", "living room", "sophia's place"],
    ["exit", "north"],
    ["exit", "east"],
    ["feature", "30078:<FA>:fate:feature:sophia-bookshelf"],
    ["feature", "30078:<FA>:fate:feature:notice-board"],
    ["npc",   "30078:<FA>:fate:npc:sophia"]
  ],
  "content": "Sophia Hapgood's New York apartment. Atlantean artefacts and psychic memorabilia fill the shelves."
}

// Sophia's Apartment — Study
{
  "kind": 30078, "tags": [
    ["d", "fate:place:sophia-study"], ["t", "fate"], ["type", "place"],
    ["title", "Sophia's Study"],
    ["noun",  "study", "back room"],
    ["exit", "south"],
    ["feature", "30078:<FA>:fate:feature:necklace-display"],
    ["item",    "30078:<FA>:fate:item:nur-ab-sal-necklace"]
  ],
  "content": "A small study lined with notes and research. A necklace hangs in a display case on the wall."
}
```

---

### Iceland — Dig Site

---

```json
// Iceland — Exterior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:iceland-exterior"], ["t", "fate"], ["type", "place"],
    ["title", "Iceland — Volcanic Plain"],
    ["noun",  "exterior", "outside", "plain", "iceland"],
    ["exit", "north"],
    ["exit", "south"],
    ["exit", "east"],
    ["feature", "30078:<FA>:fate:feature:dig-tent"],
    ["feature", "30078:<FA>:fate:feature:dig-site"],
    ["npc",   "30078:<FA>:fate:npc:sternhart"]
  ],
  "content": "A bleak volcanic plain in Iceland. A dig tent stands near a recent excavation."
}

// Iceland — Ancient Chamber
{
  "kind": 30078, "tags": [
    ["d", "fate:place:iceland-chamber"], ["t", "fate"], ["type", "place"],
    ["title", "Iceland — Ancient Chamber"],
    ["noun",  "chamber", "underground chamber", "dig"],
    ["exit", "up"],
    ["feature", "30078:<FA>:fate:feature:stone-mechanism"],
    ["feature", "30078:<FA>:fate:feature:iceland-mural"],
    ["item",    "30078:<FA>:fate:item:stone-disk"]
  ],
  "content": "A chamber buried beneath the Icelandic plain. Ancient carvings cover the walls. A stone mechanism dominates the centre."
}
```

---

### Tikal — Path Choice

---

```json
// Tikal — Jungle Exterior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:tikal-exterior"], ["t", "fate"], ["type", "place"],
    ["title", "Tikal — Jungle"],
    ["noun",  "jungle", "tikal", "exterior"],
    ["exit", "north"],
    ["exit", "south"],
    ["exit", "east"],
    ["feature", "30078:<FA>:fate:feature:jungle-ruins"],
    ["npc",   "30078:<FA>:fate:npc:sophia"]
  ],
  "content": "Dense Guatemalan jungle surrounds the Mayan ruins of Tikal."
}

// Tikal — Ruins Interior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:tikal-ruins"], ["t", "fate"], ["type", "place"],
    ["title", "Tikal — Ruins Interior"],
    ["noun",  "ruins", "temple", "interior"],
    ["exit", "west"],
    ["exit", "down"],
    ["feature", "30078:<FA>:fate:feature:path-stone"],
    ["feature", "30078:<FA>:fate:feature:tikal-mural"]
  ],
  "content": "The interior of the ancient Mayan structure. Three carved paths are depicted on the central stone."
}

// Tikal — Path Choice Chamber (key moment)
{
  "kind": 30078, "tags": [
    ["d", "fate:place:tikal-choice"], ["t", "fate"], ["type", "place"],
    ["title", "Chamber of the Paths"],
    ["noun",  "choice chamber", "path chamber"],
    ["exit", "up"],
    ["feature", "30078:<FA>:fate:feature:three-paths-stone"],
    ["puzzle",  "30078:<FA>:fate:puzzle:path-choice"],
    ["npc",     "30078:<FA>:fate:npc:sophia"]
  ],
  "content": "Three ancient symbols are carved into the floor. Each represents a different path to Atlantis."
}
```

---

### Monte Carlo — Wits Path

---

```json
// Monte Carlo — Casino Exterior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:monte-carlo-exterior"], ["t", "fate"], ["type", "place"],
    ["title", "Monte Carlo — Casino Exterior"],
    ["noun",  "monte carlo", "casino exterior", "street"],
    ["requires", "30078:<FA>:fate:item:path-wits", "", "This location is only accessible on the Wits path."],
    ["exit", "north"],
    ["exit", "east"],
    ["npc",   "30078:<FA>:fate:npc:kerner"]
  ],
  "content": "The glamorous facade of a Monte Carlo casino. Elegantly dressed patrons come and go."
}

// Monte Carlo — Casino Interior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:monte-carlo-casino"], ["t", "fate"], ["type", "place"],
    ["title", "Monte Carlo — Casino"],
    ["noun",  "casino", "gambling hall"],
    ["requires", "30078:<FA>:fate:item:path-wits", "", "This location is only accessible on the Wits path."],
    ["exit", "south"],
    ["exit", "west"],
    ["feature", "30078:<FA>:fate:feature:roulette-table"],
    ["feature", "30078:<FA>:fate:feature:coat-check"],
    ["npc",     "30078:<FA>:fate:npc:casino-patron"]
  ],
  "content": "A glittering casino. The roulette wheel spins. Well-heeled gamblers try their luck."
}
```

---

### Algiers — Fists Path

---

```json
// Algiers — Market
{
  "kind": 30078, "tags": [
    ["d", "fate:place:algiers-market"], ["t", "fate"], ["type", "place"],
    ["title", "Algiers — Market"],
    ["noun",  "market", "algiers", "bazaar", "souk"],
    ["requires", "30078:<FA>:fate:item:path-fists", "", "This location is only accessible on the Fists path."],
    ["exit", "north"],
    ["exit", "east"],
    ["exit", "west"],
    ["feature", "30078:<FA>:fate:feature:market-stalls"],
    ["npc",     "30078:<FA>:fate:npc:ali"]
  ],
  "content": "A bustling Algerian market. Merchants hawk their wares from colourful stalls."
}

// Algiers — Kerner's Hideout
{
  "kind": 30078, "tags": [
    ["d", "fate:place:algiers-hideout"], ["t", "fate"], ["type", "place"],
    ["title", "Algiers — Hideout"],
    ["noun",  "hideout", "warehouse", "kerner's base"],
    ["requires", "30078:<FA>:fate:item:path-fists", "", "This location is only accessible on the Fists path."],
    ["exit", "south"],
    ["feature", "30078:<FA>:fate:feature:crates"],
    ["feature", "30078:<FA>:fate:feature:desk-papers"],
    ["npc",     "30078:<FA>:fate:npc:kerner"]
  ],
  "content": "A dusty warehouse used as a base of operations. Papers and equipment are scattered across a desk."
}
```

---

### Crete — All Paths

---

```json
// Crete — Knossos Exterior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:crete-exterior"], ["t", "fate"], ["type", "place"],
    ["title", "Crete — Knossos Exterior"],
    ["noun",  "knossos", "crete", "ruins exterior"],
    ["exit", "north"],
    ["exit", "east"],
    ["exit", "south"],
    ["feature", "30078:<FA>:fate:feature:knossos-gate"],
    ["npc",     "30078:<FA>:fate:npc:guard"]
  ],
  "content": "The sun-bleached ruins of ancient Knossos. The palace complex stretches out before you."
}

// Crete — Labyrinth Entrance
{
  "kind": 30078, "tags": [
    ["d", "fate:place:crete-labyrinth-entrance"], ["t", "fate"], ["type", "place"],
    ["title", "Labyrinth Entrance"],
    ["noun",  "labyrinth", "entrance", "maze entrance"],
    ["exit", "south"],
    ["exit", "down"],
    ["exit", "north"],
    ["feature", "30078:<FA>:fate:feature:labyrinth-door"],
    ["item",    "30078:<FA>:fate:item:stone-tablet"]
  ],
  "content": "The entrance to the legendary Labyrinth beneath Knossos. Ancient carvings mark the threshold."
}

// Crete — Labyrinth (multiple rooms, maze-like)
{
  "kind": 30078, "tags": [
    ["d", "fate:place:labyrinth-1"], ["t", "fate"], ["type", "place"],
    ["title", "Labyrinth"],
    ["noun",  "labyrinth", "maze", "passage"],
    ["exit", "north"], ["exit", "south"], ["exit", "east"], ["exit", "west"],
    ["requires", "30078:<FA>:fate:item:path-team", "", ""],
    ["npc",   "30078:<FA>:fate:npc:sophia"]
  ],
  "content": "A winding passage in the ancient labyrinth. The walls are damp and close."
}

// (labyrinth-2 through labyrinth-8 follow same pattern, asymmetric exits)

// Crete — Minotaur Chamber (Fists path only)
{
  "kind": 30078, "tags": [
    ["d", "fate:place:minotaur-chamber"], ["t", "fate"], ["type", "place"],
    ["title", "Minotaur Chamber"],
    ["noun",  "chamber", "minotaur room"],
    ["requires", "30078:<FA>:fate:item:path-fists", "", "This chamber is sealed on other paths."],
    ["exit", "west"],
    ["exit", "north"],
    ["feature", "30078:<FA>:fate:feature:stone-bull-head"],
    ["item",    "30078:<FA>:fate:item:bronze-gear"]
  ],
  "content": "A vast circular chamber. A great stone bull's head dominates the far wall."
}

// Crete — Omphalos Chamber
{
  "kind": 30078, "tags": [
    ["d", "fate:place:omphalos-chamber"], ["t", "fate"], ["type", "place"],
    ["title", "Omphalos Chamber"],
    ["noun",  "omphalos", "navel stone", "chamber"],
    ["exit", "south"],
    ["exit", "down"],
    ["feature", "30078:<FA>:fate:feature:omphalos-stone"],
    ["puzzle",  "30078:<FA>:fate:puzzle:omphalos-alignment"]
  ],
  "content": "A domed chamber at the heart of the labyrinth. A carved stone stands at the centre — the omphalos."
}
```

---

### Thera / Santorini

---

```json
// Thera — Volcano Exterior
{
  "kind": 30078, "tags": [
    ["d", "fate:place:thera-exterior"], ["t", "fate"], ["type", "place"],
    ["title", "Thera — Volcano Exterior"],
    ["noun",  "thera", "santorini", "volcano", "crater"],
    ["exit", "north"],
    ["exit", "down"],
    ["feature", "30078:<FA>:fate:feature:crater-edge"],
    ["feature", "30078:<FA>:fate:feature:dig-equipment"]
  ],
  "content": "The rim of the ancient volcanic crater on Thera. Far below, something glints in the darkness."
}

// Thera — Submarine Cave
{
  "kind": 30078, "tags": [
    ["d", "fate:place:thera-cave"], ["t", "fate"], ["type", "place"],
    ["title", "Thera — Submarine Cave"],
    ["noun",  "cave", "sea cave", "underwater cave"],
    ["exit", "up"],
    ["exit", "east"],
    ["feature", "30078:<FA>:fate:feature:cave-paintings"],
    ["feature", "30078:<FA>:fate:feature:sunken-column"],
    ["item",    "30078:<FA>:fate:item:trident-key"]
  ],
  "content": "A sea cave accessible only from below. Ancient paintings cover the walls, depicting the fall of Atlantis."
}

// Thera — Sunken Ruins
{
  "kind": 30078, "tags": [
    ["d", "fate:place:thera-ruins"], ["t", "fate"], ["type", "place"],
    ["title", "Thera — Sunken Ruins"],
    ["noun",  "ruins", "sunken city", "underwater ruins"],
    ["exit", "west"],
    ["exit", "north"],
    ["exit", "down"],
    ["feature", "30078:<FA>:fate:feature:atlantean-arch"],
    ["feature", "30078:<FA>:fate:feature:orichalcum-vein"],
    ["item",    "30078:<FA>:fate:item:orichalcum-beads"]
  ],
  "content": "Submerged ruins of what was once a great city. Orichalcum glimmers in the rock."
}
```

---

### Atlantis — Inner City

---

```json
// Atlantis — Outer Gate
{
  "kind": 30078, "tags": [
    ["d", "fate:place:atlantis-gate"], ["t", "fate"], ["type", "place"],
    ["title", "Atlantis — Outer Gate"],
    ["noun",  "gate", "outer gate", "atlantis entrance"],
    ["exit", "north"],
    ["exit", "south"],
    ["feature", "30078:<FA>:fate:feature:gate-mechanism"],
    ["puzzle",  "30078:<FA>:fate:puzzle:gate-bead-lock"],
    ["npc",     "30078:<FA>:fate:npc:atlantean-guard"]
  ],
  "content": "The monumental outer gate of Atlantis. Orichalcum inlays glow faintly in the stonework."
}

// Atlantis — Plaza
{
  "kind": 30078, "tags": [
    ["d", "fate:place:atlantis-plaza"], ["t", "fate"], ["type", "place"],
    ["title", "Atlantis — Plaza"],
    ["noun",  "plaza", "square", "centre"],
    ["exit", "north"], ["exit", "south"], ["exit", "east"], ["exit", "west"],
    ["feature", "30078:<FA>:fate:feature:orichalcum-fountain"],
    ["feature", "30078:<FA>:fate:feature:atlantean-inscriptions"],
    ["npc",     "30078:<FA>:fate:npc:atlanteans"]
  ],
  "content": "The central plaza of Atlantis. Orichalcum flows through channels in the paved floor."
}

// Atlantis — Bead Machine Chamber (key puzzle)
{
  "kind": 30078, "tags": [
    ["d", "fate:place:bead-machine-chamber"], ["t", "fate"], ["type", "place"],
    ["title", "Bead Machine Chamber"],
    ["noun",  "machine chamber", "bead room", "chamber"],
    ["exit", "south"],
    ["feature", "30078:<FA>:fate:feature:bead-machine"],
    ["puzzle",  "30078:<FA>:fate:puzzle:bead-configuration"]
  ],
  "content": "A chamber dominated by an ancient machine of Atlantean design. Slots for orichalcum beads line the face."
}

// Atlantis — Power Room
{
  "kind": 30078, "tags": [
    ["d", "fate:place:atlantis-power-room"], ["t", "fate"], ["type", "place"],
    ["title", "Atlantis — Power Room"],
    ["noun",  "power room", "generator", "engine"],
    ["exit", "south"],
    ["exit", "north"],
    ["feature", "30078:<FA>:fate:feature:power-conduit"],
    ["feature", "30078:<FA>:fate:feature:orichalcum-reactor"]
  ],
  "content": "The power core of Atlantis. Orichalcum energy flows through conduits in the walls."
}

// Atlantis — Throne Room
{
  "kind": 30078, "tags": [
    ["d", "fate:place:atlantis-throne"], ["t", "fate"], ["type", "place"],
    ["title", "Atlantis — Throne Room"],
    ["noun",  "throne room", "hall", "chamber"],
    ["exit", "south"],
    ["feature", "30078:<FA>:fate:feature:atlantean-throne"],
    ["feature", "30078:<FA>:fate:feature:god-machine"],
    ["npc",     "30078:<FA>:fate:npc:nur-ab-sal"],
    ["npc",     "30078:<FA>:fate:npc:sophia-possessed"]
  ],
  "content": "The throne room of Atlantis. The God Machine looms at the centre. Sophia stands before it, her eyes blank."
}
```

---

## Features

---

```json
// Desk (Barnett office)
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:desk"], ["t", "fate"], ["type", "feature"],
    ["title", "Cluttered Desk"],
    ["noun",  "desk", "table"],
    ["verb",  "examine", "look", "search"],
    ["on-interact","examine", "set-state", "visible", "30078:<FA>:fate:clue:desk-note"],
    ["description", "Your desk, buried under papers and artefacts."]
  ]
}

// Path Stone (Tikal choice chamber — the most important feature in the game)
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:three-paths-stone"], ["t", "fate"], ["type", "feature"],
    ["title", "The Three Paths Stone"],
    ["noun",  "stone", "paths stone", "carving", "floor"],
    ["state",      "unchosen"],
    ["transition", "unchosen", "chosen", "You press the symbol. The path is set."],
    ["verb",  "examine",  "look"],
    ["verb",  "touch",    "press", "use"],
    ["on-interact","examine", "set-state", "visible", "30078:<FA>:fate:clue:path-description"],
    ["on-interact","touch",   "set-state", "chosen"],
    ["description", "Three ancient symbols carved into the floor. Each glows faintly."]
  ]
}

// Nur-Ab-Sal Necklace Display
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:necklace-display"], ["t", "fate"], ["type", "feature"],
    ["title", "Necklace Display"],
    ["noun",  "display", "case", "necklace case"],
    ["state",      "closed"],
    ["transition", "closed", "open", "The case swings open."],
    ["verb",  "open",    "unlock"],
    ["verb",  "examine", "look"],
    ["on-interact","open", "set-state", "open"],
    ["on-interact","open", "give-item", "30078:<FA>:fate:item:nur-ab-sal-necklace"],
    ["description", "A glass display case containing an Atlantean necklace."]
  ]
}

// Bead Machine (key puzzle feature)
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:bead-machine"], ["t", "fate"], ["type", "feature"],
    ["title", "Bead Machine"],
    ["noun",  "machine", "bead machine", "device"],
    ["state",      "empty"],
    ["transition", "empty",      "loaded",   "You slot the beads into place."],
    ["transition", "loaded",     "aligned",  "The beads rotate into alignment. Something activates."],
    ["transition", "aligned",    "aligned",  "The machine is already aligned."],
    ["verb",  "examine",  "look", "inspect"],
    ["verb",  "use",      "insert", "place"],
    ["verb",  "turn",     "rotate", "adjust"],
    ["on-interact","examine", "set-state", "visible", "30078:<FA>:fate:clue:machine-instructions"],
    ["on-interact","use",     "set-state", "loaded"],
    ["on-interact","turn",    "set-state", "aligned"],
    ["requires",   "30078:<FA>:fate:item:orichalcum-beads", "shaped", "The beads don't fit yet."],
    ["description", "An ancient machine with slots arranged in a precise pattern."]
  ]
}

// Stone Mechanism (Iceland)
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:stone-mechanism"], ["t", "fate"], ["type", "feature"],
    ["title", "Stone Mechanism"],
    ["noun",  "mechanism", "stone wheel", "device"],
    ["state",      "locked"],
    ["transition", "locked",  "open",   "The mechanism turns with a grinding sound. A passage opens."],
    ["transition", "open",    "open",   "The mechanism is already open."],
    ["verb",  "examine", "look"],
    ["verb",  "use",     "turn", "push", "pull"],
    ["requires",   "30078:<FA>:fate:item:stone-disk", "", "Something is missing from the mechanism."],
    ["on-interact","use", "set-state", "open"],
    ["on-interact","use", "set-state", "visible", "30078:<FA>:fate:portal:iceland-to-chamber"],
    ["description", "A circular stone mechanism set into the wall. A disc-shaped recess sits at its centre."]
  ]
}

// Omphalos Stone
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:omphalos-stone"], ["t", "fate"], ["type", "feature"],
    ["title", "Omphalos Stone"],
    ["noun",  "omphalos", "stone", "navel stone"],
    ["state",      "inert"],
    ["transition", "inert",    "resonating", "The stone begins to hum as the tablet's symbols align."],
    ["transition", "resonating","activated", "A deep vibration fills the chamber. The passage below opens."],
    ["verb",  "examine",  "look"],
    ["verb",  "use",      "touch", "activate"],
    ["verb",  "place",    "put"],
    ["requires",   "30078:<FA>:fate:item:stone-tablet", "", "The stone responds to nothing."],
    ["on-interact","use",  "set-state", "resonating"],
    ["on-interact","use",  "set-state", "visible", "30078:<FA>:fate:portal:crete-to-atlantis"],
    ["description", "A rounded stone carved with concentric circles. The navel of the world."]
  ]
}

// God Machine (endgame — three paths diverge here)
{
  "kind": 30078, "tags": [
    ["d", "fate:feature:god-machine"], ["t", "fate"], ["type", "feature"],
    ["title", "The God Machine"],
    ["noun",  "machine", "god machine", "device"],
    ["state",      "dormant"],
    ["transition", "dormant",   "active",   "The machine roars to life. Orichalcum energy crackles."],
    ["transition", "active",    "critical", "The machine overloads. Atlantis shakes."],
    ["transition", "critical",  "destroyed","The machine tears itself apart."],
    ["verb",  "examine",  "look", "inspect"],
    ["verb",  "activate", "use",  "start"],
    ["verb",  "destroy",  "smash","sabotage"],
    ["on-interact","activate", "set-state", "active"],
    ["on-interact","activate", "consequence","30078:<FA>:fate:consequence:atlantis-sinks"],
    ["on-interact","destroy",  "set-state",  "destroyed"],
    ["on-interact","destroy",  "consequence","30078:<FA>:fate:consequence:atlantis-survives"],
    ["description", "An enormous machine of orichalcum and stone. Its purpose is unclear — and terrifying."]
  ]
}
```

---

## Items

---

```json
// Indy's Journal
{
  "kind": 30078, "tags": [
    ["d", "fate:item:journal"], ["t", "fate"], ["type", "item"],
    ["title", "Indy's Journal"],
    ["noun",  "journal", "diary", "notebook", "book"],
    ["verb",  "read", "examine", "open"],
    ["on-interact","read", "set-state", "visible", "30078:<FA>:fate:clue:journal-contents"],
    ["description", "Your battered field journal. Years of notes and sketches fill its pages."]
  ]
}

// Plato's Lost Dialogue
{
  "kind": 30078, "tags": [
    ["d", "fate:item:plato-lost-dialogue"], ["t", "fate"], ["type", "item"],
    ["title", "Plato's Lost Dialogue"],
    ["noun",  "dialogue", "plato", "manuscript", "text", "book"],
    ["verb",  "read",    "examine"],
    ["on-interact","read", "set-state", "visible", "30078:<FA>:fate:clue:plato-atlantis-clue"],
    ["description", "A previously unknown dialogue by Plato. It contains detailed descriptions of Atlantis."]
  ]
}

// Nur-Ab-Sal Necklace
{
  "kind": 30078, "tags": [
    ["d", "fate:item:nur-ab-sal-necklace"], ["t", "fate"], ["type", "item"],
    ["title", "Atlantean Necklace"],
    ["noun",  "necklace", "pendant", "amulet", "atlantean necklace"],
    ["state",      "inert"],
    ["transition", "inert", "active", "The necklace pulses with Atlantean energy."],
    ["verb",  "wear",    "put on", "use"],
    ["verb",  "examine", "look"],
    ["on-interact","wear", "set-state", "active"],
    ["on-interact","wear", "consequence", "30078:<FA>:fate:consequence:nur-ab-sal-speaks"],
    ["description", "An Atlantean necklace. It hums faintly when held."]
  ]
}

// Stone Disk
{
  "kind": 30078, "tags": [
    ["d", "fate:item:stone-disk"], ["t", "fate"], ["type", "item"],
    ["title", "Stone Disk"],
    ["noun",  "disk", "stone disk", "disc"],
    ["description", "A perfectly circular stone disk. Symbols are carved into its face."]
  ]
}

// Orichalcum Beads — the central puzzle item
{
  "kind": 30078, "tags": [
    ["d", "fate:item:orichalcum-beads"], ["t", "fate"], ["type", "item"],
    ["title", "Orichalcum Beads"],
    ["noun",  "beads", "orichalcum", "orichalcum beads"],
    ["state",       "raw"],
    ["transition",  "raw",    "shaped",  "You carefully shape the orichalcum into the required form."],
    ["transition",  "shaped", "used",    "You insert the beads into the machine."],
    ["verb",        "examine","look"],
    ["verb",        "shape",  "work",   "carve", "mould"],
    ["on-interact", "shape",  "set-state", "shaped"],
    ["description", "Beads of raw orichalcum. The metal glows faintly orange."]
  ]
}

// Stone Tablet (Crete)
{
  "kind": 30078, "tags": [
    ["d", "fate:item:stone-tablet"], ["t", "fate"], ["type", "item"],
    ["title", "Stone Tablet"],
    ["noun",  "tablet", "stone tablet", "slab"],
    ["verb",  "read",    "examine"],
    ["on-interact","read", "set-state", "visible", "30078:<FA>:fate:clue:tablet-inscription"],
    ["description", "A stone tablet covered in Atlantean script."]
  ]
}

// Trident Key
{
  "kind": 30078, "tags": [
    ["d", "fate:item:trident-key"], ["t", "fate"], ["type", "item"],
    ["title", "Trident Key"],
    ["noun",  "key", "trident", "trident key"],
    ["description", "A key shaped like a trident. Clearly Atlantean in origin."]
  ]
}

// Whip (Indy's signature item — always carried)
{
  "kind": 30078, "tags": [
    ["d", "fate:item:whip"], ["t", "fate"], ["type", "item"],
    ["title", "Bullwhip"],
    ["noun",  "whip", "bullwhip", "lash"],
    ["verb",  "use",   "swing", "crack", "throw"],
    ["verb",  "examine","look"],
    ["description", "Your trusty bullwhip. It's gotten you out of more than a few scrapes."]
  ]
}

// Revolver
{
  "kind": 30078, "tags": [
    ["d", "fate:item:revolver"], ["t", "fate"], ["type", "item"],
    ["title", "Revolver"],
    ["noun",  "gun", "revolver", "pistol"],
    ["state",           "loaded"],
    ["counter",         "bullets", "6"],
    ["transition",      "loaded", "empty", "The gun clicks on an empty chamber."],
    ["verb",            "use",    "fire", "shoot"],
    ["verb",            "examine","look"],
    ["on-interact",     "use",    "deal-damage-npc", ""],
    ["on-interact",     "use",    "decrement",       "bullets"],
    ["on-counter", "bullets", "0","set-state",       "empty"],
    ["description", "A standard .38 revolver."]
  ]
}

// Path items (given on path choice)
{
  "kind": 30078, "tags": [
    ["d", "fate:item:path-wits"], ["t", "fate"], ["type", "item"],
    ["title", "Wits Path"],
    ["noun",  "wits"],
    ["description", "You have chosen the path of the mind."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:item:path-fists"], ["t", "fate"], ["type", "item"],
    ["title", "Fists Path"],
    ["noun",  "fists"],
    ["description", "You have chosen the path of brawn."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:item:path-team"], ["t", "fate"], ["type", "item"],
    ["title", "Team Path"],
    ["noun",  "team"],
    ["description", "You have chosen the path of partnership."]
  ]
}
```

---

## NPCs

---

```json
// Sophia Hapgood — companion on Team path, present throughout
{
  "kind": 30078, "tags": [
    ["d", "fate:npc:sophia"], ["t", "fate"], ["type", "npc"],
    ["title", "Sophia Hapgood"],
    ["noun",  "sophia", "hapgood", "she", "her", "woman"],
    ["health",       "20"],
    ["state",        "normal"],
    ["transition",   "normal",    "possessed", "Sophia's eyes go blank. Nur-Ab-Sal speaks through her."],
    ["transition",   "possessed", "freed",     "The spirit is driven out. Sophia collapses."],
    ["transition",   "freed",     "freed",     "Sophia is free."],
    ["on-encounter", "player",    "deal-damage","0"],
    ["on-attacked",  "player",    "deal-damage","0"],
    ["on-health-zero","consequence","30078:<FA>:fate:consequence:sophia-freed"],
    ["dialogue",     "30078:<FA>:fate:dialogue:sophia:greeting"],
    ["dialogue",     "30078:<FA>:fate:dialogue:sophia:after-necklace",  "30078:<FA>:fate:item:nur-ab-sal-necklace",  "active"],
    ["dialogue",     "30078:<FA>:fate:dialogue:sophia:possessed",       "30078:<FA>:fate:npc:sophia",               "possessed"],
    ["description",  "Sophia Hapgood. Former adventurer and psychic. She knows more about Atlantis than she lets on."]
  ]
}

// Klaus Kerner — primary antagonist
{
  "kind": 30078, "tags": [
    ["d", "fate:npc:kerner"], ["t", "fate"], ["type", "npc"],
    ["title", "Klaus Kerner"],
    ["noun",  "kerner", "nazi", "agent", "german", "man"],
    ["health",       "15"],
    ["damage",       "4"],
    ["hit-chance",   "0.7"],
    ["state",        "hostile"],
    ["transition",   "hostile",  "fled",  "Kerner retreats, vowing revenge."],
    ["transition",   "fled",     "fled",  "Kerner has fled."],
    ["transition",   "dead",     "dead",  "Kerner is dead."],
    ["on-encounter", "player",   "deal-damage",  "4"],
    ["on-attacked",  "player",   "deal-damage",  "4"],
    ["on-health-zero","consequence","30078:<FA>:fate:consequence:kerner-defeated"],
    ["dialogue",     "30078:<FA>:fate:dialogue:kerner:greeting"],
    ["description",  "Klaus Kerner. A cold-eyed Nazi agent. He wants Atlantis for the Reich."]
  ]
}

// Nur-Ab-Sal — Atlantean spirit, possesses Sophia
{
  "kind": 30078, "tags": [
    ["d", "fate:npc:nur-ab-sal"], ["t", "fate"], ["type", "npc"],
    ["title", "Nur-Ab-Sal"],
    ["noun",  "nur-ab-sal", "spirit", "atlantean", "voice"],
    ["state",        "dormant"],
    ["transition",   "dormant",  "active",   "Nur-Ab-Sal's presence fills the room."],
    ["transition",   "active",   "expelled", "The ancient spirit is driven back."],
    ["transition",   "expelled", "expelled", "Nur-Ab-Sal is gone."],
    ["requires",     "30078:<FA>:fate:item:nur-ab-sal-necklace", "active", ""],
    ["on-encounter", "player",    "deal-damage", "0"],
    ["dialogue",     "30078:<FA>:fate:dialogue:nur-ab-sal:greeting"],
    ["description",  "An ancient Atlantean spirit. Bound to the necklace. Not entirely unfriendly — yet."]
  ]
}

// Sophia Possessed — separate NPC state for endgame
{
  "kind": 30078, "tags": [
    ["d", "fate:npc:sophia-possessed"], ["t", "fate"], ["type", "npc"],
    ["title", "Sophia (Possessed)"],
    ["noun",  "sophia", "hapgood", "she", "her", "woman"],
    ["requires",     "30078:<FA>:fate:npc:sophia", "possessed", ""],
    ["health",       "1"],
    ["on-health-zero","consequence","30078:<FA>:fate:consequence:sophia-freed"],
    ["dialogue",     "30078:<FA>:fate:dialogue:sophia:possessed"],
    ["description",  "Sophia stands motionless. Nur-Ab-Sal speaks from behind her eyes."]
  ]
}

// Marcus Brody — mentor, Barnett College
{
  "kind": 30078, "tags": [
    ["d", "fate:npc:marcus"], ["t", "fate"], ["type", "npc"],
    ["title", "Marcus Brody"],
    ["noun",  "marcus", "brody", "dean"],
    ["dialogue",    "30078:<FA>:fate:dialogue:marcus:greeting"],
    ["description", "Dean Marcus Brody. Your friend and colleague at Barnett College."]
  ]
}

// Sternhart — double agent, Iceland
{
  "kind": 30078, "tags": [
    ["d", "fate:npc:sternhart"], ["t", "fate"], ["type", "npc"],
    ["title", "Sternhart"],
    ["noun",  "sternhart", "man", "archaeologist"],
    ["state",     "friendly"],
    ["transition","friendly", "hostile", "Sternhart drops the pretence."],
    ["dialogue",  "30078:<FA>:fate:dialogue:sternhart:greeting"],
    ["dialogue",  "30078:<FA>:fate:dialogue:sternhart:revealed", "30078:<FA>:fate:puzzle:sternhart-reveal", "solved"],
    ["description","A fellow archaeologist at the Icelandic dig. Something about him feels off."]
  ]
}
```

---

## Portals

Exit shape: `["exit", "<place-ref>", "<slot>", "<label?>"]`

---

```json
// ── BARNETT COLLEGE ───────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:office-to-hallway"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:barnett-office", "south", "The hallway lies to the south."],
    ["exit", "30078:<FA>:fate:place:barnett-hallway", "north", "Your office is to the north."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:hallway-to-library"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:barnett-hallway", "east", "The library lies to the east."],
    ["exit", "30078:<FA>:fate:place:barnett-library", "west", "The hallway lies to the west."]
  ]
}

// ── NEW YORK ──────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:apartment-to-study"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:sophia-apartment", "east", "The study is through the east door."],
    ["exit", "30078:<FA>:fate:place:sophia-study", "west", "The living room lies to the west."]
  ]
}

// ── ICELAND ───────────────────────────────────────────────────────────────────

// Iceland to Chamber — hidden until stone mechanism activated
{
  "kind": 30078, "tags": [
    ["d", "fate:portal:iceland-to-chamber"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:iceland-exterior", "down", "A passage leads below."],
    ["exit", "30078:<FA>:fate:place:iceland-chamber", "up", "The surface is above."],
    ["state",    "hidden"],
    ["requires", "30078:<FA>:fate:feature:stone-mechanism", "open", "There is no passage here."]
  ]
}

// ── TIKAL ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:tikal-to-ruins"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:tikal-exterior", "north", "The ruins lie to the north."],
    ["exit", "30078:<FA>:fate:place:tikal-ruins", "south", "The jungle exterior is to the south."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:ruins-to-choice"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:tikal-ruins", "down", "A passage leads deeper."],
    ["exit", "30078:<FA>:fate:place:tikal-choice", "up", "The ruins above."]
  ]
}

// ── CRETE ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:crete-to-labyrinth-entrance"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:crete-exterior", "east", "The labyrinth entrance lies to the east."],
    ["exit", "30078:<FA>:fate:place:crete-labyrinth-entrance", "west", "The exterior is to the west."]
  ]
}

// Labyrinth Entry — requires key for some paths
{
  "kind": 30078, "tags": [
    ["d", "fate:portal:labyrinth-to-maze"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:crete-labyrinth-entrance", "down", "The labyrinth descends."],
    ["exit", "30078:<FA>:fate:place:labyrinth-1", "up", "The entrance is above."],
    ["requires","30078:<FA>:fate:item:trident-key", "", "The labyrinth is sealed."]
  ]
}

// Crete to Atlantis — hidden until omphalos activated
{
  "kind": 30078, "tags": [
    ["d", "fate:portal:crete-to-atlantis"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:omphalos-chamber", "down", "A passage spirals downward into the earth."],
    ["exit", "30078:<FA>:fate:place:atlantis-gate", "up", "The passage leads back up."],
    ["state",    "hidden"],
    ["requires", "30078:<FA>:fate:feature:omphalos-stone", "activated", "There is no way forward."]
  ]
}

// Minotaur Chamber (Fists path only)
{
  "kind": 30078, "tags": [
    ["d", "fate:portal:labyrinth-to-minotaur"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:labyrinth-4", "north", "A heavy door leads north."],
    ["exit", "30078:<FA>:fate:place:minotaur-chamber", "south", "The labyrinth lies to the south."],
    ["requires","30078:<FA>:fate:item:path-fists", "", "This path is not available to you."]
  ]
}

// ── THERA ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:thera-to-cave"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:thera-exterior", "down", "The cave entrance is below."],
    ["exit", "30078:<FA>:fate:place:thera-cave", "up", "The surface is above."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:thera-cave-to-ruins"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:thera-cave", "east", "The ruins lie to the east."],
    ["exit", "30078:<FA>:fate:place:thera-ruins", "west", "The cave is to the west."]
  ]
}

// ── ATLANTIS ──────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:atlantis-gate-to-plaza"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:atlantis-gate", "north", "The city lies beyond."],
    ["exit", "30078:<FA>:fate:place:atlantis-plaza", "south", "The gate is to the south."],
    ["requires","30078:<FA>:fate:puzzle:gate-bead-lock", "solved", "The gate is sealed. Orichalcum beads are needed."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:plaza-to-bead-chamber"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:atlantis-plaza", "north", "The machine chamber lies north."],
    ["exit", "30078:<FA>:fate:place:bead-machine-chamber", "south", "The plaza is to the south."]
  ]
}

{
  "kind": 30078, "tags": [
    ["d", "fate:portal:plaza-to-throne"], ["t", "fate"], ["type", "portal"],
    ["exit", "30078:<FA>:fate:place:atlantis-plaza", "east", "The throne room lies east."],
    ["exit", "30078:<FA>:fate:place:atlantis-throne", "west", "The plaza is to the west."],
    ["requires","30078:<FA>:fate:feature:bead-machine",  "aligned", "The path to the throne room is sealed."]
  ]
}
```

---

## Puzzles

---

```json
// Path Choice — the central branching puzzle
{
  "kind": 30078, "tags": [
    ["d",           "fate:puzzle:path-choice"], ["t", "fate"], ["type", "puzzle"],
    ["puzzle-type", "observe"],
    ["on-complete", "", "give-item",  "30078:<FA>:fate:item:path-wits"],
    ["on-complete", "", "give-item",  "30078:<FA>:fate:item:path-fists"],
    ["on-complete", "", "give-item",  "30078:<FA>:fate:item:path-team"],
    ["on-complete", "", "set-state",  "solved"]
  ],
  "content": "Three paths lie before you. The mind. The fist. The heart. Choose wisely — the path cannot be changed."
}
```

> Note: The path choice puzzle fires `give-item` for one of the three path items based on player input — the client presents the choice and gives only the selected item. This is a UI-layer decision: the puzzle fires the appropriate `on-complete` action based on which symbol the player pressed.

```json
// Gate Bead Lock — requires shaped orichalcum
{
  "kind": 30078, "tags": [
    ["d",           "fate:puzzle:gate-bead-lock"], ["t", "fate"], ["type", "puzzle"],
    ["puzzle-type", "sequence"],
    ["ordered",     "false"],
    ["requires",    "30078:<FA>:fate:item:orichalcum-beads", "shaped", "The gate mechanism needs shaped orichalcum."],
    ["on-complete", "", "set-state", "solved"]
  ],
  "content": "Slots in the gate mechanism. They seem to require orichalcum beads of a specific shape."
}

// Omphalos Alignment — requires stone tablet
{
  "kind": 30078, "tags": [
    ["d",           "fate:puzzle:omphalos-alignment"], ["t", "fate"], ["type", "puzzle"],
    ["puzzle-type", "sequence"],
    ["ordered",     "true"],
    ["requires",    "30078:<FA>:fate:item:stone-tablet",  "", "The tablet's symbols must be used."],
    ["requires",    "30078:<FA>:fate:feature:omphalos-stone", "resonating", "The stone is not yet resonating."],
    ["on-complete", "", "set-state",  "solved"],
    ["on-complete", "", "set-state",  "activated", "30078:<FA>:fate:feature:omphalos-stone"]
  ],
  "content": "The tablet's symbols and the stone's carvings must be brought into alignment."
}

// Bead Configuration — the central Atlantis puzzle
{
  "kind": 30078, "tags": [
    ["d",           "fate:puzzle:bead-configuration"], ["t", "fate"], ["type", "puzzle"],
    ["puzzle-type", "sequence"],
    ["ordered",     "true"],
    ["requires",    "30078:<FA>:fate:item:orichalcum-beads", "shaped", "The beads must be shaped first."],
    ["requires",    "30078:<FA>:fate:feature:bead-machine",  "loaded", "The beads must be loaded into the machine."],
    ["on-complete", "", "set-state",  "solved"],
    ["on-complete", "", "set-state",  "aligned", "30078:<FA>:fate:feature:bead-machine"]
  ],
  "content": "The beads must be arranged in the correct configuration."
}

// Sternhart Reveal — dialogue puzzle, wits path
{
  "kind": 30078, "tags": [
    ["d",           "fate:puzzle:sternhart-reveal"], ["t", "fate"], ["type", "puzzle"],
    ["puzzle-type", "observe"],
    ["requires",    "30078:<FA>:fate:item:path-wits", "", "Only available on the Wits path."],
    ["on-complete", "", "set-state",  "hostile", "30078:<FA>:fate:npc:sternhart"],
    ["on-complete", "", "set-state",  "solved"]
  ],
  "content": "Sternhart's story doesn't add up. The right questions will expose him."
}
```

---

## Recipes

---

```json
// Shape Orichalcum Beads — combine raw beads with stone-working knowledge
{
  "kind": 30078, "tags": [
    ["d",           "fate:recipe:shape-beads"], ["t", "fate"], ["type", "recipe"],
    ["state",       "unknown"],
    ["transition",  "unknown", "known", "You understand how to shape the orichalcum."],
    ["requires",    "30078:<FA>:fate:item:orichalcum-beads", "raw",  "You need the raw orichalcum beads."],
    ["requires",    "30078:<FA>:fate:item:stone-tablet",     "",     "The tablet shows the required shapes."],
    ["on-complete", "", "set-state", "shaped", "30078:<FA>:fate:item:orichalcum-beads"],
    ["ordered",     "false"]
  ]
}
```

---

## Consequences

---

```json
// Nur-Ab-Sal Speaks — when necklace worn
{
  "kind": 30078, "tags": [
    ["d", "fate:consequence:nur-ab-sal-speaks"], ["t", "fate"], ["type", "consequence"],
    ["set-state", "active", "30078:<FA>:fate:npc:nur-ab-sal"]
  ],
  "content": "A voice fills your mind. Ancient. Cold. Curious."
}

// Sophia Freed — when possessed Sophia defeated
{
  "kind": 30078, "tags": [
    ["d", "fate:consequence:sophia-freed"], ["t", "fate"], ["type", "consequence"],
    ["set-state", "freed", "30078:<FA>:fate:npc:sophia"]
  ],
  "content": "The spirit is driven out. Sophia collapses to the floor, gasping."
}

// Kerner Defeated
{
  "kind": 30078, "tags": [
    ["d", "fate:consequence:kerner-defeated"], ["t", "fate"], ["type", "consequence"]
  ],
  "content": "Kerner retreats, defeated. He won't be a problem — for now."
}

// Atlantis Sinks — bad ending
{
  "kind": 30078, "tags": [
    ["d", "fate:consequence:atlantis-sinks"], ["t", "fate"], ["type", "consequence"],
    ["respawn",  "30078:<FA>:fate:place:atlantis-endgame-bad"]
  ],
  "content": "The God Machine overloads. Atlantis tears itself apart. You escape as the city collapses into the sea."
}

// Atlantis Survives — good ending
{
  "kind": 30078, "tags": [
    ["d", "fate:consequence:atlantis-survives"], ["t", "fate"], ["type", "consequence"],
    ["respawn",  "30078:<FA>:fate:place:atlantis-endgame-good"]
  ],
  "content": "The machine is destroyed. Atlantis is saved — though you'll never tell the world."
}
```

---

## Dialogue Nodes (selected)

---

```json
// ── SOPHIA ────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "fate:dialogue:sophia:greeting"], ["t", "fate"], ["type", "dialogue"],
    ["text",   "'Indy. It's been a while. I suppose you want something.'"],
    ["option", "Ask about Atlantis",      "30078:<FA>:fate:dialogue:sophia:atlantis"],
    ["option", "Ask about the necklace",  "30078:<FA>:fate:dialogue:sophia:necklace"],
    ["option", "Ask her to join you",     "30078:<FA>:fate:dialogue:sophia:join"],
    ["option", "Leave",                   ""]
  ]
}

{
  "kind": 30078, "tags": [
    ["d",       "fate:dialogue:sophia:atlantis"], ["t", "fate"], ["type", "dialogue"],
    ["text",    "'Atlantis. Of course. Nur-Ab-Sal showed me things in my visions. Things I can't explain.'"],
    ["on-enter","player", "set-state", "visited"],
    ["option",  "Ask about Nur-Ab-Sal", "30078:<FA>:fate:dialogue:sophia:nur-ab-sal"],
    ["option",  "Ask about the visions","30078:<FA>:fate:dialogue:sophia:visions"],
    ["option",  "Leave",                ""]
  ]
}

{
  "kind": 30078, "tags": [
    ["d",        "fate:dialogue:sophia:join"], ["t", "fate"], ["type", "dialogue"],
    ["requires", "30078:<FA>:fate:item:path-team", "", ""],
    ["text",     "'Join you? ...All right, Indy. But you owe me.'"],
    ["on-enter", "player", "consequence", "30078:<FA>:fate:consequence:sophia-joins"],
    ["option",   "", ""]
  ]
}

// Sophia possessed — entry point when NPC in possessed state
{
  "kind": 30078, "tags": [
    ["d",      "fate:dialogue:sophia:possessed"], ["t", "fate"], ["type", "dialogue"],
    ["text",   "'Jones. You are too late. Atlantis belongs to Nur-Ab-Sal.'"],
    ["option", "Attack",      "30078:<FA>:fate:dialogue:sophia:possessed-fight"],
    ["option", "Reason with her", "30078:<FA>:fate:dialogue:sophia:possessed-reason"],
    ["option", "Back away",   ""]
  ]
}

// ── NUR-AB-SAL ────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",        "fate:dialogue:nur-ab-sal:greeting"], ["t", "fate"], ["type", "dialogue"],
    ["requires", "30078:<FA>:fate:item:nur-ab-sal-necklace", "active", ""],
    ["text",     "'So. A new visitor to the ruins of my city. What do you seek, Jones?'"],
    ["option",   "Ask about Atlantis",       "30078:<FA>:fate:dialogue:nur-ab-sal:atlantis"],
    ["option",   "Ask about the God Machine","30078:<FA>:fate:dialogue:nur-ab-sal:machine"],
    ["option",   "Ask about Sophia",         "30078:<FA>:fate:dialogue:nur-ab-sal:sophia"],
    ["option",   "Leave",                    ""]
  ]
}

{
  "kind": 30078, "tags": [
    ["d",      "fate:dialogue:nur-ab-sal:machine"], ["t", "fate"], ["type", "dialogue"],
    ["text",   "'The God Machine was our greatest achievement. And our greatest folly. It destroyed us once. It need not again.'"],
    ["on-enter","player", "set-state", "visible", "30078:<FA>:fate:clue:god-machine-warning"],
    ["option",  "Ask what happened",   "30078:<FA>:fate:dialogue:nur-ab-sal:history"],
    ["option",  "Leave",               ""]
  ]
}

// ── KERNER ────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "fate:dialogue:kerner:greeting"], ["t", "fate"], ["type", "dialogue"],
    ["text",   "'Dr Jones. We meet at last. You have something I need.'"],
    ["option", "Refuse",          "30078:<FA>:fate:dialogue:kerner:refused"],
    ["option", "Ask what he wants","30078:<FA>:fate:dialogue:kerner:wants"],
    ["option", "Fight",           "30078:<FA>:fate:dialogue:kerner:fight"]
  ]
}

// ── MARCUS ────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",      "fate:dialogue:marcus:greeting"], ["t", "fate"], ["type", "dialogue"],
    ["text",   "'Indy! I'm glad you're here. That man, Kerner — he was asking about Plato's dialogues.'"],
    ["option", "Ask about Kerner",           "30078:<FA>:fate:dialogue:marcus:kerner"],
    ["option", "Ask about Plato's Atlantis", "30078:<FA>:fate:dialogue:marcus:atlantis"],
    ["option", "Leave",                       ""]
  ]
}
```

---

## Schema Notes

Observations from mapping Fate of Atlantis against the schema:

- **Three-path system** maps cleanly as player state items — `path-wits`, `path-fists`, `path-team`. Places, portals, and puzzles carry `requires` on the appropriate path item. The world graph is one graph; paths gate visibility within it. No duplication needed.
- **Companion NPC** — Sophia uses `requires npc present` on team-path content. The `requires-not` pattern handles her absence on other paths cleanly.
- **NPC state machine** — Sophia's `normal → possessed → freed` transition is a full state machine, just like a feature. `requires` on her NPC event gates what's visible at each stage.
- **Possessed NPC as separate event** — Sophia possessed is modelled as a separate NPC event with `requires sophia possessed` — cleaner than trying to gate all behaviour from one event.
- **Dialogue entry points** — multiple `dialogue` tags on Sophia and Nur-Ab-Sal allow conversations to resume at appropriate depth based on what's already happened.
- **Path choice puzzle** — the three-way choice fires different `give-item` actions. The client presents the choice; the puzzle fires the right action. `puzzle-type: observe` is the closest hint.
- **Orichalcum bead chain** — raw → shaped → loaded → aligned is a multi-step item/feature state chain. Recipe handles the shaping step; the bead machine feature handles loading and alignment.
- **Two-noun commands** — `use beads on machine`, `give necklace to sophia`, `hit kerner with whip` all work naturally via the parser. The whip is the instrument; the target NPC is the direct object.
- **Endgame consequences** — three different endings expressed as different consequences fired by the God Machine feature's `on-interact` handlers. No special endgame logic needed.
- **No special path logic in client** — the path system requires zero special-case client code. It's entirely expressed through `requires` on events. A client that evaluates `requires` correctly handles all three paths automatically.

*Indiana Jones and the Fate of Atlantis © LucasArts — reference/analysis document only*
