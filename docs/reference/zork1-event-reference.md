# Zork 1 — Complete Event Reference (v3)
*Written against the final the-lake schema*

All events: `kind: 30078`, `t: zork1`  
Author pubkey placeholder: `<ZA>`  
A-tag format: `30078:<ZA>:zork1:<type>:<name>`

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

## Places

### Above Ground

---

```json
// West of House — genesis place
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:west-of-house"], ["t", "zork1"], ["type", "place"],
    ["title", "West of House"],
    ["noun",  "field", "clearing", "west"],
    ["exit", "north"],
    ["exit", "south"],
    ["exit", "east"],
    ["feature", "30078:<ZA>:zork1:feature:white-house"],
    ["feature", "30078:<ZA>:zork1:feature:small-mailbox"],
    ["item",    "30078:<ZA>:zork1:item:leaflet"],
    ["on-enter","player", "set-state", "visited"]
  ],
  "content": "You are standing in an open field west of a white house, with a boarded front door. There is a small mailbox here."
}

// North of House
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:north-of-house"], ["t", "zork1"], ["type", "place"],
    ["title", "North of House"],
    ["noun",  "north", "north side"],
    ["exit", "west"],
    ["exit", "east"],
    ["exit", "path"],
    ["feature", "30078:<ZA>:zork1:feature:white-house-north"]
  ],
  "content": "You are facing the north side of a white house. There is no door here, and all the windows are boarded up. To the north a narrow path winds through the trees."
}

// South of House
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:south-of-house"], ["t", "zork1"], ["type", "place"],
    ["title", "South of House"],
    ["noun",  "south", "south side"],
    ["exit", "west"],
    ["exit", "east"],
    ["feature", "30078:<ZA>:zork1:feature:white-house-south"]
  ],
  "content": "You are facing the south side of a white house. There is no door here, and all the windows are boarded."
}

// Behind House
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:behind-house"], ["t", "zork1"], ["type", "place"],
    ["title", "Behind House"],
    ["noun",  "back", "rear", "behind"],
    ["exit", "north"],
    ["exit", "south"],
    ["exit", "east"],
    ["feature", "30078:<ZA>:zork1:feature:kitchen-window"]
  ],
  "content": "You are behind the white house. A path leads into the forest to the east. In one corner of the house there is a window which is slightly ajar."
}

// Kitchen
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:kitchen"], ["t", "zork1"], ["type", "place"],
    ["title", "Kitchen"],
    ["noun",  "kitchen"],
    ["exit", "west"],
    ["exit", "up"],
    ["feature", "30078:<ZA>:zork1:feature:kitchen-window"],
    ["item",    "30078:<ZA>:zork1:item:brown-sack"],
    ["item",    "30078:<ZA>:zork1:item:bottle-of-water"]
  ],
  "content": "You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward."
}

// Living Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:living-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Living Room"],
    ["noun",  "living room", "lounge"],
    ["exit", "east"],
    ["exit", "west"],
    ["exit", "down"],
    ["feature", "30078:<ZA>:zork1:feature:trophy-case"],
    ["feature", "30078:<ZA>:zork1:feature:large-rug"],
    ["feature", "30078:<ZA>:zork1:feature:painting-on-wall"],
    ["feature", "30078:<ZA>:zork1:feature:sword-on-wall"],
    ["item",    "30078:<ZA>:zork1:item:brass-lantern"]
  ],
  "content": "You are in the living room. There is a doorway to the east, a wooden door with strange gothic lettering to the west, and a large oriental rug in the center of the place."
}

// Attic
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:attic"], ["t", "zork1"], ["type", "place"],
    ["title", "Attic"],
    ["noun",  "attic", "loft"],
    ["exit", "down"],
    ["item",  "30078:<ZA>:zork1:item:rope"],
    ["item",  "30078:<ZA>:zork1:item:knife"]
  ],
  "content": "This is the attic. The only exit is a stairway leading down. A large coil of rope is lying in the corner. A nasty-looking knife is lying here."
}

// Forest (1-5) — maze of identical descriptions, unique d-tags, asymmetric exits
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:forest-1"], ["t", "zork1"], ["type", "place"],
    ["title", "Forest"],
    ["noun",  "forest", "trees", "woods"],
    ["exit", "north"], ["exit", "east"], ["exit", "south"], ["exit", "west"]
  ],
  "content": "This is a forest, with trees in all directions. To the east, there appears to be sunlight."
}

// (forest-2 through forest-5 follow same pattern, unique d-tags, different portal connections)

// Forest Clearing
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:forest-clearing"], ["t", "zork1"], ["type", "place"],
    ["title", "Clearing"],
    ["noun",  "clearing", "glade"],
    ["exit", "north"], ["exit", "south"], ["exit", "east"], ["exit", "west"],
    ["feature", "30078:<ZA>:zork1:feature:grating"]
  ],
  "content": "You are in a small clearing in a well marked forest path that extends to the east and west."
}

// Canyon View
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:canyon-view"], ["t", "zork1"], ["type", "place"],
    ["title", "Canyon View"],
    ["noun",  "canyon", "top", "view"],
    ["exit", "north"],
    ["exit", "down"]
  ],
  "content": "You are at the top of the Great Canyon on its south wall. From here there is a marvelous view of the canyon and parts of the Frigid River below."
}

// Rocky Ledge
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:rocky-ledge"], ["t", "zork1"], ["type", "place"],
    ["title", "Rocky Ledge"],
    ["noun",  "ledge", "cliff"],
    ["exit", "up"],
    ["exit", "down"]
  ],
  "content": "You are on a ledge about halfway up the wall of the river canyon."
}

// Canyon Bottom
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:canyon-bottom"], ["t", "zork1"], ["type", "place"],
    ["title", "Canyon Bottom"],
    ["noun",  "bottom", "floor", "canyon floor"],
    ["exit", "north"],
    ["exit", "up"]
  ],
  "content": "You are beneath the canyon walls whose tops are hundreds of feet above you. There is a narrow passage through the canyon to the north."
}

// End of Rainbow (hidden until rainbow activated)
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:end-of-rainbow"], ["t", "zork1"], ["type", "place"],
    ["title", "End of Rainbow"],
    ["noun",  "rainbow", "end"],
    ["exit", "south"],
    ["item",  "30078:<ZA>:zork1:item:pot-of-gold"]
  ],
  "content": "You are at the end of a rainbow. To the south is an open plain. There is a pot of gold here."
}
```

---

### Underground — Cellar & Upper Dungeon

---

```json
// Cellar
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:cellar"], ["t", "zork1"], ["type", "place"],
    ["title", "Cellar"],
    ["noun",  "cellar", "basement"],
    ["exit", "up"], ["exit", "east"], ["exit", "north"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["npc",  "30078:<ZA>:zork1:npc:grue"]
  ],
  "content": "You are in a dark and damp cellar with a narrow passageway leading north, and a crawlway to the east. On the west is the bottom of a steep metal ramp."
}

// East of Chasm
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:east-of-chasm"], ["t", "zork1"], ["type", "place"],
    ["title", "East of Chasm"],
    ["noun",  "chasm", "east chasm"],
    ["exit", "west"], ["exit", "north"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["npc",  "30078:<ZA>:zork1:npc:grue"]
  ],
  "content": "You are on the east edge of a chasm, the bottom of which cannot be seen. A narrow ledge runs west across the chasm."
}

// West of Chasm
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:west-of-chasm"], ["t", "zork1"], ["type", "place"],
    ["title", "West of Chasm"],
    ["noun",  "west chasm"],
    ["exit", "east"], ["exit", "south"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["npc",  "30078:<ZA>:zork1:npc:grue"]
  ],
  "content": "You are on the west edge of a chasm."
}

// Gallery
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:gallery"], ["t", "zork1"], ["type", "place"],
    ["title", "Gallery"],
    ["noun",  "gallery", "art gallery"],
    ["exit", "north"], ["exit", "south"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["item",  "30078:<ZA>:zork1:item:painting"]
  ],
  "content": "This is an art gallery. Most of the paintings have been stolen by vandals with exceptional taste. The vandals left one painting."
}

// Studio
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:studio"], ["t", "zork1"], ["type", "place"],
    ["title", "Studio"],
    ["noun",  "studio", "artist studio"],
    ["exit", "north"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["item",  "30078:<ZA>:zork1:item:large-emerald"]
  ],
  "content": "This appears to have been an artist's studio. The walls and floors are splattered with paints of 69 different colors."
}

// Maze (1-10) — twisty passages, all alike. Asymmetric exits by design.
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:maze-1"], ["t", "zork1"], ["type", "place"],
    ["title", "Maze"],
    ["noun",  "maze", "passage", "passages"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["exit", "north"], ["exit", "south"], ["exit", "east"], ["exit", "west"],
    ["exit", "up"],    ["exit", "down"],  ["exit", "northeast"], ["exit", "southwest"],
    ["npc",  "30078:<ZA>:zork1:npc:grue"],
    ["npc",  "30078:<ZA>:zork1:npc:thief"]
  ],
  "content": "You are in a maze of twisty little passages, all alike."
}

// (maze-2 through maze-10 follow same pattern, different portal connections)

// Cyclops Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:cyclops-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Cyclops Room"],
    ["noun",  "cyclops room"],
    ["exit", "east"], ["exit", "west"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["npc",  "30078:<ZA>:zork1:npc:cyclops"]
  ],
  "content": "This is a large place, in the middle of which is sitting a large and extremely ugly giant cyclops."
}

// Treasure Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:treasure-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Treasure Room"],
    ["noun",  "treasure room", "lair"],
    ["exit", "south"], ["exit", "west"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["item",  "30078:<ZA>:zork1:item:stiletto"]
  ],
  "content": "This is a large place with a number of exits. There is a stiletto here."
}
```

---

### Underground — Torch Room & Altar

---

```json
// Torch Room — permanently lit by torch feature
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:torch-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Torch Room"],
    ["noun",  "torch room"],
    ["exit", "south"], ["exit", "north"], ["exit", "east"],
    ["feature", "30078:<ZA>:zork1:feature:torch-sconce"]
  ],
  "content": "This is a large place with a prominent torch placed in a sconce near the exit. The torch emits a comforting orange glow."
}

// Altar Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:altar"], ["t", "zork1"], ["type", "place"],
    ["title", "Altar"],
    ["noun",  "altar room", "altar chamber"],
    ["exit", "north"], ["exit", "west"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["feature", "30078:<ZA>:zork1:feature:altar"],
    ["item",    "30078:<ZA>:zork1:item:candles"],
    ["item",    "30078:<ZA>:zork1:item:matches"]
  ],
  "content": "This is the Altar. The altar is made of a highly polished black stone."
}
```

---

### Underground — Dam & Reservoir

---

```json
// Reservoir South
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:reservoir-south"], ["t", "zork1"], ["type", "place"],
    ["title", "Reservoir South"],
    ["noun",  "reservoir south", "shore"],
    ["exit", "north"], ["exit", "south"], ["exit", "west"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."]
  ],
  "content": "You are in a long place on the south shore of a large underground reservoir."
}

// Dam
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:dam"], ["t", "zork1"], ["type", "place"],
    ["title", "Dam"],
    ["noun",  "dam", "top of dam"],
    ["exit", "north"], ["exit", "south"], ["exit", "east"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["feature", "30078:<ZA>:zork1:feature:dam-structure"],
    ["feature", "30078:<ZA>:zork1:feature:control-panel"]
  ],
  "content": "You are standing on the top of a large dam. To your north is a large reservoir. To your south is a short cliff and beyond that a stream. There is a control panel here."
}

// Reservoir (drained — hidden until dam opened)
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:reservoir"], ["t", "zork1"], ["type", "place"],
    ["title", "Reservoir"],
    ["noun",  "reservoir", "reservoir floor"],
    ["exit", "south"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["item",  "30078:<ZA>:zork1:item:platinum-bar"]
  ],
  "content": "You are in what was formerly the reservoir. The dam has been opened and the water has drained. A platinum bar gleams in the muddy bottom."
}
```

---

### Underground — Dome, Thief, Hades, Engravings

---

```json
// Dome Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:dome-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Dome Room"],
    ["noun",  "dome", "top of dome"],
    ["exit", "south"], ["exit", "north"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["feature", "30078:<ZA>:zork1:feature:dome"]
  ],
  "content": "You are at the top of a large dome. From here you can see most of the cavern."
}

// Below Dome (accessible only via rope)
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:dome-below"], ["t", "zork1"], ["type", "place"],
    ["title", "Below Dome"],
    ["noun",  "bottom", "base", "below dome"],
    ["exit", "up"], ["exit", "east"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."]
  ],
  "content": "You are at the base of the dome."
}

// Bat Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:bat-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Bat Room"],
    ["noun",  "bat room", "fluttering room"],
    ["exit", "north"], ["exit", "south"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["npc",  "30078:<ZA>:zork1:npc:bat"]
  ],
  "content": "You are in a place filled with the sound of fluttering wings."
}

// Land of the Dead (Hades) — death respawn destination
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:hades"], ["t", "zork1"], ["type", "place"],
    ["title", "Land of the Dead"],
    ["noun",  "hades", "land of the dead", "underworld"],
    ["exit", "south"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["feature", "30078:<ZA>:zork1:feature:spirits"],
    ["item",    "30078:<ZA>:zork1:item:broken-lantern"]
  ],
  "content": "You have entered the Land of the Dead. The spirits of the recently departed hover around you."
}

// Entrance to Hades
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:entrance-hades"], ["t", "zork1"], ["type", "place"],
    ["title", "Entrance to Hades"],
    ["noun",  "entrance", "hades entrance"],
    ["exit", "north"], ["exit", "south"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["npc",  "30078:<ZA>:zork1:npc:cerberus"]
  ],
  "content": "You are at the entrance to the Land of the Dead."
}

// Grating Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:grating-room"], ["t", "zork1"], ["type", "place"],
    ["title", "Grating Room"],
    ["noun",  "grating room", "below grating"],
    ["exit", "south"], ["exit", "up"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["feature", "30078:<ZA>:zork1:feature:grating-below"]
  ],
  "content": "You are in a small place near the middle of a large cavern. Above you is a grating."
}

// Engravings Cave
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:engravings-cave"], ["t", "zork1"], ["type", "place"],
    ["title", "Engravings Cave"],
    ["noun",  "cave", "engravings cave"],
    ["exit", "north"], ["exit", "south"], ["exit", "east"],
    ["requires", "30078:<ZA>:zork1:item:brass-lantern", "on", "It is pitch black. You are likely to be eaten by a grue."],
    ["feature", "30078:<ZA>:zork1:feature:engravings"]
  ],
  "content": "You have entered a cave with passages to the north, south, and east. There are old engravings on the walls here."
}

// End Credits (win state)
{
  "kind": 30078, "tags": [
    ["d", "zork1:place:end-credits"], ["t", "zork1"], ["type", "place"],
    ["title", "End"],
    ["noun",  "end"]
  ],
  "content": "Your score is 350 of a possible 350. This gives you the rank of Master Adventurer. The game is over."
}
```

---

## Features

---

```json
// Kitchen Window
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:kitchen-window"], ["t", "zork1"], ["type", "feature"],
    ["title", "Kitchen Window"],
    ["noun",  "window"],
    ["state",      "ajar"],
    ["transition", "ajar",   "open",   "You push the window fully open."],
    ["transition", "open",   "open",   "The window is already open."],
    ["transition", "open",   "closed", "You close the window."],
    ["transition", "closed", "open",   "You open the window."],
    ["verb",       "open",   "push"],
    ["verb",       "close",  "shut"],
    ["verb",       "examine","look"],
    ["verb",       "enter",  "climb through", "go through"],
    ["on-interact","open",  "set-state", "open"],
    ["on-interact","enter", "traverse",  "30078:<ZA>:zork1:portal:window-to-kitchen"]
  ],
  "content": "The kitchen window is slightly ajar."
}}

// Small Mailbox
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:small-mailbox"], ["t", "zork1"], ["type", "feature"],
    ["title", "Small Mailbox"],
    ["noun",  "mailbox", "box", "mail"],
    ["state",      "closed"],
    ["transition", "closed", "open",   "The mailbox creaks open."],
    ["transition", "open",   "closed", "You close the mailbox."],
    ["verb",       "open"],
    ["verb",       "close",  "shut"],
    ["verb",       "examine","look"],
    ["on-interact","open",  "set-state", "open"],
    ["contains", "30078:<ZA>:zork1:item:leaflet"]
  ],
  "content": "A small mailbox stands by the road."
}}

// Trophy Case
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:trophy-case"], ["t", "zork1"], ["type", "feature"],
    ["title", "Trophy Case"],
    ["noun",  "case", "trophy case", "cabinet"],
    ["verb",  "examine", "look"],
    ["verb",  "put",     "place", "deposit"]
  ],
  "content": "A large trophy case stands against the wall. It is empty."
}}

// Large Rug
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:large-rug"], ["t", "zork1"], ["type", "feature"],
    ["title", "Large Oriental Rug"],
    ["noun",  "rug", "carpet", "mat"],
    ["state",      "in-place"],
    ["transition", "in-place", "moved",  "You move the rug aside, revealing a trapdoor."],
    ["transition", "moved",    "moved",  "The rug is already moved aside."],
    ["verb",       "move",    "push", "pull"],
    ["verb",       "examine", "look"],
    ["verb",       "look under"],
    ["on-interact","move",       "set-state", "moved"],
    ["on-interact","move",       "set-state", "visible", "30078:<ZA>:zork1:feature:trapdoor"],
    ["on-interact","look under", "set-state", "visible", "30078:<ZA>:zork1:feature:trapdoor"]
  ],
  "content": "A large oriental rug covers the floor. Something lies beneath it."
}}

// Trapdoor (hidden until rug moved)
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:trapdoor"], ["t", "zork1"], ["type", "feature"],
    ["title", "Trapdoor"],
    ["noun",  "trapdoor", "door", "hatch"],
    ["state",      "hidden"],
    ["transition", "hidden",  "closed", ""],
    ["transition", "closed",  "open",   "The trapdoor swings open with a creak."],
    ["transition", "open",    "open",   "The trapdoor is already open."],
    ["verb",       "open",    "pull"],
    ["verb",       "examine", "look"],
    ["verb",       "enter",   "go down", "down"],
    ["on-interact","open",  "set-state", "open"],
    ["on-interact","enter", "traverse",  "30078:<ZA>:zork1:portal:living-room-to-cellar"]
  ],
  "content": "A trapdoor is set into the floor."
}}

// Grating (forest clearing)
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:grating"], ["t", "zork1"], ["type", "feature"],
    ["title", "Grating"],
    ["noun",  "grating", "gate", "grate"],
    ["state",      "locked"],
    ["transition", "locked", "open",  "The grating swings open."],
    ["transition", "open",   "open",  "The grating is already open."],
    ["requires",   "30078:<ZA>:zork1:item:skeleton-key", "", "The grating is locked."],
    ["verb",       "open",   "unlock"],
    ["verb",       "examine","look"],
    ["verb",       "enter",  "go down", "down"],
    ["on-interact","open",  "set-state", "open"],
    ["on-interact","enter", "traverse",  "30078:<ZA>:zork1:portal:clearing-to-grating-room"]
  ],
  "content": "A metal grating is set into the floor."
}}

// Control Panel (dam)
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:control-panel"], ["t", "zork1"], ["type", "feature"],
    ["title", "Control Panel"],
    ["noun",  "panel", "button", "controls", "dial"],
    ["state",      "off"],
    ["transition", "off", "on", "The control panel hums to life. You hear a distant rushing of water."],
    ["transition", "on",  "on", "The panel is already active."],
    ["verb",       "press", "push", "activate"],
    ["verb",       "examine","look"],
    ["on-interact","press", "set-state", "on"]
  ],
  "content": "A control panel with a large button and several switches."
}}

// Altar
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:altar"], ["t", "zork1"], ["type", "feature"],
    ["title", "Altar"],
    ["noun",  "altar", "stone", "table"],
    ["state",      "dry"],
    ["transition", "dry",     "watered", "You pour the water over the altar. It seeps into the black stone."],
    ["transition", "watered", "prayed",  "You speak the ancient words. The altar glows with a pale light."],
    ["transition", "prayed",  "prayed",  "The altar is already blessed."],
    ["verb",       "examine", "look"],
    ["verb",       "pray",    "kneel", "worship"],
    ["verb",       "place",   "put", "put on"],
    ["on-interact","examine", "set-state", "visible", "30078:<ZA>:zork1:clue:altar-inscription"],
    ["on-interact","pray",    "set-state", "prayed"]
  ],
  "content": "An ancient altar stands in the centre of the room."
}}

// Engravings
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:engravings"], ["t", "zork1"], ["type", "feature"],
    ["title", "Engravings"],
    ["noun",  "engravings", "writing", "inscription", "walls"],
    ["verb",  "examine", "read", "look"],
    ["on-interact","examine", "set-state", "visible", "30078:<ZA>:zork1:clue:engravings-text"],
    ["on-interact","read",    "set-state", "visible", "30078:<ZA>:zork1:clue:engravings-text"]
  ],
  "content": "Ancient engravings cover the walls."
}}

// Torch Sconce
{
  "kind": 30078, "tags": [
    ["d", "zork1:feature:torch-sconce"], ["t", "zork1"], ["type", "feature"],
    ["title", "Torch in Sconce"],
    ["noun",  "torch", "sconce", "flame"],
    ["state",      "lit"],
    ["transition", "lit", "taken", "You take the torch from the sconce."],
    ["verb",  "take",    "grab", "get"],
    ["verb",  "examine", "look"],
    ["on-interact","take", "give-item", "30078:<ZA>:zork1:item:torch"],
    ["on-interact","take", "set-state", "taken"]
  ],
  "content": "A torch burns in an iron sconce on the wall."
}}
```

---

## Items

---

```json
// Brass Lantern
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:brass-lantern"], ["t", "zork1"], ["type", "item"],
    ["title", "Brass Lantern"],
    ["noun",  "lantern", "lamp", "light", "brass lantern"],
    ["state",           "off"],
    ["counter",         "battery", "300"],
    ["transition",      "off",  "on",   "The lantern flickers to life."],
    ["transition",      "on",   "off",  "Darkness closes in."],
    ["transition",      "on",   "dead", "The lantern slowly fades out and darkness looms."],
    ["transition",      "dead", "dead", "The lantern is dead. Nothing happens."],
    ["verb",            "turn on",  "switch on",  "on",   "light"],
    ["verb",            "turn off", "switch off", "off"],
    ["on-interact",     "turn on",  "set-state",   "on"],
    ["on-interact",     "turn off", "set-state",   "off"],
    ["on-move",         "on",       "decrement",   "battery"],
    ["on-counter",  "down",  "battery",  "50",  "set-state",   "flickering"],
    ["on-counter", "down", "battery", "0",         "set-state",   "dead"],
    ["on-counter", "down", "battery", "0",  "consequence", "30078:<ZA>:zork1:consequence:lamp-dies"]
  ],
  "content": "A battery-powered brass lantern."
}}

// Elvish Sword
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:elvish-sword"], ["t", "zork1"], ["type", "item"],
    ["title", "Elvish Sword"],
    ["noun",  "sword", "blade", "elvish sword"],
    ["damage",      "4"],
    ["hit-chance",  "0.75"],
    ["verb",        "attack", "fight", "hit", "strike"],
    ["on-interact", "attack", "deal-damage-npc", ""]
  ],
  "content": "An elvish sword of great antiquity."
}}

// Knife
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:knife"], ["t", "zork1"], ["type", "item"],
    ["title", "Nasty Knife"],
    ["noun",  "knife", "blade", "dagger"],
    ["damage",      "2"],
    ["hit-chance",  "0.6"],
    ["verb",        "attack", "fight", "hit", "stab"],
    ["on-interact", "attack", "deal-damage-npc", ""]
  ],
  "content": "A nasty-looking knife."
}}

// Rope
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:rope"], ["t", "zork1"], ["type", "item"],
    ["title", "Coil of Rope"],
    ["noun",  "rope", "coil", "cord"],
    ["state",       "coiled"],
    ["transition",  "coiled", "tied", "You tie the rope securely."],
    ["transition",  "tied",   "tied", "The rope is already tied."],
    ["verb",        "tie", "attach", "fasten"],
    ["verb",        "examine", "look"],
    ["on-interact", "tie", "set-state", "tied"]
  ],
  "content": "A coil of rope."
}}

// Brown Sack (container)
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:brown-sack"], ["t", "zork1"], ["type", "item"],
    ["title", "Brown Sack"],
    ["noun",  "sack", "bag", "brown sack"],
    ["contains", "30078:<ZA>:zork1:item:lunch"],
    ["contains", "30078:<ZA>:zork1:item:garlic"]
  ],
  "content": "A brown sack, smelling of garlic."
}}

// Bottle of Water
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:bottle-of-water"], ["t", "zork1"], ["type", "item"],
    ["title", "Bottle of Water"],
    ["noun",  "bottle", "water", "jug", "flask"],
    ["state",      "full"],
    ["transition", "full",  "empty", "You pour out the water."],
    ["transition", "empty", "empty", "The bottle is already empty."],
    ["verb",        "pour",  "empty", "use"],
    ["verb",        "examine","look"],
    ["on-interact", "pour", "set-state", "empty"],
    ["on-interact", "pour", "set-state", "watered", "30078:<ZA>:zork1:feature:altar"]
  ],
  "content": "A glass bottle filled with water."
}}

// Candles
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:candles"], ["t", "zork1"], ["type", "item"],
    ["title", "Candles"],
    ["noun",  "candles", "candle", "pair of candles"],
    ["state",           "unlit"],
    ["counter",         "burn-time", "50"],
    ["transition",      "unlit", "lit",  "The candles flicker to life."],
    ["transition",      "lit",   "dead", "The candles gutter and go out."],
    ["transition",      "dead",  "dead", "The candles are spent."],
    ["verb",            "light", "ignite", "burn"],
    ["verb",            "examine","look"],
    ["on-interact",     "light", "set-state",   "lit"],
    ["on-move",         "lit",   "decrement",   "burn-time"],
    ["on-counter", "down", "burn-time", "0", "set-state","dead"]
  ],
  "content": "Two white candles."
}}

// Matches
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:matches"], ["t", "zork1"], ["type", "item"],
    ["title", "Book of Matches"],
    ["noun",  "matches", "match", "book of matches", "book"],
    ["counter",         "matches", "4"],
    ["verb",            "strike", "use", "light"],
    ["verb",            "examine","look"],
    ["on-interact",     "strike",  "set-state",  "lit", "30078:<ZA>:zork1:item:candles"],
    ["on-interact",     "strike",  "decrement",  "matches"],
    ["on-counter", "down", "matches", "0", "consequence","30078:<ZA>:zork1:consequence:out-of-matches"]
  ],
  "content": "A book of matches."
}}

// Skeleton Key
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:skeleton-key"], ["t", "zork1"], ["type", "item"],
    ["title", "Skeleton Key"],
    ["noun",  "key", "skeleton key"]
  ],
  "content": "A skeleton key."
}}

// Scarecrow Staff
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:scarecrow-staff"], ["t", "zork1"], ["type", "item"],
    ["title", "Scarecrow Staff"],
    ["noun",  "staff", "rod", "scarecrow staff"],
    ["state",       "plain"],
    ["transition",  "plain", "used",  "You wave the staff. A rainbow shimmers into being."],
    ["transition",  "used",  "used",  "You've already activated the staff."],
    ["verb",        "wave",  "use", "brandish"],
    ["verb",        "examine","look"],
    ["on-interact", "wave", "set-state", "used"],
    ["on-interact", "wave", "set-state", "visible", "30078:<ZA>:zork1:portal:canyon-to-rainbow"]
  ],
  "content": "A gnarled staff."
}}

// Treasures (abbreviated — all portable items with noun tags)
// painting, platinum-bar, jewel-encrusted-egg, large-emerald, sapphire-bracelet,
// crystal-skull, pot-of-gold, trunk-of-jewels, golden-clockwork-canary, chalice
// Each follows same pattern: type:item, title, noun aliases, description

// Torch (taken from sconce — permanent light source)
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:torch"], ["t", "zork1"], ["type", "item"],
    ["title", "Burning Torch"],
    ["noun",  "torch", "flame", "light"],
    ["state", "lit"]
  ],
  "content": "A torch."
}}

// Leaflet
{
  "kind": 30078, "tags": [
    ["d", "zork1:item:leaflet"], ["t", "zork1"], ["type", "item"],
    ["title", "Leaflet"],
    ["noun",  "leaflet", "pamphlet", "paper", "note"],
    ["verb",  "read", "examine", "look"],
    ["content", "WELCOME TO ZORK! ZORK is a game of adventure, danger and low cunning..."]
  ]
}
```

---

## NPCs

---

```json
// Grue — only exists in darkness, lethal on encounter
{
  "kind": 30078, "tags": [
    ["d", "zork1:npc:grue"], ["t", "zork1"], ["type", "npc"],
    ["title", "Grue"],
    ["noun",  "grue"],
    ["requires-not", "30078:<ZA>:zork1:item:brass-lantern", "on", ""],
    ["on-encounter", "player", "consequence", "30078:<ZA>:zork1:consequence:death"]
  ],
  "content": "A sinister, lurking presence in the dark."
}}

// Thief — roaming, steals, has combat
{
  "kind": 30078, "tags": [
    ["d", "zork1:npc:thief"], ["t", "zork1"], ["type", "npc"],
    ["title", "Thief"],
    ["noun",  "thief", "man", "figure", "seedy man"],
    ["health",       "8"],
    ["damage",       "3"],
    ["hit-chance",   "0.7"],
    ["speed",        "3"],
    ["order",        "random"],
    ["route",        "30078:<ZA>:zork1:place:treasure-room"],
    ["route",        "30078:<ZA>:zork1:place:maze-1"],
    ["route",        "30078:<ZA>:zork1:place:gallery"],
    ["route",        "30078:<ZA>:zork1:place:cyclops-room"],
    ["route",        "30078:<ZA>:zork1:place:bat-room"],
    ["state",        "neutral"],
    ["transition",   "neutral", "combat",  "The thief draws his stiletto!"],
    ["transition",   "combat",  "fled",    "The thief slips away into the darkness."],
    ["transition",   "fled",    "fled",    "The thief is gone."],
    ["transition",   "dead",    "dead",    "The thief is dead."],
    ["on-encounter", "player",  "steals-item",  "any"],
    ["on-enter",     "30078:<ZA>:zork1:place:treasure-room", "deposits"],
    ["on-attacked",  "player",  "deal-damage",  "3"],
    ["on-health", "down", "0", "30078:<ZA>:zork1:consequence:thief-dies"],
    ["stash",        "30078:<ZA>:zork1:place:treasure-room"],
    ["dialogue",     "30078:<ZA>:zork1:dialogue:thief:greeting"]
  ],
  "content": "A seedy-looking individual with a large bag."
}}

// Cyclops — guards exit, flees on condition
{
  "kind": 30078, "tags": [
    ["d", "zork1:npc:cyclops"], ["t", "zork1"], ["type", "npc"],
    ["title", "Cyclops"],
    ["noun",  "cyclops", "giant", "monster"],
    ["health",       "20"],
    ["damage",       "10"],
    ["state",        "blocking"],
    ["transition",   "blocking", "fled",  "The cyclops, extremely agitated, blunders through the door, knocking it open."],
    ["transition",   "fled",     "fled",  "The cyclops has fled."],
    ["transition",   "dead",     "dead",  "The cyclops is dead."],
    ["on-encounter", "player",   "deal-damage",   "10"],
    ["on-attacked",  "player",   "deal-damage",   "10"],
    ["on-health", "down", "0", "30078:<ZA>:zork1:consequence:cyclops-flees"],
    ["dialogue",     "30078:<ZA>:zork1:dialogue:cyclops:greeting"]
  ],
  "content": "A massive one-eyed creature blocks the passage."
}}

// Troll — guards bridge, combat
{
  "kind": 30078, "tags": [
    ["d", "zork1:npc:troll"], ["t", "zork1"], ["type", "npc"],
    ["title", "Troll"],
    ["noun",  "troll"],
    ["health",       "6"],
    ["damage",       "3"],
    ["hit-chance",   "0.65"],
    ["state",        "blocking"],
    ["transition",   "blocking", "dead", "The troll slumps to the ground with a final roar."],
    ["on-encounter", "player",   "deal-damage",   "3"],
    ["on-attacked",  "player",   "deal-damage",   "3"],
    ["on-health", "down", "0", "30078:<ZA>:zork1:consequence:troll-dies"]
  ],
  "content": "A nasty-looking troll, brandishing a bloody axe."
}}

// Bat — roaming, steals items, scared by garlic
{
  "kind": 30078, "tags": [
    ["d", "zork1:npc:bat"], ["t", "zork1"], ["type", "npc"],
    ["title", "Large Bat"],
    ["noun",  "bat"],
    ["speed",        "2"],
    ["order",        "random"],
    ["route",        "30078:<ZA>:zork1:place:bat-room"],
    ["route",        "30078:<ZA>:zork1:place:maze-1"],
    ["route",        "30078:<ZA>:zork1:place:gallery"],
    ["requires-not", "30078:<ZA>:zork1:item:garlic", "", ""],
    ["on-encounter", "player",   "steals-item", "any"],
    ["on-enter",     "30078:<ZA>:zork1:place:bat-room", "deposits"],
    ["stash",        "30078:<ZA>:zork1:place:bat-room"]
  ],
  "content": "A large bat circles overhead."
}}

// Cerberus — invincible, guards Hades exit
{
  "kind": 30078, "tags": [
    ["d", "zork1:npc:cerberus"], ["t", "zork1"], ["type", "npc"],
    ["title", "Cerberus"],
    ["noun",  "cerberus", "dog", "hound", "beast"],
    ["health",       "999"],
    ["damage",       "999"],
    ["on-encounter", "player", "deal-damage", "999"]
  ],
  "content": "A three-headed dog guards the gate."
}}
```

---

## Portals

All portals: `kind: 30078`, `type: portal`.  
Exit shape: `["exit", "<place-ref>", "<slot>", "<label>"]`

---

```json
// ── ABOVE GROUND ─────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:west-to-north"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:west-of-house", "north", "The path curves around the house."],
    ["exit", "30078:<ZA>:zork1:place:north-of-house", "west", "The path curves around the house."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:west-to-south"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:west-of-house", "south", "The path curves around the house."],
    ["exit", "30078:<ZA>:zork1:place:south-of-house", "west", "The path curves around the house."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:north-to-behind"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:north-of-house", "east", "The path continues east."],
    ["exit", "30078:<ZA>:zork1:place:behind-house", "west", "The path continues west."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:south-to-behind"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:south-of-house", "east", "The path continues east."],
    ["exit", "30078:<ZA>:zork1:place:behind-house", "west", "The path continues west."]
  ],
  "content": ""
}}

// Behind House to Kitchen — window portal, hidden until window opened
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:window-to-kitchen"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:behind-house", "enter", "The window is open. You could climb through."],
    ["exit", "30078:<ZA>:zork1:place:kitchen", "out", "The window leads back outside."],
    ["state",    "hidden"],
    ["requires", "30078:<ZA>:zork1:feature:kitchen-window", "open", "The window is not open enough to enter."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:kitchen-to-living-room"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:kitchen", "west", "A passage leads west."],
    ["exit", "30078:<ZA>:zork1:place:living-room", "east", "A passage leads east."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:kitchen-to-attic"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:kitchen", "up", "A dark staircase leads up."],
    ["exit", "30078:<ZA>:zork1:place:attic", "down", "The staircase leads back down."]
  ],
  "content": ""
}}

// Living Room to Cellar — hidden until trapdoor revealed, requires trapdoor open
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:living-room-to-cellar"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:living-room", "down", "The trapdoor leads down into darkness."],
    ["exit", "30078:<ZA>:zork1:place:cellar", "up", "The metal ramp leads back up."],
    ["state",    "hidden"],
    ["requires", "30078:<ZA>:zork1:feature:trapdoor", "open", "The trapdoor is closed."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:west-house-to-forest"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:west-of-house", "west", "The forest lies to the west."],
    ["exit", "30078:<ZA>:zork1:place:forest-1", "east", "Sunlight filters through the trees to the east."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:north-house-to-forest"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:north-of-house", "path", "The path leads back to the house."],
    ["exit", "30078:<ZA>:zork1:place:forest-2", "south", "A narrow path winds south toward the house."]
  ],
  "content": ""
}}

// Grating portal — requires skeleton key
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:clearing-to-grating-room"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:forest-clearing", "down", "The grating leads below."],
    ["exit", "30078:<ZA>:zork1:place:grating-room", "up", "A grating leads up to the surface."],
    ["requires","30078:<ZA>:zork1:feature:grating",       "open", "The grating is locked."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:canyon-view-to-ledge"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:canyon-view", "down", "A path descends into the canyon."],
    ["exit", "30078:<ZA>:zork1:place:rocky-ledge", "up", "The path climbs back up."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:ledge-to-canyon-bottom"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:rocky-ledge", "down", "The path descends to the canyon floor."],
    ["exit", "30078:<ZA>:zork1:place:canyon-bottom", "up", "The path climbs the canyon wall."]
  ],
  "content": ""
}}

// Canyon to Rainbow — hidden until staff waved
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:canyon-to-rainbow"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:canyon-bottom", "north", "A shimmering rainbow arcs to the north."],
    ["exit", "30078:<ZA>:zork1:place:end-of-rainbow", "south", "The rainbow fades behind you."],
    ["state",    "hidden"],
    ["requires", "30078:<ZA>:zork1:item:scarecrow-staff", "used", "There is nothing at the end of the rainbow."]
  ],
  "content": ""
}}

// ── UPPER DUNGEON ─────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:cellar-to-east-chasm"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:cellar", "east", "A crawlway leads east."],
    ["exit", "30078:<ZA>:zork1:place:east-of-chasm", "west", "A crawlway leads west."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:cellar-to-gallery"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:cellar", "north", "A narrow passageway leads north."],
    ["exit", "30078:<ZA>:zork1:place:gallery", "south", "The passageway leads south."]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:gallery-to-studio"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:gallery", "north", "A passage leads north."],
    ["exit", "30078:<ZA>:zork1:place:studio", "south", "The passage leads south."]
  ],
  "content": ""
}}

// Troll Bridge — requires troll defeated
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:troll-bridge"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:east-of-chasm", "west", "A rickety bridge crosses the chasm."],
    ["exit", "30078:<ZA>:zork1:place:west-of-chasm", "east", "A rickety bridge crosses the chasm."],
    ["requires","30078:<ZA>:zork1:npc:troll",            "gone", "The troll blocks your passage."]
  ],
  "content": ""
}}

// Chasm Ledge — lethal if bridge not extended (uses room state for bridge condition)
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:chasm-ledge"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:east-of-chasm", "west", "A narrow ledge crosses the chasm."],
    ["exit", "30078:<ZA>:zork1:place:west-of-chasm", "east", "A narrow ledge crosses the chasm."],
    ["requires",    "30078:<ZA>:zork1:place:east-of-chasm", "bridged", "The ledge crumbles beneath you."],
    ["consequence", "30078:<ZA>:zork1:consequence:fell-into-chasm"]
  ],
  "content": ""
}}

// Cyclops to Treasure — requires cyclops gone
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:cyclops-to-treasure"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:cyclops-room", "west", "A passage leads west."],
    ["exit", "30078:<ZA>:zork1:place:treasure-room", "east", "A passage leads east."],
    ["requires","30078:<ZA>:zork1:npc:cyclops",          "gone", "The cyclops blocks your way."]
  ],
  "content": ""
}}

// ── MAZE (asymmetric by design — selected) ────────────────────────────────────

// North from maze-1 exits east from maze-2 — intentional disorientation
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:maze-1-north"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:maze-1", "north", "A twisty passage."],
    ["exit", "30078:<ZA>:zork1:place:maze-2", "east", "A twisty passage."]
  ],
  "content": ""
}}

// (maze-2 through maze-10 follow same asymmetric pattern)

// Maze to Cyclops Room
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:maze-to-cyclops"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:maze-5", "northeast", "A twisty passage."],
    ["exit", "30078:<ZA>:zork1:place:cyclops-room", "west", "The maze lies to the west."]
  ],
  "content": ""
}}

// ── TORCH ROOM / ALTAR ────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:torch-to-altar"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:torch-room", "south", "The torch room lies to the south."],
    ["exit", "30078:<ZA>:zork1:place:altar", "north", "The altar room lies to the north."]
  ],
  "content": ""
}}

// ── DAM / RESERVOIR ───────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:dam-to-reservoir-south"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:dam", "north", "The reservoir lies to the north."],
    ["exit", "30078:<ZA>:zork1:place:reservoir-south", "south", "The dam is to the south."]
  ],
  "content": ""
}}

// Reservoir South to Drained Reservoir — hidden until dam opened
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:to-drained-reservoir"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:reservoir-south", "north", "The reservoir floor stretches north."],
    ["exit", "30078:<ZA>:zork1:place:reservoir", "south", "The entrance is to the south."],
    ["state",    "hidden"],
    ["requires", "30078:<ZA>:zork1:feature:control-panel", "on", "The reservoir is still full of water."]
  ],
  "content": ""
}}

// ── DOME ──────────────────────────────────────────────────────────────────────

// Dome to Below — hidden until rope tied
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:dome-to-below"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:dome-room", "down", "A rope hangs down into the darkness."],
    ["exit", "30078:<ZA>:zork1:place:dome-below", "up", "The rope leads back up."],
    ["state",    "hidden"],
    ["requires", "30078:<ZA>:zork1:item:rope", "tied", "There is nothing to climb down."]
  ],
  "content": ""
}}

// ── HADES ─────────────────────────────────────────────────────────────────────

// Hades Exit — requires candles lit AND altar prayed
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:hades-exit"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:hades", "north", "The exit from the Land of the Dead."],
    ["exit", "30078:<ZA>:zork1:place:entrance-hades", "south", "The way back into darkness."],
    ["requires","30078:<ZA>:zork1:item:candles",          "lit",   "The altar is cold. The spirits will not let you pass."],
    ["requires","30078:<ZA>:zork1:feature:altar",         "prayed","You have not said the words."]
  ],
  "content": ""
}}

// Death respawn — one-way, fired by consequence
{
  "kind": 30078, "tags": [
    ["d", "zork1:portal:respawn-to-hades"], ["t", "zork1"], ["type", "portal"],
    ["exit", "30078:<ZA>:zork1:place:hades", "death", "You have died."]
  ],
  "content": ""
}}
```

---

## Consequences

---

```json
// Death — respawn in Hades, clear crypto keys
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:death"], ["t", "zork1"], ["type", "consequence"],
    ["respawn",  "30078:<ZA>:zork1:place:hades"],
    ["clears",   "crypto-keys"]
  ],
  "content": "It is pitch black. You are likely to be eaten by a grue."
}

// Fell into chasm — respawn at canyon bottom, take damage
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:fell-into-chasm"], ["t", "zork1"], ["type", "consequence"],
    ["respawn",     "30078:<ZA>:zork1:place:canyon-bottom"],
    ["deal-damage", "10"]
  ],
  "content": "You stumble and fall into the chasm."
}

// Lamp dies
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:lamp-dies"], ["t", "zork1"], ["type", "consequence"]
  ],
  "content": "Your lamp has run out of power."
}

// Out of matches
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:out-of-matches"], ["t", "zork1"], ["type", "consequence"]
  ],
  "content": "You are out of matches."
}

// Thief dies — drops stiletto
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:thief-dies"], ["t", "zork1"], ["type", "consequence"],
    ["give-item", "30078:<ZA>:zork1:item:stiletto"]
  ],
  "content": "The thief, mortally wounded, slumps to the ground."
}

// Troll dies
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:troll-dies"], ["t", "zork1"], ["type", "consequence"]
  ],
  "content": "The troll, battered and bleeding, falls to the ground."
}

// Cyclops flees
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:cyclops-flees"], ["t", "zork1"], ["type", "consequence"]
  ],
  "content": "The cyclops, extremely agitated, blunders through the western door, knocking it open."
}

// Victory
{
  "kind": 30078, "tags": [
    ["d", "zork1:consequence:victory"], ["t", "zork1"], ["type", "consequence"],
    ["respawn", "30078:<ZA>:zork1:place:end-credits"]
  ],
  "content": "You have collected all the treasures. Your score is 350 of a possible 350."
}
```

---

## Dialogue Nodes (selected)

Nodes grouped by `d` tag prefix. Client fetches all nodes for an NPC in one query. NPC carries multiple `dialogue` tags — client picks the last one whose `requires` passes as entry point.

---

```json
// ── THIEF ─────────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d", "zork1:dialogue:thief:greeting"], ["t", "zork1"], ["type", "dialogue"],
    ["text",   "The thief eyes you suspiciously but says nothing."],
    ["option", "Attack",     "30078:<ZA>:zork1:dialogue:thief:attacked"],
    ["option", "Ignore him", ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d", "zork1:dialogue:thief:attacked"], ["t", "zork1"], ["type", "dialogue"],
    ["text",     "The thief draws his stiletto with a practiced hand."],
    ["on-enter", "player", "deal-damage", "3"],
    ["option",   "", ""]
  ],
  "content": ""
}}

// ── CYCLOPS ───────────────────────────────────────────────────────────────────

{
  "kind": 30078, "tags": [
    ["d",           "zork1:dialogue:cyclops:greeting"], ["t", "zork1"], ["type", "dialogue"],
    ["requires-not","30078:<ZA>:zork1:npc:cyclops",     "gone", ""],
    ["text",        "The cyclops stares at you hungrily."],
    ["option",      "Offer peanut butter", "30078:<ZA>:zork1:dialogue:cyclops:peanut-butter"],
    ["option",      "Attack",              "30078:<ZA>:zork1:dialogue:cyclops:attack"],
    ["option",      "Flee",                ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",        "zork1:dialogue:cyclops:peanut-butter"], ["t", "zork1"], ["type", "dialogue"],
    ["requires", "30078:<ZA>:zork1:item:peanut-butter",   "",    "You don't have any peanut butter."],
    ["text",     "The cyclops recoils in terror and crashes through the western door."],
    ["on-enter", "player", "consequence", "30078:<ZA>:zork1:consequence:cyclops-flees"],
    ["option",   "", ""]
  ],
  "content": ""
}}

{
  "kind": 30078, "tags": [
    ["d",       "zork1:dialogue:cyclops:attack"], ["t", "zork1"], ["type", "dialogue"],
    ["text",    "The cyclops bellows and raises its fist."],
    ["on-enter","player", "deal-damage", "10"],
    ["option",  "", ""]
  ],
  "content": ""
}}

// ── OLD HERMIT ────────────────────────────────────────────────────────────────

// Root — always available
{
  "kind": 30078, "tags": [
    ["d",      "zork1:dialogue:hermit:greeting"], ["t", "zork1"], ["type", "dialogue"],
    ["text",   "The old man looks up. 'What do you want, wanderer?'"],
    ["option", "Ask about the cave",  "30078:<ZA>:zork1:dialogue:hermit:cave"],
    ["option", "Ask about the key",   "30078:<ZA>:zork1:dialogue:hermit:key"],
    ["option", "Ask about the staff", "30078:<ZA>:zork1:dialogue:hermit:staff"],
    ["option", "Leave",               ""]
  ],
  "content": ""
}}

// After cave — entry point if player has visited cave node
{
  "kind": 30078, "tags": [
    ["d",      "zork1:dialogue:hermit:after-cave"], ["t", "zork1"], ["type", "dialogue"],
    ["text",   "'Ah, you've been to the cave. Did you find the blessing?'"],
    ["option", "Ask about the blessing", "30078:<ZA>:zork1:dialogue:hermit:blessing"],
    ["option", "Ask about the key",      "30078:<ZA>:zork1:dialogue:hermit:key"],
    ["option", "Leave",                  ""]
  ],
  "content": ""
}}

// Cave info
{
  "kind": 30078, "tags": [
    ["d",      "zork1:dialogue:hermit:cave"], ["t", "zork1"], ["type", "dialogue"],
    ["text",   "'The cave is old. Older than me. Don't go north without the serpent's blessing.'"],
    ["on-enter","player", "set-state", "visited"],
    ["option", "Ask what the blessing is", "30078:<ZA>:zork1:dialogue:hermit:blessing"],
    ["option", "Thank him and leave",       ""]
  ],
  "content": ""
}}

// Key — only offered if player holds map fragment
{
  "kind": 30078, "tags": [
    ["d",        "zork1:dialogue:hermit:key"], ["t", "zork1"], ["type", "dialogue"],
    ["requires", "30078:<ZA>:zork1:item:map-fragment", "", ""],
    ["text",     "'Ah, you found the map. The serpent key lies in the altar chamber.'"],
    ["on-enter", "player", "set-state", "visible", "30078:<ZA>:zork1:clue:hermit-key-hint"],
    ["option",   "Ask about the altar", "30078:<ZA>:zork1:dialogue:hermit:blessing"],
    ["option",   "Thank him and leave", ""]
  ],
  "content": ""
}}

// Staff — only offered if player has scarecrow staff
{
  "kind": 30078, "tags": [
    ["d",        "zork1:dialogue:hermit:staff"], ["t", "zork1"], ["type", "dialogue"],
    ["requires", "30078:<ZA>:zork1:item:scarecrow-staff", "", ""],
    ["text",     "'The scarecrow's staff? Wave it at the rainbow. But mind the chasm.'"],
    ["option",   "Thank him and leave", ""]
  ],
  "content": ""
}}

// Blessing
{
  "kind": 30078, "tags": [
    ["d",       "zork1:dialogue:hermit:blessing"], ["t", "zork1"], ["type", "dialogue"],
    ["text",    "'Light the candles. Say the words. The serpent will show you the way.'"],
    ["on-enter","player", "set-state", "visited"],
    ["option",  "Ask about the words", "30078:<ZA>:zork1:dialogue:hermit:words"],
    ["option",  "Thank him and leave", ""]
  ],
  "content": ""
}}

// After blessing — deepest entry point
{
  "kind": 30078, "tags": [
    ["d",      "zork1:dialogue:hermit:after-blessing"], ["t", "zork1"], ["type", "dialogue"],
    ["text",   "'You know what to do. Go — the cave awaits.'"],
    ["option", "Leave", ""]
  ],
  "content": ""
}}
```

---

## Quest

---

```json
{
  "kind": 30078, "tags": [
    ["d",        "zork1:quest:collect-treasures"], ["t", "zork1"], ["type", "quest"],
    ["title",    "Collect the Treasures"],
    ["involves", "30078:<ZA>:zork1:feature:trophy-case"],
    ["requires", "30078:<ZA>:zork1:item:painting",               "", ""],
    ["requires", "30078:<ZA>:zork1:item:platinum-bar",           "", ""],
    ["requires", "30078:<ZA>:zork1:item:jewel-encrusted-egg",    "", ""],
    ["requires", "30078:<ZA>:zork1:item:large-emerald",          "", ""],
    ["requires", "30078:<ZA>:zork1:item:sapphire-bracelet",      "", ""],
    ["requires", "30078:<ZA>:zork1:item:crystal-skull",          "", ""],
    ["requires", "30078:<ZA>:zork1:item:pot-of-gold",            "", ""],
    ["requires", "30078:<ZA>:zork1:item:trunk-of-jewels",        "", ""],
    ["requires", "30078:<ZA>:zork1:item:golden-clockwork-canary","", ""],
    ["requires", "30078:<ZA>:zork1:item:chalice",                "", ""]
  ],
  "content": "The Great Underground Empire awaits. Find all the treasures and deposit them in the trophy case."
}
```

---

## Schema Notes

Observations from mapping Zork 1 against the final schema:

- **Single kind, type tag** — all 100+ events are `kind: 30078`; `type` tag differentiates. One relay subscription covers the whole world.
- **`requires` on places** handles darkness — no special dark-place logic in the client.
- **`transition` table** enforces puzzle sequencing — altar requires `dry → watered → prayed` in order. No client puzzle logic.
- **`on-counter`** handles lantern battery and candle burn time — same pattern.
- **`requires-not`** on NPC (grue, bat) gates existence to conditions cleanly.
- **Consequences** unify death, combat outcomes, victory, and resource depletion.
- **Asymmetric portals** work naturally — maze exits are intentionally non-reversible.
- **Non-cardinal exits** (`path`, `enter`, `death`) are just slot name strings.
- **Multiple `requires`** tags handle AND conditions — hades portal needs both candles and prayer.
- **`exit` place-ref first** — relay `#exit` queries find portals by place reference.
- **Roaming NPCs spawn** at a referenced place; `route` tags define where they go after.
- **Dialogue entry points** — multiple `dialogue` tags let conversations resume at depth.
- **`noun` aliases** — `"lantern", "lamp", "light"` all resolve to the same item. Disambiguation by `title` when needed.
- **`verb` aliases** — `"examine", "look", "x", "l"` all fire the same `on-interact`.
- **No locks, no flags, no set-flag** — everything is event state. The schema has no special cases.

*Zork 1 © Infocom — reference/analysis document only*
