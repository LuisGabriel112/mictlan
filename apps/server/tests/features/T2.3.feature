Feature: T2.3 synchronized encounter view and combat events

  Scenario: Combat starts with a complete view of core
    Given a ready party in a lobby
    When combat starts before its first step
    Then all entities, phase, safe radius, tick, elapsed ticks and status match core
    And absent class and target use an empty string, absent mana uses zero
    And absent cast uses an optional undefined reference

  Scenario: C1 a client observes entity changes
    Given connected eagle and healer clients in combat
    When the eagle moves and casts Obsidian Arrow at the boss
    And the boss damages the eagle and the healer applies Copal to it
    Then the eagle client sees its position and cast remaining ticks change
    And sees its own health change and gains the Copal aura
    And sees its cast disappear when it finishes

  Scenario: C2 damage events reach every client
    Given two clients connected to a combat room
    When an eagle damages the boss
    Then both clients receive an events array containing damage with sourceId and abilityId

  Scenario: C3 zones and summoned entities follow core membership
    Given a synchronized encounter
    When core adds a wind zone and a xolo
    Then both appear in the view
    When the zone expires and core retains a dead xolo
    Then the zone disappears and the xolo remains with health at or below zero
    When core removes the xolo
    Then the xolo disappears from the view

  Scenario: C4 unchanged values never cause assignments
    Given a synchronized entity with a cast and auras
    When a new core snapshot has equal visible values
    Then no entity, cast or aura field is assigned
    And existing map entries and instances are retained

  Scenario: Only completed steps synchronize and nonempty batches broadcast
    Given a running combat room with an injected step
    When an advance consumes less than one tick
    Then synchronization and broadcast do not run
    When an advance runs multiple steps producing events
    Then the final state is synchronized once
    And all events are broadcast once in step order as an events array
    When an advance has no events
    Then no events message is broadcast

  Scenario: Auras and casts update incrementally and disappear
    Given an entity with a cast and an aura
    When core changes the cast, aura source and remaining ticks
    Then existing view instances contain the changed fields
    When core clears the cast and removes the aura
    Then both disappear from the view without modifying core
