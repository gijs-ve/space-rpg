'use client';

import React, { useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CHAPTERS, { findChapter } from '@/lib/guide/chapters';
import type { GuideChapter, GuideSection, CrossRef } from '@/lib/guide/types';

// ─── Cross-reference link ─────────────────────────────────────────────────────

/**
 * Renders a styled in-guide hyperlink.
 * Import and use this inside section `content` to reference other chapters.
 *
 * Example:     
 *   <GuideRef chapter="combat" section="wave-system" label="the wave system" />
 */
export function GuideRef({ chapter, section, label }: CrossRef) {
  const router = useRouter();
  const target = findChapter(chapter);
  const sec    = section ? target?.sections.find((s) => s.id === section) : undefined;
  const text   = label ?? sec?.title ?? target?.title ?? chapter;

  function navigate() {
    const params = new URLSearchParams({ chapter });
    if (section) params.set('section', section);
    router.push(`/help?${params.toString()}`);
  }

  return (
    <button
      onClick={navigate}
      className="inline text-amber-400 underline underline-offset-2 hover:text-amber-300 transition text-sm"
    >
      {text}
    </button>
  );
}

// ─── Chapter sidebar entry ────────────────────────────────────────────────────

function ChapterEntry({
  chapter,
  active,
  onClick,
}: {
  chapter: GuideChapter;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg transition-all group',
        active
          ? 'bg-amber-900/40 border border-amber-700/50 text-amber-300'
          : 'border border-transparent text-gray-400 hover:bg-gray-800/50 hover:text-gray-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{chapter.icon}</span>
        <span className="font-semibold text-sm">{chapter.title}</span>
      </div>
      <p className={`text-[10px] mt-0.5 leading-snug pl-6 ${active ? 'text-amber-500/70' : 'text-gray-600 group-hover:text-gray-500'}`}>
        {chapter.summary}
      </p>
    </button>
  );
}

// ─── Section content block ────────────────────────────────────────────────────

function SectionBlock({
  section,
  highlighted,
  sectionRef,
}: {
  section: GuideSection;
  highlighted: boolean;
  sectionRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={sectionRef}
      id={`section-${section.id}`}
      className={[
        'rounded-xl border p-5 transition-colors duration-500',
        highlighted
          ? 'border-amber-700/60 bg-amber-950/20'
          : 'border-gray-800/60 bg-gray-900/30',
      ].join(' ')}
    >
      <h3 className="text-base font-bold text-gray-100 mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-amber-600 rounded-full shrink-0" />
        {section.title}
      </h3>
      <div>{section.content}</div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-600 animate-pulse">Loading guide…</div>}>
      <HelpContent />
    </Suspense>
  );
}
// ─── Section TOC (right-side quick-jump) ─────────────────────────────────────

function SectionTOC({
  chapter,
  activeSectionId,
  onJump,
}: {
  chapter: GuideChapter;
  activeSectionId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-2 font-semibold px-1">
        Sections
      </p>
      {chapter.sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onJump(s.id)}
          className={[
            'block w-full text-left px-2 py-1 rounded text-[11px] transition',
            activeSectionId === s.id
              ? 'text-amber-400 bg-amber-900/20'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40',
          ].join(' ')}
        >
          {s.title}
        </button>
      ))}
    </nav>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function HelpContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const chapterId    = searchParams.get('chapter') ?? CHAPTERS[0]?.id ?? '';
  const sectionId    = searchParams.get('section') ?? null;

  const chapter = findChapter(chapterId) ?? CHAPTERS[0];

  // Refs for every section so we can scroll to them
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentRef  = useRef<HTMLDivElement>(null);

  const setRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  }, []);

  // Scroll + highlight on sectionId change
  useEffect(() => {
    if (!sectionId) return;
    const el = sectionRefs.current.get(sectionId);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [sectionId, chapterId]);

  function navigateTo(cId: string, sId?: string) {
    const params = new URLSearchParams({ chapter: cId });
    if (sId) params.set('section', sId);
    router.push(`/help?${params.toString()}`);
    // Scroll content pane to top when switching chapters
    if (cId !== chapterId) {
      setTimeout(() => contentRef.current?.scrollTo({ top: 0 }), 50);
    }
  }

  if (!chapter) return null;

  return (
    <div className="flex h-full gap-0 -m-6">

      {/* ── Left: Chapter list ───────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-gray-800/60 flex flex-col bg-gray-950/40">
        <div className="p-4 border-b border-gray-800/60">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Guidebook</p>
          <h1 className="text-base font-bold text-amber-400 mt-0.5">Iron Realm</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 view-scroll">
          {CHAPTERS.map((c) => (
            <ChapterEntry
              key={c.id}
              chapter={c}
              active={c.id === chapterId}
              onClick={() => navigateTo(c.id)}
            />
          ))}
        </nav>
      </aside>

      {/* ── Centre: Chapter content ──────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="flex-1 min-w-0 overflow-y-auto p-7 view-scroll"
      >
        {/* Chapter heading */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{chapter.icon}</span>
            <h2 className="text-2xl font-bold text-gray-100">{chapter.title}</h2>
          </div>
          <p className="text-sm text-gray-500 ml-11">{chapter.summary}</p>
        </div>

        {/* Sections */}
        <div className="space-y-4 max-w-2xl">
          {chapter.sections.map((s) => (
            <SectionBlock
              key={s.id}
              section={s}
              highlighted={sectionId === s.id}
              sectionRef={setRef(s.id)}
            />
          ))}
        </div>

        <p className="text-[10px] text-gray-800 mt-8 ml-1">
          End of chapter: {chapter.title}
        </p>
      </div>

      {/* ── Right: Section TOC ───────────────────────────────────────────── */}
      <aside className="w-44 shrink-0 border-l border-gray-800/60 p-4 bg-gray-950/40 hidden lg:block">
        <SectionTOC
          chapter={chapter}
          activeSectionId={sectionId}
          onJump={(id) => navigateTo(chapterId, id)}
        />
      </aside>

    </div>
  );
}
