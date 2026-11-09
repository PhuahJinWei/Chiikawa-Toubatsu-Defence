import { useEffect, useState } from 'preact/hooks';
import { SHOP_SCENE } from '../../art/spec';
import { art } from '../../art/store';
import { audio } from '../../audio/audio';
import { nameOf, t } from '../../i18n/i18n';
import { save, updateSave } from '../../save/save';
import { CutOut } from '../components/CutOut';
import { EarnedStamp } from '../components/HandStamp';
import { Icon } from '../components/Icon';
import { PenLoop } from '../components/PaperMarks';
import { PlatePaper } from '../components/Plate';
import { StickerIcon } from '../components/StickerIcon';
import { confirm, confirmState, MoneyPill, tap, toast } from '../components/ui';
import { noteMet, SHOP } from '../progress';
import { go, type Route, up } from '../router';
import { focusSide } from '../scene/camera';
import { Diorama } from '../scene/Diorama';
import { SceneTitle } from '../scene/SceneScreen';
import { SHOP_SPOTS, SHOP_TAGS } from '../scene/shop';

type Good = (typeof SHOP.sellers)[number]['items'][number];

/** How many of a good the player has: upgrades bought, tickets held, or 1 for a friend who has joined. */
function owned(item: Good): number {
  const s = save.value;
  if (item.card) return s.cards.includes(item.card) ? 1 : 0;
  if (item.upgrade) return s.upgrades[item.upgrade] >= (item.tier ?? 1) ? 1 : 0;
  if (item.id === 'buta') return s.items.buta;
  return 0;
}

/** A good's name: a friend's own name, or the item's (the steps of an upgrade share theirs). */
const goodName = (item: Good) => (item.card ? nameOf(item.card) : t(`shop.items.${item.pic ?? item.id}.name`));

/** An upgrade's steps are bought in order: a later one waits while the one above it is not bought yet. */
const waits = (item: Good) => !!item.upgrade && save.value.upgrades[item.upgrade] < (item.tier ?? 1) - 1;

/** What a good does, on its line: a friend's ability, how many friends a pochette lets you bring, the 草 a ラーメン券
 *  starts every job with. */
function goodDesc(item: Good, n: number): string {
  if (item.card) return t(`card.${item.card}.ability`);
  const tier = item.tier ?? 1;
  if (item.upgrade === 'slots') return t('shop.items.slot.desc', { n: SHOP.slotsBase + tier });
  if (item.upgrade === 'ramen') return t('shop.items.ramen.desc', { n: SHOP.ramenWeeds * tier });
  return t(`shop.items.${item.id}.desc`, { n });
}

/** Each seller's name plate is in their own colour: the pochette shop's pink, like the bear pochette; the ramen shop's
 *  yellow, like its sign; Shisa's なかま屋 orange, like her mane. */
const SELLER_TONE: Record<string, string> = { pochette: '#F7C1CF', ramen: '#FBD98F', shisa: '#F6B888' };
/** The shop's own plate is peach, like the plate on the lobby's 「お店」 button. */
const SHOP_TONE = '#FBD5AB';
/** Once there is nothing more to buy, the item gets a red 「売り切れ」 stamp: Japanese in either language, like the
 *  game's other stamps (what it means is read out in the player's language). */
const SOLD_OUT = '売り\n切れ';
/** A friend who has joined gets a red 「なかま入り」 stamp instead. */
const JOINED = 'なかま\n入り';

/** The shop is the inside of ラーメン屋「郎」: tap someone to zoom in and see what they sell. */
export function Shop({ r }: { r: Extract<Route, { name: 'shop' }> }) {
  const spot = r.spot && SHOP_SPOTS[r.spot] ? r.spot : null;
  // Opening a seller is a step of its own, so the back button (and the system back gesture) closes their goods first,
  // the way it steps back through the quest screen, and only then leaves the shop. Another seller replaces the step.
  const open = (id: string) => go({ name: 'shop', spot: id }, { replace: !!spot });
  const close = () => {
    if (spot) up({ name: 'shop' });
  };
  const [cheer, setCheer] = useState<string | null>(null);
  // The item being bought: circled with the pink pen while the game asks to confirm.
  const [buying, setBuying] = useState<string | null>(null);
  useEffect(() => {
    for (const s of SHOP.sellers) noteMet(s.npc);
  }, []);
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
      <span key={slot} class="ink-plate d-tag" style={{ '--plate': SELLER_TONE[seller] }}>
        <PlatePaper />
        {t(`shop.sellers.${seller}.name`)}
      </span>,
    ]),
  );

  const buy = (item: Good, price: number) => {
    if (waits(item)) {
      toast(t('shop.after'));
      return;
    }
    if (save.value.money < price) {
      toast(t('shop.notEnough'));
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
      toast(card ? t('shop.joined', { name }) : t('shop.bought'));
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
        <SceneTitle title={t('lobby.shop')} tone={SHOP_TONE} onBack={() => (spot ? close() : up({ name: 'lobby' }))} right={<MoneyPill />} />
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
                        {JOINED}
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
