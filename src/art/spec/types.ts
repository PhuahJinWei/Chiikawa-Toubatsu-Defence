// Types for every picture the game uses. The whole game is stacked paper cut-outs: flat stickers
// that the game layers, borders, shades and moves. Three kinds of art:
//   scenes   a picture split into pieces at different depths (menus, and each battle world)
//   sprites  a character's frames: a few short motions of them, each frame one picture
//   stickers single pictures (projectiles, effects, pickups, terrain, portraits, logos, quest cards)

export type Lang = 'ja' | 'en';
export type Text = { ja: string; en: string };

/** Character size tier on the battlefield. XXL is a giant three lanes tall (でかつよ, あのこ). */
export type Tier = 'S' | 'M' | 'L' | 'XL' | 'XXL';
/** A side of a picture or piece: left, right, top or bottom. */
export type Side = 'l' | 'r' | 't' | 'b';

/** How long each frame of a scene piece's idle loop shows when the piece does not say (ms). */
export const FRAME_MS = 450;

/** How tall a character stands on the battlefield, from its feet to the top of its head (field pixels; 1 tile = 170). */
export const TIER_HEIGHT: Record<Tier, number> = { S: 150, M: 195, L: 262, XL: 338, XXL: 480 };

/** One picture file under /art: a scene piece, a sticker, a portrait or a logo. */
export interface ImageSpec {
  /** Path under /art without the extension, e.g. 'scenes/shop/shop_wall' or 'stickers/fx_trail'. */
  key: string;
  kind: 'piece' | 'sticker' | 'portrait' | 'logo' | 'card' | 'icon' | 'button';
  /** Size of the placeholder. Pieces take their real size from the art. */
  w: number;
  h: number;
  note: Text;
}

// ---------------------------------------------------------------- characters

export interface CharacterSpec {
  /** Asset id and folder name: art/sprites/<id>/. */
  id: string;
  group: 'ally' | 'enemy' | 'rescue';
  /** Gameplay id this art belongs to. */
  subject: string;
  tier: Tier;
  /** Height on the field when it differs from the tier's (field pixels). */
  height?: number;
  /** The way it looks: allies and the car face right, toward the enemies; enemies face left. */
  facing: 1 | -1;
  /** Motion names it uses, as the battle asks for them (idle, walk, attack, collapse, pull, song…). */
  motions: string[];
  note: Text;
}

// ---------------------------------------------------------------- stickers

export interface StickerSpec {
  /** File name: art/stickers/<id>.png. */
  id: string;
  group: 'projectile' | 'effect' | 'pickup' | 'terrain';
  /** Drawn size on the battlefield (field pixels). */
  w: number;
  h: number;
  /** Feet: stands on the ground at its bottom centre. Centre: placed by its middle. */
  anchor: 'feet' | 'center';
  /** The game adds a white sticker border (default yes). */
  edge?: boolean;
  note: Text;
}

// ---------------------------------------------------------------- scenes

/** One flat piece of a scene. Positions are stage pixels in the scene's picture. */
export interface SceneLayer {
  /** File name: art/scenes/<scene>/<id>.png. */
  id: string;
  w: number;
  h: number;
  x: number;
  y: number;
  /** Menus: distance from the camera (bigger is farther; 3 keeps its size when the camera turns). Worlds: draw order. */
  z: number;
  /** The game adds a white cut edge and a soft shadow around the drawing. */
  edge: boolean;
  /** Sides where the piece runs off the edge of the picture. The game stretches those edges a little further
   *  out, and the camera never turns or pans far enough to show them. */
  cut?: Side[];
  /** Someone the player can tap: the camera zooms to this height (fraction of h) at this zoom, and puts them on
   *  this side of the screen (by default the side they stand on). */
  character?: { focusY: number; zoom: number; side?: 'left' | 'right' };
  /** Stuck on at a slight angle, like a hand-placed sticker (degrees; the game rotates it). */
  tilt?: number;
  /** An idle loop drawn as frames: <id>.png is frame 1, then <id>_2.png … <id>_<frames>.png, all the same size
   *  and placement, shown one after another once every frame has been delivered (menu scenes; battle worlds
   *  show the first frame). */
  frames?: number;
  /** How long each frame shows (ms). */
  frameMs?: number;
  /** An idle wiggle for a single cut-out (menu scenes): it snaps between leaning `deg` one way and the other, holding
   *  each lean for `ms`, like a paper cut-out tilted by hand. It turns about `pivot` (a share of its own box; by
   *  default the middle of its bottom edge, where it stands or sits). */
  snap?: { deg: number; ms: number; pivot?: [number, number] };
  /** On screens that crop the bottom of the picture (wide phones), the piece is raised by this share of what is
   *  cropped, so someone standing at the bottom edge stays in view (menu scenes). Its cut edges still never show. */
  rise?: number;
  note: Text;
}

/** A place in a scene where the game puts live content: a button, a sign's text, a name tag, a level node. */
interface SceneSlot {
  id: string;
  /** Centre of the slot, in stage pixels. */
  x: number;
  y: number;
  /** Room to leave free in the art, in stage pixels. */
  w: number;
  h: number;
  /** Depth: by default just in front of the nearest piece. */
  z?: number;
  /** Raised like a piece that rises (see SceneLayer.rise), by this share of the cropped bottom: a name tag over the
   *  head of someone who rises, say. */
  rise?: number;
  note: Text;
}

/** Light motion the game adds on top of the art (no image needed). */
export interface SceneEffect {
  kind: 'steam';
  x: number;
  y: number;
  z: number;
}

export interface SceneSpec {
  id: string;
  /** Menus are seen through the 3D camera, in pieces; worlds are the battlefield's backdrop, one flat picture. */
  kind: 'menu' | 'world';
  /** Stage size in pixels: the whole picture. */
  w: number;
  h: number;
  /** Visible at rest on every screen shape from 4:3 to 21:9; the rest of the picture is cropped on some. */
  safe: { x0: number; y0: number; x1: number; y1: number };
  /** At rest, the share of any overflow cropped from the left and from the top (0.5 centres, 0 keeps that edge). */
  anchor: { x: number; y: number };
  /** Wide scenes the player drags across (the map). */
  pan?: boolean;
  /** Battle worlds: where the field's top-left corner sits in the picture (one field pixel = one picture pixel). */
  field?: { x: number; y: number };
  /** The back wall's colour, behind everything as a safety net. */
  backdrop: string;
  /** Battle worlds: what covers the field's closed lanes, matched to this world's art (a soft tan tint without one). */
  closedLane?: string;
  /** Battle worlds: the picture has the world's water lanes painted in (without this the game lays a plain band of water over them). */
  paintedWater?: boolean;
  /** Battle worlds: the colour of the stitched lines between the field's tiles, to show on this world's ground (dark ink without one). */
  fieldLine?: string;
  /** Battle worlds: a picture painted for the jobs of `world` with only the lanes `open` open (see worldScene). */
  forLanes?: { world: number; open: number[] };
  /** Far to near. */
  layers: SceneLayer[];
  slots: SceneSlot[];
  effects: SceneEffect[];
  note: Text;
}

// ---------------------------------------------------------------- sounds

export interface SoundSpec {
  id: string;
  kind: 'sfx' | 'bgm';
  note: Text;
}
