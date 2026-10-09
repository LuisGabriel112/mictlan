import type { Rect } from './frames';
import type { AbilityHelp } from './ability-help';
import { abilityCard, helpNode } from './help-content';

export function helpSlot(document: Document, help: AbilityHelp, rect: Rect): HTMLElement {
  const slot = helpNode(document, 'div', '', 'help-slot');
  slot.tabIndex = 0;
  slot.setAttribute('aria-label', `${help.key} · ${help.name} · ${help.type}`);
  slot.setAttribute('aria-describedby', `tooltip-${help.id}`);
  Object.assign(slot.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  const tooltip = createTooltip(document, help, rect);
  slot.append(helpNode(document, 'span', help.type, 'ability-kind'), tooltip);
  for (const event of ['pointerenter', 'focus']) slot.addEventListener(event, () => { tooltip.hidden = false; });
  for (const event of ['pointerleave', 'blur']) slot.addEventListener(event, () => { tooltip.hidden = true; });
  return slot;
}

function createTooltip(document: Document, help: AbilityHelp, rect: Rect): HTMLElement {
  const tooltip = helpNode(document, 'div', '', 'ability-tooltip');
  tooltip.id = `tooltip-${help.id}`;
  tooltip.hidden = true;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.bottom = `calc(100vh - ${rect.y}px + 8px)`;
  tooltip.style.left = `clamp(16px, ${rect.x}px, calc(100vw - 356px))`;
  tooltip.append(abilityCard(document, help));
  return tooltip;
}
