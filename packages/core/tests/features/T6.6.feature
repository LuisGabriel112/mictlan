Feature: Arena cover
  The four fixed circular obstacles provide cover without changing enemy movement.

  Scenario: Players cannot enter an obstacle
    Given an obstacle with radius 1.2 meters and a player with radius 0.5 meters
    When the player moves into the obstacle
    Then the player's center remains at least 1.7 meters from its center

  Scenario: Players slide along an obstacle
    Given a player approaching an obstacle diagonally
    When the movement intersects its collision circle
    Then the player continues along the unobstructed tangent

  Scenario Outline: Dash abilities stop at the first obstacle
    Given a player uses <ability> toward an obstacle
    When the displacement crosses the obstacle
    Then the player stops at its collision boundary

    Examples:
      | ability  |
      | Esquiva  |
      | Vuelo    |

  Scenario: Cover blocks the boss cone
    Given a player is inside the boss cone behind an obstacle
    When the cone resolves
    Then that player receives no cone damage

  Scenario: An obstacle does not block a player on its boss-facing edge
    Given a player touches an obstacle on the side facing the boss
    When the cone resolves
    Then that player receives cone damage

  Scenario: The boss ignores obstacles
    Given the boss is moved through an obstacle
    When boss movement resolves
    Then the boss position is unchanged by obstacle collision
