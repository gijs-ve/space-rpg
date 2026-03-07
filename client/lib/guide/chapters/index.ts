import { GuideChapter } from '../types';
import combat from './combat';

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new chapters here by importing them above and appending to the array.
// The order here is the order they appear in the sidebar.

const CHAPTERS: GuideChapter[] = [
  combat,
  // future chapters — remove this block when you have real content:
  // base,
  // hero,
  // resources,
  // market,
];

export default CHAPTERS;

// Convenience lookup by id
export function findChapter(chapterId: string): GuideChapter | undefined {
  return CHAPTERS.find((c) => c.id === chapterId);
}

export function findSection(chapterId: string, sectionId: string) {
  return findChapter(chapterId)?.sections.find((s) => s.id === sectionId);
}
