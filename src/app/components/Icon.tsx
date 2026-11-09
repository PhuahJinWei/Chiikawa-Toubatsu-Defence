// Small hand-made icon set (24×24, round strokes). No external icon font needed offline. 草 ('leaf') is the owner's
// weed picture once there is one.

import { art } from '../../art/store';

const PATHS: Record<string, string> = {
  map: 'M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5',
  book: 'M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20',
  bag: 'M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Zm3 0V7a4 4 0 0 1 8 0v1',
  play: 'M12 3.5 14.4 9l5.6.5-4.3 3.7 1.3 5.6L12 15.9 7 18.8l1.3-5.6L4 9.5 9.6 9 12 3.5Z',
  gear: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm7.4 2.8-.1-1.2 2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a7 7 0 0 0-2 1.2L4.7 5.8l-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9c.6.5 1.3.9 2 1.2l.4 2.5h5l.4-2.5c.7-.3 1.4-.7 2-1.2l2.4.9 2-3.4-2-1.6.1-1.2Z',
  pause: 'M9 5v14M15 5v14',
  resume: 'M8 5.5v13l10-6.5-10-6.5Z',
  back: 'M15 5 8 12l7 7',
  next: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6 6 18',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9Zm6 3v3',
  star: 'M12 3.8 14.5 9l5.7.6-4.3 3.9 1.2 5.6L12 16.2l-5.1 2.9 1.2-5.6-4.3-3.9L9.5 9 12 3.8Z',
  leaf: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 7-7',
  coin: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v8m-2.5-6.2h3.6a1.6 1.6 0 0 1 0 3.2h-2.2a1.6 1.6 0 0 0 0 3.2h3.6',
  shovel: 'M14 4l6 6m-3-3-7.5 7.5M6.5 12.5l5 5-2.8 2.8a2.5 2.5 0 0 1-3.5 0l-1.5-1.5a2.5 2.5 0 0 1 0-3.5l2.8-2.8Z',
  fast: 'M4 6.5v11l7-5.5-7-5.5Zm8 0v11l7-5.5-7-5.5Z',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Zm11.5-.5a4.5 4.5 0 0 1 0 6m2.5-9a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Zm11 0 5 5m0-5-5 5',
  globe: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-8.5 8.5h17M12 3.5c2.5 2.6 3.6 5.5 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.5-3.6-8.5s1.1-5.9 3.6-8.5Z',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  upload: 'M12 15.5v-11m0 0L7.5 9M12 4.5 16.5 9M5 19.5h14',
  copy: 'M9 9h10v11H9V9Zm-4 6V4h10',
  restart: 'M5 12a7 7 0 1 0 2.1-5M5 4.5V8h3.5',
  home: 'M4 11 12 4.5 20 11v8.5h-5.5v-5h-5v5H4V11Z',
  check: 'M5 12.5 10 17.5 19 7',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 7.5v6m0-9v.5',
  bulb: 'M9 18h6m-5 2.5h4M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5Z',
  crown: 'M4 8l4 4 4-6 4 6 4-4-1.5 10h-13L4 8Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Zm0 1.5H4.5A3.5 3.5 0 0 0 8 9.5m8-4h3.5A3.5 3.5 0 0 1 16 9.5M12 13v4m-4 3h8',
  shield: 'M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-2.5Z',
  image: 'M4 5h16v14H4V5Zm0 11 4.5-4.5 3.5 3.5 2.5-2.5L20 17m-5.5-8.5h.01',
  heart: 'M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
};

export function Icon({ name, size = 22, class: cls = 'icon', title }: { name: keyof typeof PATHS | string; size?: number; class?: string; title?: string }) {
  if (name === 'leaf' && art.isReal('stickers/pickup_weed')) {
    return <img class={`${cls} icon-pic`} src={art.imageUrl('stickers/pickup_weed')} width={size} height={size} alt={title ?? ''} title={title} draggable={false} />;
  }
  const d = PATHS[name] ?? PATHS.info;
  const filled = name === 'star' || name === 'resume' || name === 'heart' || name === 'fast' || name === 'shield';
  return (
    <svg class={cls} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={d} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" stroke-width={filled ? 1.2 : 2.2} stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
