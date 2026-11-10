import { useEffect, useState } from 'preact/hooks';
import { SHOP_SCENE } from '../../art/spec';
import { art } from '../../art/store';
import { audio } from '../../audio/audio';
import { nameOf, t } from '../../i18n/i18n';
import { save, updateSave } from '../../save/save';
import { CutOut } from '../components/CutOut';
import { EarnedStamp } from '../components/HandStamp';
import { Icon } from '../components/Icon';
import { JOINED_STAMP, PenLoop } from '../components/PaperMarks';
import { PlatePaper } from '../components/Plate';
import { StickerIcon } from '../components/StickerIcon';
import { confirm, confirmState, MoneyPill, tap, toast } from '../components/ui';
import { noteMet, SHOP } from '../progress';
import { go, type Route, up } from '../router';
import { type Good, goodDesc, goodName, owned, SHOP_TONE, waits } from '../shopping';
import { focusSide } from '../scene/camera';
import { Diorama } from '../scene/Diorama';
import { SceneTitle } from '../scene/SceneScreen';
import { SHOP_SPOTS, SHOP_TAGS } from '../scene/shop';

/** The sellers at the shop's two ends: on the squarest screens their name plates step in, to stay on the screen. */
const OUTER_TAG: Record<string, string> = { ramen: ' outer-l', pochette: ' outer-r' };

/** Each seller's name plate is in their own colour: the pochette shop's pink, like the bear pochette; the ramen shop's
 *  yellow, like its sign; Shisa's なかま屋 orange, like her mane. */
const SELLER_TONE: Record<string, string> = { pochette: '#F7C1CF', ramen: '#FBD98F', shisa: '#F6B888' };
/** Once there is nothing more to buy, the item gets a red 「売り切れ」 stamp: Japanese in either language, like the
 *  game's other stamps (what it means is read out in the player's language). */
const SOLD_OUT = '売り\n切れ';

/** The shop is the inside of ラーメン屋「郎」: tap someone to zoom in and see what they sell. */
export function Shop({ r }: { r: Extract<Route, { name: 'shop' }> }) {
  const spot = r.spot && SHOP_SPOTS[r.spot] ? r.spot : null;
  // Opening a seller is a step of its own, so the back button (and the system back gesture) closes their goods first,
  // the way it steps back through the quest screen, and only then leaves the shop. Another seller replaces the step.
  // Stopped by on the way to a job (`next`), the shop is left for that job's notice instead of the lobby.
  const next = r.next;
  const open = (id: string) => go({ name: 'shop', spot: id, next }, { replace: !!spot });
  const close = () => {
    if (spot) up({ name: 'shop', next });
  };
  const leave = () => up(next ? { name: 'quest', world: next.world, level: next.level } : { name: 'lobby' });
  const [cheer, setCheer] = useState<string | null>(null);
  // The item being bought: circled with the pink pen while the game asks to confirm.
  const [buying, setBuying] = useState<string | null>(null);
  useEffect(() => {
    for (const s of SHOP.sellers) noteMet(s.npc);
  }, []);
  // The friends on sale have been seen once their seller's goods are open: a dark shape in the book until they join.
  useEffect(() => {
    if (!spot) return;
    for (const item of SHOP.sellers.find((s) => s.id === SHOP_SPOTS[spot].seller)?.items ?? []) if (item.card) noteMet(item.card);
  }, [spot]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spot]);
  useEffect(() => {
    if (!cheer) return;
    const id = window.setTimeout(() => setCheer(null), 700);
    return () => window.clearTimeout(id);
  }, [cheer]);

  const layer = spot ? SHOP_SCENE.layers.find((l) => l.id === spot) : undefined;
  const side = layer ? focusSide(SHOP_SCENE, layer) : 'left';
  const pickable = Object.fromEntries(Object.entries(SHOP_SPOTS).map(([id, s]) => [id, `${nameOf(s.speaker)} · ${t(`shop.sellers.${s.seller}.name`)}`]));
  const slots = Object.fromEntries(
    Object.entries(SHOP_TAGS).map(([slot, seller]) => [
      slot,
      <span key={slot} class={`ink-plate d-tag${OUTER_TAG[seller] ?? ''}`} style={{ '--plate': SELLER_TONE[seller] }}>
        <PlatePaper />
        {t(`shop.sellers.${seller}.name`)}
      </span>,
    ]),
  );

  const buy = (item: Good, price: number) => {
    if (waits(item)) {
      toast(t('shop.after'), 'bad');
      return;
    }
    if (save.value.money < price) {
      toast(t('shop.notEnough'), 'bad');
      return;
    }
    const who = spot;
    const card = item.card;
    setBuying(item.id);
    const name = goodName(item);
    // The price written as on the price list (1,000).
    confirm(t(card ? 'shop.confirmFriend' : 'shop.confirm', { item: name, price: price.toLocaleString() }), () => {
      updateSave((d) => {
        const tier = item.tier ?? 1;
        if (d.money < price || (card && d.cards.includes(card)) || (item.upgrade && d.upgrades[item.upgrade] !== tier - 1)) return;
        d.money -= price;
        // A friend joins the team for good, like one met on a job.
        if (card) d.cards.push(card);
        else if (item.upgrade) d.upgrades[item.upgrade] = tier;
        else if (item.id === 'buta') d.items.buta++;
      });
      audio.sfx(card ? 'sfx_unlock' : 'sfx_coin');
      toast(card ? t('shop.joined', { name }) : t('shop.bought'), 'ok');
      setCheer(who);
    }, { title: name });
  };

  return (
    <div class="screen shop-screen">
      <div class="scene-area">
        <Diorama
          scene={SHOP_SCENE}
          focus={spot}
          side={side}
          pickable={pickable}
          slots={slots}
          cheer={cheer}
          guides={save.value.settings.guides}
          onPick={(id) => {
            audio.unlock();
            audio.sfx(id === spot ? 'sfx_cancel' : 'sfx_card');
            if (id === spot) close();
            else open(id);
          }}
          onBackground={() => {
            if (!spot) return;
            audio.sfx('sfx_cancel');
            close();
          }}
        />
        <SceneTitle title={t('lobby.shop')} tone={SHOP_TONE} onBack={() => (spot ? close() : leave())} right={<MoneyPill />} />
        {spot ? (
          <SellerPanel
            key={spot}
            spot={spot}
            side={side === 'left' ? 'right' : 'left'}
            circled={confirmState.value ? buying : null}
            onClose={close}
            onBuy={buy}
          />
        ) : null}
      </div>
    </div>
  );
}

/** The seller's goods, on a card drawn like the Chiikawa line art on the free side of the screen, the seller's name on
 *  a plate across its top, written like a price list (in the gallery book's style): each item as a sticker with its
 *  name, what it does and its price in highlighter; upgrades bought so far as dot stickers, pencil dots for the rest; a
 *  red 「売り切れ」 stamp once there is nothing more to buy. A friend (the なかま屋's goods) shows their face sticker
 *  and what they do in battle, and gets a red 「なかま入り」 stamp once they have joined. The whole line is the
 *  button. */
function SellerPanel({
  spot,
  side,
  circled,
  onClose,
  onBuy,
}: {
  spot: string;
  side: 'left' | 'right';
  circled: string | null;
  onClose: () => void;
  onBuy: (item: Good, price: number) => void;
}) {
  const info = SHOP_SPOTS[spot];
  const seller = info ? SHOP.sellers.find((s) => s.id === info.seller) : undefined;
  if (!info || !seller) return null;
  const money = save.value.money;
  return (
    <div class={`seller-panel ${side}`} role="dialog" aria-label={t(`shop.sellers.${seller.id}.name`)}>
      <div class="ink-card seller-card">
        <h2 class="ink-plate seller-name" style={{ '--plate': SELLER_TONE[seller.id] }}>
          <PlatePaper />
          <span class="plate-words">{t(`shop.sellers.${seller.id}.name`)}</span>
        </h2>
        <button type="button" class="card-x" aria-label={t('common.close')} onClick={tap(onClose, 'sfx_cancel')}>
          <Icon name="close" size={18} />
        </button>
        <div class="seller-body">
          <div class="seller-who">{nameOf(info.speaker)}</div>
          <p class="seller-says">{t(info.line)}</p>
          <div class="goods">
            {seller.items.map((item) => {
              const n = owned(item);
              const maxed = !item.consumable && n >= item.max;
              const full = !!item.consumable && n >= item.max;
              const price = item.prices[Math.min(n, item.prices.length - 1)];
              const later = waits(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  class={['good', maxed ? 'maxed' : '', later ? 'later' : '', !maxed && !later && money < price ? 'poor' : ''].filter(Boolean).join(' ')}
                  disabled={maxed || full}
                  onClick={tap(() => onBuy(item, price))}
                >
                  <span class={item.card && !art.isReal(`shop/item_${item.id}`) ? 'good-pic friend' : 'good-pic'}>
                    {item.card && !art.isReal(`shop/item_${item.id}`) ? (
                      // Until the owner draws their shop picture, a friend on sale shows their face.
                      <CutOut src={art.portraitUrl(item.card)} px={84} />
                    ) : (
                      <StickerIcon k={`shop/item_${item.pic ?? item.id}`} px={72} />
                    )}
                    {item.id === circled ? <PenLoop class="good-loop" /> : null}
                  </span>
                  <span class="good-text">
                    <span class="good-name">{goodName(item)}</span>
                    <span class="good-desc">{goodDesc(item, n)}</span>
                    {!item.consumable && item.max > 1 ? (
                      <span class="good-pips" aria-hidden="true">
                        {Array.from({ length: item.max }, (_, i) => (
                          <span key={i} class={i < n ? 'on' : ''} />
                        ))}
                      </span>
                    ) : null}
                    {item.consumable ? <span class="good-owned">{t(full ? 'shop.ownedFull' : 'shop.owned', { n })}</span> : null}
                    {later ? <span class="good-owned">{t('shop.after')}</span> : null}
                  </span>
                  {maxed ? (
                    item.card ? (
                      <EarnedStamp id={`joined:${item.card}`} class="red-stamp good-stamp" label={t('shop.joinedStamp')}>
                        {JOINED_STAMP}
                      </EarnedStamp>
                    ) : (
                      <EarnedStamp id={`soldout:${item.id}`} class="red-stamp good-stamp" label={t('shop.max')}>
                        {SOLD_OUT}
                      </EarnedStamp>
                    )
                  ) : (
                    <span class="good-price">
                      <Icon name="coin" size={18} />
                      <span class="hl">{price.toLocaleString()}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
