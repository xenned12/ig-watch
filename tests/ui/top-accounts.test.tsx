import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopAccounts } from '@/app/new/_components/TopAccounts';
import { topAccountsFor } from '@/lib/niche-top-accounts';

afterEach(cleanup);

const fitness = topAccountsFor('Fitness');
const [first, second] = fitness;

function setup(props: Partial<Parameters<typeof TopAccounts>[0]> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  render(<TopAccounts niche="fitness" client="nobody" added={[]} max={10} onAdd={onAdd} onRemove={onRemove} {...props} />);
  return { onAdd, onRemove };
}

const chip = (handle: string) => screen.getByRole('button', { name: new RegExp(`^@${handle.replace(/\./g, '\\.')},`) });

describe('TopAccounts', () => {
  it('shows nothing for a niche that is not in the list', () => {
    const { container } = render(
      <TopAccounts niche="Vegan baking" client="" added={[]} max={10} onAdd={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows the curated list straight away, with no network call', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    setup();
    expect(screen.getByText('Top accounts in Fitness')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(fitness.length);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('adds an account on click', async () => {
    const { onAdd } = setup();
    await userEvent.click(chip(first.handle));
    expect(onAdd).toHaveBeenCalledWith(first.handle);
  });

  it('an added account is shown pressed and clicking it removes it', async () => {
    const { onRemove } = setup({ added: [first.handle] });
    const c = chip(first.handle);
    expect(c.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(c);
    expect(onRemove).toHaveBeenCalledWith(first.handle);
  });

  it('the client account and accounts past the limit cannot be added', async () => {
    const { onAdd } = setup({ client: first.handle, added: ['a', 'b'], max: 2 });
    await userEvent.click(chip(first.handle));
    await userEvent.click(chip(second.handle));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
