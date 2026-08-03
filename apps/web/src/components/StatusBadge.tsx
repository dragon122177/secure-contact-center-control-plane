import type { ReactNode } from 'react';

const toneByValue: Record<string, string> = {
  AVAILABLE: 'success',
  ACTIVE: 'success',
  SUCCEEDED: 'success',
  ALLOW: 'success',
  ON_CALL: 'info',
  RINGING: 'info',
  ROUTING: 'info',
  RUNNING: 'info',
  RESERVED: 'warning',
  WRAP_UP: 'warning',
  BREAK: 'warning',
  PENDING: 'warning',
  QUEUED: 'warning',
  ABANDONED: 'danger',
  FAILED: 'danger',
  DENY: 'danger',
  OFFLINE: 'neutral',
  COMPLETED: 'neutral',
};

export function StatusBadge({ value, children }: { value: string; children?: ReactNode }) {
  const tone = toneByValue[value] ?? 'neutral';
  return (
    <span className={`status-badge status-${tone}`}>{children ?? value.replaceAll('_', ' ')}</span>
  );
}
