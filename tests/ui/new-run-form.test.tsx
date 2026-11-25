import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { NewRunForm } from '@/app/new/_components/NewRunForm';

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

function reply(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ status, ok: status < 300, json: async () => body });
}

const compInput = () => screen.getByPlaceholderText('Type a handle and press Enter');

describe('NewRunForm', () => {
  it('adds a tag when a comma is typed', async () => {
    render(<NewRunForm />);
    await userEvent.type(compInput(), '@Alpha,');
    expect(screen.getByRole('button', { name: 'Remove @alpha' })).toBeTruthy();
  });

  it('adds several tags from a paste', async () => {
    render(<NewRunForm />);
    await userEvent.click(compInput());
    await userEvent.paste('a, b c');
    expect(screen.getAllByRole('button', { name: /^Remove @/ })).toHaveLength(3);
  });

  it('removes the last tag on Backspace in an empty input', async () => {
    render(<NewRunForm />);
    await userEvent.type(compInput(), 'one,two,');
    await userEvent.keyboard('{Backspace}');
    expect(screen.getAllByRole('button', { name: /^Remove @/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Remove @two' })).toBeNull();
  });

  it('rejects the client handle as a competitor', async () => {
    render(<NewRunForm />);
    await userEvent.type(screen.getByLabelText('Client account'), '@me');
    await userEvent.type(compInput(), 'me,');
    expect(screen.getByText('@me is already the client.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove @me' })).toBeNull();
  });

  it('validates an empty client on blur', async () => {
    render(<NewRunForm />);
    const client = screen.getByLabelText('Client account');
    await userEvent.click(client);
    await userEvent.tab();
    expect(screen.getByText("Enter the client's Instagram handle.")).toBeTruthy();
  });

  it('focuses the competitor input when too few competitors are added', async () => {
    render(<NewRunForm />);
    await userEvent.type(screen.getByLabelText('Client account'), 'me');
    await userEvent.type(compInput(), 'one,');
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(screen.getByText('Add 2 more competitors. You need 3 to 10.')).toBeTruthy();
    expect(document.activeElement).toBe(compInput());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  async function fillValid() {
    await userEvent.type(screen.getByLabelText('Client account'), 'me');
    await userEvent.type(compInput(), 'a,b,c,');
  }

  it('shows a 409 error above the submit buttons', async () => {
    reply(409, { error: 'Another run is already in progress.' });
    render(<NewRunForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Another run is already in progress.');
  });

  it('navigates to the run on 201', async () => {
    reply(201, { runId: 'abc' });
    render(<NewRunForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/runs/abc'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ niche: 'AI', client: 'me', competitors: ['a', 'b', 'c'] });
  });

  it('shows field errors from a 400', async () => {
    reply(400, { errors: { client: 'Server says no.' } });
    render(<NewRunForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(await screen.findByText('Server says no.')).toBeTruthy();
  });

  it('shows a connection message when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fail'));
    render(<NewRunForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not reach the server. Check your connection and try again.',
    );
  });

  it('prefills from initial and updates the summary', () => {
    render(<NewRunForm initial={{ niche: 'Gaming', client: 'me', competitors: ['a', 'b', 'c'] }} />);
    expect(screen.getByRole('button', { name: 'Gaming' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('~4 min')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('button', { name: /^Remove @/ })).toBeNull();
  });
  it('keeps focus on the competitor input when removing a tag at the 10 limit', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
    render(<NewRunForm initial={{ niche: 'AI', client: 'me', competitors: ten }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove @c3' }));
    const input = document.getElementById('comp-in');
    expect(screen.queryByRole('button', { name: 'Remove @c3' })).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('does not submit when the draft holds an invalid handle', async () => {
    reply(201, { runId: 'abc' });
    render(<NewRunForm />);
    await fillValid();
    await userEvent.type(compInput(), 'me');
    await userEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(screen.getByText('@me is already the client.')).toBeTruthy();
    expect(document.activeElement).toBe(compInput());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
