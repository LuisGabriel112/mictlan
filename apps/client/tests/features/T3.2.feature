Feature: T3.2 target selection and action bar

  Scenario Outline: Keys map to game actions and block the browser default
    When the player presses <key>
    Then the action is <action>
    And the browser default is <prevented>
    Examples:
      | key        | action              | prevented |
      | Tab        | cycle enemy target  | yes       |
      | F1         | ally 1              | yes       |
      | F5         | ally 5              | yes       |
      | Shift+3    | ally 3              | yes       |
      | Q          | cast slot 1         | no        |
      | R          | cast slot 4         | no        |
      | 2          | none                | no        |
      | KeyA       | none                | no        |

  Scenario: Tab cycles living enemies from nearest to farthest
    Given living enemies boss at 10 m and xolo-1 at 4 m and a dead xolo-2 at 1 m
    When the player presses Tab with no target
    Then the target is xolo-1
    When the player presses Tab again
    Then the target is boss
    When the player presses Tab again
    Then the target is xolo-1

  Scenario: Ally hotkeys follow party order with self first
    Given players p3 (self), p1 and p2
    Then ally 1 is p3, ally 2 is p1 and ally 3 is p2
    And ally 4 is nobody

  Scenario: Clicking selects the entity under the pointer
    Given the boss at (0, 0) with radius 1.5 and a player at (3, 0)
    When the player clicks at (1, 1)
    Then the target is the boss
    When the player clicks at (10, 10)
    Then the target does not change

  Scenario: The action bar shows why a slot is unavailable
    Given an eagle targeting the boss
    Then slot 1 is ready when the boss is within 30 m
    And slot 1 is out of range when the boss is 40 m away
    And slot 2 shows its remaining cooldown while it recharges
    And GCD slots are blocked while the GCD runs but off-GCD slots are not
    And a healer slot is out of mana when mana is below its cost
    And an enemy ability without an enemy target is marked as no target

  Scenario: The server exposes the cooldowns the bar needs
    Given a player whose Quick Shot is on cooldown and whose GCD is running
    When the encounter is synchronized
    Then the player entity shows gcdRemainingTicks and the quickShot cooldown
    And the cooldown disappears when it reaches zero
