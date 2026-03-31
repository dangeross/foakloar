# Sample Presets Reference

Two sample library presets are available via the `["samples", "<preset>"]` tag on the world event. Each preset loads a collection of named audio samples that can be used in sound event patterns via `["oscillator", "<name>"]` or `s("<name>")` in Strudel code.

**Authoritative sample descriptions:** https://tidalcycles.org/docs/configuration/AudioSamples/default_library/
This page has one-line human-written descriptions for every Dirt-Samples bank — the only reliable source for what samples actually sound like. Check it before using an unfamiliar sample.

---

## Practical Sound Design Guide

### Strudel built-in noise generators

These are **not** from the Dirt or VCSL sample libraries — they are Strudel's own built-in noise types, available without any preset. Use them via `s("brown")`, `s("pink")`, `s("white")` etc. They respond to `note` for pitch centre and standard envelope/filter parameters.

| Name | Character | Best for |
|---|---|---|
| `brown` | Brown noise — low, warm, rumbling. Sounds like deep wind or distant rushing air. | ✅ **Verified:** excellent for wind on exposed ridges/heights. Use with `note` for pitch, `slow`, heavy `room` |
| `pink` | Pink noise — balanced, less harsh than white. Natural-sounding texture. | General atmosphere, softer air textures |
| `white` | White noise — full spectrum, harsh. | Best when heavily filtered (`lpf 400–600`) for water/static |

**River/rushing water recipe (verified):**
```
s("white").lpf("400 600").hpf("80 100").room("0.7 0.5").roomsize(4).attack("0.2 0.1").release("0.5 0.7").gain(0.45)
```
Pure white noise band-passed = rushing water without metallic artifacts. Cycling values (space-separated strings) alternate per trigger — this works in the tag schema and is the best available substitute for `rand`/`perlin` which cannot be used. Each parameter cycles independently, creating natural variation.

---

### Sample types
Most Dirt samples are **one-shot hits**, not loops. This matters for patterning:
- **One-shot hits** need a rhythmic pattern: `s("birds birds:1 ~ birds:2")` — silence gaps (`~`) feel natural
- **Loops/textures** (fire, wind, outdoor, seawolf) play as a continuous stream — they are still triggered as hits in Strudel but the sample is long enough to sustain; use `slow` to stretch and avoid choppy retriggering
- **Pitched** samples (ocarina, recorder, sax, tabla) respond to `note` — use this to set root pitch and melody

### Key parameters for ambient/atmospheric sounds

| Parameter | Effect | Example |
|---|---|---|
| `slow N` | Stretches the pattern N× — fewer triggers per second | `slow 8` for sparse atmosphere |
| `room N` | Adds reverb send (0–1) | `room 0.5` |
| `roomsize N` | Reverb decay length (1–10+) | `roomsize 6` for cave/hall |
| `lpf N` | Low-pass filter cutoff in Hz — removes harshness | `lpf 800` for muffled/distant |
| `hpf N` | High-pass filter — removes low rumble | `hpf 60` to clean sub |
| `gain N` | Overall volume (default 1.0) | `gain 0.3` for background layer |
| `crush N` | Bit-crush depth (bits) — adds lo-fi grit/warmth | `crush 12` on fire gives crackling warmth; lower = more destruction |
| `degrade-by N` | Random drop probability (0–1) — removes hits randomly | `degrade-by 0.7` on fire*4 gives organic stop-start crackle |
| `delay N` | Delay send amount | `delay 0.4` |
| `delaytime N` | Delay time in seconds | `delaytime 0.3` |
| `speed N` | Playback speed (pitch-shifts too) | `speed 0.7` for lower/slower |
| `begin N` | Start position in sample (0–1) | `begin 0.2` skips the attack |

### Quick-reference: ambient samples for world building

These are the most useful samples for atmosphere and ambience in a text adventure world:

| Sample | Type | Best for | Pattern notes |
|---|---|---|---|
| `birds` | one-shot (short calls) | Forest, dawn, open sky | Sparse pattern with rests; `slow 8–12`, `room 0.3` |
| `birds3` | one-shot (calls) | Denser birdsong, canopy | Works similarly to `birds` |
| `insect` | one-shot (buzz) | Jungle, night, warmth | Dense pattern `insect*6`, `slow 3–5`, `lpf 700` |
| `fire` | texture/loop-like | Camp, hearth, warmth | Slow trigger `slow 4–6`; sounds crackling |
| `wind` | ⚠️ NOT real wind | Filtered white noise hits (per TidalCycles docs) — sounds hollow/owl-like when slowed. Not suitable for sustained wind atmosphere | Caution with `slow 8+`; better for short gusts |
| `outdoor` | texture/field recording | Open landscape, general nature — "odd ambient hits" (per docs) | Try with heavy `room` |
| `seawolf` | ⚠️ NOT water | "Noise hits" (per TidalCycles docs) — percussive, metallic impacts, not flowing water | Dense pattern `seawolf*32` gives rushing texture but stays metallic |
| `bubble` | one-shot | ⚠️ **NOT water** — docs say "sounds more like kicks". Avoid for water ambience | — |
| `breath` | one-shot | Presence, intimacy — "one breath sound, pretty pointless" (per docs) — minimal material | Very slow, `room 0.6`; only 1 sample so no variation |
| `crow` | one-shot | Ravens, dark atmosphere — "two crow sounds twice" (per docs) | Sparse, `room 0.4` |
| `pebbles` | texture (long) | ⚠️ Verified: sounds like pebbles being **shaken** — good for hail or rattling debris, not flowing water. Docs say "very long, maybe pebbles on a beach" | Sparse trigger, or dense for hail effect |
| `em2` | longer sounds (mixed) | **Kalimba, flute, loon** — "six longer sounds" (per docs) — excellent for nature/world ambience | Try sparse patterns; loon calls are especially useful for wild atmosphere |
| `koy` | texture (long) | Long ambient — "two koyaanisqatsi long samples" (per docs) — atmospheric drone textures | Very `slow`, heavy `room`; cinematic |
| `tabla` | pitched one-shot | Ancient, ceremonial, South Asian | Use `note` for pitch; `slow 4–6` |
| `tabla2` | pitched one-shot | Variation on tabla | More articulate, try alongside `tabla` |
| `sitar` | pitched one-shot | Ancient, exotic, mystery | Needs `note` tag; long resonance |
| `east` | pitched one-shot | Modal, ancient Middle-East/Asia | Try with `note` for tonal colour |
| `noise` | one-shot (burst) | Rushing water, wind, static — pure white noise, no metallic character | Dense `noise*32`, `lpf 400–700` for river/rush texture |
| `noise2` | one-shot (burst) | Variation on noise — "8 short noise hits" (per docs) | Similar use to `noise` |
| `space` | texture | Void, cave, alien — "strange mix of long/short sounds" (per docs) | Heavy `room`, `lpf 400` |
| `pad` | texture | Gentle drone, presence | Sustained; needs slow retriggering |

### Verified listener notes (from playtesting)

Notes accumulated from actual audio testing — truth beats the manual.

| Sample | Verdict | Notes |
|---|---|---|
| `seawolf` | ⚠️ Misleading name | TidalCycles docs say "noise hits" — confirmed: sounds like water hitting a metal sheet, percussive not flowing. Dense patterns (`*32`) give a rushing texture but retain the metallic quality. Not suitable for smooth river ambience. |
| `wind` | ⚠️ Not real wind | TidalCycles docs say "actually filtered white noise hits" — confirmed: sounds hollow and owl-like when slowed, due to filtered noise character rather than real wind recordings. Better for brief gusts than sustained atmosphere. |
| `fire` | ✅ Works well | Crackling, organic texture. `slow 4–6` works for campfire feel. |
| `birds` | ✅ Works well | Short, distinct bird calls — sparse patterns feel natural. |
| `insect` | ✅ Works well | High-frequency chirping buzz — dense patterns create jungle chorus. |
| `tabla` | ✅ Works well | Complex, warm, pitched. Responds well to `note` and `slow`. |
| `ocarina_vib` | ✅ Works well | Warm, wavering, ancient. Melodic use with `note` patterns effective for leitmotifs. |
| `didgeridoo` | ✅ Works well | Very low, droning, overtone-rich. Heavy `room`/`roomsize` creates cave/ritual atmosphere. |
| `hh` | ⚠️ Varies by variant | Some variants (`:0`) are good for metallic ticking; others have too much sustain. Try `:0`, `:1`, `:2` — character differs significantly. |

### Strudel pattern recipes (known-good)

Copy-paste starting points for common sound targets. Tune `gain`, `slow`, and filter values to taste.

```
# Sparse birdsong — open forest, dawn
s("birds ~ birds:1 ~ ~ birds:2 ~ ~").slow(10).room(0.3).gain(0.25)

# Jungle insect chorus — warm, alive, layered
s("insect*6").slow(4).lpf(700).room(0.2).gain(0.3)

# Campfire — sheltered, intimate
s("fire").slow(6).room(0.25).gain(0.35)

# Ancient melody — ocarina leitmotif
s("ocarina_vib").note("c3 ~ eb3 ~ ~ ~ g3 ~").slow(16).room(0.5).delay(0.3).delaytime(0.25)

# Didgeridoo drone — cave, ritual, weight
s("didgeridoo").slow(8).room(0.9).roomsize(10).lpf(600).gain(0.6)

# Tabla pulse — ceremonial, ancient
s("tabla ~ tabla:1 ~ tabla:2 ~ ~ ~").slow(6).room(0.35).gain(0.5)

# Metallic compass tick
s("hh:0 ~ ~ ~ hh:0 ~ ~ ~").slow(3).room(0.1).gain(0.4)
```

---

## Preset: "dirt"

**Source:** `github:tidalcycles/Dirt-Samples`
**Size:** 217 sample banks (each bank contains multiple numbered variations)
**License:** Various open-source

| Sample Name | Description | Tone |
|---|---|---|
| `808` | Roland TR-808 drum machine, full kit | Warm, boomy, iconic analog |
| `808bd` | TR-808 bass drum — deep sub-bass kick | Deep, subby, round |
| `808cy` | TR-808 cymbal | Bright, metallic, sizzly |
| `808hc` | TR-808 high conga | Tight, pitched, percussive |
| `808ht` | TR-808 high tom | Short, punchy, pitched |
| `808lc` | TR-808 low conga | Warm, deep, resonant |
| `808lt` | TR-808 low tom | Low, thumpy, rounded |
| `808mc` | TR-808 mid conga | Medium-pitched, warm, rhythmic |
| `808mt` | TR-808 mid tom | Mid-range, punchy, analog |
| `808oh` | TR-808 open hi-hat | Sizzly, metallic, sustained |
| `808sd` | TR-808 snare drum | Snappy, crisp, analog crack |
| `909` | Roland TR-909 drum machine | Punchy, bright, electronic |
| `ab` | Abstract/experimental fragments | Glitchy, textural, unusual |
| `ade` | Melodic synth samples | Synthetic, tonal, smooth |
| `ades2` | Synth set, second bank | Synthetic, layered, evolving |
| `ades3` | Synth set, third bank | Synthetic, airy, textural |
| `ades4` | Synth set, fourth bank | Synthetic, complex, rich |
| `alex` | Miscellaneous sounds | Eclectic, varied, personal |
| `alphabet` | Spoken letters of the alphabet | Vocal, speech, dry |
| `amencutup` | Chopped Amen break segments | Frenetic, jungle, breakbeat |
| `armora` | Armor/metallic impact sounds | Hard, clangy, industrial |
| `arp` | Arpeggiated synth tones | Melodic, sequenced, bright |
| `arpy` | Arpeggiated pluck/synth notes | Plucky, melodic, crystalline |
| `auto` | Automotive/engine sounds | Mechanical, droning, raw |
| `baa` | Sheep/goat bleating | Quirky, organic, humorous |
| `baa2` | Second set of baa vocals | Quirky, pitched, playful |
| `bass` | General bass instrument | Low, fundamental, warm |
| `bass0` | Bass synth variant 0 | Deep, clean, round |
| `bass1` | Bass synth variant 1 | Thick, resonant, punchy |
| `bass2` | Bass synth variant 2 | Growly, saturated, heavy |
| `bass3` | Bass synth variant 3 | Dark, subby, distorted |
| `bassdm` | Bass drum (non-808/909) | Thumpy, solid, dry |
| `bassfoo` | Experimental/distorted bass | Gritty, distorted, lo-fi |
| `battles` | Aggressive sound textures | Intense, chaotic, noisy |
| `bd` | Bass drum / kick drum | Punchy, solid, foundational |
| `bend` | Pitch-bent sounds | Swooping, elastic, expressive |
| `bev` | Bottle percussion | Glassy, delicate, organic |
| `bin` | Metallic bin percussion | Tinny, resonant, industrial |
| `birds` | Bird calls and birdsong | Natural, chirpy, airy |
| `birds3` | Third set of bird sounds | Natural, melodic, ambient |
| `bleep` | Short electronic bleeps | Sharp, digital, clean |
| `blip` | Quick electronic blips | Snappy, minimal, retro |
| `blue` | Bluesy melodic samples | Soulful, warm, expressive |
| `bottle` | Glass bottle percussion | Hollow, resonant, organic |
| `breaks125` | Breakbeat loop at 125 BPM | Groovy, rhythmic, danceable |
| `breaks152` | Breakbeat loop at 152 BPM | Fast, driving, energetic |
| `breaks157` | Breakbeat loop at 157 BPM | Uptempo, intense, jungle |
| `breaks165` | Breakbeat loop at 165 BPM | Rapid, frenetic, drum-and-bass |
| `breath` | Human breathing sounds | Intimate, airy, organic |
| `bubble` | Bubbly, liquid sounds | Wet, playful, effervescent |
| `can` | Tin can percussion | Tinny, bright, resonant |
| `casio` | Casio keyboard presets | Lo-fi, cheesy, retro digital |
| `cb` | Cowbell | Metallic, bright, rhythmic |
| `cc` | Crash cymbal | Explosive, shimmering, bright |
| `chin` | Chinese cymbal or chime | Trashy, bright, exotic |
| `circus` | Carnival/circus sounds | Whimsical, chaotic, festive |
| `clak` | Sharp clacking percussion | Dry, snappy, percussive |
| `click` | Short digital clicks | Minimal, precise, tiny |
| `clubkick` | Club-style heavy kick | Boomy, powerful, dance |
| `co` | Closed hi-hat | Tight, crisp, minimal |
| `coins` | Coin clinking | Sparkly, metallic, delicate |
| `control` | Control/modulation sounds | Technical, abstract, synthetic |
| `cosmicg` | Cosmic granular sounds | Spacey, ethereal, alien |
| `cp` | Handclap | Sharp, snappy, rhythmic |
| `cr` | Crash or ride cymbal | Bright, sustaining, metallic |
| `crow` | Crow/raven calls | Dark, harsh, natural |
| `d` | Short drum hit | Dry, punchy, brief |
| `db` | Double bass | Deep, woody, resonant |
| `diphone` | Diphone speech synthesis | Robotic, vocal, uncanny |
| `diphone2` | Second diphone set | Synthetic speech, choppy |
| `dist` | Distorted guitar/noise | Crunchy, aggressive, overdriven |
| `dork2` | Quirky electronic sounds | Goofy, digital, playful |
| `dorkbot` | Hacker community sounds | Geeky, glitchy, experimental |
| `dr` | Drum kit samples | Acoustic, natural, balanced |
| `dr2` | Second drum kit | Full, warm, studio |
| `dr55` | Boss DR-55 drum machine | Thin, analog, vintage |
| `dr_few` | Minimal drum kit | Sparse, clean, selective |
| `drum` | Generic drum hits | Versatile, punchy, standard |
| `drumtraks` | Sequential DrumTraks | Digital-analog hybrid, 80s |
| `e` | Short electronic sound | Minimal, synthetic, brief |
| `east` | Eastern melodic sounds | Exotic, modal, atmospheric |
| `electro1` | Electro drums and hits | Sharp, robotic, 80s |
| `em2` | Electronic melodic bank 2 | Tonal, synthetic, smooth |
| `erk` | Quirky vocal exclamation | Weird, abrupt, surprising |
| `f` | Short sound fragment | Minimal, brief, neutral |
| `feel` | Textural mood sounds | Atmospheric, ambient, warm |
| `feelfx` | Feel-based effects | Spacey, processed, evolving |
| `fest` | Festival sounds | Lively, bright, festive |
| `fire` | Fire crackling | Warm, organic, chaotic |
| `flick` | Quick flicking sounds | Sharp, transient, bright |
| `fm` | FM synthesis tones | Bell-like, metallic, digital |
| `foo` | Experimental sounds | Eclectic, unpredictable, raw |
| `future` | Futuristic electronic | Sleek, digital, forward |
| `gab` | Gabber stabs | Aggressive, distorted, relentless |
| `gabba` | Gabber kick drums | Pounding, distorted, extreme |
| `gabbaloud` | Louder gabber kicks | Crushing, overdriven, brutal |
| `gabbalouder` | Even louder gabber kicks | Deafening, maxed-out, extreme |
| `glasstap` | Glass tapping | Delicate, crystalline, fragile |
| `glitch` | Digital glitch artifacts | Broken, stuttering, chaotic |
| `glitch2` | Second glitch set | Fragmented, digital, noisy |
| `gretsch` | Gretsch drum kit | Warm, jazzy, woody |
| `gtr` | Guitar samples | Stringy, resonant, versatile |
| `h` | Short hi-hat | Tight, minimal, crisp |
| `hand` | Hand percussion | Organic, warm, rhythmic |
| `hardcore` | Hardcore techno sounds | Brutal, fast, aggressive |
| `hardkick` | Hard-hitting kick | Powerful, punchy, impactful |
| `haw` | Hawaiian novelty vocals | Tropical, playful, quirky |
| `hc` | High/closed hat or conga | Tight, short, bright |
| `hh` | Mixed drum sounds | ⚠️ Docs say "mix of drum sounds, quiet" — not reliably hi-hats; character varies by variant number |
| `hh27` | Hi-hat set with 27 variations | Varied, metallic, detailed |
| `hit` | Orchestral hit stabs | Bold, cinematic, powerful |
| `hmm` | Humming vocal | Soft, contemplative, human |
| `ho` | Open hi-hat | Sustained, bright, open |
| `hoover` | Hoover/mentasm synth bass | Screaming, detuned, massive |
| `house` | House music drums | Groovy, four-on-floor, warm |
| `ht` | High tom | Pitched, resonant, sharp |
| `if` | Abstract sound fragments | Mysterious, ambient, subtle |
| `ifdrums` | Alternative drum kit | Clean, varied, neutral |
| `incoming` | Alert/notification sounds | Urgent, ascending, attention |
| `industrial` | Industrial noise/metal | Harsh, mechanical, abrasive |
| `insect` | Insect buzzing/chirping | Organic, high-pitched, natural |
| `invaders` | Space Invaders arcade sounds | 8-bit, retro, bleepy |
| `jazz` | Jazz drum kit | Smooth, brushy, warm |
| `jingbass` | Jingle-style bass | Bright, festive, ringing |
| `jungbass` | Jungle bass hits | Deep, sub-heavy, rolling |
| `jungle` | Jungle breakbeat drums | Chopped, rapid, intense |
| `juno` | Roland Juno synth sounds | Lush, analog, warm pads |
| `jvbass` | JV-series synth bass | Full, round, polished |
| `kicklinn` | LinnDrum kick | Punchy, 80s, iconic |
| `koy` | Korg keyboard sounds | Synthetic, bright, clean |
| `kurt` | Named sample pack | Personal, eclectic, raw |
| `latibro` | Latin percussion | Rhythmic, warm, syncopated |
| `led` | LED/indicator sounds | Tiny, digital, precise |
| `less` | Minimal sound elements | Sparse, quiet, subtle |
| `lighter` | Lighter click sounds | Tiny, sharp, metallic |
| `linnhats` | LinnDrum hi-hats | Sizzly, 80s, tight |
| `lt` | Low tom | Deep, booming, resonant |
| `made` | Custom sound design | Crafted, unique, textural |
| `made2` | Second custom set | Experimental, varied |
| `mash` | Layered sound collages | Chaotic, dense, layered |
| `mash2` | Second mashup set | Collaged, noisy, complex |
| `metal` | Metal percussion | Harsh, ringing, aggressive |
| `miniyeah` | Short "yeah" vocals | Energetic, vocal, punchy |
| `monsterb` | Monster bass sounds | Huge, growling, menacing |
| `moog` | Moog synth tones | Fat, analog, creamy |
| `mouth` | Mouth percussion | Organic, beatbox-like, human |
| `mp3` | Lo-fi MP3 artifacts | Degraded, crunchy, digital |
| `msg` | Message alert tones | Short, clean, attention |
| `mt` | Mid tom | Mid-pitched, resonant, punchy |
| `mute` | Muted instrument sounds | Dead, soft, controlled |
| `newnotes` | New melodic notes | Fresh, tonal, bright |
| `noise` | White/colored noise | Harsh, full-spectrum, static |
| `noise2` | Second noise set | Grainy, atmospheric, dense |
| `notes` | Musical note samples | Tonal, clean, melodic |
| `numbers` | Spoken numbers | Vocal, clear, sequential |
| `oc` | Open-closed hat | Short, crisp, neutral |
| `odx` | Oberheim DMX drum machine | Punchy, 80s, digital-analog |
| `off` | Muted/off-beat sounds | Quiet, dampened, subtle |
| `outdoor` | Outdoor field recordings | Natural, spacious, environmental |
| `pad` | Synth pad sounds | Lush, atmospheric, dreamy |
| `padlong` | Extended pad textures | Evolving, ambient, sustained |
| `pebbles` | Pebble rattling sounds | Granular, dry, natural |
| `perc` | General percussion hits | Varied, rhythmic, sharp |
| `peri` | Auxiliary percussion | Subtle, textural, decorative |
| `pluck` | Plucked string/synth | Sharp attack, melodic, decaying |
| `popkick` | Pop-style kick drum | Clean, round, radio-friendly |
| `print` | Printer/mechanical sounds | Mechanical, rhythmic, industrial |
| `proc` | Processed textures | Mangled, wet, transformed |
| `procshort` | Short processed fragments | Brief, effected, glitchy |
| `psr` | Yamaha PSR keyboard sounds | Cheesy, digital, retro |
| `rave` | Classic rave stabs | Euphoric, bright, 90s |
| `rave2` | Second rave set | Intense, acidic, energetic |
| `ravemono` | Mono rave stabs | Raw, centered, punchy |
| `realclaps` | Real handclap recordings | Organic, natural, crisp |
| `reverbkick` | Kick with heavy reverb | Boomy, spacious, cavernous |
| `rm` | Rim shot | Sharp, woody, cutting |
| `rs` | Rim shot (alternate) | Tight, cracking, bright |
| `sax` | Saxophone | Smooth, warm, expressive |
| `sd` | Snare drum | Snappy, bright, cutting |
| `seawolf` | Sea/ocean textures | Watery, deep, mysterious |
| `sequential` | Sequential Circuits synth | Analog, vintage, warm |
| `sf` | Sound effects collection | Varied, cinematic, dramatic |
| `sheffield` | Sheffield electronic sounds | Northern, gritty, post-punk |
| `short` | Very short percussive hits | Clipped, transient, dry |
| `sid` | Commodore SID chip | 8-bit, chiptune, buzzy |
| `simplesine` | Pure sine wave tones | Clean, pure, fundamental |
| `sitar` | Indian sitar strings | Twangy, resonant, exotic |
| `sn` | Snare drum (alternate) | Sharp, rattling, bright |
| `space` | Spacey ambient sounds | Vast, ethereal, cosmic |
| `speakspell` | Speak & Spell toy speech | Robotic, nostalgic, childlike |
| `speech` | Human speech fragments | Vocal, clear, linguistic |
| `speechless` | Processed speech | Abstract, vocal, ghostly |
| `speedupdown` | Speed ramp effects | Accelerating, elastic, playful |
| `stab` | Sharp synth stab chords | Punchy, bright, rhythmic |
| `stomp` | Foot stomp percussion | Heavy, boomy, grounded |
| `subroc3d` | SubRoc-3D arcade sounds | Retro, 8-bit, sci-fi |
| `sugar` | Sweet melodic sounds | Sugary, pleasant, light |
| `sundance` | Atmospheric sounds | Cinematic, warm, expansive |
| `tabla` | Indian tabla drum | Pitched, complex, resonant |
| `tabla2` | Second tabla set | Varied, articulate, rhythmic |
| `tablex` | Extended tabla percussion | Percussive, dry, detailed |
| `tacscan` | Tac/Scan arcade sounds | Retro, bleepy, 8-bit |
| `tech` | Techno elements | Minimal, driving, mechanical |
| `techno` | Techno drum hits | Pounding, dark, hypnotic |
| `tink` | Tiny metallic tinking | Delicate, high-pitched, sparkly |
| `tok` | Short wooden knock | Dry, hollow, clicky |
| `toys` | Toy instrument sounds | Playful, lo-fi, childlike |
| `trump` | Trumpet/brass stabs | Brassy, bold, piercing |
| `ul` | Ultra-low sounds | Sub-bass, rumbling, deep |
| `ulgab` | Ultra gabber kicks | Extreme, distorted, punishing |
| `uxay` | Abstract textures | Alien, unpredictable, strange |
| `v` | Short vocal or violin | Brief, tonal, expressive |
| `voodoo` | Dark ritualistic sounds | Eerie, tribal, haunting |
| `wind` | Wind recordings | Breathy, atmospheric, natural |
| `wobble` | Wobble bass (dubstep) | Undulating, heavy, modulated |
| `world` | World music percussion | Ethnic, diverse, organic |
| `xmas` | Christmas/holiday sounds | Festive, jingling, seasonal |
| `yeah` | Vocal "yeah" exclamations | Energetic, affirmative, punchy |

---

## Preset: "classic"

**Source:** VCSL (Virtual Community Sample Library)
**URL:** `https://raw.githubusercontent.com/felixroos/dough-samples/main/vcsl.json`
**Size:** 53 samples
**License:** CC0

### Percussion — Drums

| Sample Name | Description | Tone |
|---|---|---|
| `bassdrum1` | Acoustic bass drum, first variant | Deep, boomy, resonant |
| `bassdrum2` | Acoustic bass drum, second variant | Thick, punchy, warm |
| `snare_modern` | Modern snare drum | Bright, crisp, cutting |
| `snare_hi` | High-tuned snare drum | Tight, cracking, sharp |
| `snare_low` | Low-tuned snare drum | Fat, full, rattling |
| `snare_rim` | Snare rim click/shot | Woody, sharp, dry |
| `tom_mallet` | Rack tom with mallets | Warm, rounded, mellow |
| `tom_stick` | Rack tom with sticks | Bright, punchy, articulate |
| `tom_rim` | Rack tom rim shot | Sharp, cracking, metallic |
| `tom2_mallet` | Floor tom with mallets | Deep, warm, booming |
| `tom2_stick` | Floor tom with sticks | Full, punchy, resonant |
| `tom2_rim` | Floor tom rim shot | Low, cracking, woody |

### Percussion — Orchestral

| Sample Name | Description | Tone |
|---|---|---|
| `timpani` | Orchestral timpani hits | Thunderous, pitched, grand |
| `timpani_roll` | Timpani roll (sustained tremolo) | Rumbling, dramatic, building |
| `timpani2` | Timpani alternate set | Deep, resonant, orchestral |

### Percussion — World

| Sample Name | Description | Tone |
|---|---|---|
| `bongo` | Bongo hand drum | Bright, woody, rhythmic |
| `conga` | Conga drum | Deep, warm, Afro-Cuban |
| `darbuka` | Middle Eastern goblet drum | Sharp, metallic, articulate |
| `framedrum` | Frame drum (bodhran, tar) | Resonant, deep, earthy |

### Percussion — Novelty

| Sample Name | Description | Tone |
|---|---|---|
| `ballwhistle` | Referee/sports whistle | Shrill, piercing, bright |
| `trainwhistle` | Steam train whistle | Piercing, nostalgic, brassy |
| `siren` | Emergency/air raid siren | Wailing, urgent, sweeping |

### Woodwinds — Recorder

| Sample Name | Description | Tone |
|---|---|---|
| `recorder_alto_stacc` | Alto recorder, staccato | Light, breathy, short |
| `recorder_alto_vib` | Alto recorder, vibrato | Warm, wavering, medieval |
| `recorder_alto_sus` | Alto recorder, sustained | Smooth, airy, gentle |
| `recorder_bass_stacc` | Bass recorder, staccato | Hollow, deep, breathy |
| `recorder_bass_vib` | Bass recorder, vibrato | Dark, resonant, wavering |
| `recorder_bass_sus` | Bass recorder, sustained | Deep, mellow, woody |
| `recorder_soprano_stacc` | Soprano recorder, staccato | High, piercing, bright |
| `recorder_soprano_sus` | Soprano recorder, sustained | Clear, sweet, singing |
| `recorder_tenor_stacc` | Tenor recorder, staccato | Mid-range, breathy, soft |
| `recorder_tenor_vib` | Tenor recorder, vibrato | Warm, lyrical, wavering |
| `recorder_tenor_sus` | Tenor recorder, sustained | Smooth, mellow, sustained |

### Woodwinds — Ocarina

| Sample Name | Description | Tone |
|---|---|---|
| `ocarina_small_stacc` | Small ocarina, staccato | Tiny, pure, chirpy |
| `ocarina_small` | Small ocarina | Sweet, high, folk |
| `ocarina` | Standard ocarina | Round, pure, earthy |
| `ocarina_vib` | Ocarina with vibrato | Warm, wavering, ancient |

### Woodwinds — Saxophone

| Sample Name | Description | Tone |
|---|---|---|
| `sax` | Saxophone (tenor or alto) | Smooth, warm, jazzy |
| `saxello` | Saxello (curved soprano sax) | Nasal, bright, unusual |
| `saxello_stacc` | Saxello, staccato | Short, punchy, brassy |
| `saxello_vib` | Saxello with vibrato | Expressive, singing, warm |

### Woodwinds — Harmonica

| Sample Name | Description | Tone |
|---|---|---|
| `harmonica` | Diatonic harmonica | Bluesy, breathy, soulful |
| `harmonica_soft` | Harmonica played softly | Gentle, whispery, intimate |
| `harmonica_vib` | Harmonica with vibrato | Expressive, wavering, warm |
| `super64` | Hohner Super 64 chromatic harmonica | Rich, full, chromatic |
| `super64_acc` | Super 64 with accented attack | Punchy, bright, pronounced |
| `super64_vib` | Super 64 with vibrato | Lush, wavering, expressive |

### Keyboards — Organ

| Sample Name | Description | Tone |
|---|---|---|
| `pipeorgan_loud_pedal` | Pipe organ, loud with pedal bass | Massive, thundering, majestic |
| `pipeorgan_loud` | Pipe organ, loud (manuals) | Full, powerful, grand |
| `pipeorgan_quiet_pedal` | Pipe organ, soft with pedal bass | Gentle, deep, reverent |
| `pipeorgan_quiet` | Pipe organ, soft (manuals) | Hushed, ethereal, sacred |
| `organ_4inch` | Organ with 4-foot stop | Bright, thin, reedy |
| `organ_8inch` | Organ with 8-foot stop | Full, warm, foundational |
| `organ_full` | Organ with all stops | Rich, massive, overwhelming |

### Other

| Sample Name | Description | Tone |
|---|---|---|
| `didgeridoo` | Australian Aboriginal didgeridoo | Droning, deep, overtone-rich |
