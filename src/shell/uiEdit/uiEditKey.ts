/** Where a button sits, as part of its ui-edit key (ui-edit.js:27). */
export type UiEditScope = 'view' | 'onglets' | 'haut';

/** What identifies a button for the label edit mode. */
export interface UiEditIdentity {
  /**
   * Button id.
   * @default undefined
   */
  id?: string;
  /**
   * Its `data-*` attributes in attribute order (names with the `data-` prefix).
   * @default []
   */
  data?: ReadonlyArray<readonly [string, string]>;
  /** Its original main text. */
  text: string;
}

/**
 * Stable key of a button in `ldb.uiEdits` (legacy `uiKey`, ui-edit.js:25-40):
 * the screen (or `onglets` / `haut`), then `#id`, else its `data-*`
 * attributes `name=value` joined by `&`, else `txt=` and its text (60 chars).
 * @param scope - Where the button is.
 * @param currentView - Screen shown (used for `view` buttons).
 * @param identity - Id, data attributes and text.
 * @returns The key.
 */
export function uiEditKey(
  scope: UiEditScope,
  currentView: string,
  identity: UiEditIdentity,
): string {
  const view = scope === 'view' ? currentView : scope;
  let signature = identity.id ? `#${identity.id}` : '';
  if (!signature) {
    const parts: string[] = [];
    for (const [name, value] of identity.data ?? []) {
      if (name.startsWith('data-') && !name.startsWith('data-ue')) {
        parts.push(`${name}=${value}`);
      }
    }
    signature = parts.join('&');
  }
  if (!signature) {
    signature = `txt=${normalizeLabel(identity.text).slice(0, 60)}`;
  }
  return `${view}|${signature}`;
}

/**
 * Main text of a button as legacy read it (direct text nodes joined by a
 * space, whitespace collapsed).
 * @param text - Raw text.
 * @returns Normalized text.
 */
export function normalizeLabel(text: string): string {
  return text.replaceAll(/\s+/g, ' ').trim();
}

/**
 * Identity of a rendered button read from the DOM (for buttons that do not
 * declare one): id, `data-*` attributes and direct text, like legacy.
 * @param button - The button element.
 * @returns Its identity and scope.
 */
export function identityOf(button: Element): {
  scope: UiEditScope;
  identity: UiEditIdentity;
} {
  const scope: UiEditScope = button.closest('.topnav')
    ? 'onglets'
    : button.closest('#view')
      ? 'view'
      : 'haut';
  const data: Array<[string, string]> = [];
  for (const attribute of button.attributes) {
    if (attribute.name.startsWith('data-')) {
      data.push([attribute.name, attribute.value]);
    }
  }
  return {
    scope,
    identity: { id: button.id || undefined, data, text: directText(button) },
  };
}

/**
 * Direct text of a button (ui-edit.js:17-23): its own text nodes, else the
 * text of a child `<span>` without children (tab labels).
 * @param button - The button element.
 * @returns The text.
 */
function directText(button: Element): string {
  const parts: string[] = [];
  for (const node of button.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      parts.push(node.textContent);
    }
  }
  if (parts.length > 0) return normalizeLabel(parts.join(' '));
  for (const child of button.children) {
    if (
      child.tagName === 'SPAN' &&
      child.children.length === 0 &&
      child.textContent?.trim()
    ) {
      return normalizeLabel(child.textContent);
    }
  }
  return '';
}
