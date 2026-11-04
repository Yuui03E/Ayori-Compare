import { describe, expect, it } from 'vitest';
import { residentSlots } from './residency';
describe('large collection working set', () => {
  it('keeps arbitrary selected pairs, previous flicker source and all quadrants while staying bounded', () => {
    for (let a = 0; a < 100; a++) {
      const slots = residentSlots(100, a, 99, 65, true);
      expect(slots.length).toBeLessThanOrEqual(8);
      expect(new Set(slots)).toEqual(new Set(slots.filter((s) => s >= 0 && s < 100)));
      for (const required of [a, 99, 65, 0, 1, 2, 3]) expect(slots).toContain(required);
    }
  });
  it('preserves the fully resident small-comparison path', () => {
    expect(residentSlots(4, 0, 1, 1, false)).toEqual([0, 1, 2, 3]);
    expect(residentSlots(8, 7, 6, 0, true)).toHaveLength(8);
  });
});
