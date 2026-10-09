import { type ClassDefinition } from '@mictlan/core';
import { classHelp, type AbilityHelp } from './ability-help';

export function helpNode(document: Document, tag: string, text = '', className = ''): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

export function abilityCard(document: Document, help: AbilityHelp): HTMLElement {
  const card = helpNode(document, 'article', '', 'ability-card');
  card.append(helpNode(document, 'h3', `${help.key} · ${help.name}`),
    helpNode(document, 'span', help.type, 'ability-kind'), helpNode(document, 'p', help.description));
  card.append(helpNode(document, 'p', `Costo: ${help.cost} · Casteo: ${help.cast}`, 'ability-details'),
    helpNode(document, 'p', `Recarga: ${help.cooldown} · Alcance: ${help.range}`, 'ability-details'));
  return card;
}

export function classPanel(document: Document, definition: ClassDefinition): HTMLElement {
  const help = classHelp(definition);
  const panel = helpNode(document, 'section');
  panel.setAttribute('aria-label', `Habilidades de ${help.name}`);
  panel.append(helpNode(document, 'h2', `${help.name} · ${help.role}`),
    helpNode(document, 'p', `${help.health} · ${help.resource}`));
  const abilities = helpNode(document, 'div', '', 'class-abilities');
  abilities.append(...help.abilities.map((ability) => abilityCard(document, ability)));
  panel.append(abilities);
  return panel;
}
