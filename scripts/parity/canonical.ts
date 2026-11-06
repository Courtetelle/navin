/**
 * Serialize the page into a canonical, line-per-node text that is stable
 * across rendering techniques (innerHTML strings vs React): attributes and
 * classes sorted, inline styles normalized, form state read from properties,
 * inline event handler attributes dropped, adjacent text nodes merged, and the
 * React `#root` wrapper made transparent.
 *
 * Runs inside the browser: it must stay self-contained (no imports, no closures).
 * @param ignoreAttributes - Regular expression source of attribute names to skip.
 * @returns The canonical text.
 */
export function serializeDom(ignoreAttributes: string | null): string {
  const ignored = ignoreAttributes ? new RegExp(ignoreAttributes) : null;
  // VIDEO: the invisible wake-lock fallback, whose place in <body> depends on
  // when the refused Wake Lock request returns.
  const skipped = new Set([
    'SCRIPT',
    'STYLE',
    'LINK',
    'NOSCRIPT',
    'TEMPLATE',
    'VIDEO',
  ]);
  const lines: string[] = [];

  const attributesOf = (element: Element): string => {
    const parts: string[] = [];
    for (const attribute of element.attributes) {
      const name = attribute.name;
      if (name.startsWith('on') || ignored?.test(name)) continue;
      if (['value', 'checked', 'selected'].includes(name)) continue;
      if (name === 'class') {
        const value = [...element.classList].toSorted().join(' ');
        if (value) parts.push(`class="${value}"`);
        continue;
      }
      if (name === 'style' && element instanceof HTMLElement) {
        const declarations: string[] = [];
        for (let index = 0; index < element.style.length; index++) {
          const property = element.style.item(index);
          // Unobservable, and it varies from run to run in legacy, where the
          // fit races with the rule that hides the cell.
          if (
            property === 'height' &&
            element instanceof HTMLTextAreaElement &&
            element.closest('[hidden]')
          ) {
            continue;
          }
          const priority = element.style.getPropertyPriority(property);
          declarations.push(
            `${property}:${element.style.getPropertyValue(property)}${priority ? ' !important' : ''}`,
          );
        }
        if (declarations.length > 0) {
          parts.push(`style="${declarations.toSorted().join(';')}"`);
        }
        continue;
      }
      parts.push(`${name}="${attribute.value}"`);
    }
    if (element instanceof HTMLInputElement) {
      parts.push(
        element.type === 'checkbox' || element.type === 'radio'
          ? `:checked=${String(element.checked)}`
          : `:value="${element.value}"`,
      );
    } else if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      parts.push(`:value="${element.value}"`);
    }
    return parts.toSorted().join(' ');
  };

  const walk = (node: Node, depth: number) => {
    const element = node as Element;
    if (skipped.has(element.tagName)) return;
    if (element.id === 'root' && element.parentElement === document.body) {
      walkChildren(element, depth);
      return;
    }
    const attributes = attributesOf(element);
    const tag = element.tagName.toLowerCase();
    lines.push(
      `${'  '.repeat(depth)}<${tag}${attributes ? ` ${attributes}` : ''}>`,
    );
    if (element instanceof HTMLTextAreaElement) return;
    walkChildren(element, depth + 1);
  };

  const walkChildren = (parent: Node, depth: number) => {
    let text = '';
    const flush = () => {
      const value = text.replaceAll(/\s+/g, ' ').trim();
      if (value) lines.push(`${'  '.repeat(depth)}"${value}"`);
      text = '';
    };
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent ?? '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        flush();
        walk(child, depth);
      }
    }
    flush();
  };

  const rootParts: string[] = [];
  for (const name of ['class', 'data-theme', 'lang', 'style']) {
    // The app suspends scroll anchoring for one frame after a tap: under the
    // harness clock, a screen with many timers can stretch that frame.
    const value = document.documentElement
      .getAttribute(name)
      ?.replace(/\s*overflow-anchor: none;/, '');
    if (value) {
      rootParts.push(`${name}="${value.split(/\s+/).toSorted().join(' ')}"`);
    }
  }
  lines.push(
    `<html ${rootParts.join(' ')}>`,
    `<body ${attributesOf(document.body)}>`,
  );
  walkChildren(document.body, 1);
  return `${lines.join('\n')}\n`;
}
