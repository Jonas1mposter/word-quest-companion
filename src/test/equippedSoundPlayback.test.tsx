import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ getUser: vi.fn(), query: vi.fn(), ready: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mock.getUser }, from: mock.query } }));
vi.mock('@/lib/audioManager', () => ({ audioManager: { ensureReady: mock.ready } }));
import { reloadActiveSoundPack, useMatchSounds } from '@/hooks/useMatchSounds';

describe('equipped six-stage sound playback', () => {
  const urls = Array.from({ length: 6 }, (_, i) => `/singularity_${i + 1}.mp3`);
  let played: string[];
  let rejectPlayback: boolean;
  const start = vi.fn();
  beforeEach(() => {
    played = []; rejectPlayback = false;
    mock.getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    mock.query.mockImplementation((table: string) => {
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'profiles' ? { active_kill_sound_pack_id: 'singularity' } : { sound_urls: urls }, error: null }) };
      return q;
    });
    vi.stubGlobal('Audio', class {
      currentTime = 0; preload = '';
      constructor(public src: string) {}
      play() { played.push(this.src); return rejectPlayback ? Promise.reject(new Error('NotAllowed')) : Promise.resolve(); }
    });
    mock.ready.mockResolvedValue({ decodeAudioData: vi.fn(async () => ({})), destination: {}, createBufferSource: () => ({ connect: vi.fn(), start, buffer: null }) });
    start.mockClear();
  });
  it('plays all six Singularity stages, clamping later combos to stage six', async () => {
    await reloadActiveSoundPack();
    const { result } = renderHook(useMatchSounds);
    await act(async () => { for (let i = 1; i <= 7; i++) await result.current.playCombo(i); });
    expect(played).toEqual([...urls, urls[5]]);
  });
  it('retries after an initial unavailable session instead of caching default sounds forever', async () => {
    mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await reloadActiveSoundPack();
    const { result } = renderHook(useMatchSounds);
    await act(async () => { await result.current.playCombo(1); });
    await waitFor(() => expect(played).toEqual([urls[0]]));
  });
  it('plays decoded audio when HTML media playback is rejected', async () => {
    rejectPlayback = true;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    await reloadActiveSoundPack();
    const { result } = renderHook(useMatchSounds);
    await act(async () => { await result.current.playCombo(6); });
    expect(start).toHaveBeenCalledOnce();
  });
});