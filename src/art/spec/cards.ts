// How a friend looks on their battle card: their standing picture close up, on a colour of their own. Each one is framed
// by hand, so that heads come out about the same size across the team whatever else is in the picture.

export interface CardLook {
  /** The card's colour behind them. */
  tint: string;
  /** How wide their picture is, in card widths: bigger is closer. */
  zoom: number;
  /** The point of the picture that sits at the card's centre, as fractions of its width and height. */
  x: number;
  y: number;
}

/** By friend. 星 has no row: its card is the friend wished for. */
export const CARD_LOOKS: Record<string, CardLook> = {
  chiikawa: { tint: '#FFC9D4', zoom: 0.94, x: 0.5, y: 0.4 },
  chiikawa_island: { tint: '#F7C1E0', zoom: 1.3, x: 0.47, y: 0.43 },
  hachiware: { tint: '#A9D6F5', zoom: 1.17, x: 0.41, y: 0.41 },
  hachiware_pajama: { tint: '#B7C8F5', zoom: 1, x: 0.5, y: 0.42 },
  yoroi: { tint: '#F6E3B4', zoom: 1.2, x: 0.54, y: 0.28 },
  yoroi_erai: { tint: '#AEB9D6', zoom: 1.29, x: 0.58, y: 0.28 },
  usagi: { tint: '#FFCF7A', zoom: 1.34, x: 0.5, y: 0.42 },
  usagi_cool: { tint: '#F2A65A', zoom: 0.96, x: 0.51, y: 0.43 },
  momonga: { tint: '#CFC8F5', zoom: 1.27, x: 0.6, y: 0.44 },
  kurimanju: { tint: '#E8BE8C', zoom: 0.98, x: 0.5, y: 0.37 },
  shisa: { tint: '#A8E0D8', zoom: 1, x: 0.5, y: 0.43 },
  ode: { tint: '#C9E3A5', zoom: 0.97, x: 0.5, y: 0.23 },
  pajama_parties: { tint: '#D8C6F0', zoom: 0.99, x: 0.5, y: 0.4 },
  rakko: { tint: '#9FC3D9', zoom: 1, x: 0.5, y: 0.44 },
  furuhonya: { tint: '#F3DFA8', zoom: 0.98, x: 0.5, y: 0.39 },
  futaba: { tint: '#BFE3B4', zoom: 1.38, x: 0.48, y: 0.24 },
  hitoha: { tint: '#D6E8A8', zoom: 1.38, x: 0.48, y: 0.24 },
  shimajiro: { tint: '#A7D8C9', zoom: 1.15, x: 0.54, y: 0.39 },
  taiyaki: { tint: '#BFE4F2', zoom: 0.97, x: 0.5, y: 0.5 },
  muchauman: { tint: '#B8E0E8', zoom: 1.29, x: 0.48, y: 0.23 },
};
