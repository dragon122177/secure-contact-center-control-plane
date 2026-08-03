import { AlertTriangle, LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading operational data…' }: { label?: string }) {
  return (
    <div className="data-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="data-state data-state-error" role="alert">
      <AlertTriangle size={22} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}
