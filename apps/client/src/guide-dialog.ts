import type { ClassId } from '@mictlan/core';
import { helpNode } from './help-content';
import { roleGuide } from './role-guide';

export class GuideDialog {
  readonly element: HTMLDialogElement;
  private previousFocus?: HTMLElement;

  constructor(private readonly document: Document) {
    this.element = document.createElement('dialog');
    this.element.className = 'role-guide';
    this.element.setAttribute('aria-labelledby', 'role-guide-title');
    this.element.addEventListener('cancel', (event) => { event.preventDefault(); this.close(); });
    document.body.append(this.element);
  }

  show(classId: ClassId): void {
    const guide = roleGuide(classId);
    const title = helpNode(this.document, 'h2', `Cómo jugar · ${guide.name}`);
    title.id = 'role-guide-title';
    this.element.replaceChildren(title, this.closeButton());
    for (const section of guide.sections) this.appendSection(section.title, section.text);
    this.appendSection('Controles comunes', guide.controls);
    this.element.append(helpNode(this.document, 'p', 'H o Esc: cerrar ayuda.', 'help-hint'));
    this.previousFocus = this.document.activeElement as HTMLElement;
    this.element.showModal();
  }

  close(): void {
    if (!this.element.open) return;
    this.element.close();
    this.previousFocus?.focus();
  }

  private appendSection(title: string, text: string): void {
    const section = helpNode(this.document, 'section');
    section.append(helpNode(this.document, 'h3', title), helpNode(this.document, 'p', text));
    this.element.append(section);
  }

  private closeButton(): HTMLElement {
    const button = helpNode(this.document, 'button', 'Cerrar');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => this.close());
    return button;
  }
}
