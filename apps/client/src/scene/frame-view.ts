import type * as Phaser from 'phaser';
import { castBarBorder, type CastBarView, type Rect, type UnitFrameView } from '../frames';

const COLORS = { panel: 0x1d1726, health: 0x4cd964, healthLow: 0xe5484d, mana: 0x3b82f6, track: 0x2b2435,
  cast: 0xd9a441, selfBorder: 0xffffff, border: 0x3a3147 } as const;
const TEXT_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff' } as const;
const LOW_HEALTH_RATIO = 0.35;

type Track = (object: Phaser.GameObjects.GameObject) => void;

export function drawBar(graphics: Phaser.GameObjects.Graphics, rect: Rect, ratio: number, color: number): void {
  graphics.fillStyle(COLORS.track, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  graphics.fillStyle(color, 1).fillRect(rect.x, rect.y, rect.width * Math.min(1, Math.max(0, ratio)), rect.height);
}

export class CastBarWidget {
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, track: Track) {
    this.label = scene.add.text(0, 0, '', TEXT_STYLE).setOrigin(0.5, 0.5);
    track(this.label);
  }

  draw(graphics: Phaser.GameObjects.Graphics, cast: CastBarView | undefined, rect: Rect): void {
    this.label.setVisible(cast !== undefined);
    if (!cast) return;
    drawBar(graphics, rect, cast.progress, COLORS.cast);
    graphics.lineStyle(cast.interruptible ? 3 : 1, castBarBorder(cast), 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.label.setText(`${cast.abilityName} · ${cast.remainingSeconds.toFixed(1)} s`);
    this.label.setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }
}

export class FrameWidget {
  private readonly name: Phaser.GameObjects.Text;
  private readonly health: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, track: Track) {
    this.name = scene.add.text(0, 0, '', TEXT_STYLE);
    this.health = scene.add.text(0, 0, '', TEXT_STYLE).setOrigin(1, 0);
    track(this.name);
    track(this.health);
  }

  draw(graphics: Phaser.GameObjects.Graphics, frame: UnitFrameView | undefined, rect: Rect): void {
    this.name.setVisible(frame !== undefined);
    this.health.setVisible(frame !== undefined);
    if (!frame) return;
    graphics.fillStyle(COLORS.panel, 0.9).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(frame.isSelf ? 2 : 1, frame.isSelf ? COLORS.selfBorder : COLORS.border, 1)
      .strokeRect(rect.x, rect.y, rect.width, rect.height);
    graphics.fillStyle(frame.color, frame.dead ? 0.3 : 1).fillRect(rect.x, rect.y, 4, rect.height);
    this.drawBars(graphics, frame, rect);
    this.name.setText(frame.name).setPosition(rect.x + 10, rect.y + 3).setAlpha(frame.dead ? 0.5 : 1);
    this.health.setText(frame.dead ? 'Muerto' : `${frame.health.value}/${frame.health.max}`)
      .setPosition(rect.x + rect.width - 6, rect.y + 3);
  }

  private drawBars(graphics: Phaser.GameObjects.Graphics, frame: UnitFrameView, rect: Rect): void {
    const inner = { x: rect.x + 10, width: rect.width - 16 };
    const healthColor = frame.health.ratio <= LOW_HEALTH_RATIO ? COLORS.healthLow : COLORS.health;
    const healthBottomGap = frame.resource ? 14 : 6;
    drawBar(graphics, { ...inner, y: rect.y + rect.height - healthBottomGap - 8, height: 8 }, frame.health.ratio, healthColor);
    if (frame.resource) drawBar(graphics, { ...inner, y: rect.y + rect.height - 11, height: 5 }, frame.resource.ratio, COLORS.mana);
  }
}
