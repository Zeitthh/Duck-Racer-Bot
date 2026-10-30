import type { XpEvent } from '@duckbot/db';
import { describe, expect, it } from 'vitest';
import { multiplierFor } from './lib/events';

const ev = (multiplier: number, channelId: string | null): XpEvent => ({
  id: `${multiplier}-${channelId}`,
  guildId: 'g',
  channelId,
  multiplier,
  startsAt: new Date(0),
  endsAt: new Date(8.64e15),
  createdById: 'u',
});

describe('multiplierFor', () => {
  it('is 1 without events', () => {
    expect(multiplierFor([], ['c1'])).toBe(1);
  });

  it('uses server-wide events and events of the channel (or its parent), but not other channels', () => {
    const events = [ev(1.5, null), ev(3, 'other'), ev(2, 'parent')];
    expect(multiplierFor(events, ['c1'])).toBe(1.5);
    expect(multiplierFor(events, ['thread', 'parent'])).toBe(2);
  });

  it('takes the highest multiplier instead of stacking them', () => {
    expect(multiplierFor([ev(2, null), ev(3, 'c1'), ev(1.5, 'c1')], ['c1'])).toBe(3);
  });
});
