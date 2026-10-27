/**
 * The header photo, full screen (#295): tapping it opens the photo it showed, Next and the arrow
 * keys go through the others (mirrored in Arabic), Zoom in shows it at full size, and Escape or
 * Back close it on the photo it was left at.
 */
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PIXEL } from '@/api/inventory/mock/files';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import type { AttachmentView } from '@/api/inventory/types';
import { type MockState, ownerScenario } from '@/api/mock/fixtures';
import { renderThingPart } from '@/test/thing-part';
import { PhotoCarousel } from './photos';

vi.setConfig({ testTimeout: 20_000 });

const photo = (id: string): AttachmentView => ({
  id,
  role: 'photo',
  sort: 0,
  file: {
    id: `${id}-file`,
    sha256: id.padEnd(64, '0'),
    bytes: 1,
    mime: 'image/png',
    class: 'photo',
    hasGps: false,
    width: 1,
    height: 1,
    derivativeState: 'ready',
    thumbUrl: PIXEL,
    displayUrl: PIXEL,
  },
  url: null,
  subject: { thingId: INV_IDS.thing.tv },
  createdBy: { displayName: 'Ibrahim' },
  rowVersion: 1,
});

function withPhotos(count: number): MockState {
  const s = ownerScenario();
  const tv = s.inventory.things.find((t) => t.id === INV_IDS.thing.tv);
  if (!tv) throw new Error('no TV in the fixtures');
  tv.photos = Array.from({ length: count }, (_, n) => photo(`photo-${n + 1}`));
  return s;
}

const render = (locale: 'en' | 'ar' = 'en') =>
  renderThingPart(<PhotoCarousel />, {
    thingId: INV_IDS.thing.tv,
    state: withPhotos(3),
    locale,
    digits: 'western',
  });

// The viewer's history entry comes back off on a later task (ui/close-on-back.tsx): let it land
// here, not in the next case.
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  window.history.replaceState(null, '');
});

describe('a photo full screen', () => {
  it('tapping the photo opens it, and Next and the arrow keys go through the others', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    expect(within(viewer).getByRole('img', { name: 'Photo 1 of 3' })).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }));
    expect(within(viewer).getByRole('img', { name: 'Photo 2 of 3' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(within(viewer).getByRole('img', { name: 'Photo 3 of 3' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(viewer).getByRole('img', { name: 'Photo 2 of 3' })).toBeInTheDocument();
  });

  it('Zoom in shows it at full size, and Zoom out fits it again', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    await user.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
    expect(within(viewer).queryByRole('button', { name: 'Zoom in' })).toBeNull();
    await user.click(within(viewer).getByRole('button', { name: 'Zoom out' }));
    expect(within(viewer).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  });

  it('Escape closes it, and the header keeps the photo it was left at', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Photo 2 of 3' })).toBeInTheDocument();
  });

  it('Back closes it', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    await screen.findByRole('dialog', { name: 'Photos' });
    await act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('in Arabic the arrow keys mirror', async () => {
    const { user } = await render('ar');
    await user.click(await screen.findByRole('button', { name: /1/ }));
    const viewer = await screen.findByRole('dialog');
    const shown = () => within(viewer).getByRole('img').getAttribute('alt') ?? '';
    const first = shown();
    await user.keyboard('{ArrowLeft}');
    expect(shown()).not.toBe(first);
    await user.keyboard('{ArrowRight}');
    expect(shown()).toBe(first);
  });
});
