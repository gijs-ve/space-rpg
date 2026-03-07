import { ReactNode } from 'react';

// ─── Core data model ──────────────────────────────────────────────────────────

export interface GuideSection {
  /** Unique within its chapter. Used as the URL anchor (#section-id). */
  id: string;
  title: string;
  /** Rich JSX content.  Use the <Ref> helper for cross-chapter links. */
  content: ReactNode;
}

export interface GuideChapter {
  /** Unique across all chapters. Used in URLs (?chapter=combat). */
  id: string;
  /** Navigation icon (emoji). */
  icon: string;
  title: string;
  /** One-line blurb shown in the chapter list. */
  summary: string;
  sections: GuideSection[];
}

// ─── Cross-reference helper ───────────────────────────────────────────────────

/**
 * Describes a link to another chapter (and optionally a specific section).
 * Pass this to the <GuideRef> component rendered in help/page.tsx.
 */
export interface CrossRef {
  /** Target chapter id. */
  chapter: string;
  /** Target section id within that chapter (optional). */
  section?: string;
  /** Display label. Defaults to the chapter/section title if omitted. */
  label?: string;
}
