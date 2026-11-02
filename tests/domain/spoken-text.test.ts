import { describe, expect, it } from 'vitest';
import { spokenText } from '../../src/lib/domain/spoken-text';

describe('spokenText', () => {
  it('speaks the notation of a shortest-path explanation', () => {
    expect(spokenText('From A, the direct edge sets F ≤ 11.')).toBe('From A, the direct edge sets F is at most eleven.');
    expect(spokenText('F drops 11 → 7 through the A–C edge.')).toBe('F drops eleven, now seven through the A to C edge.');
    expect(spokenText('Checked route: A → C → E → F, cost 9.')).toBe('Checked route: A to C to E to F, cost nine.');
    expect(spokenText('dist[v] = min(dist[v], dist[u] + w)')).toBe('dist of v is min(dist of v, dist of u plus w)');
    expect(spokenText('Every other vertex starts at ∞.')).toBe('Every other vertex starts at infinity.');
  });
  it('leaves wording, decimals and large numbers alone', () => {
    expect(spokenText('Cost 2.5 beats 140, and well-known words stay.')).toBe('Cost 2.5 beats 140, and well-known words stay.');
    expect(spokenText('Round 3 of 7')).toBe('Round three of seven');
    expect(spokenText('B4 and x2 are names')).toBe('B4 and x2 are names');
    expect(spokenText('It costs 42.')).toBe('It costs forty-two.');
  });
});
