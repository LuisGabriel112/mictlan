Feature: T2.4 Pure player removal on disconnect
  Scenario: Remove a living player
    Given an immutable encounter with a living player casting and carrying auras
    When removePlayer receives that player's id
    Then it returns a new state with that player's health zero, no cast and no auras
    And it emits exactly one death at the current tick
    And the sourceId and entityId identify that player with abilityId disconnect
    And the input and all other entities remain unchanged

  Scenario Outline: Removal is idempotent and only affects players
    Given a player id that is "<kind>"
    When removePlayer receives the id repeatedly
    Then it preserves the state and emits no events

    Examples:
      | kind        |
      | already dead|
      | missing     |
      | an enemy    |

  Scenario: The next step declares defeat when the last player was removed
    Given all players have been removed by removePlayer
    When the next core step runs
    Then the encounter ends in defeat exactly once
