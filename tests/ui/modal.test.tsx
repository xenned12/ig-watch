import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Modal } from '@/app/_components/Modal';

afterEach(cleanup);

function Harness(props: { onNext?: () => void; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <Modal
          labelledBy="t"
          onClose={() => {
            props.onClose?.();
            setOpen(false);
          }}
          onNext={props.onNext}
        >
          <h2 id="t">Title</h2>
          <button data-close aria-label="Close">x</button>
          <button>middle</button>
          <button>last</button>
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('Esc calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByText('open'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element moves to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('open'));
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
    screen.getByText('last').focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
  });

  it('returns focus to the opener after closing', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText('open');
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
  });

  it('ArrowRight calls onNext', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Harness onNext={onNext} />);
    await user.click(screen.getByText('open'));
    await user.keyboard('{ArrowRight}');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('backdrop click closes, click inside does not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByText('open'));
    await user.click(screen.getByText('Title'));
    expect(onClose).not.toHaveBeenCalled();
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
