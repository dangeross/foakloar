/**
 * Tests for sound decompile — Strudel code → tag arrays.
 */
import { describe, it, expect } from 'vitest';
import { decompileStrudelCode, buildStrudelCodeFromTags } from '../../services/sound.js';

describe('decompileStrudelCode', () => {
  it('extracts note pattern', () => {
    const tags = decompileStrudelCode('note("c3 e3 g3").s("sine").gain(0.5)');
    expect(tags).toContainEqual(['note', 'c3 e3 g3']);
  });

  it('extracts oscillator from .s()', () => {
    const tags = decompileStrudelCode('note("c3").s("triangle").gain(0.5)');
    expect(tags).toContainEqual(['oscillator', 'triangle']);
  });

  it('extracts noise source', () => {
    const tags = decompileStrudelCode('noise().lpf(400).gain(0.3)');
    expect(tags).toContainEqual(['noise', '']);
    expect(tags).toContainEqual(['lpf', '400']);
  });

  it('extracts float methods', () => {
    const tags = decompileStrudelCode('note("c3").s("sine").slow(2).gain(0.5).lpf(400).hpf(200).room(0.8)');
    expect(tags).toContainEqual(['slow', '2']);
    expect(tags).toContainEqual(['gain', '0.5']);
    expect(tags).toContainEqual(['lpf', '400']);
    expect(tags).toContainEqual(['hpf', '200']);
    expect(tags).toContainEqual(['room', '0.8']);
  });

  it('extracts crush as integer', () => {
    const tags = decompileStrudelCode('note("c3").s("sine").crush(4)');
    expect(tags).toContainEqual(['crush', '4']);
  });

  it('extracts delay with two values', () => {
    const tags = decompileStrudelCode('note("c3").delay(0.5, 0.3)');
    expect(tags).toContainEqual(['delay', '0.5', '0.3']);
  });

  it('extracts degradeBy', () => {
    const tags = decompileStrudelCode('noise().degradeBy(0.3)');
    expect(tags).toContainEqual(['degrade-by', '0.3']);
  });

  it('extracts rand gain', () => {
    const tags = decompileStrudelCode('noise().gain(rand.range(0.1, 0.4))');
    expect(tags).toContainEqual(['rand', '0.1', '0.4']);
  });

  it('extracts rev and palindrome', () => {
    const tags = decompileStrudelCode('note("c3").rev().palindrome()');
    expect(tags).toContainEqual(['rev', '']);
    expect(tags).toContainEqual(['palindrome', '']);
  });

  it('extracts jux', () => {
    const tags = decompileStrudelCode('note("c3").jux(rev)');
    expect(tags).toContainEqual(['jux', 'rev']);
  });

  it('extracts arp', () => {
    const tags = decompileStrudelCode('note("c3 e3 g3").arp("up")');
    expect(tags).toContainEqual(['arp', 'up']);
  });

  it('extracts envelope tags', () => {
    const tags = decompileStrudelCode('note("c3").sustain(2).attack(0.1).release(0.5)');
    expect(tags).toContainEqual(['sustain', '2']);
    expect(tags).toContainEqual(['attack', '0.1']);
    expect(tags).toContainEqual(['release', '0.5']);
  });

  it('returns empty array for empty input', () => {
    expect(decompileStrudelCode('')).toEqual([]);
    expect(decompileStrudelCode(null)).toEqual([]);
  });
});

describe('round-trip: tags → code → tags', () => {
  it('basic note + oscillator round-trips', () => {
    const original = [
      ['note', 'c3 e3 g3'],
      ['oscillator', 'sine'],
      ['slow', '2'],
      ['gain', '0.5'],
    ];
    const code = buildStrudelCodeFromTags(original);
    expect(code).toBeTruthy();
    const decompiled = decompileStrudelCode(code);
    expect(decompiled).toContainEqual(['note', 'c3 e3 g3']);
    expect(decompiled).toContainEqual(['oscillator', 'sine']);
    expect(decompiled).toContainEqual(['slow', '2']);
  });

  it('noise + effects round-trips', () => {
    const original = [
      ['noise', ''],
      ['lpf', '400'],
      ['crush', '6'],
      ['degrade-by', '0.3'],
    ];
    const code = buildStrudelCodeFromTags(original);
    expect(code).toBeTruthy();
    const decompiled = decompileStrudelCode(code);
    expect(decompiled).toContainEqual(['noise', '']);
    expect(decompiled).toContainEqual(['lpf', '400']);
    expect(decompiled).toContainEqual(['crush', '6']);
    expect(decompiled).toContainEqual(['degrade-by', '0.3']);
  });
});
