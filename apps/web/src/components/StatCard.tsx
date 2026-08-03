import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}
