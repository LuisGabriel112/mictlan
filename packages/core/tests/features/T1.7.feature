Feature: T1.7 Enemy AI, Jaguar auto-attacks and boss casts
  Tick order: existing aura/threat timers, completed player casts, player inputs,
  Jaguar auto-attacks, pull and encounter clocks, threat target selection,
  then living enemies in ascending id order: boss casts and ability timers,
  pursuit and auto-attacks. A completed boss cast resolves before queued starts.
  The pull tick counts as elapsed tick 1 and consumes the first phase timer tick.
  New casts and restarted attack/ability timers retain their full duration.
  Attack timers saturate at zero, including while casting or outside range.
  Enemies without a living player target do not pursue or auto-attack.
  Simultaneous abilities follow phase table order; existing queue entries go first.
  Instant boss abilities emit castStarted (duration 0) and abilityResolved;
  timed abilities also emit castFinished immediately before abilityResolved.

  Scenario Outline: The boss remains inactive until a living player pulls
    Given an inactive boss with no positive player threat
    When the player <trigger>
    Then the boss becomes active on that tick
    And encounter and phase clocks equal 1
    And phase 1 timers equal their first values minus 1
    Examples:
      | trigger                                      |
      | damages the boss                             |
      | generates effective healing threat           |
      | reaches exactly 10 meters from the boss body |

  Scenario: Waiting does not advance encounter or boss timers
    Given all living players are farther than 10 meters from the boss body
    When ticks pass without positive player threat
    Then the boss does not move, attack or cast
    And encounter, phase and boss timers do not advance

  Scenario: Pursuit and attack use the target body radius
    Given an active boss targeting a living player
    When the target is farther than 4 meters from its body
    Then the boss advances at 5 meters per second, stopping at melee range
    And its center remains within the arena wall
    When the ready attack reaches 4 meters or less
    Then it deals 60 base damage and restarts a 40 tick timer
    And Jaguar armor reduces that damage to 42
    And enemies never critically hit

  Scenario: Generic AI can control an existing xolo
    Given an existing xolo with a living player target
    When the xolo reaches melee range
    Then it uses the xolo damage and interval from the data definitions

  Scenario: Jaguar auto-attacks participate in pull and threat selection
    Given a Jaguar targeting a living enemy at 4 meters or less from its body
    When its attack timer reaches zero
    Then it deals 20 damage with abilityId autoAttack and generates 60 threat
    And its next attack is available 40 ticks later
    And it can critically hit using the seeded RNG
    And other player classes do not auto-attack

  Scenario: Flayed Strike locks its target and ignores resolution range
    Given the boss starts a non-interruptible 50 tick Flayed Strike
    When that target moves away and the boss selects a different target
    Then the boss stays still and does not auto-attack while casting
    And the original living target receives 400 base damage at completion
    And Jaguar armor and active Shield reduce the hit to 140
    But a dead or missing target receives no damage

  Scenario: Due casts queue exactly once and reset from actual start
    Given the boss is casting Flayed Strike
    When Lament becomes due
    Then Lament remains queued exactly once with its timer at zero
    When Flayed Strike finishes
    Then Lament starts in that same tick with a full 60 tick cast
    And its next use is scheduled 500 ticks from that start

  Scenario: Instant placeholders can run during a cast
    Given the boss is casting Flayed Strike
    When Wind or Call of the Xolos becomes due in its phase
    Then it emits start and resolution events without replacing the active cast
    And no wind, raid damage or summons are implemented

  Scenario: Pure deterministic stepping preserves unchanged entities
    Given a deeply frozen encounter and inputs
    When the same tick is replayed
    Then states and events are identical and the input remains unchanged
    And entities without changes retain their original references
