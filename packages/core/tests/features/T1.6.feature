Feature: T1.6 Auras and living-player Taunt maximum
  Background:
    Given a deterministic encounter with critChance 0
    And aura definitions come from the existing class ability data

  Scenario: C1 Copal heals exactly ten times over ten seconds
    Given a Jaguar missing at least 200 health
    When the healer applies Copal through the ability
    Then no healing occurs on application or during the next 19 ticks
    And Copal heals 20 every 20 ticks through tick 200 after application
    And the ten healing events total 200 effective healing
    And each event identifies the healer and ability copal
    And the last healing occurs before the aura expires

  Scenario: C2 Refresh resets duration and interval without stacking
    Given Copal has been active for 30 ticks and has healed once
    When the healer applies Copal again
    Then exactly one Copal aura remains with 200 duration ticks and 20 ticks until healing
    And the old next healing time does not produce a pulse
    And the refreshed aura produces ten pulses starting 20 ticks after refresh
    And other auras retain their references

  Scenario: C3 Shield expires exactly six seconds after application
    When the Jaguar uses Obsidian Shield
    Then it has 120 duration ticks without consuming a critical roll
    And it still mitigates damage after 119 subsequent ticks
    And it no longer mitigates damage on the 120th subsequent tick

  Scenario: C4 Flayed Strike uses the actual Shield modifier
    Given the Jaguar has used Obsidian Shield through the ability
    When damage is calculated for the configured 400 damage Flayed Strike
    Then its armor and active aura modifier reduce the damage to 140
    And combat effect resolution also passes active modifiers to damage calculation

  Scenario: C5 Taunt ignores dead-player threat entries
    Given a dead player has 1000 threat and a living player has 100 threat
    When the Jaguar uses Taunt
    Then its threat becomes 110 and the dead player's entry is unchanged
    And absent entities and enemies cannot contribute to the maximum

  Scenario: Aura timing precedes casts and inputs
    When a tick starts
    Then existing auras advance with the other timers before completed casts and inputs
    And due Copal healing occurs before a completed direct healing cast
    And a pulse due on a refresh tick resolves before the refresh
    And newly applied auras retain their full duration and initial delay

  Scenario: Copal critical healing and effective threat
    Given critChance is 1 for this critical-specific scenario
    When a Copal pulse is due
    Then the seeded player critical roll heals 30
    And only effective healing generates threat split among living enemies
    And full overhealing generates no additional threat

  Scenario: Death clears auras without resurrection
    Given a unit carries periodic healing and a damage modifier
    When combat damage kills the unit
    Then its auras are removed in the same resolution
    And a dead unit with auras is cleared before periodic effects can heal it

  Scenario: Aura processing is immutable and deterministic
    Given frozen encounter state with auras on multiple units
    When the encounter advances with the same seed and inputs
    Then healing events and RNG state are independent of entity insertion order
    And the original state remains unchanged
    And entities with no changes retain their references
