import { GuideChapter } from '../types';
import combat from './combat';
import hero from './hero';
import base from './base';
import resources from './resources';
import market from './market';
import vendors from './vendors';

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new chapters here by importing them above and appending to the array.
// The order here is the order they appear in the sidebar.

const CHAPTERS: GuideChapter[] = [
  hero,
  base,
  resources,
  market,
  vendors,
  combat,
];

export default CHAPTERS;

// Convenience lookup by id
export function findChapter(chapterId: string): GuideChapter | undefined {
  return CHAPTERS.find((c) => c.id === chapterId);
}

export function findSection(chapterId: string, sectionId: string) {
  return findChapter(chapterId)?.sections.find((s) => s.id === sectionId);
}
