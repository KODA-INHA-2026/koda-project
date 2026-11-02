import { defineControls } from 'tempo-sdk/assets';
export function Icon({ name }: { name: 'document' | 'shield' | 'arrow' | 'lock' | 'grid' | 'clock' | 'key' | 'check' | 'search' | 'logout' }) {
  const paths = {
    document: 'M7 3h7l4 4v14H5V3h2Zm7 0v5h4M8 12h7M8 16h7',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
    arrow: 'M4 12h16m-6-6 6 6-6 6', lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
    grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
    clock: 'M12 8v5l3 2M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
    key: 'M14 6a4 4 0 1 1 4 4h-2l-2 2h-3v3H8v3H4v-4l10-8Z',
    check: 'm5 12 4 4L19 6', search: 'm16 16 5 5M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z',
    logout: 'M10 4H4v16h6m4-14 6 6-6 6M8 12h12',
  };
  return <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
defineControls(Icon, { name: { type: 'select' } });
