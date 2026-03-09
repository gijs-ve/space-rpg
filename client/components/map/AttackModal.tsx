'use client';

import WaveAttackModal from './WaveAttackModal';
import type { MapTile } from '@rpg/shared';

interface AttackModalProps {
  targetTile: MapTile;
  onClose:    () => void;
  onSuccess:  () => void;
}

export default function AttackModal(props: AttackModalProps) {
  return <WaveAttackModal mode="attack" {...props} />;
}
