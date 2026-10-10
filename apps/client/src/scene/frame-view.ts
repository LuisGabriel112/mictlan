import { castBarBorder, type CastBarView, type Rect, type UnitFrameView } from '../frames';
import { HudNode, hexColor } from './hud-node';

const COLORS = { health: 0x4cd964, healthLow: 0xe5484d, selfBorder: 0xffffff, border: 0x3a3147 } as const;
const LOW_HEALTH_RATIO = 0.35;

export class CastBarWidget {
  private readonly root: HudNode;
  private readonly fill: HudNode;
  private readonly label: HudNode;

  constructor(document: Document, parent: HTMLElement) {
    this.root = new HudNode(document, parent, 'hud-cast');
    this.fill = new HudNode(document, this.root.element, 'hud-cast-fill');
    this.label = new HudNode(document, this.root.element, 'hud-cast-label', 'span');
  }

  draw(cast: CastBarView | undefined, rect: Rect): void {
    this.root.visible(cast !== undefined);
    if (!cast) return;
    this.root.place(rect).style('borderColor', hexColor(castBarBorder(cast))).style('borderWidth', cast.interruptible ? '3px' : '1px');
    this.fill.fill(cast.progress);
    this.label.text(`${cast.abilityName} · ${cast.remainingSeconds.toFixed(1)} s`);
  }
}

export class FrameWidget {
  private readonly root: HudNode;
  private readonly stripe: HudNode;
  private readonly name: HudNode;
  private readonly health: HudNode;
  private readonly healthFill: HudNode;
  private readonly manaTrack: HudNode;
  private readonly manaFill: HudNode;

  constructor(document: Document, parent: HTMLElement) {
    this.root = new HudNode(document, parent, 'hud-frame');
    this.stripe = new HudNode(document, this.root.element, 'hud-frame-stripe');
    this.name = new HudNode(document, this.root.element, 'hud-frame-name', 'span');
    this.health = new HudNode(document, this.root.element, 'hud-frame-health', 'span');
    const healthTrack = new HudNode(document, this.root.element, 'hud-health-track');
    this.healthFill = new HudNode(document, healthTrack.element, 'hud-health-fill');
    this.manaTrack = new HudNode(document, this.root.element, 'hud-mana-track');
    this.manaFill = new HudNode(document, this.manaTrack.element, 'hud-mana-fill');
  }

  draw(frame: UnitFrameView | undefined, rect: Rect): void {
    this.root.visible(frame !== undefined);
    if (!frame) return;
    this.root.place(rect).style('borderColor', hexColor(frame.isSelf ? COLORS.selfBorder : COLORS.border))
      .style('opacity', frame.dead ? '0.5' : '1');
    this.stripe.style('backgroundColor', hexColor(frame.color));
    this.name.text(frame.name);
    this.health.text(frame.dead ? 'Muerto' : `${frame.health.value}/${frame.health.max}`);
    this.healthFill.fill(frame.health.ratio)
      .style('backgroundColor', hexColor(frame.health.ratio <= LOW_HEALTH_RATIO ? COLORS.healthLow : COLORS.health));
    this.manaTrack.visible(frame.resource !== undefined);
    if (frame.resource) this.manaFill.fill(frame.resource.ratio);
  }
}
