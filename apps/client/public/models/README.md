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

Copia en `scenery/` (dentro de esta carpeta) con estos nombres. Elige del pack la pieza que más se parezca; si un pack no tiene alguna, déjala fuera (el cliente usa lo procedural).

| Archivo | Pack sugerido | Pieza |
|---|---|---|
| `scenery/pillar.glb` | KayKit Dungeon Remastered | pilar de piedra (sustituye a los 12 cilindros) |
| `scenery/brazier.glb` | KayKit Dungeon Remastered | brasero o antorcha de pie (va sobre el pilar) |
| `scenery/rock_a.glb`, `scenery/rock_b.glb` | Quaternius Ultimate Nature | rocas medianas |
| `scenery/plant_a.glb`, `scenery/plant_b.glb` | Quaternius Ultimate Nature | helechos o arbustos de jungla |
| `scenery/tree.glb` | Quaternius Ultimate Nature | árbol (solo en el lado lejano a la cámara) |
| `scenery/skulls.glb` | KayKit Dungeon Remastered o Skeletons | cráneo o montón de huesos |
| `scenery/candles.glb` | KayKit Dungeon Remastered | velas (ofrenda de Día de Muertos) |

Licencias: `LICENSE-kaykit-dungeon.txt` y `LICENSE-quaternius-nature.txt` en esta carpeta (no en `scenery/`).

Fuentes:
- KayKit Dungeon Remastered: https://kaylousberg.itch.io/kaykit-dungeon-remastered
- Quaternius Ultimate Nature: https://quaternius.com/packs/ultimatenature.html

Si el pack viene en FBX/OBJ y no en glTF, conviértelo a `.glb` (como el xolo) antes de copiarlo.
