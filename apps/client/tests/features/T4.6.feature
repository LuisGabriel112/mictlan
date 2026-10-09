Feature: T4.6 Boss damage animation
  Scenario: A normal hit fades with the injected clock
    Given a damage event targeting an entity at 1000 milliseconds
    When the injected time advances by 0, 100 and 200 milliseconds
    Then its white flash intensity is 1, 0.5 and 0
    And its scale returns linearly from 1.06 to 1

  Scenario: A critical hit is stronger and lasts longer
    Given a critical damage event targeting an entity
    When its flash is sampled
    Then the flash is yellow and starts at scale 1.10
    And it fades linearly over 280 milliseconds

  Scenario: Repeated hits replace the previous pulse
    Given an entity already has an active flash
    When another damage event targets it
    Then its intensity restarts at 1 without accumulating
    And the latest hit determines its color and duration
    And other entities retain their independent timing

  Scenario: No damage means no pulse
    Given an entity without recorded damage
    When its flash is sampled or a non-damage event arrives
    Then its intensity is 0 and its scale is 1

  Scenario: Only the boss flashes in the arena
    Given damage events arrive through the room events subscription
    When the arena draws the boss, players and xolos
    Then only the boss receives the flash overlay at its interpolated position
    And the overlay is drawn before selection marks and the health bar
    And the HUD camera ignores the world graphics

  Scenario: A new attempt starts without stale flashes
    Given an active boss flash
    When the room returns to the lobby and starts another attempt
    Then the previous flash is absent

  Scenario: Three attackers leave gaps between flashes
    Given normal hits arrive at 0, 100 and 150 milliseconds
    When the injected clock reaches 350 milliseconds
    Then the boss flash is fully gone
    And Venegas verifies in the browser that hits remain distinct during real combat
