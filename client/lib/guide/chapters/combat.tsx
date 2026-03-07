import React from 'react';
import * as G from '../components';
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
        <G.Section>
          <G.P>
            When you send an attack, your army marches to the target city. On arrival a{' '}
            <G.Strong>3-wave battle</G.Strong> is resolved automatically by the server. Neither
            side can intervene once the march arrives — all strategy happens before the battle
            through army composition and wave assignment.
          </G.P>
          <G.P>
            Win <G.Strong>at least 2 of the 3 waves</G.Strong> to win the battle overall and
            plunder resources.
          </G.P>
        </G.Section>
      ),
    },

    // ── Units ────────────────────────────────────────────────────────────────
    {
      id:    'units',
      title: 'Units & Stats',
      content: (
        <G.Section>
          <G.P>Every unit has four combat-relevant stats:</G.P>
          <G.Table headers={['Stat', 'Effect']}>
            <G.Row><G.Term color="amber">Attack</G.Term>  <G.Cell>Raw offensive power before matchup bonuses.</G.Cell></G.Row>
            <G.Row><G.Term color="sky">Defense</G.Term>   <G.Cell>Raw defensive power before matchup bonuses. Also used for the wall bonus base.</G.Cell></G.Row>
            <G.Row><G.Term color="green">Speed</G.Term>   <G.Cell>Determines march time. The slowest unit in any wave sets the pace for all waves.</G.Cell></G.Row>
            <G.Row><G.Term color="purple">Carry</G.Term>  <G.Cell>Plunder capacity per surviving unit after a won battle.</G.Cell></G.Row>
          </G.Table>
          <G.P>
            Units also have a <G.Strong>category</G.Strong> (infantry / ranged / cavalry / siege)
            and one or more <G.Strong>labels</G.Strong>{' '}
            (e.g. <em>mounted</em>, <em>heavy_armored</em>, <em>anti_cavalry</em>) that drive
            matchup bonuses.
          </G.P>
        </G.Section>
      ),
    },

    // ── Effective attack ──────────────────────────────────────────────────────
    {
      id:    'effective-attack',
      title: 'Effective Attack Score',
      content: (
        <G.Section>
          <G.P>
            For each unit on the attacking side the game computes a{' '}
            <G.Strong>matchup multiplier</G.Strong> based on who they are fighting, then multiplies
            it against raw attack and count:
          </G.P>
          <G.Formula>
            <p>effective<sub>i</sub> = attack<sub>i</sub> × count<sub>i</sub> × multiplier<sub>i</sub></p>
            <p>total effective attack = Σ effective<sub>i</sub></p>
          </G.Formula>
          <G.P>
            The multiplier starts at <code className="text-amber-300">1.0</code> and adds bonuses
            from two sources (see <G.Strong>Category Counters</G.Strong> and{' '}
            <G.Strong>Label Counters</G.Strong> below). Bonuses are <em>additive</em>:
          </G.P>
          <G.Formula>multiplier = 1 + Σ bonuses</G.Formula>
          <G.P>
            The <G.Strong>defender's effective defense</G.Strong> is computed the same way — their
            units "attack" the attacker army using the identical formula, yielding a score that
            represents how hard they are to break through.
          </G.P>
        </G.Section>
      ),
    },

    // ── Category counters ─────────────────────────────────────────────────────
    {
      id:    'category-counters',
      title: 'Category Counters',
      content: (
        <G.Section>
          <G.P>
            If an attacking unit's <G.Strong>category</G.Strong> counters the{' '}
            <G.Strong>dominant category</G.Strong> of the defending army (the category with the
            most units by count), the attacking unit receives a{' '}
            <strong className="text-green-400">+50% bonus</strong> to its multiplier.
          </G.P>
          <G.Table headers={['Attacker category', 'Beats']}>
            <G.Row><G.Term>Infantry</G.Term><G.Cell>Cavalry — spears and pikes halt charges</G.Cell></G.Row>
            <G.Row><G.Term>Cavalry</G.Term> <G.Cell>Ranged — horses close distance before volleys</G.Cell></G.Row>
            <G.Row><G.Term>Ranged</G.Term>  <G.Cell>Infantry — volleys punish slow foot soldiers</G.Cell></G.Row>
            <G.Row><G.Term color="gray">Siege</G.Term><G.Cell color="gray">No category counter (specialised vs fortifications)</G.Cell></G.Row>
          </G.Table>
          <G.Note>
            The counter check uses the <em>dominant category</em>, so a mostly-cavalry army that
            also contains some infantry is still countered by infantry attackers.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Label counters ────────────────────────────────────────────────────────
    {
      id:    'label-counters',
      title: 'Label Counters',
      content: (
        <G.Section>
          <G.P>
            Labels represent attack styles and armour types. When an attacking unit's label
            counters a label present on defending units, the unit gains a{' '}
            <strong className="text-green-400">+30% bonus, scaled by the fraction of the
            defender army that carries the vulnerable label</strong>.
          </G.P>
          <G.Formula>label bonus = (LABEL_COUNTER_BONUS − 1) × fraction_of_defenders_with_label</G.Formula>
          <G.Table headers={['Attack label', 'Counters']}>
            <G.Row><G.Term>slashing</G.Term>    <G.Cell>light_armored — swords &amp; axes shred unprotected flesh</G.Cell></G.Row>
            <G.Row><G.Term>crushing</G.Term>    <G.Cell>heavy_armored — warhammers crack plate</G.Cell></G.Row>
            <G.Row><G.Term>broadhead</G.Term>   <G.Cell>light_armored — wide-tip arrows punish the unarmoured</G.Cell></G.Row>
            <G.Row><G.Term>piercing</G.Term>    <G.Cell>heavy_armored — bodkin bolts punch through mail</G.Cell></G.Row>
            <G.Row><G.Term>anti_cavalry</G.Term><G.Cell>mounted — pikes unseat riders</G.Cell></G.Row>
          </G.Table>
          <G.Note>
            Example: if only half the defenders are <em>heavy_armored</em>, a crushing unit gains
            +(0.3 × 0.5) = +15% rather than the full +30%.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Wall bonus ────────────────────────────────────────────────────────────
    {
      id:    'wall-bonus',
      title: 'Wall Bonus',
      content: (
        <G.Section>
          <G.P>
            Defenders benefit from a fortification advantage. The raw defense score (attack ×
            count, no matchup) is multiplied by the wall bonus percentage and added on top of the
            matchup-adjusted score:
          </G.P>
          <G.Formula>defenderScore = effectiveDefense + rawDefense × (wallBonus% / 100)</G.Formula>
          <G.Table headers={['Condition', 'Wall bonus']}>
            <G.Row><G.Cell color="gray" pad>Default (no building)</G.Cell>    <G.Cell color="sky">+10%</G.Cell></G.Row>
            <G.Row><G.Cell color="gray" pad>Defense Grid building</G.Cell><G.Cell color="sky">+10% + defenseBonus per level</G.Cell></G.Row>
          </G.Table>
          <G.Note>
            The wall bonus only applies in waves where the city defender is actually defending
            (waves I and III). In the counter-attack wave (II) the attacker has no fortification
            advantage.
          </G.Note>
        </G.Section>
      ),
    },

    // ── Wave system ───────────────────────────────────────────────────────────
    {
      id:    'wave-system',
      title: 'The Three-Wave System',
      content: (
        <G.Section>
          <G.P>
            Every attack is divided into <G.Strong>three waves</G.Strong>. Each wave fights the
            defender's matching wave — not a shared pool. Both sides decide how to distribute
            their troops across the three slots before the battle.
          </G.P>
          <G.Table headers={['Wave', 'Type', 'Who must win']}>
            <G.Row>
              <G.Term color="gray" >I</G.Term>
              <G.Cell color="amber" pad>Attacker push</G.Cell>
              <G.Cell>Attacker must exceed defender score. Wall bonus active.</G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="gray">II</G.Term>
              <G.Cell color="orange" pad>Defender counter-attack ↩</G.Cell>
              <G.Cell>
                Roles flip in the formula — defender attacks, attacker defends. Attacker wins
                by <em>repelling</em> the counter. No wall bonus.
              </G.Cell>
            </G.Row>
            <G.Row>
              <G.Term color="gray">III</G.Term>
              <G.Cell color="amber" pad>Attacker push</G.Cell>
              <G.Cell>Attacker must exceed defender score. Wall bonus active.</G.Cell>
            </G.Row>
          </G.Table>
          <G.P>
            <G.Strong>Overall winner:</G.Strong> the side that wins at least 2 of the 3 waves.
          </G.P>
          <G.Tip label="Strategy tip (Wave II)">
            Pack your Wave II slot with high-defense units (Man-at-Arms, Knights) to weather the
            counter-attack, even if they are weak on offence.
          </G.Tip>
        </G.Section>
      ),
    },

    // ── Carry-over ────────────────────────────────────────────────────────────
    {
      id:    'carry-over',
      title: 'Survivor Carry-over',
      content: (
        <G.Section>
          <G.P>
            After each wave, the <G.Strong>surviving troops on both sides carry forward</G.Strong>{' '}
            and are merged with the next wave's fresh reinforcements. Neither side gets a clean
            slate between waves.
          </G.P>
          <G.Formula>
            <p>Wave II attacker force = Wave II fresh troops + Wave I survivors</p>
            <p>Wave III attacker force = Wave III fresh troops + Wave II survivors</p>
            <p className="text-gray-600">(same logic applies to the defender)</p>
          </G.Formula>
          <G.P>
            This means a strong opening wave is doubly valuable: not only does it win Wave I, its
            survivors reinforce Wave II. Conversely, a costly Wave I victory may leave you
            weakened for the counter-attack.
          </G.P>
        </G.Section>
      ),
    },

    // ── Casualties ────────────────────────────────────────────────────────────
    {
      id:    'casualties',
      title: 'Casualties',
      content: (
        <G.Section>
          <G.P>
            After each wave's winner is decided, both sides take casualties proportional to the
            margin of victory.
          </G.P>
          <G.Table headers={['Side', 'Outcome', 'Loss ratio']}>
            <G.Row><G.Term color="green">Winner</G.Term><G.Cell pad>Won wave</G.Cell> <G.Cell>min(90%, loserScore / winnerScore × 80%)</G.Cell></G.Row>
            <G.Row><G.Term color="red">Loser</G.Term>  <G.Cell pad>Lost wave</G.Cell><G.Cell>95% fixed (near-total loss)</G.Cell></G.Row>
          </G.Table>
          <G.Note>
            The winner's losses scale with how close the fight was. A dominant victory means very
            few losses. The loser always loses ~95% of that wave's troops.
          </G.Note>
          <G.P>Casualties are applied proportionally across every unit type in the army.</G.P>
        </G.Section>
      ),
    },
    // ── Plunder ───────────────────────────────────────────────────────────────
    {
      id:    'plunder',
      title: 'Plunder',
      content: (
        <G.Section>
          <G.P>
            If the attacker wins the overall battle (≥ 2 waves won), their{' '}
            <G.Strong>surviving troops carry resources</G.Strong> back from the defender's
            stockpile.
          </G.P>
          <G.Formula>
            <p>totalCarry = Σ (survivor count × unit.carry)</p>
            <p>ratio = min(1, totalCarry / total defender resources)</p>
            <p>stolen[res] = floor(defender[res] × ratio)</p>
          </G.Formula>
          <G.P>
            Resources are stolen proportionally — a defender with many rare resources loses the
            same fraction of each type. The attacker cannot exceed their army's total carry
            capacity.
          </G.P>
          <G.Tip>
            Cavalry and Knights have high carry stats — include some in Wave III as a "loot wave"
            that survives to carry plunder home.
          </G.Tip>
        </G.Section>
      ),
    },

  ],
};

export default combat;
