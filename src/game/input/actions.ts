/**
 * The semantic action vocabulary and the keyboard binding table that feeds it.
 *
 * Every gameplay input the dungeon reads is one of these named actions. The
 * binding table maps a physical key name (as registered with Phaser `addKeys`)
 * to the actions that key drives; a single key may drive several actions (SPACE
 * both moves up and jumps off a ladder), and a single action may be driven by
 * several keys (A and LEFT both move left). Touch presentation will bind the
 * same actions to on-screen controls without going through this table.
 */
export type GameAction =
  // Traversal (held while the key is down)
  | "moveLeft"
  | "moveRight"
  | "moveUp"
  | "moveDown"
  | "jumpOff"
  // Combat
  | "attack"
  | "cast"
  | "cycleSpell"
  // Interaction / utility (edge-triggered)
  | "interact"
  | "torch"
  | "luck"
  | "drop"
  // Party control
  | "followerMode"
  | "cycle"
  | "party1"
  | "party2"
  | "party3"
  | "party4"
  // Menu / overlay navigation
  | "menuUp"
  | "menuDown"
  | "menuLeft"
  | "menuRight"
  // System / modal toggles
  | "pause"
  | "mute"
  | "stats"
  | "gear"
  | "rest"
  | "restart";

/**
 * Key name -> actions that key contributes to. Key names match the strings
 * passed to Phaser's `addKeys`. `CTRL` is fed from a raw ControlLeft listener
 * rather than an `addKeys` key (see {@link KeyboardSource}).
 */
export const KEY_BINDINGS: Readonly<Record<string, readonly GameAction[]>> = {
  // Movement rows also double as their arrow-key menu-navigation actions.
  A: ["moveLeft"],
  LEFT: ["moveLeft", "menuLeft"],
  D: ["moveRight", "drop"],
  RIGHT: ["moveRight", "menuRight"],
  W: ["moveUp"],
  UP: ["moveUp", "menuUp"],
  SPACE: ["moveUp", "jumpOff"],
  // S is bound for touch/future use but deliberately not registered below, matching
  // the original scene where only DOWN drove climb-down / brace.
  S: ["moveDown"],
  DOWN: ["moveDown", "menuDown"],
  // Combat. CTRL and J/X all melee; K casts; Q cycles the prepared spell.
  J: ["attack"],
  X: ["attack"],
  CTRL: ["attack"],
  K: ["cast"],
  Q: ["cycleSpell"],
  // Interaction / utility.
  E: ["interact"],
  T: ["torch"],
  L: ["luck"],
  H: ["followerMode"],
  // Party + overlays.
  TAB: ["cycle"],
  ONE: ["party1"],
  TWO: ["party2"],
  THREE: ["party3"],
  FOUR: ["party4"],
  // System. R both rests (edge) and restarts a finished run (held).
  ESC: ["pause"],
  M: ["mute"],
  C: ["stats"],
  I: ["gear"],
  R: ["rest", "restart"],
};

/**
 * The set of gameplay actions whose being *held* dismisses the start/briefing
 * pause — the original "any control down" gate. Menu-only and system actions
 * (pause, mute, overlays) are excluded so opening a menu does not dismiss the
 * briefing.
 */
export const START_DISMISS_ACTIONS: readonly GameAction[] = [
  "moveLeft",
  "moveRight",
  "moveUp",
  "moveDown",
  "jumpOff",
  "attack",
  "cast",
];

/**
 * The Phaser `addKeys` descriptor. Matches the scene's original registration
 * (notably excluding S and CTRL): CTRL is fed from a raw ControlLeft listener,
 * and S is intentionally left unregistered to preserve prior behavior.
 */
export const KEYBOARD_ADD_KEYS =
  "A,D,W,LEFT,RIGHT,UP,DOWN,SPACE,J,X,K,C,Q,E,T,H,L,M,R,TAB,ONE,TWO,THREE,FOUR,ESC,I";
