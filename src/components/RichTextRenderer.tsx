import { Fragment } from 'react';
import {
  parseSimpleRichText,
  type InlineSegment,
} from '../domain/newsFormatter';

interface RichTextRendererProps {
  content: string;
  compact?: boolean;
  tone?: 'dark' | 'light';
}

function renderInlineSegments(
  segments: InlineSegment[],
  keyPrefix: string,
  isDark: boolean
) {
  return segments.map((seg, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (seg.type === 'bold') {
      return (
        <strong
          key={key}
          className={isDark ? 'font-semibold text-white' : 'font-bold text-[#0d0d0d]'}
        >
          {seg.text}
        </strong>
      );
    }
    if (seg.type === 'italic') {
      return (
        <em
          key={key}
          className={isDark ? 'font-editorial text-zinc-200' : 'italic text-neutral-800'}
        >
          {seg.text}
        </em>
      );
    }
    if (seg.type === 'link') {
      return (
        <a
          key={key}
          href={seg.href}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isDark
              ? 'text-[#a5b0ff] hover:text-white underline underline-offset-4 decoration-white/30 font-medium transition-colors'
              : 'text-[#707ef9] hover:text-[#5766eb] underline underline-offset-2 font-medium'
          }
        >
          {seg.text}
        </a>
      );
    }
    return <Fragment key={key}>{seg.text}</Fragment>;
  });
}

/**
 * Renders formatted news content purely through safe React JSX elements (zero raw HTML injection).
 */
export function RichTextRenderer({
  content,
  compact = false,
  tone = 'dark',
}: RichTextRendererProps) {
  const blocks = parseSimpleRichText(content);
  const isDark = tone === 'dark';

  if (blocks.length === 0) {
    return (
      <p className={`text-sm italic ${isDark ? 'text-zinc-500' : 'text-neutral-500'}`}>
        Sin contenido redactado todavía.
      </p>
    );
  }

  return (
    <div
      className={
        compact
          ? `space-y-3 text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-neutral-700'}`
          : `space-y-4 text-[15px] leading-relaxed ${isDark ? 'text-zinc-300' : 'text-neutral-800'}`
      }
    >
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <h3
              key={`blk-${idx}`}
              className={`font-medium tracking-[-0.02em] pt-2 ${
                isDark ? 'text-white' : 'text-[#0d0d0d]'
              } ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={`blk-${idx}`}
              className={`rounded-2xl px-5 py-4 font-editorial text-base sm:text-lg ${
                isDark
                  ? 'bg-white/[0.03] border border-white/[0.08] text-zinc-200'
                  : 'bg-[#f5f6f8] border border-neutral-200 text-neutral-700'
              }`}
            >
              {renderInlineSegments(block.segments, `q-${idx}`, isDark)}
            </blockquote>
          );
        }

        if (block.type === 'list') {
          return (
            <ul
              key={`blk-${idx}`}
              className={`list-disc pl-5 space-y-1.5 ${
                isDark ? 'text-zinc-300 marker:text-[#9aa5ff]' : 'text-neutral-800'
              }`}
            >
              {block.items.map((itemSegs, itemIdx) => (
                <li key={`li-${idx}-${itemIdx}`}>
                  {renderInlineSegments(itemSegs, `li-${idx}-${itemIdx}`, isDark)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`blk-${idx}`}>
            {renderInlineSegments(block.segments, `p-${idx}`, isDark)}
          </p>
        );
      })}
    </div>
  );
}
