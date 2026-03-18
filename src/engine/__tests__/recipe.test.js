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

    const msg = engine.output.find((o) => o.text === 'Already crafted.');
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
