import { defineControls } from 'tempo-sdk/assets';
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'info' | 'warning' }) {
  return <span className="status-badge" data-tone={tone}><span className="status-dot" aria-hidden="true" />{label}</span>;
}
defineControls(StatusBadge, { label: { type: 'text' }, tone: { type: 'select' } });
