Feature: T2.1 raid room and lobby
  Scenario: A complete party starts by room code
    Given an active raid with a unique four-letter uppercase code
    And three clients joined that code with their session ids
    When they ready as jaguar, healer and eagle
    Then every client sees status combat
    And the server stores one encounter with those session ids

  Scenario Outline: Reject an invalid ready message privately
    Given a lobby with a ready jaguar
    When another client sends <payload>
    Then only that client receives rejected with reason <reason>
    And the rejected client remains unready with an empty class
    Examples:
      | payload               | reason        |
      | classId jaguar        | composition   |
      | missing classId       | invalid_class |
      | unknown classId       | invalid_class |
      | null, array or scalar | invalid_class |

  Scenario: Normal composition and readiness are required
    Given the default minimum of three players and maximum of five
    When a player is unready or a required role is missing
    Then the lobby does not start combat
    And ready players never exceed one jaguar, one healer and three eagles

  Scenario Outline: Development minimum comes only from the server
    Given MICTLAN_DEV_MIN_PLAYERS is <setting>
    When <count> clients ready with <classes>
    Then the room status is <status>
    Examples:
      | setting | count | classes           | status |
      | 1       | 1     | eagle             | combat |
      | 2       | 1     | eagle             | lobby  |
      | 2       | 2     | jaguar, eagle     | combat |
      | invalid | 1     | eagle             | lobby  |
      | 3       | 3     | eagle,eagle,eagle | lobby  |

  Scenario: Codes remain unique despite random collisions
    Given two simultaneous rooms and identical random samples
    When the rooms reserve their codes
    Then both codes match four letters A through Z and differ
    And disposing a room releases its code

  Scenario: Lobby membership follows connections
    Given a lobby with an unready client and a complete ready party
    When the unready client leaves
    Then that client disappears from the lobby and the party starts

  Scenario: Combat starts once
    Given a room in combat
    When an existing client sends ready again
    Then its encounter and class stay unchanged
    And new clients cannot join the combat
