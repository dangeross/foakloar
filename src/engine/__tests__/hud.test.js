import { describe, it, expect } from 'vitest';
import { interpolateHud } from '../hud.js';

describe('HUD interpolation', () => {
  it('replaces single counter', () => {
    const result = interpolateHud('Score: {{score}}', 'test:world', { counters: { 'test:world:score': 42 } });
    expect(result).toBe('Score: 42');
  });

  it('replaces multiple counters', () => {
    const result = interpolateHud('Score: {{score}} | Moves: {{moves}}', 'test:world', {
      counters: { 'test:world:score': 100, 'test:world:moves': 25 },
    });
    expect(result).toBe('Score: 100 | Moves: 25');
  });

  it('defaults to 0 for missing counters', () => {
    const result = interpolateHud('Score: {{score}}', 'test:world', { counters: {} });
    expect(result).toBe('Score: 0');
  });

  it('handles template with no placeholders', () => {
    const result = interpolateHud('Static text', 'test:world', {});
    expect(result).toBe('Static text');
  });

  it('handles zero value correctly', () => {
    const result = interpolateHud('HP: {{health}}', 'test:world', { health: 0 });
    expect(result).toBe('HP: 0');
  });

  it('interpolates health and max-health', () => {
    const result = interpolateHud('HP: {{health}}/{{max-health}}', 'test:world', { health: 8, maxHealth: 10 });
    expect(result).toBe('HP: 8/10');
  });

  it('interpolates inventory-count', () => {
    const result = interpolateHud('Items: {{inventory-count}}', 'test:world', { inventory: ['a', 'b', 'c'] });
    expect(result).toBe('Items: 3');
  });

  it('mixes built-in and counter variables', () => {
    const result = interpolateHud('HP: {{health}} | Score: {{score}}', 'test:world', {
      health: 5,
      counters: { 'test:world:score': 42 },
    });
    expect(result).toBe('HP: 5 | Score: 42');
  });
});
