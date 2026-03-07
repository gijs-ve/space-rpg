import React from 'react';
import { GuideChapter } from '../types';

const combat: GuideChapter = {
  id:      'combat',
  icon:    '⚔',
  title:   'Combat',
  summary: 'How player-vs-player battles resolve — units, matchups, the 3-wave system and plunder.',
  sections: [

    // ── Overview ────────────────────────────────────────────────────────────
    {
      id:    'overview',
      title: 'Overview',
      content: (
        <div className="space-y-2 text-sm text-gray-300 leading-relaxed">
          <p>
            When you send an attack, your army marches to the target city. On arrival a
            <strong className="text-gray-100"> 3-wave battle</strong> is resolved automatically by
            the server. Neither side can intervene once the march arrives — all strategy happens
            before the battle through army composition and wave assignment.
          </p>
          <p>
            Win <strong className="text-gray-100">at least 2 of the 3 waves</strong> to win the
            battle overall and plunder resources.
          </p>
        </div>
      ),
    },

    // ── Units ────────────────────────────────────────────────────────────────
    {
      id:    'units',
      title: 'Units & Stats',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>Every unit has four combat-relevant stats:</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-left">
                <th className="pb-1 pr-4">Stat</th>
                <th className="pb-1 pr-4">Effect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">Attack</td>  <td className="py-1 text-gray-400">Raw offensive power before matchup bonuses.</td></tr>
              <tr><td className="py-1 pr-4 text-sky-300   font-semibold">Defense</td> <td className="py-1 text-gray-400">Raw defensive power before matchup bonuses. Also used for the wall bonus base.</td></tr>
              <tr><td className="py-1 pr-4 text-green-300 font-semibold">Speed</td>   <td className="py-1 text-gray-400">Determines march time. The slowest unit in any wave sets the pace for all waves.</td></tr>
              <tr><td className="py-1 pr-4 text-purple-300 font-semibold">Carry</td>  <td className="py-1 text-gray-400">Plunder capacity per surviving unit after a won battle.</td></tr>
            </tbody>
          </table>
          <p>
            Units also have a <strong className="text-gray-100">category</strong> (infantry / ranged
            / cavalry / siege) and one or more <strong className="text-gray-100">labels</strong>{' '}
            (e.g. <em>mounted</em>, <em>heavy_armored</em>, <em>anti_cavalry</em>) that drive
            matchup bonuses.
          </p>
        </div>
      ),
    },

    // ── Effective attack ──────────────────────────────────────────────────────
    {
      id:    'effective-attack',
      title: 'Effective Attack Score',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            For each unit on the attacking side the game computes a
            <strong className="text-gray-100"> matchup multiplier</strong> based on who they are
            fighting, then multiplies it against raw attack and count:
          </p>
          <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800">
            <p>effective<sub>i</sub> = attack<sub>i</sub> × count<sub>i</sub> × multiplier<sub>i</sub></p>
            <p className="mt-1">total effective attack = Σ effective<sub>i</sub></p>
          </div>
          <p>
            The multiplier starts at <code className="text-amber-300">1.0</code> and adds bonuses
            from two sources (see{' '}
            <strong className="text-gray-100">Category Counters</strong> and{' '}
            <strong className="text-gray-100">Label Counters</strong> below).
            Bonuses are <em>additive</em>:
          </p>
          <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800">
            multiplier = 1 + Σ bonuses
          </div>
          <p>
            The <strong className="text-gray-100">defender's effective defense</strong> is computed
            the same way — their units "attack" the attacker army using the identical formula,
            yielding a score that represents how hard they are to break through.
          </p>
        </div>
      ),
    },

    // ── Category counters ─────────────────────────────────────────────────────
    {
      id:    'category-counters',
      title: 'Category Counters',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            If an attacking unit's <strong className="text-gray-100">category</strong> counters the{' '}
            <strong className="text-gray-100">dominant category</strong> of the defending army
            (the category with the most units by count), the attacking unit receives a{' '}
            <strong className="text-green-400">+50% bonus</strong> to its multiplier.
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-left">
                <th className="pb-1 pr-4">Attacker category</th>
                <th className="pb-1">Beats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">Infantry</td> <td className="py-1 text-gray-300">Cavalry — spears and pikes halt charges</td></tr>
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">Cavalry</td>  <td className="py-1 text-gray-300">Ranged — horses close distance before volleys</td></tr>
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">Ranged</td>   <td className="py-1 text-gray-300">Infantry — volleys punish slow foot soldiers</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500 font-semibold">Siege</td>     <td className="py-1 text-gray-500">No category counter (specialised vs fortifications)</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            The counter check uses the <em>dominant category</em>, so a mostly-cavalry army that
            also contains some infantry is still countered by infantry attackers.
          </p>
        </div>
      ),
    },

    // ── Label counters ────────────────────────────────────────────────────────
    {
      id:    'label-counters',
      title: 'Label Counters',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            Labels represent attack styles and armour types. When an attacking unit's label
            counters a label present on defending units, the unit gains a{' '}
            <strong className="text-green-400">+30% bonus, scaled by the fraction of the
            defender army that carries the vulnerable label</strong>.
          </p>
          <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800">
            label bonus = (LABEL_COUNTER_BONUS − 1) × fraction_of_defenders_with_label
          </div>
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-left">
                <th className="pb-1 pr-4">Attack label</th>
                <th className="pb-1">Counters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">slashing</td>    <td className="py-1 text-gray-300">light_armored — swords & axes shred unprotected flesh</td></tr>
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">crushing</td>    <td className="py-1 text-gray-300">heavy_armored — warhammers crack plate</td></tr>
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">broadhead</td>   <td className="py-1 text-gray-300">light_armored — wide-tip arrows punish the unarmoured</td></tr>
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">piercing</td>    <td className="py-1 text-gray-300">heavy_armored — bodkin bolts punch through mail</td></tr>
              <tr><td className="py-1 pr-4 text-amber-300 font-semibold">anti_cavalry</td><td className="py-1 text-gray-300">mounted — pikes unseat riders</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Example: if only half the defenders are <em>heavy_armored</em>, a crushing unit gains
            +(0.3 × 0.5) = +15% rather than the full +30%.
          </p>
        </div>
      ),
    },

    // ── Wall bonus ────────────────────────────────────────────────────────────
    {
      id:    'wall-bonus',
      title: 'Wall Bonus',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            Defenders benefit from a fortification advantage. The raw defense score (attack ×
            count, no matchup) is multiplied by the wall bonus percentage and added on top of the
            matchup-adjusted score:
          </p>
          <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800">
            defenderScore = effectiveDefense + rawDefense × (wallBonus% / 100)
          </div>
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-left">
                <th className="pb-1 pr-4">Condition</th>
                <th className="pb-1">Wall bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-1 pr-4">Default (no building)</td><td className="py-1 text-sky-300 font-semibold">+10%</td></tr>
              <tr><td className="py-1 pr-4">Defense Grid building</td><td className="py-1 text-sky-300 font-semibold">+10% + defenseBonus per level</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            The wall bonus only applies in waves where the city defender is actually defending
            (waves I and III). In the counter-attack wave (II) the attacker has no fortification
            advantage.
          </p>
        </div>
      ),
    },

    // ── Wave system ───────────────────────────────────────────────────────────
    {
      id:    'wave-system',
      title: 'The Three-Wave System',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            Every attack is divided into <strong className="text-gray-100">three waves</strong>.
            Each wave fights the defender's matching wave — not a shared pool. Both sides decide
            how to distribute their troops across the three slots before the battle.
          </p>

          {/* Wave table */}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-left">
                <th className="pb-1 pr-3">Wave</th>
                <th className="pb-1 pr-3">Type</th>
                <th className="pb-1">Who must win</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr>
                <td className="py-1.5 pr-3 font-semibold text-gray-200">I</td>
                <td className="py-1.5 pr-3 text-amber-300">Attacker push</td>
                <td className="py-1.5 text-gray-400">Attacker must exceed defender score. Wall bonus active.</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 font-semibold text-gray-200">II</td>
                <td className="py-1.5 pr-3 text-orange-400">Defender counter-attack ↩</td>
                <td className="py-1.5 text-gray-400">
                  Roles flip in the formula — defender attacks, attacker defends. Attacker wins
                  by <em>repelling</em> the counter. No wall bonus.
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 font-semibold text-gray-200">III</td>
                <td className="py-1.5 pr-3 text-amber-300">Attacker push</td>
                <td className="py-1.5 text-gray-400">Attacker must exceed defender score. Wall bonus active.</td>
              </tr>
            </tbody>
          </table>

          <p>
            <strong className="text-gray-100">Overall winner:</strong> the side that wins at
            least 2 of the 3 waves.
          </p>

          <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-300/80">
            <strong>Strategy tip (Wave II):</strong> Pack your Wave II slot with high-defense
            units (Man-at-Arms, Knights) to weather the counter-attack, even if they are weak
            on offence.
          </div>
        </div>
      ),
    },

    // ── Carry-over ────────────────────────────────────────────────────────────
    {
      id:    'carry-over',
      title: 'Survivor Carry-over',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            After each wave, the <strong className="text-gray-100">surviving troops on both sides
            carry forward</strong> and are merged with the next wave's fresh reinforcements.
            Neither side gets a clean slate between waves.
          </p>
          <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800 space-y-1">
            <p>Wave II attacker force = Wave II fresh troops + Wave I survivors</p>
            <p>Wave III attacker force = Wave III fresh troops + Wave II survivors</p>
            <p className="text-gray-600">(same logic applies to the defender)</p>
          </div>
          <p>
            This means a strong opening wave is doubly valuable: not only does it win Wave I, its
            survivors reinforce Wave II. Conversely, a costly Wave I victory may leave you
            weakened for the counter-attack.
          </p>
        </div>
      ),
    },

    // ── Casualties ────────────────────────────────────────────────────────────
    {
      id:    'casualties',
      title: 'Casualties',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            After each wave's winner is decided, both sides take casualties proportional to the
            margin of victory.
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest text-left">
                <th className="pb-1 pr-4">Side</th>
                <th className="pb-1 pr-4">Outcome</th>
                <th className="pb-1">Loss ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr><td className="py-1 pr-4 text-green-400">Winner</td><td className="py-1 pr-4">Won wave</td>  <td className="py-1 text-gray-300">min(90%, loserScore / winnerScore × 80%)</td></tr>
              <tr><td className="py-1 pr-4 text-red-400">Loser</td>  <td className="py-1 pr-4">Lost wave</td> <td className="py-1 text-gray-300">95% fixed (near-total loss)</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            The winner's losses scale with how close the fight was. A dominant victory means very
            few losses. The loser always loses ~95% of that wave's troops.
          </p>
          <p>Casualties are applied proportionally across every unit type in the army.</p>
        </div>
      ),
    },

    // ── Plunder ───────────────────────────────────────────────────────────────
    {
      id:    'plunder',
      title: 'Plunder',
      content: (
        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            If the attacker wins the overall battle (≥ 2 waves won), their{' '}
            <strong className="text-gray-100">surviving troops carry resources</strong> back from
            the defender's stockpile.
          </p>
          <div className="bg-gray-900/70 rounded-lg px-4 py-3 font-mono text-xs text-gray-300 border border-gray-800 space-y-1">
            <p>totalCarry = Σ (survivor count × unit.carry)</p>
            <p>ratio = min(1, totalCarry / total defender resources)</p>
            <p>stolen[res] = floor(defender[res] × ratio)</p>
          </div>
          <p>
            Resources are stolen proportionally — a defender with many rare resources loses
            the same fraction of each type. The attacker cannot exceed their army's total carry
            capacity.
          </p>
          <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-amber-300/80">
            <strong>Tip:</strong> Cavalry and Knights have high carry stats — include some in
            Wave III as a "loot wave" that survives to carry plunder home.
          </div>
        </div>
      ),
    },

  ],
};

export default combat;
