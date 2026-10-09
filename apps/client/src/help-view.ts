import { CLASSES, type ClassId } from '@mictlan/core';
import type { ClientScreen } from './lobby';
import { classPanel } from './help-content';
import { GuideDialog } from './guide-dialog';
import { guideKey, helpSlots } from './help-layout';
import { helpSlot } from './help-slot-view';

export class HelpView {
  private screen: ClientScreen = 'start';
  private classId: ClassId = 'eagle';
  private readonly guide: GuideDialog;
  private readonly panel: HTMLElement;
  private readonly combat: HTMLElement;
  private readonly button: HTMLElement;
  private readonly onOpen = () => this.guide.show(this.classId);
  private readonly onKey = (event: KeyboardEvent) => this.handleKey(event);
  private readonly onResize = () => this.renderCombat();

  constructor(private readonly document: Document, private readonly window: Window) {
    this.guide = new GuideDialog(document);
    this.panel = document.getElementById('class-panel')!;
    this.combat = document.getElementById('combat-help')!;
    this.button = document.getElementById('how-to-play')!;
    this.button.addEventListener('click', this.onOpen);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.onResize);
  }

  render(screen: ClientScreen, classId: ClassId): void {
    if (screen === this.screen && classId === this.classId) return;
    this.guide.close();
    this.screen = screen;
    this.classId = classId;
    if (screen === 'lobby') this.panel.replaceChildren(classPanel(this.document, CLASSES[classId]));
    this.renderCombat();
  }

  dispose(): void {
    this.guide.close();
    this.window.removeEventListener('keydown', this.onKey, true);
    this.window.removeEventListener('resize', this.onResize);
    this.button.removeEventListener('click', this.onOpen);
    this.combat.replaceChildren();
    this.guide.element.remove();
  }

  private renderCombat(): void {
    this.combat.hidden = this.screen !== 'combat';
    this.combat.replaceChildren();
    if (this.screen !== 'combat') return;
    const slots = helpSlots(CLASSES[this.classId], this.window.innerWidth, this.window.innerHeight);
    this.combat.append(...slots.map(({ help, rect }) => helpSlot(this.document, help, rect)));
  }

  private handleKey(event: KeyboardEvent): void {
    const open = this.guide.element.open;
    if (open) event.stopImmediatePropagation();
    if (!open && this.screen !== 'combat') return;
    const action = guideKey(open, event);
    if (action === 'none') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'open') this.onOpen();
    else this.guide.close();
  }
}
