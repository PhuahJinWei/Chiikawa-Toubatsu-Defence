// The name plate along the top of a menu scene (the shop), with the back button on its left.

import type { ComponentChildren } from 'preact';
import { PlatePaper } from '../components/Plate';
import { BackButton } from '../components/ui';

/** A name plate for the top of a scene screen (in `tone`, the colour of the lobby button that leads there), with an
 *  optional back button and things on the right. */
export function SceneTitle({ title, tone, onBack, right }: { title: string; tone?: string; onBack?: () => void; right?: ComponentChildren }) {
  return (
    <div class="scene-top">
      {onBack ? <BackButton onClick={onBack} /> : null}
      <div class="ink-plate scene-label" style={tone ? { '--plate': tone } : undefined}>
        <PlatePaper />
        <h1>{title}</h1>
      </div>
      <div class="grow" />
      {right}
    </div>
  );
}
