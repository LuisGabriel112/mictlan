# Modelos 3D (T5.4)

Copia aquí los archivos de los packs CC0 con estos nombres exactos. Los carga `apps/client/src/world-3d/models.ts`; si falta un archivo, el cliente usa las primitivas actuales.

| Archivo | Pack | Modelo original |
|---|---|---|
| `jaguar.glb` | KayKit Adventurers | Barbarian |
| `eagle.glb` | KayKit Adventurers | Rogue (o Ranger) |
| `healer.glb` | KayKit Adventurers | Mage |
| `boss.glb` | KayKit Skeletons | Skeleton_Mage (a 3 m por UNIT_HEIGHTS) |
| `xolo.glb` | Quaternius Ultimate Animated Animals | Shiba Inu o Husky |

Animaciones: si el pack las trae en archivos separados (KayKit: `Rig_Medium_General.glb`, `Rig_Medium_MovementBasic.glb`, etc.), copia esos archivos con su nombre original en esta carpeta.

Licencias: copia el `License.txt` de cada pack como `LICENSE-kaykit-adventurers.txt`, `LICENSE-kaykit-skeletons.txt` y `LICENSE-quaternius-animals.txt`. Son CC0 (dominio público); igual se registran por SPEC §9.

Fuentes:
- KayKit Adventurers: https://kaylousberg.itch.io/kaykit-adventurers
- KayKit Skeletons: https://kaylousberg.itch.io/kaykit-skeletons
- Quaternius Ultimate Animated Animals: https://quaternius.com/packs/ultimateanimatedanimals.html

## Escenario (T5.5)

Piezas reales copiadas en `scenery/` (formatos tal como vienen en los packs; no se renombraron para no romper las referencias internas de los .gltf):

| Uso | Archivo | Pack | Formato |
|---|---|---|---|
| pilar | `scenery/pillar.gltf` (+ `pillar.bin`) | KayKit Dungeon | glTF |
| brasero | `scenery/torch_lit.gltf` (+ `torch_lit.bin`) | KayKit Dungeon | glTF |
| velas | `scenery/candle_triple.gltf` (+ `.bin`) | KayKit Dungeon | glTF |
| escombros | `scenery/rubble_large.gltf` (+ `.bin`) | KayKit Dungeon | glTF |
| textura compartida de KayKit | `scenery/dungeon_texture.png` | KayKit Dungeon | PNG (la usan los 4 .gltf) |
| rocas | `scenery/Rock_1.fbx`, `scenery/Rock_2.fbx` | Quaternius Ultimate Nature | FBX |
| plantas | `scenery/Plant_1.fbx`, `scenery/Bush_1.fbx` | Quaternius Ultimate Nature | FBX |
| árbol (lado lejano) | `scenery/PalmTree_1.fbx` | Quaternius Ultimate Nature | FBX |

No hay cráneos en el pack gratuito de KayKit Dungeon; `skulls` queda fuera.

Licencias (CC0): `LICENSE-kaykit-dungeon.txt` y `LICENSE-quaternius-nature.txt` en esta carpeta.

Fuentes:
- KayKit Dungeon Pack 1.1 FREE: https://kaylousberg.itch.io/kaykit-dungeon-remastered
- Quaternius Ultimate Nature: https://quaternius.com/packs/ultimatenature.html
