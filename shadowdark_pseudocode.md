# Shadowdark Algorithmic Pseudocode

This document provides a comprehensive, unified algorithmic pseudocode implementation of the Shadowdark rules for game-engine integration.

---

## Algorithmic Pseudo-code Implementation

The following pseudocode translates the combined Shadowdark rules into logical algorithms for use in game-loop systems or game engines.

### A. Core Constants & Data Structures

```python
# Ability Scores
class StatType:
    STR = "Strength"
    DEX = "Dexterity"
    CON = "Constitution"
    INT = "Intelligence"
    WIS = "Wisdom"
    CHA = "Charisma"

# Standard Difficulty Classes
class DC:
    EASY = 9
    NORMAL = 12
    HARD = 15
    EXTREME = 18

# Environment Crawling Danger Levels
class CrawlingDanger:
    UNSAFE = 3
    RISKY = 2
    DEADLY = 1

# Advantage Status
class RollMode:
    NORMAL = 0
    ADVANTAGE = 1
    DISADVANTAGE = 2

# Distances
class DistanceType:
    CLOSE = "Close"
    NEAR = "Near"
    FAR = "Far"

# Creature Attitude / Reaction
class AttitudeType:
    HOSTILE = "Hostile"
    SUSPICIOUS = "Suspicious"
    NEUTRAL = "Neutral"
    CURIOUS = "Curious"
    FRIENDLY = "Friendly"

# Treasure Quality
class TreasureQuality:
    POOR = 0        # 0 XP
    NORMAL = 1      # 1 XP
    FABULOUS = 3    # 3 XP
    LEGENDARY = 10  # 10 XP

class AncestryType:
    DWARF = "Dwarf"
    ELF = "Elf"
    GOBLIN = "Goblin"
    HALFLING = "Halfling"
    HALF_ORC = "Half-Orc"
    HUMAN = "Human"

class ClassType:
    FIGHTER = "Fighter"
    PRIEST = "Priest"
    THIEF = "Thief"
    WIZARD = "Wizard"

class AlignmentType:
    LAWFUL = "Lawful"
    NEUTRAL = "Neutral"
    CHAOTIC = "Chaotic"
```

### B. Core Roll & Check Mechanics

```python
# Standard dice rolling helper
function roll_dice(num: int, sides: int) -> int:
    total = 0
    for i from 1 to num:
        total += random_integer_between(1, sides)
    return total

# Roll with advantage/disadvantage handling
function roll_d20_mode(mode: RollMode) -> int:
    if mode == RollMode.NORMAL:
        return roll_dice(1, 20)
    elif mode == RollMode.ADVANTAGE:
        return max(roll_dice(1, 20), roll_dice(1, 20))
    elif mode == RollMode.DISADVANTAGE:
        return min(roll_dice(1, 20), roll_dice(1, 20))

# D6 Decider for binary outcomes
function roll_d6_decider() -> bool:
    roll = roll_dice(1, 6)
    return roll >= 4 # True = Better outcome (4-6), False = Worse outcome (1-3)

# Resolve a check
function resolve_check(character: Character, stat: StatType, target_dc: int, mode: RollMode, has_time_pressure: bool, has_dire_consequences: bool) -> CheckResult:
    # Rules check: trained tasks succeed automatically unless under time pressure and dire consequences
    if character.is_trained_in(stat) and not (has_time_pressure and has_dire_consequences):
        return new CheckResult(success=True, natural_roll=10, total=target_dc)
        
    roll = roll_d20_mode(mode)
    modifier = get_stat_modifier(character.stats[stat])
    total = roll + modifier
    
    is_success = total >= target_dc
    if roll == 20:
        return new CheckResult(success=True, natural_roll=20, total=total, is_critical=True)
    if roll == 1:
        return new CheckResult(success=False, natural_roll=1, total=total, is_critical=True)
        
    return new CheckResult(success=is_success, natural_roll=roll, total=total)

# Contested check resolution
function resolve_contested_check(char_a: Character, stat_a: StatType, mode_a: RollMode, char_b: Character, stat_b: StatType, mode_b: RollMode) -> Character:
    while true:
        roll_a = roll_d20_mode(mode_a) + get_stat_modifier(char_a.stats[stat_a])
        roll_b = roll_d20_mode(mode_b) + get_stat_modifier(char_b.stats[stat_b])
        if roll_a > roll_b:
            return char_a
        elif roll_b > roll_a:
            return char_b
        # Reroll ties (page 43)
```

### C. Character Systems & Progression

```python
class Character:
    name: String
    ancestry: AncestryType
    class_type: ClassType
    alignment: AlignmentType
    level: int = 1
    xp: int = 0
    max_hp: int
    current_hp: int
    stats: Map[StatType, int]
    trained_skills: List[String]
    languages: List[String]
    gear: List[Item]
    luck_token: bool = false
    is_dying: bool = false
    death_timer: int = 0
    known_spells: List[Spell]
    unlocked_spells_lost: List[Spell] # Spells disabled until next rest
    has_focus_active: bool = false
    active_focus_spell: Spell = null
    
    function get_stat_modifier(stat: StatType) -> int:
        score = this.stats[stat]
        if score >= 18: return 4
        elif score >= 16: return 3
        elif score >= 14: return 2
        elif score >= 12: return 1
        elif score >= 10: return 0
        elif score >= 8: return -1
        elif score >= 6: return -2
        elif score >= 4: return -3
        else: return -4

    function is_trained_in(task_or_stat: String) -> bool:
        return task_or_stat in this.trained_skills

    function calculate_max_gear_slots() -> int:
        base_slots = max(10, this.stats[StatType.STR])
        # Fighter Hauler benefit (page 18)
        if this.class_type == ClassType.FIGHTER:
            con_mod = this.get_stat_modifier(StatType.CON)
            if con_mod > 0:
                base_slots += con_mod
        return base_slots

    function get_carried_slots_count() -> int:
        total_slots = 0
        coin_count = 0
        for item in this.gear:
            if item.name == "Coin":
                coin_count += item.quantity
            else:
                total_slots += item.slots_occupied
        
        # First 100 coins are free; 1 slot per 100 thereafter (page 33)
        if coin_count > 100:
            total_slots += math.ceil((coin_count - 100) / 100)
            
        return total_slots

    # Level Up Progression
    function check_level_up():
        xp_needed = this.level * 10
        if this.xp >= xp_needed:
            this.xp = 0 # Reset XP (page 37)
            this.level += 1
            
            # Increase HP (Dwarf rolls with advantage)
            hp_die_sides = 8 if this.class_type == ClassType.FIGHTER else (6 if this.class_type == ClassType.PRIEST else 4)
            con_mod = this.get_stat_modifier(StatType.CON)
            
            gained_hp = 0
            if this.ancestry == AncestryType.DWARF:
                gained_hp = max(roll_dice(1, hp_die_sides), roll_dice(1, hp_die_sides))
            else:
                gained_hp = roll_dice(1, hp_die_sides)
                
            this.max_hp += max(1, gained_hp + con_mod)
            this.current_hp = this.max_hp
            
            # Roll for talent if level is 3, 5, 7, or 9
            if this.level in [3, 5, 7, 9]:
                this.roll_class_talent()

    function roll_class_talent():
        roll = roll_dice(2, 6)
        # Apply specific class-based talent enhancements...
```

### D. Time, Crawling, & Movement Systems

```python
class ActiveLightSource:
    name: String # Torch, Lantern, Campfire
    duration_remaining_seconds: float
    range: DistanceType

class TimeSystem:
    active_light_timer: ActiveLightSource = null
    real_time_tracking: bool = true
    
    function update_time_elapsed(seconds: float, party: Party, danger: CrawlingDanger):
        if this.active_light_timer != null:
            this.active_light_timer.duration_remaining_seconds -= seconds
            if this.active_light_timer.duration_remaining_seconds <= 0:
                this.active_light_timer = null
                trigger_light_snuffed_event(party)

    # Campfire implementation (combines 3 torches)
    function create_campfire(party: Party) -> bool:
        torch_count = 0
        # Find and remove 3 torches from party inventory
        for member in party.members:
            for item in member.gear:
                if item.name == "Torch" and item.quantity > 0:
                    item.quantity -= 1
                    torch_count += 1
                    if torch_count == 3:
                        break
            if torch_count == 3: break
            
        if torch_count == 3:
            this.active_light_timer = new ActiveLightSource("Campfire", 28800.0, DistanceType.NEAR) # 8 hours
            return true
        return false

# Movement checks
function resolve_climbing(character: Character, is_slippery: bool) -> String:
    mode = RollMode.NORMAL
    if character.class_type == ClassType.THIEF:
        mode = RollMode.ADVANTAGE # Thief climbing advantage
        
    dc = DC.NORMAL
    if is_slippery: dc = DC.HARD
    
    result = resolve_check(character, StatType.DEX, dc, mode, has_time_pressure=true, has_dire_consequences=true)
    if result.success:
        return "Climbed successfully at half speed"
    elif (result.total + 5) <= dc:
        # Failed by 5+ points -> Fall
        damage = roll_dice(1, 6) # Assume base 10' fall
        character.current_hp -= damage
        return "Failed check by 5+ and fell, taking " + damage + " damage"
    return "Failed to climb but did not fall"

function resolve_swimming(character: Character, rounds_swimming: int, is_rough_water: bool) -> String:
    # Armor penalty check
    has_heavy_armor = character.is_wearing_heavy_armor()
    if has_heavy_armor and not character.has_mithral_armor():
        return "Drowning! Plate mail cannot swim, chainmail has disadvantage"
        
    mode = RollMode.NORMAL
    if character.class_type == ClassType.THIEF:
         mode = RollMode.ADVANTAGE # Thief swimming/climbing advantage
         
    if is_rough_water:
        result = resolve_check(character, StatType.STR, DC.NORMAL, mode, has_time_pressure=true, has_dire_consequences=true)
        if not result.success:
            return "Struggled and made no progress in rough water"
            
    con_mod = character.get_stat_modifier(StatType.CON)
    safe_rounds = max(1, con_mod)
    
    if rounds_swimming > safe_rounds:
        # Must pass Constitution check each round or take 1d6 damage (page 47)
        check = resolve_check(character, StatType.CON, DC.NORMAL, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
        if not check.success:
            damage = roll_dice(1, 6)
            character.current_hp -= damage
            return "Suffocated, taking " + damage + " damage"
            
    return "Swam safely at half speed"
```

### E. Resting System

```python
function attempt_rest(character: Character, unsafe_environment: bool) -> bool:
    # Requirements: 8 hours sleep and 1 ration (page 48)
    has_ration = false
    for item in character.gear:
        if item.name == "Rations" and item.quantity > 0:
            item.quantity -= 1
            has_ration = true
            break
            
    if not has_ration:
        return false # Cannot rest without food/water
        
    if unsafe_environment:
        # GM checks for random encounter at rest frequency (hours instead of rounds)
        if roll_dice(1, 6) == 1:
            # Encounter triggers, rest interrupted
            interrupted_check = resolve_check(character, StatType.CON, DC.NORMAL, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
            if not interrupted_check.success:
                return false # Rest failed, ration consumed
                
    # Success: heal fully and clear temporary stat damage
    character.current_hp = character.max_hp
    character.unlocked_spells_lost.clear()
    return true
```

### F. Stealth & Surprise Systems

```python
function resolve_stealth_check(stealthy_char: Character, active_searcher: Character = null) -> bool:
    mode = RollMode.NORMAL
    if stealthy_char.class_type == ClassType.THIEF:
        mode = RollMode.ADVANTAGE # Thief sneaking advantage
        
    stealth_result = resolve_check(stealthy_char, StatType.DEX, DC.NORMAL, mode, has_time_pressure=true, has_dire_consequences=false)
    
    # If there's an active observer
    if active_searcher != null:
        searcher_result = resolve_check(active_searcher, StatType.WIS, DC.NORMAL, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=false)
        return stealth_result.total > searcher_result.total
        
    return stealth_result.success
```

### G. Combat System

```python
function resolve_combat_attack(attacker: Character, defender: Character, weapon: Weapon, has_surprise: bool, cover: bool) -> int:
    mode = RollMode.NORMAL
    if has_surprise:
        mode = RollMode.ADVANTAGE # Advantage on surprised targets
    elif cover:
        mode = RollMode.DISADVANTAGE # Disadvantage if target behind cover
        
    # Finesse weapon handling
    attack_stat = StatType.STR
    if "Finesse" in weapon.properties and attacker.stats[StatType.DEX] > attacker.stats[StatType.STR]:
        attack_stat = StatType.DEX
        
    # Ranged weapon base Dex
    if weapon.is_ranged:
        attack_stat = StatType.DEX
        
    # Attack roll
    check = resolve_check(attacker, attack_stat, defender.calculate_ac(), mode, has_time_pressure=true, has_dire_consequences=true)
    
    if not check.success:
        return 0 # Missed
        
    # Roll weapon damage
    damage_rolls = parse_damage_formula(weapon.damage_formula)
    damage = roll_dice(damage_rolls.num, damage_rolls.sides)
    
    # Apply Half-Orc Mighty melee bonus
    if attacker.ancestry == AncestryType.HALF_ORC and not weapon.is_ranged:
        damage += 1
        
    # Apply Fighter Weapon Mastery bonus
    if attacker.class_type == ClassType.FIGHTER and attacker.has_weapon_mastery_with(weapon.name):
        damage += 1 + math.floor(attacker.level / 2)
        
    # Backstab execution (Thief class)
    if attacker.class_type == ClassType.THIEF and has_surprise:
        extra_dice = 1 + math.floor(attacker.level / 2)
        for i from 1 to extra_dice:
            damage += roll_dice(1, damage_rolls.sides)
            
    # Critical hit handling (Natural 20)
    if check.is_critical:
        damage *= 2 # Double damage dice (page 51)
        
    defender.apply_damage(damage)
    return damage

function handle_zero_hp(character: Character):
    character.current_hp = 0
    character.is_dying = true
    con_mod = character.get_stat_modifier(StatType.CON)
    character.death_timer = max(1, roll_dice(1, 4) + con_mod) # 1d4 + CON mod rounds

# Tick character's status during dying phase
function tick_dying_character(character: Character) -> String:
    if not character.is_dying:
        return "Character is stable"
        
    # Roll self-revival check (d20, Natural 20 saves, page 51)
    roll = roll_dice(1, 20)
    if roll == 20:
        character.current_hp = 1
        character.is_dying = false
        character.death_timer = 0
        return "Natural 20! Character woke up with 1 HP."
        
    character.death_timer -= 1
    if character.death_timer <= 0:
        character.is_dying = false
        return "Character has died and is retired from play."
        
    return "Character is dying. Timer: " + character.death_timer + " rounds remaining."

# Stabilize check by an ally
function attempt_stabilize(healer: Character, target: Character) -> bool:
    if not target.is_dying:
        return true
        
    result = resolve_check(healer, StatType.INT, 15, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
    if result.success:
        target.is_dying = false
        target.death_timer = 0
        return true # Target is stable but remains at 0 HP unconscious
    return false

# Resolve morale check (page 51)
function resolve_morale_check(group_leader: Character, group_size: int, current_size: int) -> bool:
    if current_size <= (group_size / 2):
        # Reduced to half or less -> make DC 15 WIS check using leader's modifier
        roll = roll_dice(1, 20)
        total = roll + group_leader.get_stat_modifier(StatType.WIS)
        if total < 15:
            return false # Flee!
    return true

# Spend a luck token to reroll any roll (page 41)
function attempt_luck_reroll(character: Character, original_check_result: CheckResult, stat: StatType, target_dc: int, mode: RollMode) -> CheckResult:
    if not character.luck_token:
        return original_check_result
        
    character.luck_token = false
    # Roll again and use the new result
    return resolve_check(character, stat, target_dc, mode, has_time_pressure=true, has_dire_consequences=true)
```

### H. Spellcasting System

```python
function cast_spell(caster: Character, spell: Spell, target: Character) -> bool:
    casting_stat = StatType.INT if caster.class_type == ClassType.WIZARD else StatType.WIS
    
    # Check if spell was previously lost
    if spell in caster.unlocked_spells_lost:
        return false
        
    target_dc = 10 + spell.tier
    mode = RollMode.NORMAL
    
    # Class/Ancestry talent modifiers
    if caster.ancestry == AncestryType.ELF and caster.class_type == ClassType.WIZARD:
        mode = RollMode.ADVANTAGE
        
    check = resolve_check(caster, casting_stat, target_dc, mode, has_time_pressure=true, has_dire_consequences=true)
    
    # Spell Focus management (page 56)
    if spell.is_focus and check.success:
        caster.has_focus_active = true
        caster.active_focus_spell = spell
        
    if not check.success:
        caster.unlocked_spells_lost.append(spell)
        
        # Mishap & Penance check
        if check.is_critical: # Critical Failure (Natural 1)
            if caster.class_type == ClassType.WIZARD:
                trigger_wizard_mishap(caster, spell.tier)
            elif caster.class_type == ClassType.PRIEST:
                trigger_priest_penance(caster, spell)
        return false
        
    # Double numerical effect on Critical Success (Natural 20)
    multiplier = 2 if check.is_critical else 1
    apply_spell_effect(spell, target, multiplier)
    return true

function trigger_wizard_mishap(caster: Character, tier: int):
    roll = roll_dice(1, 12)
    # Apply Tier 1-2 mishap effects (page 54)
    if roll == 2:
        caster.current_hp -= roll_dice(1, 8) # Explosion!

function trigger_priest_penance(caster: Character, spell: Spell):
    caster.unlocked_spells_lost.append(spell)
    sacrifice_gp = 0
    if spell.tier == 1: sacrifice_gp = 5
    elif spell.tier == 2: sacrifice_gp = 20
    elif spell.tier == 3: sacrifice_gp = 40
    elif spell.tier == 4: sacrifice_gp = 90
    else: sacrifice_gp = 150
    # Caster must destroy/donate gold/items equal to sacrifice_gp (page 53)

# Maintaining Focus at start of turn (page 56)
function tick_focus_check(caster: Character) -> bool:
    if not caster.has_focus_active:
        return true
        
    spell = caster.active_focus_spell
    casting_stat = StatType.INT if caster.class_type == ClassType.WIZARD else StatType.WIS
    
    # Must check at start of turn (DC 10 + tier)
    check = resolve_check(caster, casting_stat, 10 + spell.tier, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
    
    if not check.success:
        caster.has_focus_active = false
        caster.active_focus_spell = null
        return false # Focus broke, spell ends
        
    return true

# Scrolls & Wands usage (page 55)
function cast_from_scroll(caster: Character, scroll: Scroll, target: Character) -> bool:
    target_dc = 10 + scroll.spell.tier
    check = resolve_check(caster, StatType.INT if caster.class_type == ClassType.WIZARD else StatType.WIS, target_dc, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
    
    # Scroll disappears after attempt (page 55)
    scroll.quantity -= 1
    
    if not check.success:
        if check.is_critical and caster.class_type == ClassType.WIZARD:
            trigger_wizard_mishap(caster, scroll.spell.tier)
        return false
        
    apply_spell_effect(scroll.spell, target, 2 if check.is_critical else 1)
    return true

function cast_from_wand(caster: Character, wand: Wand, target: Character) -> bool:
    if wand.is_depleted:
        return false
        
    target_dc = 10 + wand.spell.tier
    check = resolve_check(caster, StatType.INT if caster.class_type == ClassType.WIZARD else StatType.WIS, target_dc, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
    
    if not check.success:
        wand.is_depleted = true # Wand stops working until rest (page 55)
        if check.is_critical:
            wand.is_broken = true # Wand permanently breaks on critical failure (page 55)
            if caster.class_type == ClassType.WIZARD:
                trigger_wizard_mishap(caster, wand.spell.tier)
        return false
        
    apply_spell_effect(wand.spell, target, 2 if check.is_critical else 1)
    return true
```

### I. GM Systems (Encounters, Traps, Hazards, XP, Gold)

```python
class EncounterInfo:
    triggered: bool
    distance: DistanceType
    activity: String
    attitude: AttitudeType
    creature_name: String

class CrawlingSystem:
    party: Party
    danger_level: int # CrawlingDanger rating (1, 2, or 3)
    round_counter: int = 0
    
    function increment_round(loud_disturbance: bool = false, in_total_darkness: bool = false) -> EncounterInfo:
        this.round_counter += 1
        
        should_check = false
        if loud_disturbance or in_total_darkness:
            # Rule: check every round in total darkness or if loud disturbance occurs (page 46)
            should_check = true
        elif this.round_counter % this.danger_level == 0:
            should_check = true
            
        if should_check:
            # Roll 1d6. An encounter occurs on a 1 (page 14)
            if roll_dice(1, 6) == 1:
                return this.trigger_encounter()
                
        return new EncounterInfo(triggered=false)
        
    function trigger_encounter() -> EncounterInfo:
        creature_name = get_random_creature_for_zone()
        
        # Starting Distance (1d6, page 14)
        dist_roll = roll_dice(1, 6)
        distance = DistanceType.NEAR
        if dist_roll == 1:
            distance = DistanceType.CLOSE
        elif dist_roll >= 5:
            distance = DistanceType.FAR
            
        # Creature Activity (2d6, page 14)
        act_roll = roll_dice(2, 6)
        activity = ""
        if act_roll <= 4: activity = "Hunting"
        elif act_roll <= 6: activity = "Eating"
        elif act_roll <= 8: activity = "Building/nesting"
        elif act_roll <= 10: activity = "Socializing/playing"
        elif act_roll == 11: activity = "Guarding"
        else: activity = "Sleeping"
        
        # Reaction / Attitude Check (2d6 + CHA Mod, page 15)
        is_vicious = check_if_creature_is_vicious(creature_name)
        attitude = AttitudeType.HOSTILE
        
        if not is_vicious:
            interactor = this.select_interacting_character()
            cha_modifier = 0
            if interactor != null:
                cha_modifier = interactor.get_stat_modifier(StatType.CHA)
                reveal_party_position() # Interacting reveals presence
                
            react_roll = roll_dice(2, 6) + cha_modifier
            
            if react_roll <= 6: attitude = AttitudeType.HOSTILE
            elif react_roll <= 8: attitude = AttitudeType.SUSPICIOUS
            elif react_roll == 9: attitude = AttitudeType.NEUTRAL
            elif react_roll <= 11: attitude = AttitudeType.CURIOUS
            else: attitude = AttitudeType.FRIENDLY
            
        return new EncounterInfo(
            triggered=true,
            distance=distance,
            activity=activity,
            attitude=attitude,
            creature_name=creature_name
        )
        
    function select_interacting_character() -> Character:
        return prompt_players_for_interactor()

# Falling Damage Math (page 47)
function resolve_falling(character: Character, height_feet: int) -> int:
    ten_foot_segments = math.floor(height_feet / 10)
    damage = roll_dice(ten_foot_segments, 6) # 1d6 damage for every 10 feet
    character.current_hp -= damage
    return damage

# Traps System
class Trap:
    d12_id: int
    name: String
    trigger: String
    damage_formula: String
    secondary_effect: String
    is_found: bool = false
    is_disabled: bool = false

class TrapSystem:
    # Finding Traps (pg. 16): search specific area automatically succeeds
    function search_area_for_trap(character: Character, target_object: String, trap: Trap):
        if is_searching_specific_location(target_object, trap):
            trap.is_found = true
            display_tell_or_hint(trap)
            
    # Disabling Traps (pg. 16): Thieves & tinkering trained characters succeed automatically with time
    function attempt_disable_trap(character: Character, trap: Trap, method: String, is_time_pressure: bool) -> bool:
        if not trap.is_found: return false
            
        is_trained = character.is_trained_in("tinkering") or character.is_trained_in("thievery")
        is_reasonable = validate_method(method, trap)
        
        if is_trained and is_reasonable and not is_time_pressure:
            trap.is_disabled = true
            return true
            
        target_dc = DC.NORMAL if trap.d12_id < 9 else DC.HARD
        success_check = resolve_check(character, StatType.DEX, target_dc, RollMode.NORMAL, is_time_pressure, has_dire_consequences=true)
        if success_check.success:
            trap.is_disabled = true
            return true
        else:
            this.trigger_trap(trap, character)
            return false
            
    function trigger_trap(trap: Trap, target_character: Character):
        if trap.is_disabled: return
            
        stat_to_check = StatType.DEX
        if trap.secondary_effect in ["paralyze", "sleep", "unconscious"]:
            stat_to_check = StatType.CON
            
        mitigated = resolve_check(target_character, stat_to_check, DC.NORMAL, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
        
        if not mitigated.success:
            damage_rolls = parse_damage_formula(trap.damage_formula)
            damage = roll_dice(damage_rolls.num, damage_rolls.sides)
            target_character.current_hp -= damage
            if trap.secondary_effect != "none":
                target_character.apply_status_effect(trap.secondary_effect)

# Hazards System (page 17)
class Hazard:
    d12_id: int
    name: String
    hazard_class: String # Movement, Damage, Weaken, Combined
    effect_description: String

class HazardSystem:
    function resolve_hazard_tick(character: Character, hazard: Hazard):
        if hazard.hazard_class == "Movement":
            # DEX/STR check to escape
            escaped = resolve_check(character, StatType.DEX, DC.NORMAL, RollMode.NORMAL, has_time_pressure=true, has_dire_consequences=true)
            if not escaped.success:
                character.apply_movement_restriction()
        elif hazard.hazard_class == "Damage":
            damage = roll_dice(1, 6)
            character.current_hp -= damage
        elif hazard.hazard_class == "Weaken":
            apply_weakening_status(character, hazard.name)
        elif hazard.hazard_class == "Combined":
            character.apply_movement_restriction()
            damage = roll_dice(1, 6)
            character.current_hp -= damage

# XP & Gold guidelines (page 13)
function get_treasure_xp(treasure_quality: TreasureQuality) -> int:
    if treasure_quality == TreasureQuality.POOR: return 0
    elif treasure_quality == TreasureQuality.NORMAL: return 1
    elif treasure_quality == TreasureQuality.FABULOUS: return 3
    elif treasure_quality == TreasureQuality.LEGENDARY: return 10
    return 0

function generate_encounter_reward_value(party: Party) -> float:
    avg_level = party.get_average_level()
    target_gp = 10.0 * avg_level
    if avg_level <= 3.0:
        return 20.0  # Levels 1-3 baseline
    elif avg_level <= 6.0:
        return 50.0  # Levels 4-6 baseline
    elif avg_level <= 9.0:
        return 80.0  # Levels 7-9 baseline
    return target_gp
```