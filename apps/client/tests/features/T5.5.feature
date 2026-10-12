Feature: CC0 scenery outside the combat arena
  Scenario: Format-aware cached loading
    Given KayKit glTF and Quaternius FBX pieces of arbitrary source dimensions
    When two attempts request the same pieces
    Then each file is loaded and measured once with its format loader
    And a failed file produces one warning and preserves its procedural fallback

  Scenario: Deterministic decoration and camera clearance
    Given the fixed isometric camera and a seed
    When scenery placements are generated twice
    Then positions, rotations and heights match
    And decoration footprints stay between wall radius plus 2 and plus 9 metres
    And pieces above 1 metre only occupy the far half
    And rocks and plants never exceed 1 metre

  Scenario: Pillars and torches
    Given procedural pillars and their existing coloured lights
    When pillar and torch models finish loading independently
    Then successful models replace only their own fallback
    And pillars measure the configured height with torches on top
    And light positions, colours, count and flicker remain unchanged

  Scenario: Static instancing and shadows
    Given loaded scenery templates with multiple meshes and materials
    When the arena is built
    Then copies share one instance batch per piece and material
    And all pieces receive shadows but only pillars and trees cast shadows
    And decorations add no lights and require no frame updates

  Scenario: Leaving an attempt while loading
    Given an arena with completed and pending scenery loads
    When the arena is disposed
    Then its instances, geometries and owned materials are released
    And cached templates and textures remain reusable
    And pending loads cannot add objects to the disposed arena
