/**
 * hud.js — HUD template interpolation.
 * Resolves {{name}} in templates against player state.
 *
 * Built-in variables: health, max-health, inventory-count
 * Counter variables: any world-scoped counter by name
 */

/**
 * Interpolate a HUD template with player state values.
 * @param {string} template — e.g. "HP: {{health}}/{{max-health}} | Score: {{score}}"
 * @param {string} worldDtag — world event d-tag for counter key prefix
 * @param {Object} playerState — full player state object
 * @returns {string} — interpolated string
 */
export function interpolateHud(template, worldDtag, playerState = {}) {
  return template.replace(/\{\{([\w-]+)\}\}/g, (_, name) => {
    // Built-in variables
    if (name === 'health') return String(playerState.health ?? 0);
    if (name === 'max-health') return String(playerState.maxHealth ?? 0);
    if (name === 'inventory-count') return String(playerState.inventory?.length ?? 0);

    // Player counter (world-scoped)
    const key = `${worldDtag}:${name}`;
    const val = playerState.counters?.[key];
    return val !== undefined ? String(val) : '0';
  });
}
