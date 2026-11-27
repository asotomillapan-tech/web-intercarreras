import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bold,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Newspaper,
  Plus,
  Quote,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import {
  applyToolbarFormat,
  buildTournamentBriefContext,
  NEWS_CATEGORY_META,
  sanitizeSafeNewsUrl,
  type EditorToolbarAction,
} from '../domain/newsFormatter';
import { getFirebaseIdToken } from '../services/firebaseAuth';
import type { Editorial2025Photos } from '../services/googleDrive';
import type {
  AppUserProfile,
  DisciplineId,
  NewsArticle,
  NewsCategory,
  TournamentState,
} from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';
import { RichTextRenderer } from './RichTextRenderer';

interface AdminNewsManagerProps {
  state: TournamentState;
  currentUser: AppUserProfile;
  editorialPhotos: Editorial2025Photos | null;
  onAddNews: (article: NewsArticle) => Promise<void> | void;
  onUpdateNews: (article: NewsArticle) => Promise<void> | void;
  onDeleteNews: (article: NewsArticle) => Promise<void> | void;
}

const NEWS_CATEGORIES: NewsCategory[] = [
  'ANUNCIO',
  'DESTACADO',
  'RESULTADOS',
  'CONVOCATORIA',
  'PLAYOFFS',
];

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AdminNewsManager({
  state,
  currentUser,
  editorialPhotos,
  onAddNews,
  onUpdateNews,
  onDeleteNews,
}: AdminNewsManagerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NewsCategory>('ANUNCIO');
  const [disciplineId, setDisciplineId] = useState<DisciplineId | 'general'>('general');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [featured, setFeatured] = useState(true);
  const [published, setPublished] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  const [aiMode, setAiMode] = useState<'recap' | 'topic'>('recap');
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<'oficial' | 'cronica' | 'urgente'>('oficial');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'FEATURED'>('ALL');
  const [pendingDelete, setPendingDelete] = useState<NewsArticle | null>(null);

  const galleryPhotoChoices = useMemo(() => {
    const items: Array<{ url: string; label: string }> = [];
    if (editorialPhotos?.heroUrl) {
      items.push({ url: editorialPhotos.heroUrl, label: 'Portada Galería 2025' });
    }
    if (editorialPhotos?.byDiscipline) {
      for (const disc of DISCIPLINES) {
        const entry = editorialPhotos.byDiscipline[disc.id];
        if (entry?.url && !items.some((i) => i.url === entry.url)) {
          items.push({ url: entry.url, label: disc.nombreCorto });
        }
      }
    }
    for (const p of state.photos.slice(0, 6)) {
      if (p.imageUrl && !items.some((i) => i.url === p.imageUrl)) {
        items.push({ url: p.imageUrl, label: p.title });
      }
    }
    return items.slice(0, 10);
  }, [editorialPhotos, state.photos]);

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...state.news]
      .filter((n) => {
        if (statusFilter === 'PUBLISHED' && !n.published) return false;
        if (statusFilter === 'DRAFT' && n.published) return false;
        if (statusFilter === 'FEATURED' && !n.featured) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          n.authorName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.news, searchQuery, statusFilter]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setCategory('ANUNCIO');
    setDisciplineId('general');
    setCoverImageUrl('');
    setFeatured(true);
    setPublished(true);
    setAiGenerated(false);
    setEditorMode('edit');
    setFormError(null);
  };

  const loadForEdit = (article: NewsArticle) => {
    setEditingId(article.id);
    setTitle(article.title);
    setSummary(article.summary);
    setContent(article.content);
    setCategory(article.category);
    setDisciplineId(article.disciplineId ?? 'general');
    setCoverImageUrl(article.coverImageUrl ?? '');
    setFeatured(article.featured);
    setPublished(article.published);
    setAiGenerated(Boolean(article.aiGenerated));
    setEditorMode('edit');
    setFormError(null);
    setStatusBanner(null);
  };

  const handleToolbarAction = (action: EditorToolbarAction) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : content.length;
    const end = el ? el.selectionEnd : content.length;
    const { nextValue, nextStart, nextEnd } = applyToolbarFormat(content, start, end, action);
    setContent(nextValue);
    setEditorMode('edit');
    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextStart, nextEnd);
    });
  };

  const handleGenerateBriefWithAI = async () => {
    setAiError(null);
    setFormError(null);
    if (aiMode === 'topic' && aiTopic.trim().length < 5) {
      setAiError('Ingresa una breve pauta o tema (al menos 5 caracteres) para generar la nota.');
      return;
    }

    setAiLoading(true);
    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        throw new Error(
          'Tu sesión de Google no está activa. Vuelve a iniciar sesión para generar borradores.'
        );
      }

      const disciplineName =
        disciplineId === 'general'
          ? 'Campeonato General (todas las disciplinas)'
          : DISCIPLINE_MAP[disciplineId].nombre;

      const tournamentContext = buildTournamentBriefContext(state, disciplineId);

      const res = await fetch('/api/ai/generate-news-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mode: aiMode,
          topic: aiMode === 'topic' ? aiTopic.trim() : '',
          disciplineName,
          tone: aiTone,
          tournamentContext,
        }),
      });

      const data = (await res.json()) as {
        title?: string;
        summary?: string;
        content?: string;
        category?: NewsCategory;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Error generando el borrador automático.');
      }

      setEditingId(null);
      setTitle(data.title || '');
      setSummary(data.summary || '');
      setContent(data.content || '');
      if (data.category && NEWS_CATEGORIES.includes(data.category)) {
        setCategory(data.category);
      }
      setAiGenerated(true);
      setEditorMode('edit');
      setStatusBanner('Borrador generado en el editor. Revísalo y publica cuando estés listo.');
    } catch (err: unknown) {
      setAiError(
        err instanceof Error ? err.message : 'No se pudo generar el borrador automático.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setStatusBanner(null);

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();
    const cleanContent = content.trim();
    const rawCover = coverImageUrl.trim();

    if (cleanTitle.length < 3) {
      setFormError('El titular debe tener al menos 3 caracteres.');
      return;
    }
    if (cleanSummary.length < 10) {
      setFormError('La bajada o resumen breve debe tener al menos 10 caracteres.');
      return;
    }
    if (cleanContent.length < 10) {
      setFormError('El cuerpo de la noticia debe tener al menos 10 caracteres.');
      return;
    }
    if (rawCover && !sanitizeSafeNewsUrl(rawCover)) {
      setFormError('La URL de imagen de portada debe comenzar con https:// o ser una foto de galería.');
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingId ? state.news.find((n) => n.id === editingId) : undefined;
    const authorRole: 'admin' | 'moderador' | 'prensa' =
      currentUser.role === 'prensa'
        ? 'prensa'
        : currentUser.role === 'moderador'
        ? 'moderador'
        : 'admin';

    const payload: NewsArticle = {
      id: existing ? existing.id : `news-${Date.now()}`,
      title: cleanTitle.slice(0, 160),
      summary: cleanSummary.slice(0, 360),
      content: cleanContent.slice(0, 12000),
      category,
      disciplineId,
      coverImageUrl: rawCover ? sanitizeSafeNewsUrl(rawCover) || undefined : undefined,
      featured,
      published,
      aiGenerated,
      authorUid: existing ? existing.authorUid : currentUser.uid,
      authorName: existing ? existing.authorName : currentUser.displayName,
      authorRole: existing ? existing.authorRole : authorRole,
      createdAt: existing ? existing.createdAt : nowIso,
      updatedAt: nowIso,
    };

    setSaving(true);
    try {
      if (existing) {
        await onUpdateNews(payload);
        setStatusBanner(
          payload.published
            ? `Noticia "${payload.title}" actualizada y publicada.`
            : `Borrador "${payload.title}" guardado.`
        );
      } else {
        await onAddNews(payload);
        setStatusBanner(
          payload.published
            ? `Anuncio "${payload.title}" publicado en portada.`
            : `Borrador "${payload.title}" guardado.`
        );
        resetForm();
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error guardando la noticia.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggle = async (article: NewsArticle, field: 'published' | 'featured') => {
    const updated: NewsArticle = {
      ...article,
      [field]: !article[field],
      updatedAt: new Date().toISOString(),
    };
    await onUpdateNews(updated);
    setStatusBanner(
      field === 'published'
        ? updated.published
          ? `"${updated.title}" publicada en Inicio.`
          : `"${updated.title}" movida a borrador.`
        : updated.featured
        ? `"${updated.title}" marcada como destacada.`
        : `"${updated.title}" quitada de destacados.`
    );
  };

  const publishedCount = state.news.filter((n) => n.published).length;
  const featuredCount = state.news.filter((n) => n.published && n.featured).length;
  const draftCount = state.news.filter((n) => !n.published).length;

  const inputCls =
    'w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]';

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            <Newspaper className="w-3.5 h-3.5" />
            <span>Panel de Prensa · Sala Editorial</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Noticias y{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">comunicados</span>
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Publicadas</p>
            <p className="text-xl font-medium tabular-nums text-white mt-0.5">{publishedCount}</p>
          </div>
          <div className="rounded-2xl border border-[#707ef9]/30 bg-[#707ef9]/10 px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-[#c8ceff]">Destacadas</p>
            <p className="text-xl font-medium tabular-nums text-[#a5b0ff] mt-0.5">
              {featuredCount}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-4 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Borradores</p>
            <p className="text-xl font-medium tabular-nums text-zinc-300 mt-0.5">{draftCount}</p>
          </div>
        </div>
      </div>

      {/* Automatic Brief Generator */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#101016] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Redacción rápida</span>
            </p>
            <h3 className="text-lg font-medium text-white">Generar borrador de jornada</h3>
          </div>

          <div className="inline-flex rounded-full bg-[#050507] border border-white/[0.08] p-1 self-start">
            <button
              type="button"
              onClick={() => setAiMode('recap')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                aiMode === 'recap'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Resumen de jornada
            </button>
            <button
              type="button"
              onClick={() => setAiMode('topic')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                aiMode === 'topic'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Desde pauta
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {aiMode === 'topic' ? (
            <div className="lg:col-span-6">
              <label htmlFor="ai-news-topic" className="block text-xs text-zinc-400 mb-1.5">
                Pauta o tema del comunicado
              </label>
              <input
                id="ai-news-topic"
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ej. Cierre de inscripciones Fútbol 7 este viernes..."
                className={inputCls}
              />
            </div>
          ) : (
            <div className="lg:col-span-6 rounded-xl bg-[#050507] border border-white/[0.08] px-4 py-2.5 text-xs text-zinc-400 leading-relaxed">
              Resume automáticamente los{' '}
              <strong className="text-white">
                {state.matches.filter((m) => m.status === 'FINALIZADO').length}
              </strong>{' '}
              partidos finalizados de{' '}
              <strong className="text-white">
                {disciplineId === 'general'
                  ? 'todas las disciplinas'
                  : DISCIPLINE_MAP[disciplineId].nombreCorto}
              </strong>
              .
            </div>
          )}

          <div className="lg:col-span-3">
            <label htmlFor="ai-news-tone" className="block text-xs text-zinc-400 mb-1.5">
              Tono editorial
            </label>
            <select
              id="ai-news-tone"
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value as 'oficial' | 'cronica' | 'urgente')}
              className={inputCls}
            >
              <option value="oficial">Comunicado Oficial</option>
              <option value="cronica">Crónica Breve</option>
              <option value="urgente">Aviso Urgente</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleGenerateBriefWithAI}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] disabled:opacity-50 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{aiLoading ? 'Redactando...' : 'Generar borrador'}</span>
            </button>
          </div>
        </div>

        {aiError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{aiError}</span>
          </div>
        )}
      </section>

      {statusBanner && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Main Split: Editor + Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 rounded-3xl border border-white/[0.08] bg-[#101016] p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <h3 className="text-lg font-medium text-white">
              {editingId ? 'Editar noticia' : 'Nueva noticia o anuncio'}
            </h3>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-xs text-zinc-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear nueva</span>
              </button>
            )}
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="news-category" className="block text-xs text-zinc-400 mb-1.5">
                Categoría
              </label>
              <select
                id="news-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NewsCategory)}
                className={inputCls}
              >
                {NEWS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {NEWS_CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="news-discipline" className="block text-xs text-zinc-400 mb-1.5">
                Disciplina asociada
              </label>
              <select
                id="news-discipline"
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value as DisciplineId | 'general')}
                className={inputCls}
              >
                <option value="general">Campeonato General</option>
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="news-title" className="text-xs text-zinc-400">
                Titular *
              </label>
              <span className="text-[11px] text-zinc-500 tabular-nums">{title.length}/160</span>
            </div>
            <input
              id="news-title"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Comienzan los Playoffs de Fútbol 7 Primera División"
              className={inputCls}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="news-summary" className="text-xs text-zinc-400">
                Resumen breve en portada *
              </label>
              <span className="text-[11px] text-zinc-500 tabular-nums">{summary.length}/360</span>
            </div>
            <textarea
              id="news-summary"
              required
              rows={2}
              maxLength={360}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resumen en 1 o 2 frases para la portada..."
              className={inputCls}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="news-cover" className="text-xs text-zinc-400">
                Imagen de portada (opcional)
              </label>
              {galleryPhotoChoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPhotoPicker((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-[#a5b0ff] hover:text-white cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{showPhotoPicker ? 'Ocultar galería' : 'Elegir de galería'}</span>
                </button>
              )}
            </div>
            <input
              id="news-cover"
              type="url"
              maxLength={1000}
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              className={`${inputCls} text-xs`}
            />
            {showPhotoPicker && galleryPhotoChoices.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-2xl bg-[#050507] border border-white/[0.08]">
                {galleryPhotoChoices.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => {
                      setCoverImageUrl(item.url);
                      setShowPhotoPicker(false);
                    }}
                    className={`relative h-16 rounded-xl overflow-hidden border text-left cursor-pointer ${
                      coverImageUrl === item.url
                        ? 'border-[#707ef9] ring-2 ring-[#707ef9]'
                        : 'border-white/[0.12]'
                    }`}
                    title={item.label}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/75 text-white text-[10px] px-1.5 py-0.5 truncate">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="news-content" className="text-xs text-zinc-400">
                Cuerpo de la noticia *
              </label>
              <div className="inline-flex rounded-full bg-[#050507] border border-white/[0.08] p-0.5">
                <button
                  type="button"
                  onClick={() => setEditorMode('edit')}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
                    editorMode === 'edit' ? 'bg-white text-[#050507]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
                    editorMode === 'preview'
                      ? 'bg-[#707ef9] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Vista previa
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.1] bg-[#050507] overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 px-2.5 py-2 bg-white/[0.02] border-b border-white/[0.08]">
                {(
                  [
                    { action: 'bold', icon: Bold, label: 'Negrita' },
                    { action: 'italic', icon: Italic, label: 'Cursiva' },
                    { action: 'heading', icon: Heading2, label: 'Subtítulo' },
                    { action: 'list', icon: List, label: 'Lista' },
                    { action: 'quote', icon: Quote, label: 'Cita' },
                    { action: 'link', icon: Link2, label: 'Enlace' },
                  ] as const
                ).map(({ action, icon: Icon, label }) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleToolbarAction(action)}
                    aria-label={label}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {editorMode === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  id="news-content"
                  required
                  rows={8}
                  maxLength={12000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe aquí el comunicado o crónica..."
                  className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-zinc-600 leading-relaxed focus:outline-none resize-y"
                />
              ) : (
                <div className="p-4 min-h-[200px] text-zinc-200">
                  <RichTextRenderer content={content} compact />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/[0.08]">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Destacar en portada</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Publicar inmediatamente</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] disabled:opacity-50 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {saving
                ? 'Guardando...'
                : editingId
                ? 'Guardar cambios'
                : published
                ? 'Publicar noticia'
                : 'Guardar borrador'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-300 cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        </form>

        {/* Right: News Directory */}
        <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden">
          <div className="p-5 border-b border-white/[0.08] space-y-3 bg-[#101016]">
            <h3 className="text-base font-medium text-white">
              Archivo de noticias ({state.news.length})
            </h3>

            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por titular o autor..."
                aria-label="Buscar noticias"
                className="w-full rounded-xl bg-[#050507] border border-white/[0.1] pl-10 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Todas' },
                  { id: 'PUBLISHED', label: 'Publicadas' },
                  { id: 'FEATURED', label: 'Destacadas' },
                  { id: 'DRAFT', label: 'Borradores' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors ${
                    statusFilter === f.id
                      ? 'bg-white text-[#050507]'
                      : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/[0.06] max-h-[680px] overflow-y-auto">
            {filteredNews.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <p className="text-sm font-medium text-white">Sin noticias en esta vista</p>
                <p className="text-xs text-zinc-500">
                  Redacta una nueva noticia o genera un borrador arriba.
                </p>
              </div>
            ) : (
              filteredNews.map((article) => {
                const cat = NEWS_CATEGORY_META[article.category];
                const isSelected = editingId === article.id;
                return (
                  <div
                    key={article.id}
                    className={`p-4 space-y-2.5 transition-colors ${
                      isSelected ? 'bg-[#707ef9]/[0.09]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-200 font-medium">
                          {cat.label}
                        </span>
                        {article.featured && (
                          <span className="px-2 py-0.5 rounded-full bg-[#707ef9]/20 text-[#c8ceff] font-medium">
                            Destacada
                          </span>
                        )}
                        {!article.published && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-medium">
                            Borrador
                          </span>
                        )}
                      </div>
                      <span className="text-zinc-500 tabular-nums shrink-0">
                        {formatShortDate(article.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-white leading-snug">{article.title}</p>
                    <p className="text-xs text-zinc-400 line-clamp-2">{article.summary}</p>
                    <p className="text-[11px] text-zinc-500">
                      Por {article.authorName} ·{' '}
                      {article.authorRole === 'prensa'
                        ? 'Prensa'
                        : article.authorRole === 'moderador'
                        ? 'Moderador'
                        : 'Admin'}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => loadForEdit(article)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white hover:text-[#050507] text-[11px] text-zinc-200 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggle(article, 'featured')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/[0.1] hover:border-[#707ef9] text-[11px] text-zinc-300 cursor-pointer"
                      >
                        <Star
                          className={`w-3 h-3 ${
                            article.featured ? 'fill-[#707ef9] text-[#707ef9]' : ''
                          }`}
                        />
                        <span>{article.featured ? 'Quitar' : 'Destacar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggle(article, 'published')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/[0.1] hover:border-white/30 text-[11px] text-zinc-300 cursor-pointer"
                      >
                        {article.published ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                        <span>{article.published ? 'Ocultar' : 'Publicar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingDelete(article)}
                        aria-label={`Eliminar noticia ${article.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-[11px] text-red-300 ml-auto cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar noticia"
        description={
          pendingDelete
            ? `¿Seguro que deseas eliminar permanentemente "${pendingDelete.title}"?`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          await onDeleteNews(target);
          if (editingId === target.id) resetForm();
          setStatusBanner(`Noticia "${target.title}" eliminada.`);
        }}
      />
    </div>
  );
}
