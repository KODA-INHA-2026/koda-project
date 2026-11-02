import { defineControls } from 'tempo-sdk/assets';
export function Notice({ title, children, kind = 'info' }: { title: string; children: React.ReactNode; kind?: 'info' | 'error' }) {
  return <div className="notice" data-kind={kind} role={kind === 'error' ? 'alert' : undefined}><div><strong>{title}</strong><div className="notice-copy">{children}</div></div></div>;
}
defineControls(Notice, { title: { type: 'text' }, kind: { type: 'select' }, children: false });
