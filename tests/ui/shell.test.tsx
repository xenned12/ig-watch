import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

import { Shell } from '@/app/_components/Shell';

afterEach(cleanup);

describe('Shell recent runs', () => {
  it('shows the client handle and the niche as separate lines, with the full text available', () => {
    render(
      <Shell active="results" recent={[{ id: 'r1', niche: 'Health and wellness', clientHandle: 'heleniusaulavirtual' }]}>
        <p>page</p>
      </Shell>,
    );
    const link = screen.getByRole('link', { name: '@heleniusaulavirtual, Health and wellness' });
    expect(link.getAttribute('href')).toBe('/runs/r1');
    expect(link.getAttribute('title')).toBe('@heleniusaulavirtual · Health and wellness');
    expect(link.querySelector('.recent-handle')?.textContent).toBe('@heleniusaulavirtual');
    expect(link.querySelector('.recent-niche')?.textContent).toBe('Health and wellness');
    expect(link.querySelector('.recent-avatar')?.textContent).toBe('h');
  });
});
