import type { ReactNode } from 'react';

/**
 * The page of a PDF: a table whose empty head and foot repeat on every
 * printed page, giving each page its margin top and bottom.
 * @param props - The content.
 * @param props.children - The content.
 * @returns The table.
 */
export function PdfSheet({ children }: { children: ReactNode }) {
  return (
    <table className="pdf-sheet">
      <thead>
        <tr>
          <td />
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td />
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td className="pdf-body">{children}</td>
        </tr>
      </tbody>
    </table>
  );
}
