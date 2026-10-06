Feature: T1.4 Damage, healing, death and Flight
  Background:
    Given a deterministic encounter with critChance 0 unless testing critical hits
    And all combat values come from the class and combat definitions

  Scenario: C1 Armor and multiplicative mitigation use basis points
    Given a Jaguar with 3000 armor basis points
    When Flayed Strike deals 400 base damage
    Then the final damage is 280
    And supplying a 5000 basis point modifier makes the final damage 140
    And multiple modifiers multiply before the single final floor with minimum damage 1

  Scenario: C2 Player critical hits use the encounter RNG
    Given an Eagle with critChance 1
    When Obsidian Arrow finishes casting
    Then it deals 210 damage and advances rngState
    And enemy and environmental sources cannot critically hit

  Scenario: C3 Effective healing excludes overhealing
    Given a living ally missing 20 health
    When Remedy heals for 120
    Then health reaches but never exceeds maximum health
    And the healing event reports amount 120 and effectiveAmount 20
    And healing at full health preserves the target reference

  Scenario: C4 Dead units neither act nor receive abilities
    Given a unit with health at or below zero
    When it submits target, move and cast inputs or another player tries to heal it
    Then its state remains unchanged and the cast is rejected as dead
    And the other player's cast is rejected as invalid_target
    When damage kills a living target
    Then one death event follows damage and subsequent actions cannot target it

  Scenario: C5 Flight uses facing or the last movement of the tick
    Given an Eagle facing north
    When Flight is used without movement or with a zero move
    Then the Eagle travels 8 meters north and keeps its facing
    When the last move of the same tick points east
    Then normal movement happens first and Flight adds 8 meters east
    And only the first cast input is processed

  Scenario: C6 Flight stops the player center at the wall
    Given an Eagle near the circular arena wall with a smaller safe radius
    When Flight would cross the wall
    Then its center stops at radius 20 meters using the normal movement clamp

  Scenario: C7 Flight cancels the active Arrow before displacement
    Given an Eagle currently casting Obsidian Arrow
    When Flight is used before Arrow completes
    Then castCancelled with reason flight precedes Flight resolution
    And Arrow deals no damage and consumes no mana or cooldown
    And Flight starts its 240 tick cooldown without starting a GCD

  Scenario: Direct class effects resolve in tick order
    When Claw, Roar, Remedy, Great Remedy, Offering, Arrow or Quick Shot resolve
    Then their configured direct effect applies immediately to living valid targets
    And area targets are evaluated by body-adjusted distance in id order
    And every damage and healing event carries sourceId and abilityId
    And timers and completed casts resolve before target, last move and first cast inputs
    And earlier healing is preserved when a later player's timers advance
    And Copal, Shield, threat, auto attacks and enemy AI remain outside this task

  Scenario: Combat preserves deterministic immutable state
    Given frozen encounter state and inputs
    When a combat tick resolves
    Then the originals remain unchanged and unchanged entities retain their references
    And replaying the same seed and inputs yields identical state and events
