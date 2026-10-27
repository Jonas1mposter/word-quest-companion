import { describe, expect, it } from 'vitest';
import { botPlayer } from '@/lib/matchmaking';

describe('server-issued fallback identity', () => {
  it('uses AG·f4ngeer from the assigned slot and identifies it as a bot', () => {
    const p = botPlayer(2, { bot_slots: [2], identities: { '2': 'AG·f4ngeer' } });
    expect(p.username).toBe('AG·f4ngeer（人机）');
    expect(p.isAI).toBe(true);
  });
  it('keeps different slots assigned to their server names', () => {
    const bots = { bot_slots: [2, 4], identities: { '2': 'AG·f4ngeer', '4': 'EDG·ZmjjKK' } };
    expect(botPlayer(4, bots).username).toBe('EDG·ZmjjKK（人机）');
  });
  it('keeps server-selected cosmetics in the assigned slot across reloads', () => {
    const outfit = { name_card: { id: 'card', name: '学霸新星', background_gradient: '', icon: null, rarity: 'rare', rank_position: null }, badges: [{ id: 'badge', name: '初出茅庐', icon: 'Swords', rarity: 'common', slot: 0 }] };
    const bots = { bot_slots: [2, 4], cosmetics: { '2': outfit } };
    expect(botPlayer(2, bots).botCosmetics).toEqual(outfit);
    expect(botPlayer(2, bots).botCosmetics).toEqual(botPlayer(2, bots).botCosmetics);
    expect(botPlayer(4, bots).botCosmetics).toBeUndefined();
  });
});