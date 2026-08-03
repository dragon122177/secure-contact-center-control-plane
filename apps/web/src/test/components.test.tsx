import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../components/DataState.js';
import { PageHeader } from '../components/PageHeader.js';
import { StatusBadge } from '../components/StatusBadge.js';

describe('operations UI primitives', () => {
  it('labels and tones live operational statuses', () => {
    const { rerender } = render(<StatusBadge value="AVAILABLE" />);
    expect(screen.getByText('AVAILABLE')).toHaveClass('status-success');

    rerender(<StatusBadge value="FAILED" />);
    expect(screen.getByText('FAILED')).toHaveClass('status-danger');
  });

  it('renders an accessible page title and supporting text', () => {
    render(
      <PageHeader
        eyebrow="Routing"
        title="Queues & routing"
        description="Deterministic assignment rules"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Queues & routing' })).toBeInTheDocument();
    expect(screen.getByText('Deterministic assignment rules')).toBeInTheDocument();
  });

  it('communicates an empty state without a blank panel', () => {
    render(<EmptyState message="No calls match this filter." />);
    expect(screen.getByText('No calls match this filter.')).toBeVisible();
  });
});
