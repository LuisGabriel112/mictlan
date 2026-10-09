import type * as Phaser from 'phaser';
import { floatingTextMotion, floatingTextVisible, type FloatingTextQueue } from '../floating-text';
import type { Rect } from '../frames';
import { worldToScreen } from '../world-view';

export class FloatingTextView {
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene, private readonly hudCamera: Phaser.Cameras.Scene2D.Camera) {}

  draw(queue: FloatingTextQueue, panels: readonly Rect[]): void {
    const active = new Set(queue.texts.map(({ id }) => id));
    for (const [id, label] of this.labels) {
      if (active.has(id)) continue;
      label.destroy();
      this.labels.delete(id);
    }
    const camera = this.scene.cameras.main;
    const { width, height } = this.scene.scale;
    for (const text of queue.texts) {
      let label = this.labels.get(text.id);
      if (!label) {
        label = this.scene.add.text(0, 0, text.text, {
          fontFamily: 'system-ui, sans-serif', fontSize: text.fontSize, color: text.color,
          fontStyle: 'bold', stroke: '#14101c', strokeThickness: 3,
        }).setOrigin(0.5, 1);
        // World objects render before the HUD camera, and never in that camera.
        this.hudCamera.ignore(label);
        this.labels.set(text.id, label);
      }
      const point = worldToScreen(text);
      const motion = floatingTextMotion(text);
      label.setScale(1 / camera.zoom).setAlpha(motion.alpha);
      label.setPosition(point.x + (text.lane - 1) * 22 / camera.zoom,
        point.y + (motion.offsetY - 20 - text.lane * 16) / camera.zoom);
      const bounds = label.getBounds();
      // The arena camera is centered on (0,0), without rotation.
      label.setVisible(floatingTextVisible({
        x: width / 2 + bounds.x * camera.zoom, y: height / 2 + bounds.y * camera.zoom,
        width: bounds.width * camera.zoom, height: bounds.height * camera.zoom,
      }, { x: 0, y: 0, width, height }, panels));
    }
  }
}
