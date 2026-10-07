Feature: T2.1 development encounters
  Scenario: Normal encounters still require three to five players
    Given a config without devMode
    When createEncounter receives two players
    Then it rejects the config

  Scenario Outline: Development scaling uses at least the normal minimum
    Given devMode is true with <count> players
    When the encounter is created and xolos are summoned
    Then the boss health is <boss> and xolo health is <xolo>
    And player positions use the actual party size
    Examples:
      | count | boss  | xolo |
      | 1     | 24000 | 300  |
      | 2     | 24000 | 300  |
      | 3     | 24000 | 300  |
      | 4     | 40000 | 450  |
      | 5     | 56000 | 600  |

  Scenario Outline: Development does not permit empty or oversized parties
    Given devMode is true
    When createEncounter receives <count> players
    Then it rejects the config
    Examples:
      | count |
      | 0     |
      | 6     |
