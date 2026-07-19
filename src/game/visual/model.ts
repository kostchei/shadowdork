export type ZonePackId =
  | "diablerie"
  | "red-sands"
  | "midnight-sun"
  | "river-of-night"
  | "dwellers-in-the-deep"
  | "city-of-masks";

export type VisualSkinId =
  | "rot-bramble"
  | "mugdulblub-keep"
  | "willowman-hollow"
  | "djurum-approach"
  | "iron-fortress"
  | "burning-mines"
  | "rime-sea-caves"
  | "frost-jarl-tomb"
  | "dverg-forges"
  | "overgrown-basalt-ziggurat"
  | "drowned-star-cenote"
  | "canopy-village"
  | "librarians-chasm"
  | "nuln-fungal-grottos"
  | "subterranean-sea-fort"
  | "rooftop-scamper"
  | "sunken-thieves-guild"
  | "hidden-face-temple";

export type MaterialSetId =
  | "root-thorn"
  | "dissolving-stone"
  | "pale-root"
  | "wind-cut-red-stone"
  | "basalt-iron"
  | "burning-granite"
  | "glacial-rock"
  | "runestone-timber"
  | "forge-stone"
  | "jungle-basalt"
  | "wet-limestone"
  | "woven-canopy"
  | "abyssal-archive"
  | "fungal-cavern"
  | "sea-fort"
  | "roof-tile"
  | "sewer-brick"
  | "opulent-estate";

export interface VisualPalette {
  background: number;
  stoneTint: number;
  accent: number;
  haze: number;
  darkness: number;
}

export interface VisualSkin {
  id: VisualSkinId;
  zone: ZonePackId;
  displayName: string;
  materials: MaterialSetId;
  palette: VisualPalette;
  roomNouns: readonly string[];
}

export interface EnvironmentTextureKeys {
  wall(variant: number): string;
  /** Optional topology-aware alternatives used by open-surface skins. */
  supportWall?(variant: number): string;
  overhang?: string;
  climbBackdrop?: string;
  openSky?: boolean;
  platform: string;
  weakWall: string;
  climb: string;
  portcullis: string;
  door: string;
  backdrop: string;
  foregroundTint: number;
  decorations: {
    mushrooms: string;
    bones: string;
    banner: string;
    stalactite: string;
  };
}
