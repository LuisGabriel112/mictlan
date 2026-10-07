Feature: T2.2 combat loop and inputs

  Scenario: The fixed clock turns elapsed time into whole ticks
    Given a combat clock with no accumulated time
    When 1000 ms elapse in uneven slices
    Then exactly 20 steps of 50 ms are requested
    And the remainder below 50 ms is kept for the next call

  Scenario: The clock does not spiral after a stall
    Given a combat clock with no accumulated time
    When a single slice of 2000 ms elapses
    Then at most 5 steps are requested
    And the backlog beyond those steps is discarded

  Scenario Outline: Movement payloads are validated and normalized
    When a player sends move <payload>
    Then the queued move is <result>
    Examples:
      | payload                 | result            |
      | dx 3, dy 4              | dx 0.6, dy 0.8    |
      | dx 0, dy 0              | dx 0, dy 0        |
      | dx NaN or Infinity      | ignored           |
      | dx as string            | ignored           |
      | null, array or scalar   | ignored           |

  Scenario Outline: Target and cast payloads are validated
    When a player sends <type> <payload>
    Then the input is <result>
    Examples:
      | type   | payload                  | result  |
      | target | entityId boss            | queued  |
      | target | entityId null            | queued  |
      | target | entityId 7               | ignored |
      | cast   | abilityId obsidianArrow  | queued  |
      | cast   | abilityId fireball       | ignored |

  Scenario: A flooding client cannot grow the queue without bound
    Given a player who already queued 16 inputs this tick
    When the player sends another valid input
    Then the input is discarded

  Scenario: Queued inputs are consumed by the next step only
    Given inputs queued by two players
    When the session advances one tick
    Then core step receives all queued inputs once
    And the following tick receives none

  Scenario: A move of length 3 moves the same as length 1
    Given two identical encounters
    When one receives move (3, 0) and the other move (1, 0)
    Then both players end at the same position

  Scenario: The loop stops when the encounter ends
    Given a session whose next step returns victory
    When time advances
    Then the session reports it is finished
    And no further step is called

  Scenario: An eagle damages the boss through the real server
    Given a dev room with one eagle and critChance 0
    When the eagle targets the boss and casts Obsidian Arrow
    Then after 2 s the boss has lost exactly 140 health

  Scenario: Malformed messages do not crash the room
    Given a dev room in combat
    When the client sends malformed move, target and cast messages
    Then the room keeps advancing ticks
    And the player position stays finite
