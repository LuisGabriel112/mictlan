Feature: T3.3 unit frames and cast bars

  Scenario: The own frame shows health and resource
    Given a healer with 600 of 700 health and 812.6 of 1000 mana
    Then the own frame shows Tícitl, health 600/700 and mana 812/1000
    And a jaguar frame has no resource bar

  Scenario: Overkill never shows negative health
    Given a player at -20 health
    Then the frame shows 0 health and is marked dead

  Scenario: The target frame mirrors the selected unit and its cast
    Given the player targets the boss casting Lament with 20 of 60 ticks left
    Then the target frame names the boss
    And its cast bar reads Lamento de los muertos, two thirds done, 1.0 s left, interruptible

  Scenario: Group frames list the party with self first and are clickable
    Given players p3 (self), p1 and p2 and the boss
    Then the group frames are p3, p1 and p2
    When the player clicks inside the second group frame
    Then p1 is selected
    When the player clicks outside every group frame
    Then nothing is selected by the frames

  Scenario: Own and boss cast bars are shown separately
    Given the player casts Obsidian Arrow and the boss casts Flayed Strike
    Then the own cast bar shows Flecha de obsidiana, not interruptible
    And the boss cast bar shows Golpe del Descarnado, not interruptible
    And without casts both bars are hidden

  Scenario Outline: Cast bar borders distinguish interruptible casts
    When a cast bar is <interruptible>
    Then its border color is <color>
    Examples:
      | interruptible | color     |
      | true          | turquoise |
      | false         | gray      |
