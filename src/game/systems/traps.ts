import Phaser from "phaser";
import { DC } from "../../engine";
import type { FeaturedTrapSpec, TilePoint } from "../level/dungeons";
import type { GameContext } from "../context";
import type { CharacterSprite } from "../entities/CharacterSprite";
import { TILE } from "../textures";
import { spikeTrap, swordClang, thud, type SfxOpts } from "../audio/sfx";
import { spatialOpts, type Vec2 } from "../audio/spatial";
import { floatText } from "./combat";

export interface TrapInteraction {
  label: string;
  run: () => void;
}

interface PlateGateRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "plate-gate" }>;
  plate: Phaser.GameObjects.Rectangle;
  gate: Phaser.GameObjects.Rectangle;
  latch: Phaser.GameObjects.Rectangle;
  open: boolean;
  latched: boolean;
  weighted: boolean;
}

interface SpikeBankRuntime {
  points: readonly TilePoint[];
  sprites: Phaser.GameObjects.Image[];
  state: "safe" | "warning" | "active";
}

interface AlternatingSpikesRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "alternating-spikes" }>;
  bankA: SpikeBankRuntime;
  bankB: SpikeBankRuntime;
  mechanism: Phaser.GameObjects.Rectangle;
  disabled: boolean;
}

interface CrusherRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "crusher-gallery" }>;
  columns: Phaser.GameObjects.Rectangle[];
  mechanism: Phaser.GameObjects.Rectangle;
  active: boolean[];
  disabled: boolean;
  bracedBy: CharacterSprite | null;
  bracedIndex: number | null;
}

interface DartRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "dart-gallery" }>;
  emitter: Phaser.GameObjects.Rectangle;
  mechanism: Phaser.GameObjects.Rectangle;
  darts: Phaser.GameObjects.Rectangle[];
  lastShotAt: number;
  lastUpdateAt: number;
  disabled: boolean;
}

interface LiftRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "counterweighted-lift" }>;
  left: Phaser.GameObjects.Rectangle;
  right: Phaser.GameObjects.Rectangle;
  lastLeftY: number;
  lastRightY: number;
}

interface LightRunesRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "light-runes" }>;
  runes: Map<number, Phaser.GameObjects.Rectangle>;
}

interface UndeadBarrierRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "undead-barrier" }>;
  barrier: Phaser.GameObjects.Rectangle;
  bones: Phaser.GameObjects.Image[];
  open: boolean;
}

interface FloodRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "flooded-chamber" }>;
  water: Phaser.GameObjects.Rectangle;
  lever: Phaser.GameObjects.Rectangle;
  high: boolean;
}

interface RollingStoneRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "rolling-stone" }>;
  stone: Phaser.GameObjects.Arc;
  triggered: boolean;
  steps: number;
  lastLeaderTile: number;
}

interface CollapsingTileRuntime {
  point: TilePoint;
  tile: Phaser.GameObjects.Rectangle;
  triggeredAt: number | null;
  collapsed: boolean;
}

interface CollapsingFloorRuntime {
  spec: Extract<FeaturedTrapSpec, { kind: "collapsing-floor" }>;
  tiles: CollapsingTileRuntime[];
}

type PhysicsActor = Phaser.Physics.Arcade.Sprite | Phaser.Physics.Arcade.Image;

export class TrapSystem {
  private readonly scene: Phaser.Scene;
  private readonly ctx: GameContext;
  private readonly members: () => readonly CharacterSprite[];
  private readonly leader: () => CharacterSprite;
  private readonly weights: () => readonly { x: number; y: number }[];
  private readonly lightAt: (x: number, y: number) => "lit" | "dim" | "dark";
  private readonly snuffTorch: (member: CharacterSprite) => void;
  private readonly tint: number;
  private readonly actors = new Set<PhysicsActor>();
  private readonly lastHurtAt = new Map<string, number>();
  private readonly plateGates: PlateGateRuntime[] = [];
  private readonly spikeTraps: AlternatingSpikesRuntime[] = [];
  private readonly crushers: CrusherRuntime[] = [];
  private readonly dartTraps: DartRuntime[] = [];
  private readonly lifts: LiftRuntime[] = [];
  private readonly lightRunes: LightRunesRuntime[] = [];
  private readonly undeadBarriers: UndeadBarrierRuntime[] = [];
  private readonly floods: FloodRuntime[] = [];
  private readonly rollingStones: RollingStoneRuntime[] = [];
  private readonly collapsingFloors: CollapsingFloorRuntime[] = [];
  private readonly swimmers = new Set<CharacterSprite>();

  constructor(
    scene: Phaser.Scene,
    ctx: GameContext,
    specs: readonly FeaturedTrapSpec[],
    members: () => readonly CharacterSprite[],
    leader: () => CharacterSprite,
    weights: () => readonly { x: number; y: number }[],
    lightAt: (x: number, y: number) => "lit" | "dim" | "dark",
    snuffTorch: (member: CharacterSprite) => void,
    tint: number,
  ) {
    this.scene = scene;
    this.ctx = ctx;
    this.members = members;
    this.leader = leader;
    this.weights = weights;
    this.lightAt = lightAt;
    this.snuffTorch = snuffTorch;
    this.tint = tint;
    for (const spec of specs) this.createTrap(spec);
  }

  registerActor(actor: PhysicsActor): void {
    if (this.actors.has(actor)) return;
    this.actors.add(actor);
    for (const runtime of this.plateGates) {
      this.scene.physics.add.collider(actor, runtime.gate);
    }
    for (const runtime of this.lifts) {
      this.scene.physics.add.collider(actor, runtime.left);
      this.scene.physics.add.collider(actor, runtime.right);
    }
    for (const runtime of this.undeadBarriers) this.scene.physics.add.collider(actor, runtime.barrier);
    for (const runtime of this.collapsingFloors) {
      for (const tile of runtime.tiles) this.scene.physics.add.collider(actor, tile.tile);
    }
  }

  update(time: number): void {
    for (const runtime of this.plateGates) this.updatePlateGate(runtime);
    for (const runtime of this.spikeTraps) this.updateAlternatingSpikes(runtime, time);
    for (const runtime of this.crushers) this.updateCrushers(runtime, time);
    for (const runtime of this.dartTraps) this.updateDarts(runtime, time);
    for (const runtime of this.lifts) this.updateLift(runtime);
    for (const runtime of this.lightRunes) this.updateLightRunes(runtime, time);
    for (const runtime of this.floods) this.updateFlood(runtime);
    for (const runtime of this.rollingStones) this.updateRollingStone(runtime, time);
    for (const runtime of this.collapsingFloors) this.updateCollapsingFloor(runtime, time);
  }

  findInteraction(member: CharacterSprite): TrapInteraction | null {
    for (const runtime of this.plateGates) {
      if (
        !runtime.latched &&
        Phaser.Math.Distance.Between(member.x, member.y, runtime.latch.x, runtime.latch.y) < TILE * 1.6
      ) {
        return {
          label: "latch the counterweight gate open",
          run: () => {
            runtime.latched = true;
            this.setGateOpen(runtime, true);
            runtime.latch.setFillStyle(0x65d48a).setAngle(35);
            this.ctx.say("The counterweight catches. The gate will stay open.", "#65d48a");
          },
        };
      }
      if (
        !runtime.weighted &&
        member.character.className === "fighter" &&
        Phaser.Math.Distance.Between(member.x, member.y, runtime.plate.x, runtime.plate.y) < TILE * 1.7
      ) {
        return {
          label: "drag rubble onto the pressure plate",
          run: () => {
            runtime.weighted = true;
            runtime.plate.setStrokeStyle(5, 0x594837);
            this.ctx.say(`${member.character.name} weights the plate with fallen stone.`, "#d0a060");
          },
        };
      }
    }

    for (const runtime of this.crushers) {
      if (runtime.disabled || member.character.className !== "fighter") continue;
      const index = runtime.spec.columns.findIndex(
        (x) => Math.abs(member.x - this.tileX(x)) < TILE * 1.1,
      );
      if (index >= 0 && member.character.carriedShield && !member.character.shieldStowed) {
        return {
          label: "brace the stone press with your shield",
          run: () => {
            runtime.bracedBy = member;
            runtime.bracedIndex = index;
            member.mode = "hold";
            this.ctx.say(`${member.character.name} locks their shield beneath the descending stone.`, "#d0a060");
          },
        };
      }
    }

    for (const runtime of this.dartTraps) {
      if (runtime.disabled) continue;
      const distance = Phaser.Math.Distance.Between(
        member.x,
        member.y,
        this.tileX(runtime.spec.switch.x),
        this.tileY(runtime.spec.switch.y),
      );
      const wizardRange = member.character.className === "wizard" && distance < TILE * 8;
      const thiefRange = member.character.className === "thief" && distance < TILE * 1.7;
      if (wizardRange || thiefRange) {
        return {
          label: wizardRange ? "strike the distant dart switch" : "jam the dart mechanism",
          run: () => {
            runtime.disabled = true;
            runtime.mechanism.setFillStyle(0x4f6b59).setAngle(45);
            this.ctx.say(
              wizardRange ? "A spark snaps across the gallery. The dart ports go dark." : "The dart gears grind to a halt.",
              "#65d48a",
            );
          },
        };
      }
    }

    for (const runtime of this.undeadBarriers) {
      if (runtime.open || Math.abs(member.x - runtime.barrier.x) >= TILE * 2) continue;
      if (member.character.className === "priest") {
        return {
          label: "sanctify the reforming dead",
          run: () => {
            this.openUndeadBarrier(runtime);
            this.ctx.say(`${member.character.name}'s prayer stills the dead for good.`, "#65d48a");
          },
        };
      }
      return {
        label: "force through the reforming dead",
        run: () => {
          const damage = this.ctx.engine.dice.roll("1d6");
          this.ctx.engine.damageCharacter(member.character, damage);
          thud(this.spatial(member));
          floatText(this.scene, member.x, member.y - 18, `-${damage} grasping dead`, "#ff6050");
          this.openUndeadBarrier(runtime);
          this.ctx.say(`${member.character.name} tears through at a bloody cost.`, "#d07070");
        },
      };
    }

    for (const runtime of this.floods) {
      if (this.near(member, runtime.spec.lever)) {
        return {
          label: runtime.high ? "lower the water" : "raise the water",
          run: () => {
            runtime.high = !runtime.high;
            runtime.lever.setAngle(runtime.high ? 35 : -35);
            this.ctx.say(`Stone sluices grind. The chamber ${runtime.high ? "fills" : "drains"}.`, "#70b8d0");
          },
        };
      }
    }

    if (member.character.className !== "thief") return null;

    for (const runtime of this.spikeTraps) {
      if (!runtime.disabled && this.near(member, runtime.spec.mechanism)) {
        return this.disarmInteraction(member, "alternating spikes", () => {
          runtime.disabled = true;
          runtime.mechanism.setFillStyle(0x4f6b59).setAngle(45);
          this.setSpikeBank(runtime.bankA, "safe");
          this.setSpikeBank(runtime.bankB, "safe");
        });
      }
    }

    for (const runtime of this.crushers) {
      if (!runtime.disabled && this.near(member, runtime.spec.mechanism)) {
        return this.disarmInteraction(member, "stone presses", () => {
          runtime.disabled = true;
          runtime.mechanism.setFillStyle(0x4f6b59).setAngle(45);
        });
      }
    }

    return null;
  }

  private createTrap(spec: FeaturedTrapSpec): void {
    switch (spec.kind) {
      case "plate-gate":
        this.createPlateGate(spec);
        break;
      case "alternating-spikes":
        this.createAlternatingSpikes(spec);
        break;
      case "crusher-gallery":
        this.createCrusherGallery(spec);
        break;
      case "dart-gallery":
        this.createDartGallery(spec);
        break;
      case "counterweighted-lift":
        this.createCounterweightedLift(spec);
        break;
      case "light-runes":
        this.createLightRunes(spec);
        break;
      case "undead-barrier":
        this.createUndeadBarrier(spec);
        break;
      case "flooded-chamber":
        this.createFloodedChamber(spec);
        break;
      case "rolling-stone":
        this.createRollingStone(spec);
        break;
      case "collapsing-floor":
        this.createCollapsingFloor(spec);
        break;
    }
  }

  private createPlateGate(spec: Extract<FeaturedTrapSpec, { kind: "plate-gate" }>): void {
    const plate = this.scene.add
      .rectangle(this.tileX(spec.plate.x), 15 * TILE - 4, TILE * 1.15, 7, 0x8f784d)
      .setDepth(5);
    const gate = this.scene.add
      .rectangle(this.tileX(spec.gateX), 13 * TILE, TILE * 0.72, TILE * 4, this.tint, 0.92)
      .setDepth(7);
    this.scene.physics.add.existing(gate, true);
    const latch = this.createMechanism(spec.latch, 0xd6a84d);
    const runtime: PlateGateRuntime = {
      spec,
      plate,
      gate,
      latch,
      open: false,
      latched: false,
      weighted: false,
    };
    this.plateGates.push(runtime);
    for (const actor of this.actors) this.scene.physics.add.collider(actor, gate);
  }

  private createAlternatingSpikes(
    spec: Extract<FeaturedTrapSpec, { kind: "alternating-spikes" }>,
  ): void {
    const bank = (points: readonly TilePoint[]): SpikeBankRuntime => ({
      points,
      sprites: points.map((point) =>
        this.scene.add.image(this.tileX(point.x), 15 * TILE + 9, "spikes").setDepth(6).setAlpha(0.22),
      ),
      state: "safe",
    });
    this.spikeTraps.push({
      spec,
      bankA: bank(spec.bankA),
      bankB: bank(spec.bankB),
      mechanism: this.createMechanism(spec.mechanism, 0xc35b56),
      disabled: false,
    });
  }

  private createCrusherGallery(
    spec: Extract<FeaturedTrapSpec, { kind: "crusher-gallery" }>,
  ): void {
    const columns = spec.columns.map((x) =>
      this.scene.add
        .rectangle(this.tileX(x), -2.5 * TILE, TILE * 1.55, TILE * 9, this.tint, 0.92)
        .setStrokeStyle(3, 0x322d35)
        .setDepth(7),
    );
    this.crushers.push({
      spec,
      columns,
      mechanism: this.createMechanism(spec.mechanism, 0xc35b56),
      active: columns.map(() => false),
      disabled: false,
      bracedBy: null,
      bracedIndex: null,
    });
  }

  private createDartGallery(spec: Extract<FeaturedTrapSpec, { kind: "dart-gallery" }>): void {
    this.dartTraps.push({
      spec,
      emitter: this.scene.add
        .rectangle(this.tileX(spec.emitter.x), this.tileY(spec.emitter.y) - 8, 18, 28, 0x7f4545)
        .setStrokeStyle(2, 0x251719)
        .setDepth(7),
      mechanism: this.createMechanism(spec.switch, 0xc35b56),
      darts: [],
      lastShotAt: -Infinity,
      lastUpdateAt: this.scene.time.now,
      disabled: false,
    });
  }

  private createCounterweightedLift(
    spec: Extract<FeaturedTrapSpec, { kind: "counterweighted-lift" }>,
  ): void {
    const platform = (x: number, y: number) => {
      const tile = this.scene.add
        .rectangle(this.tileX(x), this.tileY(y), TILE * 3, 12, this.tint)
        .setStrokeStyle(2, 0x29242d)
        .setDepth(6);
      this.scene.physics.add.existing(tile, true);
      return tile;
    };
    const left = platform(spec.leftX, spec.bottomY);
    const right = platform(spec.rightX, spec.topY);
    this.lifts.push({
      spec,
      left,
      right,
      lastLeftY: left.y,
      lastRightY: right.y,
    });
  }

  private createLightRunes(spec: Extract<FeaturedTrapSpec, { kind: "light-runes" }>): void {
    const runes = new Map<number, Phaser.GameObjects.Rectangle>();
    for (const x of spec.safeXs) {
      runes.set(
        x,
        this.scene.add
          .rectangle(this.tileX(x), 15 * TILE - 5, TILE * 0.78, 5, 0x8ee6d2)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(6)
          .setAlpha(0.08),
      );
    }
    this.lightRunes.push({ spec, runes });
  }

  private createUndeadBarrier(spec: Extract<FeaturedTrapSpec, { kind: "undead-barrier" }>): void {
    const barrier = this.scene.add
      .rectangle(this.tileX(spec.barrierX), 13 * TILE, TILE * 0.9, TILE * 4, 0x7e8da5, 0.34)
      .setStrokeStyle(3, 0xcad6df)
      .setDepth(7);
    this.scene.physics.add.existing(barrier, true);
    const bones = [11, 12, 13, 14].map((y) =>
      this.scene.add.image(this.tileX(spec.barrierX), this.tileY(y), "deco-bones").setDepth(8),
    );
    this.undeadBarriers.push({ spec, barrier, bones, open: false });
  }

  private createFloodedChamber(spec: Extract<FeaturedTrapSpec, { kind: "flooded-chamber" }>): void {
    const width = (spec.x2 - spec.x1 + 1) * TILE;
    const water = this.scene.add
      .rectangle((this.tileX(spec.x1) + this.tileX(spec.x2)) / 2, 15 * TILE, width, TILE * 2, 0x356b82, 0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    this.floods.push({
      spec,
      water,
      lever: this.createMechanism(spec.lever, 0x4f9db0),
      high: false,
    });
  }

  private createRollingStone(spec: Extract<FeaturedTrapSpec, { kind: "rolling-stone" }>): void {
    this.rollingStones.push({
      spec,
      stone: this.scene.add
        .circle(this.tileX(spec.start.x), this.tileY(spec.start.y), TILE * 0.72, this.tint)
        .setStrokeStyle(4, 0x2b2830)
        .setDepth(8)
        .setVisible(false),
      triggered: false,
      steps: 0,
      lastLeaderTile: Math.floor(this.leader().x / TILE),
    });
  }

  private createCollapsingFloor(
    spec: Extract<FeaturedTrapSpec, { kind: "collapsing-floor" }>,
  ): void {
    const tiles = spec.tiles.map((point) => {
      const tile = this.scene.add
        .rectangle(this.tileX(point.x), this.tileY(point.y), TILE - 2, 10, this.tint)
        .setStrokeStyle(2, 0x39313d)
        .setDepth(6);
      this.scene.physics.add.existing(tile, true);
      return { point, tile, triggeredAt: null, collapsed: false };
    });
    this.collapsingFloors.push({ spec, tiles });
  }

  private createMechanism(point: TilePoint, color: number): Phaser.GameObjects.Rectangle {
    return this.scene.add
      .rectangle(this.tileX(point.x), this.tileY(point.y) - 8, 8, 28, color)
      .setStrokeStyle(2, 0x241b18)
      .setDepth(8)
      .setAngle(-35);
  }

  private updatePlateGate(runtime: PlateGateRuntime): void {
    const occupants = this.members().filter(
      (member) =>
        member.alive &&
        Math.abs(member.x - runtime.plate.x) < TILE * 0.65 &&
        Math.abs(member.y - runtime.plate.y) < TILE,
    );
    for (const occupant of occupants) occupant.mode = "hold";
    const occupied = runtime.weighted || occupants.length > 0;
    runtime.plate.setFillStyle(occupied ? 0x65d48a : 0x8f784d);
    runtime.plate.setScale(1, occupied ? 0.55 : 1);
    const doorwayOccupied = runtime.open && this.members().some(
      (member) => member.alive && Math.abs(member.x - runtime.gate.x) < TILE * 0.75,
    );
    this.setGateOpen(runtime, runtime.latched || occupied || doorwayOccupied);
  }

  private setGateOpen(runtime: PlateGateRuntime, open: boolean): void {
    if (runtime.open === open) return;
    runtime.open = open;
    const body = runtime.gate.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = !open;
    runtime.gate.setAlpha(open ? 0.14 : 0.92).setScale(1, open ? 0.08 : 1);
  }

  private updateAlternatingSpikes(runtime: AlternatingSpikesRuntime, time: number): void {
    if (runtime.disabled) return;
    const phase = time % 7000;
    const stateA = phase < 1000 ? "safe" : phase < 2000 ? "warning" : phase < 3500 ? "active" : "safe";
    const stateB = phase < 4500 ? "safe" : phase < 5500 ? "warning" : "active";
    this.setSpikeBank(runtime.bankA, stateA);
    this.setSpikeBank(runtime.bankB, stateB);
    if (stateA === "active") this.hurtAtPoints(runtime.spec.id, runtime.bankA.points, time, "1d6", "spikes");
    if (stateB === "active") this.hurtAtPoints(runtime.spec.id, runtime.bankB.points, time, "1d6", "spikes");
  }

  private setSpikeBank(bank: SpikeBankRuntime, state: SpikeBankRuntime["state"]): void {
    if (bank.state === state) return;
    bank.state = state;
    const y = state === "active" ? 15 * TILE - 8 : state === "warning" ? 15 * TILE + 2 : 15 * TILE + 9;
    const alpha = state === "active" ? 1 : state === "warning" ? 0.62 : 0.22;
    const tint = state === "warning" ? 0xffb34d : state === "active" ? 0xff6858 : 0xffffff;
    for (const sprite of bank.sprites) sprite.setY(y).setAlpha(alpha).setTint(tint);
  }

  private updateCrushers(runtime: CrusherRuntime, time: number): void {
    if (
      runtime.bracedBy &&
      (!runtime.bracedBy.alive ||
        runtime.bracedIndex === null ||
        Math.abs(runtime.bracedBy.x - this.tileX(runtime.spec.columns[runtime.bracedIndex]!)) > TILE * 1.2)
    ) {
      runtime.bracedBy = null;
      runtime.bracedIndex = null;
    }
    for (let index = 0; index < runtime.columns.length; index++) {
      const column = runtime.columns[index]!;
      if (runtime.disabled) {
        column.setY(-2.5 * TILE).setAlpha(0.32);
        runtime.active[index] = false;
        continue;
      }
      if (runtime.bracedBy && runtime.bracedIndex === index) {
        column.setY(5.5 * TILE).setAlpha(0.9).setFillStyle(0xd0a060);
        runtime.active[index] = false;
        continue;
      }
      const phase = (time + index * 2100) % 7600;
      const warning = phase >= 4200 && phase < 5600;
      const active = phase >= 5600 && phase < 6800;
      runtime.active[index] = active;
      const progress = warning ? (phase - 4200) / 1400 : active ? 1 : 0;
      column
        .setY(Phaser.Math.Linear(-2.5 * TILE, 10 * TILE, progress))
        .setAlpha(warning ? 0.75 : active ? 0.98 : 0.42)
        .setFillStyle(warning || active ? 0xb85a4d : this.tint);
      if (active) {
        this.hurtAtX(runtime.spec.id, runtime.spec.columns[index]!, time, "1d8", "crusher");
      }
    }
  }

  private updateDarts(runtime: DartRuntime, time: number): void {
    const delta = Phaser.Math.Clamp(time - runtime.lastUpdateAt, 0, 50);
    runtime.lastUpdateAt = time;
    if (!runtime.disabled && time - runtime.lastShotAt >= 2400) {
      runtime.lastShotAt = time;
      runtime.emitter.setFillStyle(0xff705c);
      runtime.darts.push(
        this.scene.add
          .rectangle(runtime.emitter.x - 12, runtime.emitter.y, 24, 4, 0xd8c28d)
          .setStrokeStyle(1, 0x3b2b24)
          .setDepth(8),
      );
    } else {
      runtime.emitter.setFillStyle(runtime.disabled ? 0x3f4f45 : 0x7f4545);
    }

    for (const dart of runtime.darts) {
      if (!dart.active) continue;
      dart.x -= delta * 0.22;
      const target = [...this.members()]
        .filter(
          (member) =>
            member.alive &&
            Math.abs(member.x - dart.x) < 20 &&
            Math.abs(member.y - dart.y) < TILE * 0.8,
        )
        .sort((a, b) => b.x - a.x)[0];
      if (target) {
        const shielded = target.character.carriedShield && !target.character.shieldStowed;
        if (shielded) {
          const o = this.spatial(target);
          swordClang({ ...o, gain: (o.gain ?? 1) * 0.5 });
          floatText(this.scene, target.x, target.y - 18, "BLOCK", "#f0d080");
          this.ctx.say(`${target.character.name}'s shield catches a dart.`, "#d0a060");
        } else {
          this.hurt(runtime.spec.id, target, time, "1d4", "dart");
        }
        dart.destroy();
      } else if (dart.x <= this.tileX(runtime.spec.endX)) {
        dart.destroy();
      }
    }
    runtime.darts = runtime.darts.filter((dart) => dart.active);
  }

  private updateLift(runtime: LiftRuntime): void {
    const weightAt = (platform: Phaser.GameObjects.Rectangle) =>
      this.weights().filter(
        (weight) =>
          Math.abs(weight.x - platform.x) < TILE * 1.55 &&
          weight.y < platform.y &&
          platform.y - weight.y < TILE * 1.5,
      ).length;
    const leftWeight = weightAt(runtime.left);
    const rightWeight = weightAt(runtime.right);
    const topY = this.tileY(runtime.spec.topY);
    const bottomY = this.tileY(runtime.spec.bottomY);
    const middleY = (topY + bottomY) / 2;
    const leftTarget = leftWeight === rightWeight ? middleY : leftWeight > rightWeight ? bottomY : topY;
    const rightTarget = leftWeight === rightWeight ? middleY : leftWeight > rightWeight ? topY : bottomY;
    runtime.lastLeftY = this.movePlatform(runtime.left, leftTarget, runtime.lastLeftY);
    runtime.lastRightY = this.movePlatform(runtime.right, rightTarget, runtime.lastRightY);
  }

  private movePlatform(
    platform: Phaser.GameObjects.Rectangle,
    targetY: number,
    previousY: number,
  ): number {
    const nextY = Phaser.Math.Linear(platform.y, targetY, 0.06);
    const deltaY = nextY - previousY;
    for (const actor of this.actors) {
      if (
        actor.active &&
        Math.abs(actor.x - platform.x) < TILE * 1.45 &&
        actor.y < previousY &&
        previousY - actor.y < TILE * 1.5
      ) {
        actor.y += deltaY;
      }
    }
    platform.y = nextY;
    (platform.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    return nextY;
  }

  private updateLightRunes(runtime: LightRunesRuntime, time: number): void {
    for (const [x, rune] of runtime.runes) {
      const light = this.lightAt(rune.x, rune.y);
      rune.setAlpha(light === "lit" ? 0.95 : light === "dim" ? 0.38 : 0.06);
      rune.setScale(1 + 0.08 * Math.sin(time / 180 + x), 1);
    }
    for (const member of this.members()) {
      const tileX = Math.floor(member.x / TILE);
      if (
        member.alive &&
        tileX >= runtime.spec.x1 &&
        tileX <= runtime.spec.x2 &&
        !runtime.spec.safeXs.includes(tileX) &&
        Math.abs(member.y - this.tileY(runtime.spec.y)) < TILE * 1.1
      ) {
        this.hurt(runtime.spec.id, member, time, "1d4", "shadow rune");
        member.setVelocityY(-220);
      }
    }
  }

  private updateFlood(runtime: FloodRuntime): void {
    const surfaceY = this.tileY(runtime.high ? runtime.spec.highY : runtime.spec.lowY);
    const bottomY = 17 * TILE;
    runtime.water.setY((surfaceY + bottomY) / 2).setDisplaySize(runtime.water.width, bottomY - surfaceY);
    runtime.water.setAlpha(runtime.high ? 0.48 : 0.3);

    const submerged = new Set<CharacterSprite>();
    for (const member of this.members()) {
      if (
        member.alive &&
        member.x >= this.tileX(runtime.spec.x1) - TILE / 2 &&
        member.x <= this.tileX(runtime.spec.x2) + TILE / 2 &&
        member.y >= surfaceY - TILE * 0.4
      ) {
        submerged.add(member);
        const body = member.body as Phaser.Physics.Arcade.Body;
        body.setGravityY(-850);
        if (body.velocity.y > 110) body.setVelocityY(110);
        if (member.torchLit) this.snuffTorch(member);
      }
    }
    for (const member of this.swimmers) {
      if (!submerged.has(member)) (member.body as Phaser.Physics.Arcade.Body).setGravityY(0);
    }
    this.swimmers.clear();
    for (const member of submerged) this.swimmers.add(member);
  }

  private updateRollingStone(runtime: RollingStoneRuntime, time: number): void {
    const leader = this.leader();
    const leaderTile = Math.floor(leader.x / TILE);
    if (!runtime.triggered && leaderTile >= runtime.spec.triggerX) {
      runtime.triggered = true;
      runtime.stone.setVisible(true);
      runtime.lastLeaderTile = leaderTile;
      this.ctx.say("Stone grinds behind you. It moves when you move.", "#d0a060");
    }
    if (!runtime.triggered) return;
    if (leaderTile !== runtime.lastLeaderTile) {
      runtime.steps += Math.min(2, Math.abs(leaderTile - runtime.lastLeaderTile));
      runtime.lastLeaderTile = leaderTile;
    }
    const targetX = Math.min(
      this.tileX(runtime.spec.endX),
      this.tileX(runtime.spec.start.x + runtime.steps),
    );
    runtime.stone.x = Phaser.Math.Linear(runtime.stone.x, targetX, 0.22);
    runtime.stone.angle += 5;
    for (const member of this.members()) {
      if (
        member.alive &&
        Phaser.Math.Distance.Between(member.x, member.y, runtime.stone.x, runtime.stone.y) < TILE * 1.1
      ) {
        this.hurt(runtime.spec.id, member, time, "1d8", "rolling stone");
        member.setVelocityX(260);
      }
    }
  }

  private updateCollapsingFloor(runtime: CollapsingFloorRuntime, time: number): void {
    for (const floor of runtime.tiles) {
      if (floor.collapsed) continue;
      const occupied = this.members().some(
        (member) =>
          member.alive &&
          Math.abs(member.x - floor.tile.x) < TILE * 0.48 &&
          member.y < floor.tile.y &&
          floor.tile.y - member.y < TILE * 1.25,
      );
      if (occupied && floor.triggeredAt === null) {
        floor.triggeredAt = time;
        floor.tile.setStrokeStyle(3, 0xffb060).setAngle((floor.point.x % 2 === 0 ? 1 : -1) * 2);
      }
      if (floor.triggeredAt !== null && time - floor.triggeredAt >= 900) {
        floor.collapsed = true;
        (floor.tile.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.scene.tweens.add({ targets: floor.tile, y: floor.tile.y + TILE * 3, alpha: 0, duration: 500 });
      }
    }
  }

  private openUndeadBarrier(runtime: UndeadBarrierRuntime): void {
    runtime.open = true;
    (runtime.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    runtime.barrier.setAlpha(0.05);
    for (const bone of runtime.bones) {
      this.scene.tweens.add({ targets: bone, alpha: 0, y: bone.y + 24, duration: 450 });
    }
  }

  private hurtAtPoints(
    trapId: string,
    points: readonly TilePoint[],
    time: number,
    damageDice: string,
    label: string,
  ): void {
    for (const point of points) {
      for (const member of this.members()) {
        if (
          member.alive &&
          Math.abs(member.x - this.tileX(point.x)) < TILE * 0.42 &&
          Math.abs(member.y - this.tileY(point.y)) < TILE * 1.1
        ) {
          this.hurt(trapId, member, time, damageDice, label);
        }
      }
    }
  }

  private hurtAtX(trapId: string, x: number, time: number, damageDice: string, label: string): void {
    for (const member of this.members()) {
      if (member.alive && Math.abs(member.x - this.tileX(x)) < TILE * 0.72) {
        this.hurt(trapId, member, time, damageDice, label);
      }
    }
  }

  /** Trap sounds are heard from wherever the leader stands. */
  private spatial(p: Vec2): SfxOpts {
    const l = this.leader();
    return spatialOpts({ x: p.x, y: p.y }, { x: l.x, y: l.y });
  }

  private hurt(
    trapId: string,
    member: CharacterSprite,
    time: number,
    damageDice: string,
    label: string,
  ): void {
    const key = `${trapId}:${member.character.id}`;
    if (time - (this.lastHurtAt.get(key) ?? -Infinity) < 1200) return;
    this.lastHurtAt.set(key, time);
    const damage = this.ctx.engine.dice.roll(damageDice);
    spikeTrap(this.spatial(member));
    floatText(this.scene, member.x, member.y - 18, `-${damage} ${label}`, "#ff6050");
    const wentDown = this.ctx.engine.damageCharacter(member.character, damage);
    if (wentDown) this.ctx.say(`${member.character.name} is brought down by the ${label}!`, "#ff5050");
  }

  private disarmInteraction(
    member: CharacterSprite,
    label: string,
    onSuccess: () => void,
  ): TrapInteraction {
    return {
      label: `disarm the ${label}`,
      run: () => {
        const result = this.ctx.engine.check({
          actor: member.character,
          stat: "DEX",
          dc: DC.NORMAL,
          kind: "stat",
        });
        if (result.success) {
          onSuccess();
          this.ctx.say(`${member.character.name} disables the ${label}.`, "#65d48a");
        } else {
          this.ctx.say(`Disarm failed (rolled ${result.total} vs DC ${DC.NORMAL}).`, "#d07070");
        }
      },
    };
  }

  private near(member: CharacterSprite, point: TilePoint): boolean {
    return Phaser.Math.Distance.Between(member.x, member.y, this.tileX(point.x), this.tileY(point.y)) < TILE * 1.7;
  }

  private tileX(x: number): number {
    return x * TILE + TILE / 2;
  }

  private tileY(y: number): number {
    return y * TILE + TILE / 2;
  }
}
