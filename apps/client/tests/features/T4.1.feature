Feature: T4.1 Server origin for friends
  Scenario Outline: Resolve the default WebSocket URL
    Given a page with protocol <protocol>, host <host> and hostname <hostname>
    When launch parameters are parsed with production set to <production>
    Then the server URL is <endpoint>
    Examples:
      | protocol | host                 | hostname        | production | endpoint                   |
      | https:   | raid.trycloudflare.com | raid.trycloudflare.com | true | wss://raid.trycloudflare.com |
      | http:    | localhost:2567       | localhost       | true       | ws://localhost:2567        |
      | https:   | raid.example:8443    | raid.example    | true       | wss://raid.example:8443     |
      | http:    | 192.168.1.5:5173     | 192.168.1.5     | false      | ws://192.168.1.5:2567      |

  Scenario: Explicit server takes priority in either build
    Given a nonempty server query parameter
    When launch parameters are parsed
    Then that exact server URL overrides the default

  Scenario: Vite is reachable on the local network
    Given the client development script
    When Venegas starts it
    Then Vite runs with --host
