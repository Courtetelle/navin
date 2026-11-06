import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { buttonTexts, editedChildren } from '../uiEdit/applyUiEdit.tsx';

const edit = { view: 'sos', orig: '📞', at: '', label: '☎️' };

test('without direct text, the label is the first span holding only text', () => {
  const children = [
    <span key="icon" className="ph">
      📞
    </span>,
    <span key="name">
      <b>Port</b>
    </span>,
  ];
  expect(buttonTexts(children).text).toBe('📞');
  expect(renderToStaticMarkup(<>{editedChildren(children, edit)}</>)).toBe(
    '<span class="ph">☎️</span><span><b>Port</b></span>',
  );
});

test('direct text stays the label when a span sits next to it', () => {
  const children = [<span key="icon">⚙️</span>, 'Moteur'];
  expect(buttonTexts(children).text).toBe('Moteur');
  expect(renderToStaticMarkup(<>{editedChildren(children, edit)}</>)).toBe(
    '<span>⚙️</span>☎️',
  );
});
