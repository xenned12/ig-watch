import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopAccounts } from '@/app/new/_components/TopAccounts';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({ status, ok: status < 300, json: async () => body });

const accounts = [
  { handle: 'lessie.fitness', fullName: 'Lessie', followers: 9_297_123, verified: false },
  { handle: 'zumba', fullName: 'Zumba', followers: 4_850_066, verified: true },
  { handle: 'me', fullName: 'Me', followers: 100, verified: false },
];

function setup(props: Partial<Parameters<typeof TopAccounts>[0]> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  render(<TopAccounts niche="fitness" client="me" added={[]} max={10} onAdd={onAdd} onRemove={onRemove} {...props} />);
  return { onAdd, onRemove };
}

describe('TopAccounts', () => {
  it('shows nothing for a niche that is not in the list', () => {
    setup({ niche: 'Vegan baking' });
    expect(screen.queryByText(/Top accounts in/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the top accounts for a listed niche and adds one on click', async () => {
    reply(200, { niche: 'Fitness', accounts, cached: true });
    const { onAdd } = setup();
    expect(await screen.findByText('Top accounts in Fitness')).toBeTruthy();
    const chip = await screen.findByRole('button', { name: /@zumba, 4\.9M followers, verified/ });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/niches/top?niche=Fitness');
    await userEvent.click(chip);
    expect(onAdd).toHaveBeenCalledWith('zumba');
  });

  it('an added account is shown pressed and clicking it removes it', async () => {
    reply(200, { niche: 'Fitness', accounts, cached: true });
    const { onRemove } = setup({ added: ['zumba'] });
    const chip = await screen.findByRole('button', { name: /@zumba/ });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(chip);
    expect(onRemove).toHaveBeenCalledWith('zumba');
  });

  it('the client account and accounts past the limit cannot be added', async () => {
    reply(200, { niche: 'Fitness', accounts, cached: true });
    const { onAdd } = setup({ added: [], max: 0 });
    const me = await screen.findByRole('button', { name: /@me/ });
    expect(me.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(me);
    await userEvent.click(screen.getByRole('button', { name: /@zumba/ }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('says it is searching while the first search runs', async () => {
    reply(202, { niche: 'Fitness', loading: true });
    setup();
    expect(await screen.findByText(/Finding top accounts/)).toBeTruthy();
  });

  it('shows an error with a retry button', async () => {
    reply(502, { error: 'Could not load top accounts right now. Try again.' });
    setup();
    expect(await screen.findByText('Could not load top accounts right now. Try again.')).toBeTruthy();
    reply(200, { niche: 'Fitness', accounts, cached: true });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /@zumba/ })).toBeTruthy();
  });
});
