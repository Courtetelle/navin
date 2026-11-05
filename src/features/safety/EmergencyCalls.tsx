import { Button } from '../../components/shared/Button.tsx';
import { buzz, openLink } from '../../lib/dom.ts';

/** Number of an emergency service. */
export type EmergencyKey = 'ch' | 'fr' | 'eu';

/** Rescue services of the lake: label, number, details (legacy `MOB_CALLS`). */
const MOB_CALLS: Readonly<
  Record<EmergencyKey, readonly [string, string, string]>
> = {
  ch: ['🇨🇭 Secours suisses', '117', 'police, sauvetage sur le lac'],
  fr: ['🇫🇷 Secours français', '18', 'pompiers, secours sur le lac'],
  eu: ['🆘 Urgence européenne', '112', 'passe sur tous les réseaux'],
};

/** Props of {@link EmergencyCalls}. */
export interface EmergencyCallsProps {
  /** Position on the French side: French services first. */
  french: boolean;
  /** Attribute naming the button (`data-mcall`, `data-vcall`). */
  dataKey: string;
  /** Called before the phone call, with the label and the number. */
  onCall: (label: string, number: string) => void;
}

/**
 * The three call buttons of the lake.
 * @param props - Order, attribute and note of the call.
 * @returns The buttons.
 */
export function EmergencyCalls({
  french,
  dataKey,
  onCall,
}: EmergencyCallsProps) {
  const order: readonly EmergencyKey[] = french
    ? ['fr', 'ch', 'eu']
    : ['ch', 'fr', 'eu'];
  return (
    <div className="mob-calls">
      {order.map((key) => {
        const [label, number, details] = MOB_CALLS[key];
        return (
          <Button
            key={key}
            className={key === 'eu' ? 'btn big' : 'btn big danger'}
            {...{ [dataKey]: key }}
            onClick={() => {
              buzz();
              onCall(label, number);
              openLink(`tel:${number}`);
            }}
          >
            📞 {label} · {number}
            <small>{details}</small>
          </Button>
        );
      })}
    </div>
  );
}
