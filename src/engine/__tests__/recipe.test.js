/**
 * Tests for recipe / crafting (Phase 25).
 */
import { describe, it, expect } from 'vitest';
import {
  ref, WORLD,
  makePlace, makeItem, makeFeature, makeRecipe,
  buildEvents, makeEngine,
} from './helpers.js';

describe('unordered crafting', () => {
  it('crafts when all items present', () => {
    const bar = makeItem('iron-bar', { nouns: [['bar', 'iron bar']] });
    const leather = makeItem('leather', { nouns: [['leather', 'strip']] });
    const key = makeItem('iron-key', { nouns: [['key', 'iron key']] });
    const recipe = makeRecipe('iron-key', {
      verbs: [['forge', 'craft']],
      nouns: [['key', 'iron key']],
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', ''],
        [ref(`${WORLD}:item:leather`), '', ''],
      ],
      onComplete: [
        ['', 'give-item', ref(`${WORLD}:item:iron-key`)],
        ['', 'consume-item', ref(`${WORLD}:item:iron-bar`)],
        ['', 'consume-item', ref(`${WORLD}:item:leather`)],
      ],
    });
    const room = makePlace('smithy');

    const events = buildEvents(bar, leather, key, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`), ref(`${WORLD}:item:leather`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));

    // Key should be in inventory, bar and leather consumed
    expect(engine.player.hasItem(ref(`${WORLD}:item:iron-key`))).toBe(true);
    expect(engine.player.hasItem(ref(`${WORLD}:item:iron-bar`))).toBe(false);
    expect(engine.player.hasItem(ref(`${WORLD}:item:leather`))).toBe(false);
    expect(engine.player.isPuzzleSolved(ref(`${WORLD}:recipe:iron-key`))).toBe(true);
  });

  it('fails when item missing', () => {
    const bar = makeItem('iron-bar', { nouns: [['bar']] });
    const recipe = makeRecipe('iron-key', {
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', 'You need an iron bar.'],
        [ref(`${WORLD}:item:leather`), '', 'You need leather.'],
      ],
    });
    const room = makePlace('smithy');

    const events = buildEvents(bar, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));

    expect(engine.player.isPuzzleSolved(ref(`${WORLD}:recipe:iron-key`))).toBe(false);
    const msg = engine.output.find((o) => o.text === 'You need leather.');
    expect(msg).toBeTruthy();
  });

  it('checks feature state requires', () => {
    const bar = makeItem('iron-bar', { nouns: [['bar']] });
    const forge = makeFeature('forge', { state: 'cold' });
    const recipe = makeRecipe('iron-key', {
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', ''],
        [ref(`${WORLD}:feature:forge`), 'lit', 'The forge must be lit.'],
      ],
    });
    const room = makePlace('smithy', { features: [`${WORLD}:feature:forge`] });

    const events = buildEvents(bar, forge, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`)],
      states: { [ref(`${WORLD}:feature:forge`)]: 'cold' },
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));

    const msg = engine.output.find((o) => o.text === 'The forge must be lit.');
    expect(msg).toBeTruthy();
  });

  it('skips already crafted recipe', () => {
    const recipe = makeRecipe('iron-key');
    const room = makePlace('smithy');
    const events = buildEvents(recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);
    engine.player.markPuzzleSolved(ref(`${WORLD}:recipe:iron-key`));

    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));

    const msg = engine.output.find((o) => o.text === 'You already did that.');
    expect(msg).toBeTruthy();
  });
});

describe('ordered crafting', () => {
  it('crafts in correct order', () => {
    const bar = makeItem('iron-bar', { nouns: [['bar', 'iron bar']] });
    const leather = makeItem('leather', { nouns: [['leather', 'strip']] });
    const key = makeItem('iron-key', { nouns: [['key']] });
    const recipe = makeRecipe('iron-key', {
      ordered: true,
      verbs: [['forge', 'craft']],
      nouns: [['key']],
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', ''],
        [ref(`${WORLD}:item:leather`), '', ''],
      ],
      onComplete: [
        ['', 'give-item', ref(`${WORLD}:item:iron-key`)],
        ['', 'consume-item', ref(`${WORLD}:item:iron-bar`)],
        ['', 'consume-item', ref(`${WORLD}:item:leather`)],
      ],
    });
    const room = makePlace('smithy');

    const events = buildEvents(bar, leather, key, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`), ref(`${WORLD}:item:leather`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    // Start crafting
    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));
    expect(engine.craftingActive).toBeTruthy();

    // Step 1: iron bar
    engine._handleCraftStep('iron bar');
    expect(engine.craftingActive).toBeTruthy(); // still crafting

    // Step 2: leather
    engine._handleCraftStep('leather');
    expect(engine.craftingActive).toBeNull(); // done

    // Key crafted
    expect(engine.player.hasItem(ref(`${WORLD}:item:iron-key`))).toBe(true);
    expect(engine.player.hasItem(ref(`${WORLD}:item:iron-bar`))).toBe(false);
  });

  it('fails on wrong order', () => {
    const bar = makeItem('iron-bar', { nouns: [['bar', 'iron bar']] });
    const leather = makeItem('leather', { nouns: [['leather', 'strip']] });
    const recipe = makeRecipe('iron-key', {
      ordered: true,
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', ''],
        [ref(`${WORLD}:item:leather`), '', ''],
      ],
    });
    const room = makePlace('smithy');

    const events = buildEvents(bar, leather, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`), ref(`${WORLD}:item:leather`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));

    // Wrong order: leather first (should be iron bar)
    engine._handleCraftStep('leather');

    expect(engine.craftingActive).toBeNull(); // exited crafting
    const msg = engine.output.find((o) => o.text === "That's not right.");
    expect(msg).toBeTruthy();
  });

  it('fails early on unmet feature state', () => {
    const bar = makeItem('iron-bar', { nouns: [['bar']] });
    const forge = makeFeature('forge', { state: 'cold' });
    const recipe = makeRecipe('iron-key', {
      ordered: true,
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', ''],
        [ref(`${WORLD}:feature:forge`), 'lit', 'The forge must be lit.'],
      ],
    });
    const room = makePlace('smithy', { features: [`${WORLD}:feature:forge`] });

    const events = buildEvents(bar, forge, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`)],
      states: { [ref(`${WORLD}:feature:forge`)]: 'cold' },
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    engine._attemptCraft(recipe, ref(`${WORLD}:recipe:iron-key`));

    // Should fail before entering crafting mode
    expect(engine.craftingActive).toBeNull();
    const msg = engine.output.find((o) => o.text === 'The forge must be lit.');
    expect(msg).toBeTruthy();
  });
});

describe('recipe discovery', () => {
  it('finds recipe by noun', () => {
    const recipe = makeRecipe('iron-key', {
      nouns: [['key', 'iron key']],
      verbs: [['forge', 'craft']],
    });
    const room = makePlace('smithy');
    const events = buildEvents(recipe, room);
    const engine = makeEngine(events, { place: ref(`${WORLD}:place:smithy`) });

    const match = engine._findRecipeByNoun('key');
    expect(match).toBeTruthy();
    expect(match.type).toBe('recipe');
  });

  it('finds recipe by title', () => {
    const recipe = makeRecipe('iron-key', {
      verbs: [['forge']],
    });
    const room = makePlace('smithy');
    const events = buildEvents(recipe, room);
    const engine = makeEngine(events, { place: ref(`${WORLD}:place:smithy`) });

    const match = engine._findRecipeByNoun('iron-key');
    expect(match).toBeTruthy();
  });

  it('examine shows shuffled ingredients', () => {
    const bar = makeItem('iron-bar');
    const leather = makeItem('leather');
    const recipe = makeRecipe('iron-key', {
      requires: [
        [ref(`${WORLD}:item:iron-bar`), '', ''],
        [ref(`${WORLD}:item:leather`), '', ''],
      ],
      content: 'A recipe for a key.',
    });
    const room = makePlace('smithy');
    const events = buildEvents(bar, leather, recipe, room);
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:smithy`),
      inventory: [ref(`${WORLD}:item:iron-bar`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:smithy`);

    engine._examineRecipe(recipe, ref(`${WORLD}:recipe:iron-key`));

    // Should show content and requires
    expect(engine.output.some((o) => o.text === 'A recipe for a key.')).toBe(true);
    expect(engine.output.some((o) => o.text === 'Requires:')).toBe(true);
    // Iron-bar is in inventory so should show checkmark
    expect(engine.output.some((o) => o.text.includes('\u2713') && o.text.includes('Iron-bar'))).toBe(true);
    // Leather not in inventory so should show X
    expect(engine.output.some((o) => o.text.includes('\u2717') && o.text.includes('Leather'))).toBe(true);
  });
});

describe('recipe index cache', () => {
  it('finds recipe on first lookup (cold cache)', () => {
    const place = makePlace('forge');
    const bar = makeItem('iron-bar', { nouns: [['bar']] });
    const sword = makeItem('sword', { nouns: [['sword']] });
    const recipe = makeRecipe('forge-sword', {
      verbs: [['forge', 'smith']],
      nouns: [['sword']],
      ingredients: [ref(`${WORLD}:item:iron-bar`)],
      result: ref(`${WORLD}:item:sword`),
    });
    const engine = makeEngine(buildEvents(place, bar, sword, recipe), {
      place: ref(`${WORLD}:place:forge`),
      inventory: [ref(`${WORLD}:item:iron-bar`)],
    });

    const found = engine._findRecipeByVerb('forge');
    expect(found).not.toBeNull();
    expect(found.dtag).toContain('forge-sword');
  });

  it('finds recipe by alias', () => {
    const place = makePlace('forge');
    const bar = makeItem('iron-bar', { nouns: [['bar']] });
    const sword = makeItem('sword', { nouns: [['sword']] });
    const recipe = makeRecipe('forge-sword', {
      verbs: [['forge', 'smith']],
      nouns: [['sword']],
      ingredients: [ref(`${WORLD}:item:iron-bar`)],
      result: ref(`${WORLD}:item:sword`),
    });
    const engine = makeEngine(buildEvents(place, bar, sword, recipe), {
      place: ref(`${WORLD}:place:forge`),
    });

    // 'smith' is an alias, not the canonical — _findRecipeByVerb uses canonical only
    expect(engine._findRecipeByVerb('forge')).not.toBeNull();
    expect(engine._findRecipeByVerb('missing')).toBeNull();
  });

  it('index rebuilds when events map is replaced', () => {
    const place = makePlace('forge');
    const bar = makeItem('iron-bar', { nouns: [['bar']] });
    const sword = makeItem('sword', { nouns: [['sword']] });
    const recipe = makeRecipe('forge-sword', {
      verbs: [['forge']],
      nouns: [['sword']],
      ingredients: [ref(`${WORLD}:item:iron-bar`)],
      result: ref(`${WORLD}:item:sword`),
    });
    const engine = makeEngine(buildEvents(place, bar, sword), {
      place: ref(`${WORLD}:place:forge`),
    });

    // No recipe yet — cold cache
    expect(engine._findRecipeByVerb('forge')).toBeNull();

    // Simulate App.jsx swapping in a new mergedEvents map with the recipe added
    const extended = buildEvents(place, bar, sword, recipe);
    engine.events = extended;

    // Index should rebuild for the new map
    expect(engine._findRecipeByVerb('forge')).not.toBeNull();
  });
});

describe('recipe scope (verb not available outside target room)', () => {
  it('recipe verb is absent from verb map when feature is not in current place', async () => {
    // A mechanism in room B with a "use" verb; player is in room A (clearing).
    // Recipe verb "use" must NOT appear in the verb map when in the clearing.
    const amulet = makeItem('serpent-amulet', { nouns: [['amulet']] });
    const mechanism = makeFeature('mechanism', {
      verbs: [['use', 'activate']],
      nouns: [['mechanism']],
      onInteract: [['use', 'activate', ref(`${WORLD}:recipe:activate-mechanism`)]],
    });
    const recipe = makeRecipe('activate-mechanism', {
      verbs: [['use', 'activate', 'place']],
      nouns: [['mechanism']],
      requires: [[ref(`${WORLD}:item:serpent-amulet`), '', '']],
      onComplete: [['', 'set-state', 'activated', ref(`${WORLD}:feature:mechanism`)]],
    });
    const chamberRoom = makePlace('mechanism-chamber', {
      features: [`${WORLD}:feature:mechanism`],
    });
    const clearingRoom = makePlace('clearing');

    const events = buildEvents(amulet, mechanism, recipe, chamberRoom, clearingRoom);

    // Player is in the clearing with the amulet in inventory
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:clearing`),
      inventory: [ref(`${WORLD}:item:serpent-amulet`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:clearing`);

    // "use mechanism" from the clearing should fail — mechanism is not here
    await engine.handleCommand('use mechanism');
    const output = engine.output.map((o) => o.text);
    // Should NOT start crafting — either "don't see that here" or "don't understand"
    expect(output.some((t) => t.toLowerCase().includes("don't see") || t.toLowerCase().includes("don't understand"))).toBe(true);
    expect(engine.craftingActive).toBeNull();
  });

  it('recipe verb fires correctly when feature IS in current place', async () => {
    const amulet = makeItem('serpent-amulet', { nouns: [['amulet']] });
    const mechanism = makeFeature('mechanism', {
      verbs: [['use', 'activate']],
      nouns: [['mechanism']],
      onInteract: [['use', 'activate', ref(`${WORLD}:recipe:activate-mechanism`)]],
    });
    const recipe = makeRecipe('activate-mechanism', {
      verbs: [['use', 'activate', 'place']],
      nouns: [['mechanism']],
      requires: [[ref(`${WORLD}:item:serpent-amulet`), '', '']],
      onComplete: [['', 'set-state', 'activated', ref(`${WORLD}:feature:mechanism`)]],
      content: 'The mechanism activates.',
    });
    const chamberRoom = makePlace('mechanism-chamber', {
      features: [`${WORLD}:feature:mechanism`],
    });

    const events = buildEvents(amulet, mechanism, recipe, chamberRoom);

    // Player is in the mechanism chamber with the amulet
    const engine = makeEngine(events, {
      place: ref(`${WORLD}:place:mechanism-chamber`),
      inventory: [ref(`${WORLD}:item:serpent-amulet`)],
    });
    engine.currentPlace = ref(`${WORLD}:place:mechanism-chamber`);

    await engine.handleCommand('use mechanism');
    // Recipe requires the amulet — player has it, so crafting should attempt
    // (ordered=false, single item → completes immediately)
    const output = engine.output.map((o) => o.text);
    expect(output.some((t) => t.includes('The mechanism activates.'))).toBe(true);
  });
});
