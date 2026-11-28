import { motion } from 'motion/react';
import { Calendar, Sparkles, User, X } from 'lucide-react';
import { DISCIPLINE_MAP } from '../data/ufroSeed';
import { NEWS_CATEGORY_META, sanitizeSafeNewsUrl } from '../domain/newsFormatter';
import type { DisciplineId, NewsArticle } from '../types/tournament';
import { EDITORIAL_EASE } from './MotionPrimitives';
import { RichTextRenderer } from './RichTextRenderer';
import { ShareEntityLinkButton } from './ShareEntityLinkButton';

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
      : 'Campeonato UFRO';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
      onClick={onClose}
    >
      <motion.article
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.34, ease: EDITORIAL_EASE }}
        className="bg-[#08080c] text-zinc-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.1] shadow-[0_32px_90px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Editorial Article Split Header (inspired by Artfolio blog view) */}
        <div className="p-6 sm:p-10 border-b border-white/[0.08]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="text-zinc-300">{catMeta.label}</span>
              <span aria-hidden="true">›</span>
              <span>{disciplineLabel}</span>
              {article.featured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#a5b0ff]">Portada</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ShareEntityLinkButton
                entityType="news"
                entityId={article.id}
                shareTitle={`${article.title} · Campeonato Intercarreras UFRO`}
                shareText={article.summary}
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar noticia"
                className="w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className={`grid gap-8 items-center ${safeCover ? 'grid-cols-1 lg:grid-cols-12' : ''}`}>
            <div className={safeCover ? 'lg:col-span-6 space-y-5' : 'space-y-5 max-w-2xl'}>
              <h2
                id="news-modal-title"
                className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] leading-[1.08] text-white"
              >
                {article.title}
              </h2>

              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                {article.summary}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5 text-zinc-300">
                  <User className="w-3.5 h-3.5 text-[#9aa5ff]" />
                  <span>{article.authorName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#9aa5ff]" />
                  <span>{formatDateEs(article.createdAt)}</span>
                </span>
                {article.aiGenerated && (
                  <span className="inline-flex items-center gap-1 text-[#a5b0ff]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Prensa UFRO</span>
                  </span>
                )}
              </div>
            </div>

            {safeCover && (
              <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#101016] aspect-[16/10]">
                <img
                  src={safeCover}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Formatted Body */}
        <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-8">
          <RichTextRenderer content={article.content} tone="dark" />

          <div className="pt-6 border-t border-white/[0.08] flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              Prensa Oficial · Campeonato Intercarreras UFRO
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}
