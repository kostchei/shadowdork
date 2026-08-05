import { Engine, Character, ClassName, Ancestry, Alignment, AttackInput, AttackResult } from "./engine/index.js";
import { createCharacter, registerTables } from "./data/index.js";
import { CheckResult } from "./engine/check.js";
import { StatName } from "./engine/character.js";

/**
 * Initialize and return a new game engine, complete with registered tables.
 * This should be the first function called to set up the game state.
 */
export function createEngine(): Engine {
    const engine = new Engine();
    registerTables(engine);
    return engine;
}

/**
 * Generate a new character of a given class.
 * This fulfills tasks like "generate character a random human fighter".
 */
export function generateCharacter(
    engine: Engine,
    id: string,
    name: string,
    className: ClassName,
    ancestry?: Ancestry,
    alignment?: Alignment
): Character {
    return createCharacter(engine, id, name, className, ancestry, alignment);
}

/**
 * Perform an attack ("roll to hit").
 * Resolves the attack roll against the target's AC and calculates damage if successful.
 */
export function rollToHit(engine: Engine, input: AttackInput): AttackResult {
    return engine.attack(input);
}

/**
 * Perform a stat check or task (like "check dexterity for open locks").
 * Resolves the d20 roll against a given DC.
 */
export function performCheck(
    engine: Engine,
    actor: Character,
    stat: StatName,
    dc: number,
    task?: string
): CheckResult {
    return engine.check({
        actor,
        stat,
        dc,
        kind: "stat",
        task
    });
}
