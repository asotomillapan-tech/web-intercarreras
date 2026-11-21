import { Fragment } from 'react';
import {
  parseSimpleRichText,
  type InlineSegment,
} from '../domain/newsFormatter';

interface RichTextRendererProps {
  content: string;
  compact?: boolean;
}

function renderInlineSegments(segments: InlineSegment[], keyPrefix: string) {
  return segments.map((seg, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (seg.type === 'bold') {
      return (
        <strong key={key} className="font-bold text-[#0d0d0d]">
          {seg.text}
        </strong>
      );
    }
    if (seg.type === 'italic') {
      return (
        <em key={key} className="italic text-neutral-800">
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
          className="text-[#707ef9] hover:text-[#5766eb] underline underline-offset-2 font-medium"
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
export function RichTextRenderer({ content, compact = false }: RichTextRendererProps) {
  const blocks = parseSimpleRichText(content);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-neutral-500 italic">
        Sin contenido redactado todavía.
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-3 text-sm text-neutral-700 leading-relaxed' : 'space-y-4 text-[15px] text-neutral-800 leading-relaxed'}>
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <h3
              key={`blk-${idx}`}
              className={`font-display font-bold uppercase tracking-wide text-[#0d0d0d] pt-1 ${
                compact ? 'text-lg' : 'text-2xl'
              }`}
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={`blk-${idx}`}
              className="border-l-4 border-[#707ef9] bg-[#f5f6f8] px-4 py-3 text-neutral-700 italic"
            >
              {renderInlineSegments(block.segments, `q-${idx}`)}
            </blockquote>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={`blk-${idx}`} className="list-disc pl-5 space-y-1.5 text-neutral-800">
              {block.items.map((itemSegs, itemIdx) => (
                <li key={`li-${idx}-${itemIdx}`}>
                  {renderInlineSegments(itemSegs, `li-${idx}-${itemIdx}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`blk-${idx}`}>
            {renderInlineSegments(block.segments, `p-${idx}`)}
          </p>
        );
      })}
    </div>
  );
}
