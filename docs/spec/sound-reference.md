# Sound System Reference

## Overview

The sound system uses [Strudel](https://strudel.cc) for WebAudio synthesis. World authors compose sounds as `sound` events with tags that map to Strudel functions. The client resolves these tags, builds Strudel code, and evaluates it for playback.

Built-in oscillators (`sine`, `triangle`, `sawtooth`, `square`) and `noise` work instantly. External audio samples can be loaded via the `sample` tag.

---

## Sound event

A `sound` event defines a reusable audio pattern. Other events reference it via `sound` tags with a-tag refs.

```json
{
  "kind": 30078,
  "tags": [
    ["d", "my-world:sound:cave-drone"],
    ["type", "sound"],
    ["t", "my-world"],
    ["note", "c2 ~ ~ ~"],
    ["oscillator", "sawtooth"],
    ["lpf", "200"],
    ["slow", "4"],
    ["gain", "0.4"]
  ]
}
```

---

## Sound tag functions

Each tag on a `sound` event maps to a Strudel function. The client reads these tags and builds the Strudel code chain automatically.

### Source tags

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `note` | Mini-notation: `c3`, `c3 e3 g3`, `c3*4`, `c3 ~ c3 ~` | `note("c3 e3 g3")` | Pitch sequence. Uses Strudel mini-notation for note patterns, rests (`~`), and repetition (`*`). |
| `oscillator` | `sine`, `triangle`, `sawtooth`, `square` | `.s("sine")` | Waveform shape. `sine` = smooth/pure, `triangle` = warm/soft, `sawtooth` = buzzy/harsh, `square` = hollow/retro. |
| `noise` | *(no value)* | `s("noise")` | White noise source. Useful as a base for wind, rain, fire, static effects when combined with filters. |

### Volume & timing

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `gain` | `0.0` – `1.0` | `.gain(0.3)` | Volume level. `0.0` = silent, `1.0` = full volume. |
| `slow` | Number > 1 | `.slow(2)` | Stretch the cycle — makes the pattern play slower. `slow 2` = half speed. |
| `fast` | Number > 1 | `.fast(2)` | Compress the cycle — makes the pattern play faster. `fast 2` = double speed. |
| `pan` | `-1.0` (left) to `1.0` (right) | `.pan(0.5)` | Stereo position. `0` = centre, `-1` = hard left, `1` = hard right. |

### Filters

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `lpf` | Frequency in Hz: `200`, `800`, `2000` | `.lpf(400)` | Low-pass filter — removes frequencies above the cutoff. Lower values = warmer, more muffled. Useful for drones, underwater, muted sounds. |
| `hpf` | Frequency in Hz: `200`, `1000`, `4000` | `.hpf(1000)` | High-pass filter — removes frequencies below the cutoff. Higher values = thinner, more airy. Useful for shimmer, sparkle, radio effects. |
| `vowel` | `a`, `e`, `i`, `o`, `u` or pattern `a e i o` | `.vowel("a e i o")` | Formant filter — shapes the sound to resemble vocal vowels. Cycles through vowel shapes when given a pattern. |

### Distortion

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `crush` | Bits: `1`–`16` (lower = harsher) | `.crush(4)` | Bit crusher — reduces audio resolution for retro/digital distortion. `16` = clean, `1` = extreme noise. |
| `shape` | `0.0`–`1.0` | `.shape(0.5)` | Soft distortion/saturation — adds warmth and presence. Higher values = more aggressive. |

### Effects

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `room` | `0.0`–`1.0` | `.room(0.5)` | Reverb wet/dry mix. `0` = dry (no reverb), `1` = fully wet. Adds space and depth. |
| `roomsize` | `1`–`10` | `.roomsize(4)` | Reverb room size. Larger values = bigger space, longer tail. Only meaningful with `room` > 0. |
| `delay` | Two values: time `0.0`–`1.0`, feedback `0.0`–`1.0` | `.delay(0.5, 0.3)` | Echo/delay effect. Time controls echo spacing, feedback controls how many repeats. |
| `rev` | *(no value)* | `.rev()` | Reverse the pattern order within each cycle. |
| `palindrome` | *(no value)* | `.palindrome()` | Play the pattern forward then backward, creating a mirrored loop. |

### Texture & randomness

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `degrade-by` | `0.0`–`1.0` | `.degradeBy(0.3)` | Randomly drop a percentage of events each cycle. Creates organic, irregular texture. `0.3` = drop ~30% of notes. |
| `rand` | Two values: min, max | `.gain(rand.range(0.1, 0.4))` | Random gain per event. Creates crackle, shimmer, or breathing effects by varying volume unpredictably. |

### Stereo & layering

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `jux` | `rev` | `.jux(rev)` | Stereo width effect — plays the pattern normally in the left channel and reversed in the right channel. Creates spatial movement. Currently only supports `rev` (a built-in Strudel function that reverses pattern order). |
| `stack` | Comma-separated sound-ref a-tags | `stack(pat1, pat2)` | Layer multiple sound events simultaneously. Each value is an a-tag reference to another `sound` event (e.g. `30078:<pk>:sound:drone`). The client resolves each ref, builds the Strudel code for each, and combines them into one layered output. |

### Pitch manipulation

| Tag | Values | Strudel | Effect |
|---|---|---|---|
| `arp` | `up`, `down`, `updown` | `.arp("up")` | Arpeggiate — if the note pattern contains chords, play them as individual notes in sequence. `up` = low to high, `down` = high to low, `updown` = bounce. |

---

## Sample tag

The `sample` tag on a `sound` event registers an external audio sample by name:

```
["sample", "<name>", "<url>"]
```

- **name**: short identifier used in patterns (e.g. `kick`, `rain`, `crackle`)
- **url**: full URL to an audio file (WAV, MP3, OGG). Can be hosted on blossom, CDN, or any public URL.

### How samples work

1. On world load, the client collects all `sample` tags from all `sound` events
2. Deduplicates by name (last-write-wins if same name appears with different URLs)
3. Calls Strudel's `samples()` once with the full map to preload audio files
4. Once loaded, any pattern can reference the sample by name in `note`: `["note", "crackle*8"]`

### Example: campfire with sample

```json
{
  "kind": 30078,
  "tags": [
    ["d", "my-world:sound:campfire"],
    ["type", "sound"],
    ["t", "my-world"],
    ["sample", "crackle", "https://blossom.example/crackle.wav"],
    ["note", "crackle*8"],
    ["gain", "0.4"],
    ["degrade-by", "0.3"],
    ["lpf", "800"]
  ]
}
```

This loads the `crackle` sample, plays it 8 times per cycle with ~30% random dropout and a low-pass filter — creating an organic fire sound.

**Note:** Sample loading is async. Patterns using samples won't play until the audio files are fetched. Built-in oscillators and `noise` work instantly.

---

## Sound roles

When a `sound` event is referenced from another event, the referencing tag declares a **role** and a **volume**:

```
["sound", "<a-tag-ref>", "<role>", "<volume>", "<state-gate?>"]
```

| Role | Behaviour |
|---|---|
| `ambient` | Continuous loop. Only one ambient plays per place. Crossfades on room change. |
| `layer` | Continuous loop layered on top of ambient. Multiple layers can play simultaneously. |
| `effect` | One-shot. Fires once when the event enters scope (e.g. entering a room). Re-fires if you leave and return. |

### Gain × volume

The sound event's `gain` tag sets the base volume of the sound definition. The `volume` element on the referencing `sound` tag controls the mix level at the point of use. These multiply:

```
finalVolume = soundEvent.gain × referencingTag.volume
```

This lets the same sound event be reused at different volumes in different places — e.g. a cave drone at `0.6` near the entrance and `0.8` deeper inside.

### State-gated sounds

The optional 5th element gates the sound on the parent event's current state:

```json
["sound", "30078:<pk>:sound:lantern-hum", "layer", "0.4", "on"]
```

This layer only plays when the parent event's state is `"on"`. If the state changes to something else, the layer stops. If it changes back to `"on"`, the layer restarts.

---

## Sound as action type

`sound` can be used as an action in any `on-*` trigger to play a one-shot sound:

```json
["on-interact", "use", "sound", "30078:<pk>:sound:click"]
["on-complete", "", "sound", "30078:<pk>:sound:fanfare"]
["on-health", "down", "50%", "sound", "30078:<pk>:sound:alarm"]
```

The referenced sound event is resolved, built into Strudel code, and played for one cycle.

---

## BPM

The world event can set the global tempo:

```json
["bpm", "90"]
```

Default is 120 BPM. This affects the cycle speed for all Strudel patterns in the world.

---

## Recipe examples

### Warm cave drone (oscillator only)

```json
{
  "tags": [
    ["d", "my-world:sound:cave-drone"],
    ["type", "sound"],
    ["t", "my-world"],
    ["note", "c2 ~ ~ ~"],
    ["oscillator", "sawtooth"],
    ["lpf", "200"],
    ["slow", "4"],
    ["gain", "0.4"]
  ]
}
```

### Water drip (oscillator + effects)

```json
{
  "tags": [
    ["d", "my-world:sound:water-drip"],
    ["type", "sound"],
    ["t", "my-world"],
    ["note", "e5 ~ ~ g5 ~ ~ a5 ~"],
    ["oscillator", "sine"],
    ["fast", "2"],
    ["delay", "0.3", "0.2"],
    ["gain", "0.3"]
  ]
}
```

### Wind (noise + filters)

```json
{
  "tags": [
    ["d", "my-world:sound:wind"],
    ["type", "sound"],
    ["t", "my-world"],
    ["noise", ""],
    ["lpf", "400"],
    ["rand", "0.05", "0.2"],
    ["slow", "4"],
    ["gain", "0.3"]
  ]
}
```

### Eerie shimmer (stereo + reversal)

```json
{
  "tags": [
    ["d", "my-world:sound:shimmer"],
    ["type", "sound"],
    ["t", "my-world"],
    ["note", "c4 eb4 g4"],
    ["oscillator", "sine"],
    ["jux", "rev"],
    ["slow", "8"],
    ["gain", "0.2"]
  ]
}
```

### Fire crackle (noise + distortion)

```json
{
  "tags": [
    ["d", "my-world:sound:fire-crackle"],
    ["type", "sound"],
    ["t", "my-world"],
    ["noise", ""],
    ["lpf", "800"],
    ["crush", "6"],
    ["rand", "0.1", "0.4"],
    ["gain", "0.3"]
  ]
}
```
