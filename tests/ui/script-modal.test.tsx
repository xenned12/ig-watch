import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/app/_components/Toast';
import { ScriptModal } from '@/app/runs/[id]/_components/ScriptModal';
import type { Script } from '@/lib/types';

afterEach(cleanup);

const script: Script = {
  name: 'The prompt fix',
  lengthS: 20,
  patterns: ['Bold claim hook: a very long pattern name that would overflow a card'],
  hook: "You're prompting ChatGPT wrong.",
  beats: [
    { at: '0–3s', voiceover: "You're prompting ChatGPT wrong.", onScreen: 'STOP DOING THIS', direction: 'Close-up.' },
    { at: '3–20s', voiceover: 'Give it a role, an example and a format. Save this.', onScreen: '', direction: 'Screen recording.' },
  ],
  cta: 'Save this.',
};

const renderModal = (s: Script) =>
  render(<ToastProvider><ScriptModal script={s} index={1} total={3} onClose={vi.fn()} /></ToastProvider>);

describe('ScriptModal', () => {
  it('shows every beat word for word with timing, on-screen text and shot', () => {
    renderModal(script);
    expect(screen.getByRole('dialog', { name: 'The prompt fix' })).toBeTruthy();
    expect(screen.getByText('Recommended script 2 of 3')).toBeTruthy();
    expect(screen.getByText('Give it a role, an example and a format. Save this.')).toBeTruthy();
    expect(screen.getByText('STOP DOING THIS')).toBeTruthy();
    expect(screen.getByText('Hook')).toBeTruthy();
    expect(screen.getByText('Call to action')).toBeTruthy();
    expect(screen.getByText('15 words')).toBeTruthy();
  });
  it('has no Prev or Next controls', () => {
    renderModal(script);
    expect(screen.queryByRole('button', { name: /previous|next/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy full script' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy voiceover only' })).toBeTruthy();
  });
  it('explains older one-line scripts', () => {
    renderModal({ ...script, beats: [{ at: '0–3s', text: 'Hook to camera.' }] });
    expect(screen.getByText(/saved before full scripts were added/)).toBeTruthy();
    expect(screen.getByText('Hook to camera.')).toBeTruthy();
  });
});
