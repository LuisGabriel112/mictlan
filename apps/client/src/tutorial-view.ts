import type { TutorialPrompt } from './tutorial-steps';

export class TutorialView {
  private readonly panel: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly text: HTMLElement;
  private readonly skip: HTMLElement;

  constructor(document: Document) {
    this.panel = document.createElement('section');
    this.panel.id = 'tutorial';
    this.panel.setAttribute('aria-live', 'polite');
    this.panel.hidden = true;
    this.counter = document.createElement('span');
    this.counter.className = 'tutorial-counter';
    this.text = document.createElement('p');
    this.skip = document.createElement('button');
    this.skip.textContent = 'Saltar';
    this.panel.append(this.counter, this.text, this.skip);
    document.body.append(this.panel);
  }

  render(prompt: TutorialPrompt | undefined): void {
    this.panel.hidden = !prompt;
    if (!prompt) return;
    this.counter.textContent = prompt.counter;
    this.text.textContent = prompt.text;
  }

  onSkip(callback: () => void): void {
    this.skip.addEventListener('click', () => callback());
  }
}
