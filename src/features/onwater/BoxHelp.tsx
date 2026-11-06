import type { HelpTextProps } from '../../components/shared/HelpText.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';

/**
 * An explanation of the box: a pill in `#view`, a plain paragraph in French in
 * the map's window, where legacy neither folded nor translated anything.
 * @param props - Help text props; `keep` means outside `#view`.
 * @returns The paragraph.
 */
export function BoxHelp({ keep, className, ...rest }: HelpTextProps) {
  if (!keep) return <HelpText className={className} {...rest} />;
  return (
    <p className={className ? `help ${className}` : 'help'}>{rest.children}</p>
  );
}
