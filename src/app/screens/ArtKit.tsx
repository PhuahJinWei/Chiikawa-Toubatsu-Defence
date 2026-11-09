import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { strToU8, zipSync } from 'fflate';
import { drawImage } from '../../art/fallback';
import { spriteFor, type SpriteMotion } from '../../art/sprite';
import {
  ALL_IMAGES,
  FRAME_MS,
  GALLERY_IMAGES,
  type ImageSpec,
  LOGOS,
  PAJAMA_MEMBERS,
  pictureSize,
  pieceFiles,
  PORTRAITS,
  QUEST_IMAGES,
  CHARACTERS,
  type CharacterSpec,
  SCENES,
  type SceneSpec,
  SHOP_ITEMS,
  SOUNDS,
  SPRITE_MOTIONS,
  spriteNeeds,
  STICKER_DETAIL,
  UI_BUTTONS,
  UI_ICONS,
  UI_PROPS,
} from '../../art/spec';
import { art, resolveScene } from '../../art/store';
import { audio } from '../../audio/audio';
import { lang, t } from '../../i18n/i18n';
import { Icon } from '../components/Icon';
import { Figure } from '../components/Figure';
import { Header, Sheet, tap, toast } from '../components/ui';
import { up } from '../router';

function txt(x: { ja: string; en: string }): string {
  return lang.value === 'en' ? x.en : x.ja;
}

/** How wide each character's preview is drawn in the list (about as tall as a row's other thumbnails; a giant's is
 *  taller and cut off behind it), and on its sheet (CSS pixels). Every character stands on the one stage at one scale
 *  (art/figure.ts), so the list shows their sizes against each other as on the field. */
const FIGURE_THUMB = 76;
const FIGURE_SHEET = 300;

/** Everyone in the list, one row per set of frames: パジャマパーティーズ come one member at a time. */
const FIGURE_ROWS: CharacterSpec[] = CHARACTERS.flatMap((r) => (r.id === 'ally_pajama_parties' ? PAJAMA_MEMBERS.map((m) => ({ ...r, id: `${r.id}_${m}` })) : [r]));

/** The frames a character has been drawn in: "idle ×1 · walk ×8". */
const framesText = (id: string) =>
  Object.entries(spriteFor(id)?.anims ?? {})
    .map(([motion, a]) => `${motion} ×${a.frames}`)
    .join(' · ');

function canvasPng(draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number): Promise<Uint8Array> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx);
  return new Promise((resolve) => c.toBlob((b) => (b ? b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))) : resolve(new Uint8Array())), 'image/png'));
}

async function exportZip(): Promise<void> {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  for (const spec of ALL_IMAGES) {
    // Each template at the size to draw it (twice the planned size for a sticker).
    const size = pictureSize(spec);
    const png = await canvasPng(
      (ctx) => {
        ctx.scale(size.w / spec.w, size.h / spec.h);
        drawImage(ctx, spec);
      },
      size.w,
      size.h,
    );
    files[`${spec.key}.png`] = [png, { level: 0 }];
  }
  files['README.txt'] = strToU8(
    [
      'Chiikawa Tobatsu Defense — art kit (size templates)',
      '',
      'Everything is flat paper pieces. Paint each scene as one picture, split it into the listed pieces, and run',
      '`npm run art:import <folder>` with a composited preview beside the layers. Characters are frames, brought in',
      'with `npm run art:sprites <folder>`.',
      'Single stickers (stickers/, portraits/, ui/) go straight into the matching folder under /art.',
      `Every template here is at the size to draw it: stickers are ${STICKER_DETAIL}x the size they show on the field.`,
      'No white border, shadow or glow: the game adds them. ASSET_CHECKLIST.md has every size and position.',
      '',
      'シーンは1枚の絵として描き、表にあるパーツに分けて、合成プレビューといっしょに',
      '`npm run art:import <フォルダ>` を実行してください。キャラクターはコマの絵を `npm run art:sprites <フォルダ>` で。',
      'ステッカー・顔・ロゴは /art の同じフォルダへ。',
      `どのテンプレートも、描くときの大きさです。ステッカーは戦場に出る大きさの${STICKER_DETAIL}倍。`,
    ].join('\n'),
  );
  const zip = zipSync(files);
  const blob = new Blob([new Uint8Array(zip)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chiikawa-td-art-kit.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** A scene's pieces assembled flat, as a small picture. */
function SceneThumb({ scene, width }: { scene: SceneSpec; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sc = useMemo(() => resolveScene(scene), [scene]);
  useEffect(() => {
    let alive = true;
    art.load(sc.layers.map((l) => `scenes/${sc.id}/${l.id}`)).then(() => {
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!alive || !c || !ctx) return;
      const k = c.width / sc.w;
      ctx.fillStyle = sc.backdrop;
      ctx.fillRect(0, 0, c.width, c.height);
      for (const l of [...sc.layers].sort((a, b) => b.z - a.z)) {
        const img = art.image(`scenes/${sc.id}/${l.id}`);
        if (img) ctx.drawImage(img, l.x * k, l.y * k, l.w * k, l.h * k);
      }
    });
    return () => {
      alive = false;
    };
  }, [sc]);
  return <canvas ref={ref} class="scene-thumb" width={width} height={Math.round((width * sc.h) / sc.w)} />;
}

/** The size to draw a picture at; for a sticker, also how big the game shows it on the field. */
function sizeText(spec: ImageSpec): string {
  const s = pictureSize(spec);
  const size = `${s.w}×${s.h}`;
  return spec.kind === 'sticker' ? `${size} · ${t('artkit.onField', { w: spec.w, h: spec.h })}` : size;
}

function RealChip({ real }: { real: boolean }) {
  return <span class={`chip ${real ? 'green' : ''}`}>{real ? t('artkit.real') : t('artkit.placeholder')}</span>;
}

function ImageRow({ spec, onOpen }: { spec: ImageSpec; onOpen: () => void }) {
  return (
    <button class="asset-row" onClick={tap(onOpen)}>
      <div class="asset-thumb">
        <img src={art.imageUrl(spec.key)} alt="" />
      </div>
      <div class="grow">
        <div class="bold small" style={{ wordBreak: 'break-all' }}>
          art/{spec.key}.png
        </div>
        <div class="tiny muted">{sizeText(spec)}</div>
        <div class="tiny faint">{txt(spec.note)}</div>
      </div>
      <RealChip real={art.isReal(spec.key)} />
    </button>
  );
}

export function ArtKit() {
  const [scene, setScene] = useState<SceneSpec | null>(null);
  const [character, setCharacter] = useState<CharacterSpec | null>(null);
  const [img, setImg] = useState<ImageSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => art.realCounts(), []);
  const stickers = ALL_IMAGES.filter((i) => i.kind === 'sticker');
  return (
    <div class="screen artkit">
      <Header title={t('artkit.title')} sub={`${t('artkit.real')}: ${counts.real}/${counts.total}`} onBack={() => {
          // Back to the lobby, with the settings pop-up it was opened from.
          up({ name: 'lobby', settings: true });
        }}
      />
      <div class="scroll">
        <div class="pad stack" style={{ paddingTop: '4px', gap: '14px' }}>
          <div class="panel pad stack" style={{ gap: '8px' }}>
            <p class="small" style={{ lineHeight: 1.7 }}>
              {t('artkit.intro')}
            </p>
            <p class="tiny muted">{t('artkit.rules')}</p>
            <button
              class="btn blue"
              disabled={busy}
              onClick={tap(async () => {
                setBusy(true);
                try {
                  await exportZip();
                } catch (e) {
                  toast(String(e));
                }
                setBusy(false);
              })}
            >
              <Icon name="download" /> {busy ? t('artkit.downloading') : t('artkit.download')}
            </button>
          </div>

          <section class="stack" style={{ gap: '8px' }}>
            <h2 class="section-title">
              {t('artkit.groups.scene')} · {SCENES.length}
            </h2>
            <div class="list">
              {SCENES.map((sc) => {
                const real = sc.layers.filter((l) => pieceFiles(l).every((f) => art.isReal(`scenes/${sc.id}/${f}`))).length;
                return (
                  <button key={sc.id} class="asset-row" onClick={tap(() => setScene(sc))}>
                    <SceneThumb scene={sc} width={160} />
                    <div class="grow">
                      <div class="bold small">art/scenes/{sc.id}/</div>
                      <div class="tiny muted">
                        {sc.w}×{sc.h}
                        {sc.kind === 'world' ? '' : ` · ${t('artkit.pieces', { n: sc.layers.length })}`}
                        {sc.slots.length ? ` · ${t('artkit.slots', { n: sc.slots.length })}` : ''}
                      </div>
                      <div class="tiny faint">{txt(sc.note)}</div>
                    </div>
                    <span class={`chip ${real === sc.layers.length ? 'green' : ''}`}>
                      {real}/{sc.layers.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section class="stack" style={{ gap: '8px' }}>
            <h2 class="section-title">
              {t('artkit.groups.character')} · {FIGURE_ROWS.length}
            </h2>
            <div class="list">
              {FIGURE_ROWS.map((r) => (
                <button key={r.id} class="asset-row" onClick={tap(() => setCharacter(r))}>
                  <Figure id={r.id} anim={r.motions.includes('idle') ? 'idle' : r.motions[0]} width={FIGURE_THUMB} />
                  <div class="grow">
                    <div class="bold small" style={{ wordBreak: 'break-all' }}>
                      art/sprites/{r.id}/
                    </div>
                    <div class="tiny muted">
                      {r.tier} · {framesText(r.id)}
                    </div>
                    <div class="tiny faint">{txt(r.note)}</div>
                  </div>
                  <RealChip real={!!spriteFor(r.id)} />
                </button>
              ))}
            </div>
          </section>

          {[
            { key: 'sticker', list: stickers },
            { key: 'portrait', list: PORTRAITS },
            { key: 'icon', list: UI_ICONS },
            { key: 'button', list: UI_BUTTONS },
            { key: 'goods', list: SHOP_ITEMS },
            { key: 'props', list: UI_PROPS },
            { key: 'card', list: QUEST_IMAGES },
            { key: 'book', list: GALLERY_IMAGES },
            { key: 'ui', list: LOGOS },
          ].map((g) => (
            <section key={g.key} class="stack" style={{ gap: '8px' }}>
              <h2 class="section-title">
                {t(`artkit.groups.${g.key}`)} · {g.list.length}
              </h2>
              <div class="list">
                {g.list.map((spec) => (
                  <ImageRow key={spec.key} spec={spec} onOpen={() => setImg(spec)} />
                ))}
              </div>
            </section>
          ))}

          <section class="stack" style={{ gap: '8px', marginBottom: '20px' }}>
            <h2 class="section-title">
              {t('artkit.groups.sound')} · {SOUNDS.length}
            </h2>
            <div class="list">
              {SOUNDS.map((snd) => (
                <div key={snd.id} class="asset-row">
                  <button
                    class="icon-btn"
                    aria-label={snd.id}
                    onClick={() => {
                      audio.unlock();
                      if (snd.kind === 'sfx') audio.sfx(snd.id, { gap: 0 });
                      else audio.playMusic(snd.id);
                    }}
                  >
                    <Icon name="resume" size={18} />
                  </button>
                  <div class="grow">
                    <div class="bold small">{snd.id}</div>
                    <div class="tiny muted">
                      {txt(snd.note)} · art/audio/{snd.id}.ogg|mp3|m4a|wav
                    </div>
                  </div>
                  <RealChip real={audio.hasFile(snd.id)} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      {scene ? <SceneSheet scene={scene} onClose={() => setScene(null)} /> : null}
      {character ? <CharacterSheet spec={character} onClose={() => setCharacter(null)} /> : null}
      {img ? (
        <Sheet onClose={() => setImg(null)}>
          <div class="stack" style={{ gap: '10px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 900, wordBreak: 'break-all' }}>art/{img.key}.png</h2>
            <p class="small muted">
              {t('artkit.size')}: {sizeText(img)}
            </p>
            <p class="small">{txt(img.note)}</p>
            <img src={art.imageUrl(img.key)} alt="" style={{ width: '100%', borderRadius: '12px', border: '1.5px solid var(--line)' }} />
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function SceneSheet({ scene, onClose }: { scene: SceneSpec; onClose: () => void }) {
  const sc = resolveScene(scene);
  return (
    <Sheet onClose={onClose} label={scene.id}>
      <div class="stack" style={{ gap: '12px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 900 }}>art/scenes/{scene.id}/</h2>
        <SceneThumb scene={scene} width={560} />
        <p class="small">{txt(scene.note)}</p>
        <div class="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
          <span class="chip">
            {t('artkit.size')}: {sc.w}×{sc.h}
          </span>
          {scene.kind === 'menu' ? (
            <span class="chip">
              {t('artkit.safe')}: x {Math.round(sc.safe.x0)}–{Math.round(sc.safe.x1)}, y {Math.round(sc.safe.y0)}–{Math.round(sc.safe.y1)}
            </span>
          ) : null}
        </div>
        <div class="list">
          {sc.layers.map((l) => {
            const key = `scenes/${sc.id}/${l.id}`;
            const files = pieceFiles(l);
            return (
              <div key={l.id} class="asset-row">
                <div class="asset-thumb">
                  <img src={art.imageUrl(key)} alt="" />
                </div>
                <div class="grow">
                  <div class="bold small">{files.length > 1 ? `${l.id}.png … ${files[files.length - 1]}.png` : `${l.id}.png`}</div>
                  <div class="tiny muted">
                    {l.w}×{l.h} · x {Math.round(l.x)}, y {Math.round(l.y)} · z {Math.round(l.z * 100) / 100}
                    {l.cut?.length ? ` · ${t('artkit.cut')}: ${l.cut.join('')}` : ''}
                    {files.length > 1 ? ` · ${t('artkit.frames', { n: files.length, ms: l.frameMs ?? FRAME_MS })}` : ''}
                  </div>
                  <div class="tiny faint">{txt(l.note)}</div>
                </div>
                <RealChip real={files.every((f) => art.isReal(`scenes/${sc.id}/${f}`))} />
              </div>
            );
          })}
        </div>
        {sc.slots.length ? (
          <>
            <h3 class="section-title">{t('artkit.slots', { n: sc.slots.length })}</h3>
            <p class="tiny muted">{sc.slots.map((s) => `${s.id} (${Math.round(s.x)}, ${Math.round(s.y)}, ${Math.round(s.w)}×${Math.round(s.h)})`).join(' · ')}</p>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

function CharacterSheet({ spec, onClose }: { spec: CharacterSpec; onClose: () => void }) {
  const [anim, setAnim] = useState(spec.motions.includes('idle') ? 'idle' : spec.motions[0]);
  const sprite = spriteFor(spec.id);
  const { need, extra } = spriteNeeds(spec, spec.id);
  return (
    <Sheet onClose={onClose} label={spec.id}>
      <div class="stack" style={{ gap: '12px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 900, wordBreak: 'break-all' }}>art/sprites/{spec.id}/</h2>
        <div class="row" style={{ alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <Figure id={spec.id} anim={anim} width={FIGURE_SHEET} />
          <div class="stack grow" style={{ gap: '8px', minWidth: '180px' }}>
            <p class="small">{txt(spec.note)}</p>
            <div class="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {spec.motions.map((m) => (
                <button key={m} class={`chip ${m === anim ? 'pink' : ''}`} onClick={() => setAnim(m)}>
                  {m}
                </button>
              ))}
            </div>
            <p class="tiny muted">
              {t('artkit.facing')}: {spec.facing > 0 ? '→' : '←'} · {spec.tier}
            </p>
          </div>
        </div>
        <div class="list">
          {[...need, ...extra].map((m) => {
            const a = sprite?.anims[m as SpriteMotion];
            return (
              <div key={m} class="asset-row">
                <div class="asset-thumb">{a ? <img src={art.imageUrl(`sprites/${spec.id}/${m}_1`)} alt="" /> : null}</div>
                <div class="grow">
                  <div class="bold small">
                    {a && a.frames > 1 ? `${m}_1.png … ${m}_${a.frames}.png` : `${m}_1.png`}
                    {extra.includes(m) ? ` (${t('artkit.optional')})` : ''}
                  </div>
                  <div class="tiny faint">{txt(SPRITE_MOTIONS[m])}</div>
                </div>
                <RealChip real={!!a} />
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
