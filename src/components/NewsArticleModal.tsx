import { Calendar, Sparkles, User, X } from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { NEWS_CATEGORY_META, sanitizeSafeNewsUrl } from '../domain/newsFormatter';
import type { DisciplineId, NewsArticle } from '../types/tournament';
import { RichTextRenderer } from './RichTextRenderer';

interface NewsArticleModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

function formatDateEs(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function NewsArticleModal({ article, onClose }: NewsArticleModalProps) {
  if (!article) return null;

  const catMeta = NEWS_CATEGORY_META[article.category];
  const safeCover = article.coverImageUrl ? sanitizeSafeNewsUrl(article.coverImageUrl) : null;
  const disciplineLabel =
    article.disciplineId && article.disciplineId !== 'general'
      ? DISCIPLINE_MAP[article.disciplineId as DisciplineId]?.nombre
      : 'Campeonato General UFRO';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
      onClick={onClose}
    >
      <article
        className="bg-white text-[#0d0d0d] w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-neutral-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Carbon Editorial Header */}
        <div className="bg-[#0d0d0d] text-white p-6 sm:p-8 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className={`px-2.5 py-1 font-display font-bold uppercase tracking-widest ${catMeta.badgeClass}`}>
                  {catMeta.label}
                </span>
                {article.featured && (
                  <span className="px-2.5 py-1 bg-white/10 text-white font-display font-bold uppercase tracking-widest">
                    Destacado en Portada
                  </span>
                )}
                <span className="text-neutral-300">{disciplineLabel}</span>
              </div>

              <h2
                id="news-modal-title"
                className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight leading-[1.06] text-white"
              >
                {article.title}
              </h2>

              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
                {article.summary}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#707ef9]" />
                  <span>
                    {article.authorName} ·{' '}
                    {article.authorRole === 'prensa' ? 'Prensa Oficial' : 'Administración UFRO'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#707ef9]" />
                  <span>{formatDateEs(article.createdAt)}</span>
                </span>
                {article.aiGenerated && (
                  <span className="inline-flex items-center gap-1 text-[#9ca7ff]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Borrador asistido · Editado por Prensa</span>
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar noticia"
              className="p-2 text-neutral-400 hover:text-white border border-white/15 hover:border-white/40 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Cover Image */}
        {safeCover && (
          <div className="bg-[#0d0d0d] max-h-80 overflow-hidden border-b border-neutral-200">
            <img
              src={safeCover}
              alt={article.title}
              className="w-full h-72 sm:h-80 object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Formatted Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <RichTextRenderer content={article.content} />

          <div className="pt-6 border-t border-neutral-200 flex items-center justify-between gap-4">
            <p className="text-xs text-neutral-500">
              Comunicación Oficial · Campeonato Intercarreras Universidad de La Frontera
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              Cerrar lectura
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
