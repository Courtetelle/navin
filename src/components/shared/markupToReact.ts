import type { CSSProperties, ReactNode } from 'react';
import { createElement } from 'react';

const cache = new Map<string, ReactNode>();
const BOOLEAN_PROPS = new Set([
  'hidden',
  'disabled',
  'checked',
  'readonly',
  'multiple',
  'selected',
  'open',
]);

/**
 * Turn a static, trusted markup string (legacy SVG icons, fixed HTML snippets)
 * into React elements, so the DOM is the legacy one without `innerHTML`.
 * Results are cached per markup string.
 * @param markup - SVG or HTML markup with a single root element.
 * @param type - Parser type: `image/svg+xml` for SVG, `text/html` for HTML.
 * @returns The React element tree.
 */
export function markupToReact(
  markup: string,
  type: 'image/svg+xml' | 'text/html' = 'image/svg+xml',
): ReactNode {
  const key = `${type}\n${markup}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const parsed = new DOMParser().parseFromString(markup, type);
  const roots =
    type === 'text/html'
      ? [...parsed.body.childNodes]
      : [parsed.documentElement];
  const nodes = roots.map((node, index) => convertNode(node, index));
  const result = nodes.length === 1 ? nodes[0] : nodes;
  cache.set(key, result);
  return result;
}

/**
 * React prop name of a DOM attribute: `class` → `className`, `for` →
 * `htmlFor`, kebab-case presentation attributes → camelCase; `data-*`,
 * `aria-*` and already camel-cased names are kept.
 * @param name - Attribute name as written in the markup.
 * @returns The React prop name.
 */
export function reactPropName(name: string): string {
  if (name === 'class') return 'className';
  if (name === 'for') return 'htmlFor';
  if (name === 'tabindex') return 'tabIndex';
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  if (name.includes(':')) {
    const [prefix = '', local = ''] = name.split(':');
    return prefix + local.charAt(0).toUpperCase() + local.slice(1);
  }
  return name.replaceAll(/-(?<letter>[a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

/**
 * Parse an inline `style` attribute into a React style object.
 * @param text - CSS declarations (`a: b; c: d`).
 * @returns The style object (custom properties kept as written).
 */
export function parseStyle(text: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of text.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!property) continue;
    const name = property.startsWith('--')
      ? property
      : property.replaceAll(/-(?<letter>[a-z])/g, (_match, letter: string) =>
          letter.toUpperCase(),
        );
    style[name] = value;
  }
  return style;
}

function convertNode(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const props: Record<string, unknown> = { key };
  for (const attribute of element.attributes) {
    if (attribute.name === 'xmlns') continue;
    if (attribute.name === 'style') {
      props.style = parseStyle(attribute.value);
      continue;
    }
    const name = reactPropName(attribute.name);
    props[name] = BOOLEAN_PROPS.has(name) ? true : attribute.value;
  }
  const children: ReactNode[] = [];
  let index = 0;
  for (const child of element.childNodes) {
    children.push(convertNode(child, index));
    index++;
  }
  return createElement(
    element.localName,
    props,
    ...(children.length > 0 ? children : []),
  );
}
