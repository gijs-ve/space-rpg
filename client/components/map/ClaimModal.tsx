'use client';

import WaveAttackModal from './WaveAttackModal';
import type { MapTile } from '@rpg/shared';

interface ClaimModalProps {
  targetTile: MapTile;
  onClose:    () => void;
  onSuccess:  () => void;
}

export default function ClaimModal({ targetTile, onClose, onSuccess }: ClaimModalProps) {
  // If the tile already belongs to another player's domain → contest
  // Otherwise → claim a neutral tile
  const mode = targetTile.domainCityId ? 'contest' : 'claim';
  return <WaveAttackModal mode={mode} targetTile={targetTile} onClose={onClose} onSuccess={onSuccess} />;
}
