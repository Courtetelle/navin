import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { keyedItems } from '../../lib/keyedItems.ts';
import { telOf } from '../../lib/phone.ts';

import type { CallItem, ContactItem } from './contacts.ts';

/** Props of {@link ContactButtons}. */
interface ContactButtonsProps {
  /** Items of {@link contactItems}. */
  items: readonly ContactItem[];
}

/**
 * Contact lines: a big call button per number, a static line otherwise
 * (legacy `contactsHtml`).
 * @param props - The items.
 * @returns The buttons.
 */
export function ContactButtons({ items }: ContactButtonsProps) {
  return (
    <>
      {keyedItems(items, (item) => item.label).map(({ key, item }) =>
        item.kind === 'call' ? (
          <CallButton key={key} {...item} />
        ) : (
          <div key={key} className="btn contact static">
            <b>{item.label}</b>
            <span>{item.value}</span>
          </div>
        ),
      )}
    </>
  );
}

/**
 * A call link (legacy `callBtn`).
 * @param props - Label, number and text after the number.
 * @returns The link.
 */
export function CallButton({ label, number, sub }: CallItem) {
  return (
    <LinkButton className="btn contact call" href={`tel:${telOf(number)}`}>
      <span className="ph">📞</span>
      <span>
        <b>{label || number}</b>
        <span>
          {number}
          {sub ? ` · ${sub}` : ''}
        </span>
      </span>
    </LinkButton>
  );
}
