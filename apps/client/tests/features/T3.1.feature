Feature: T3.1 base scene

  Scenario Outline: Launch parameters choose the connection mode
    Given the page URL query is <query>
    When the client reads its launch parameters
    Then dev mode is <dev>, the class is <class> and the server is <server>
    Examples:
      | query                                  | dev   | class  | server               |
      | (empty)                                | false | eagle  | ws://localhost:2567  |
      | ?dev=1                                 | true  | eagle  | ws://localhost:2567  |
      | ?dev=1&class=jaguar                    | true  | jaguar | ws://localhost:2567  |
      | ?dev=1&class=wizard                    | true  | eagle  | ws://localhost:2567  |
      | ?server=ws://10.0.0.5:2567&code=ABCD   | false | eagle  | ws://10.0.0.5:2567   |

  Scenario: Dev mode joins any open raid and readies alone
    Given dev mode with class healer
    When the client connects
    Then it joins or creates a raid room
    And it sends ready with classId healer

  Scenario: World meters map to screen pixels with north up
    Given 1 m equals 32 px
    When the world point (2, 3) is projected
    Then the screen point is (64, -96)
    And projecting back returns (2, 3)

  Scenario Outline: WASD becomes a unit move vector
    When the held keys are <keys>
    Then the move vector is <vector>
    Examples:
      | keys       | vector              |
      | none       | (0, 0)              |
      | W          | (0, 1)              |
      | S and D    | (0.707, -0.707)     |
      | A and D    | (0, 0)              |

  Scenario: The client only sends a move when the held direction changes
    Given the last sent move was (0, 1)
    When the held direction is still (0, 1)
    Then nothing is sent
    When the keys are released
    Then a move (0, 0) is sent

  Scenario: The server keeps a held move until the client changes it
    Given a player in combat who sent move (1, 0) once
    When three ticks run
    Then the player moved three ticks to the east
    When the player sends move (0, 0)
    Then the player stops moving

  Scenario: Remote positions are interpolated about 100 ms in the past
    Given snapshots at 0 ms with x = 0 and at 100 ms with x = 10
    When the client renders at 150 ms
    Then the entity is drawn at x = 5
    And before the first snapshot it is drawn at the first position
    And after the last snapshot it stays at the last position

  Scenario Outline: Entities use the SPEC placeholder colors
    When an entity of kind <kind> is drawn
    Then its color is <color>
    Examples:
      | kind           | color  |
      | jaguar player  | orange |
      | healer player  | green  |
      | eagle player   | blue   |
      | boss           | purple |
      | xolo           | gray   |
