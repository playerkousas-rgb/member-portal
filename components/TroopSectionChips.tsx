import { openSectionsForTroop } from '../lib/troops';
import type { DistrictTroop } from '../lib/types';

/** 只顯示該旅實際開設嘅支部；零／空白唔畫灰色佔位。 */
export default function TroopSectionChips({ troop }: { troop: DistrictTroop }) {
  const sections = openSectionsForTroop(troop);
  if (!sections.length) return null;

  return (
    <span className="troop-section-chips">
      {sections.map((section) => (
        <span key={section.key} className="section-chip on" title={`${section.label}：${section.count} 個團`}>
          <em>{section.emoji}</em>
          <b>{section.label}</b>
          <i>{section.count}</i>
        </span>
      ))}
    </span>
  );
}
