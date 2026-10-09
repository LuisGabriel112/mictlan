Feature: T4.2 boss health balance
  Scenario Outline: Boss health follows SPEC section 6 v0.8
    Given a party of <players> players
    When the encounter is created
    Then the boss starts with <health> current and maximum health

    Examples:
      | players | health |
      | 3       | 7500   |
      | 4       | 12500  |
      | 5       | 17500  |

  Scenario: Existing consumers use configured boss health
    Given an encounter using the configured boss health
    When damage, synchronization, restart or client frames are evaluated
    Then they preserve their behavior with the updated health

  Scenario: Three-player bots meet the balance target
    Given three-player bot parties using seeds 1 through 50
    When all 50 encounters are simulated
    Then all 50 encounters end in victory
    And the mean encounter duration is between 180 and 240 seconds inclusive
