Feature: T4.1 Jugar con amigos desde un solo servidor
  Scenario: Build and start from a clean checkout
    Given dependencies were installed with npm ci
    When npm run start runs from the repository root
    Then Vite builds the client before one game server process starts
    And HTTP and Colyseus share PORT or port 2567 by default
    And MICTLAN_DEV_MIN_PLAYERS cannot lower the production minimum

  Scenario: Serve the client without swallowing matchmaking
    Given a compiled client directory and a running production server
    When GET requests fetch the root, a static asset and an extensionless route
    Then the root and route return index.html and the asset returns its own contents and MIME type
    And missing files return 404 instead of HTML
    And HEAD returns headers without a body
    And invalid paths cannot read outside the client directory
    And unsupported HTTP methods return 405
    And file system failures return 500 without exposing paths
    When three Colyseus clients create and join a room on the same port
    Then one or two ready players remain in the lobby
    And a Jaguar, a Ticitl and an Eagle can start and finish an attempt

  @manual
  Scenario: Venegas validates three separate networks
    Given npm run start and cloudflared tunnel --url http://localhost:2567 are running
    When three people on different networks open the public HTTPS URL and join the same room
    Then they complete an attempt and return to the lobby after five seconds
