Feature: T3.7 click-to-move (server)

  Scenario: A destination moves the player toward it every tick
    Given a player at (0, -15) in combat
    When the player sends moveTo (0, -10)
    Then each tick the player moves 0.35 m north
    And the player stops within one step of the destination without a new message

  Scenario: A destination outside the wall is pulled onto the wall
    When the player sends moveTo (0, -50)
    Then the player walks south and stops at the wall instead of pushing forever

  Scenario Outline: Invalid destinations are ignored
    When the player sends moveTo <payload>
    Then nothing changes
    Examples:
      | payload            |
      | x NaN              |
      | x Infinity         |
      | missing y          |
      | x as string        |
      | null, array, text  |

  Scenario: Stop cancels the destination and any held move
    Given a player walking toward a destination
    When the player sends stop
    Then the player stops moving on the next tick

  Scenario: Asking for a cast-time ability stops movement so the cast starts
    Given an eagle walking toward a destination with the boss targeted
    When the eagle casts Obsidian Arrow
    Then the destination is cleared and the cast starts instead of being rejected for moving

  Scenario: Instant abilities do not stop movement
    Given an eagle walking toward a destination
    When the eagle casts Flight
    Then the eagle keeps walking toward the destination after the dash

  Scenario: A new destination replaces the old one and a direction move replaces both
    Given a player walking toward a destination
    When the player sends another moveTo
    Then the player walks toward the new destination
    When the player sends a move direction
    Then the destination is forgotten

  Scenario: Dead or disconnected players forget their destination
    Given a player walking toward a destination
    When the player dies or disconnects
    Then no further move input is produced for that player
