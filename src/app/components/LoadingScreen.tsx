// What the player looks at while a screen's pictures come in: ちいかわ looking for weeds.

import { t } from '../../i18n/i18n';
import { save } from '../../save/save';
import { Figure } from './Figure';

export function LoadingScreen() {
  const still = save.value.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div class="loading">
      <div>
        <div class="loading-chiikawa">
          <Figure id="ally_chiikawa" anim={still ? 'idle' : 'weed_search'} width={240} />
        </div>
        {t('common.loading')}
      </div>
    </div>
  );
}
