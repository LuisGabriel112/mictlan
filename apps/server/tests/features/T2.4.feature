Feature: T2.4 Encounter ending and restart
  Scenario Outline: An encounter returns to a clean lobby after five seconds
    Given connected players have selected classes and started combat
    When core reports "<outcome>"
    Then every client observes "<outcome>" and combat stops advancing
    And the room remains locked for 100 ticks of 50 milliseconds
    When the room clock reaches five seconds after the outcome
    Then the session is discarded and the room is unlocked in lobby
    And entities and zones are empty and combat fields are zero
    And connected players keep their classes with ready false
    And another ready can start a fresh encounter

    Examples:
      | outcome |
      | victory |
      | defeat  |

  Scenario: A player disconnects during combat
    Given multiple players are fighting
    When one player disconnects
    Then that player leaves the lobby roster
    And before the next step their health becomes zero without cast or auras
    And the remaining clients receive one death attributed to disconnect
    And combat continues while another player lives

  Scenario: Removing the last unready player does not start combat
    Given a valid ready party and one unready player are in the lobby
    When the unready player leaves
    Then the party remains in the lobby until another ready message

  Scenario: A lobby departure releases its role
    Given a ready jaguar and another player are in the lobby
    When the jaguar leaves
    Then the other player can ready as jaguar

  Scenario: An empty room releases its code
    Given a room with one connected client
    When the last client leaves in lobby, combat or the result screen
    Then Colyseus disposes the room and clears its timers
    And a newly created room can reuse the released code

  Scenario: Low boss health is only injected by the server in tests
    Given a client requests low boss health in its creation options
    When combat starts without server test options
    Then the boss has the normal health defined in core
