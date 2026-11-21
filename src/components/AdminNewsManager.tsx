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

  // Editor form state
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

  // Automatic Brief Generator state
  const [aiMode, setAiMode] = useState<'recap' | 'topic'>('recap');
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<'oficial' | 'cronica' | 'urgente'>('oficial');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Feedback & list filtering state
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
          'Tu sesión de Google no está activa. Vuelve a iniciar sesión para generar noticias automáticas.'
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
      setStatusBanner(
        'Noticia breve generada automáticamente en el editor. Revisa el texto, ajusta si lo deseas y presiona "Publicar noticia".'
      );
    } catch (err: unknown) {
      setAiError(
        err instanceof Error ? err.message : 'No se pudo generar la noticia automática.'
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
      setFormError('La URL de imagen de portada debe comenzar con https:// o ser una foto de la galería.');
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingId ? state.news.find((n) => n.id === editingId) : undefined;
    const authorRole: 'admin' | 'prensa' = currentUser.role === 'prensa' ? 'prensa' : 'admin';

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
            ? `Noticia "${payload.title}" actualizada y visible en la página de inicio.`
            : `Borrador "${payload.title}" guardado correctamente.`
        );
      } else {
        await onAddNews(payload);
        setStatusBanner(
          payload.published
            ? `Anuncio "${payload.title}" publicado en la página de inicio.`
            : `Borrador "${payload.title}" creado y guardado en la sala de prensa.`
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
          ? `"${updated.title}" ahora está publicada en Inicio.`
          : `"${updated.title}" se movió a borrador (oculta en Inicio).`
        : updated.featured
        ? `"${updated.title}" marcada como anuncio destacado en portada.`
        : `"${updated.title}" quitada de destacados principales.`
    );
  };

  const publishedCount = state.news.filter((n) => n.published).length;
  const featuredCount = state.news.filter((n) => n.published && n.featured).length;
  const draftCount = state.news.filter((n) => !n.published).length;

  return (
    <div className="space-y-8">
      {/* KPI Header Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-neutral-200 bg-[#f5f6f8] p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Publicadas en Inicio</p>
          <p className="font-display text-3xl font-bold tabular-nums text-[#0d0d0d] mt-1">
            {publishedCount}
          </p>
        </div>
        <div className="border border-neutral-200 bg-[#f5f6f8] p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Anuncios Destacados</p>
          <p className="font-display text-3xl font-bold tabular-nums text-[#707ef9] mt-1">
            {featuredCount}
          </p>
        </div>
        <div className="border border-neutral-200 bg-[#f5f6f8] p-5">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Borradores Privados</p>
          <p className="font-display text-3xl font-bold tabular-nums text-neutral-700 mt-1">
            {draftCount}
          </p>
        </div>
      </div>

      {/* Automatic Brief Generator Card */}
      <section className="bg-[#0d0d0d] text-white border border-neutral-800 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#707ef9] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Redacción Automática · Sala de Prensa UFRO</span>
            </p>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
              Generar noticia breve automáticamente
            </h2>
            <p className="text-xs text-neutral-400">
              Crea un borrador periodístico listo para revisar en el editor a partir de los resultados
              reales del campeonato o de una pauta rápida.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 self-start">
            <button
              type="button"
              onClick={() => setAiMode('recap')}
              className={`px-3 py-1.5 text-xs font-display font-bold uppercase tracking-widest cursor-pointer ${
                aiMode === 'recap' ? 'bg-[#707ef9] text-white' : 'text-neutral-300 hover:text-white'
              }`}
            >
              Resumen de jornada
            </button>
            <button
              type="button"
              onClick={() => setAiMode('topic')}
              className={`px-3 py-1.5 text-xs font-display font-bold uppercase tracking-widest cursor-pointer ${
                aiMode === 'topic' ? 'bg-[#707ef9] text-white' : 'text-neutral-300 hover:text-white'
              }`}
            >
              Desde pauta o tema
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {aiMode === 'topic' ? (
            <div className="lg:col-span-6">
              <label htmlFor="ai-news-topic" className="block text-xs text-neutral-300 mb-1.5">
                ¿Qué anuncio o noticia quieres redactar?
              </label>
              <input
                id="ai-news-topic"
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ej. Cierre de inscripciones de Fútbol 7 Damas este viernes a las 18:00..."
                className="w-full bg-[#18181f] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#707ef9]"
              />
            </div>
          ) : (
            <div className="lg:col-span-6 bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-neutral-300 leading-relaxed">
              Se tomarán automáticamente los{' '}
              <strong className="text-white">{state.matches.filter((m) => m.status === 'FINALIZADO').length}</strong>{' '}
              partidos finalizados, próximos encuentros, líderes y ventanas abiertas de{' '}
              <strong className="text-white">
                {disciplineId === 'general' ? 'todas las disciplinas' : DISCIPLINE_MAP[disciplineId].nombreCorto}
              </strong>{' '}
              sin inventar marcadores.
            </div>
          )}

          <div className="lg:col-span-3">
            <label htmlFor="ai-news-tone" className="block text-xs text-neutral-300 mb-1.5">
              Estilo editorial
            </label>
            <select
              id="ai-news-tone"
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value as 'oficial' | 'cronica' | 'urgente')}
              className="w-full bg-[#18181f] border border-white/15 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
            >
              <option value="oficial">Comunicado Oficial UFRO</option>
              <option value="cronica">Crónica Deportiva Breve</option>
              <option value="urgente">Anuncio Urgente / Aviso</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleGenerateBriefWithAI}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] disabled:opacity-50 text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{aiLoading ? 'Redactando breve...' : 'Generar borrador breve'}</span>
            </button>
          </div>
        </div>

        {aiError && (
          <div role="alert" className="bg-red-950/70 border border-red-400/50 text-red-100 px-4 py-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
            <span>{aiError}</span>
          </div>
        )}
      </section>

      {statusBanner && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-300 px-4 py-3 text-sm text-emerald-950 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Main Split: Simple Text Editor (Left 7 cols) + Published/Draft List (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Simple Rich Text News Editor */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 border border-neutral-200 bg-white p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
            <div className="flex items-center gap-2.5">
              <Newspaper className="w-5 h-5 text-[#707ef9]" />
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                  {editingId ? 'Editar noticia publicada o borrador' : 'Nueva noticia o anuncio destacado'}
                </h2>
                <p className="text-xs text-neutral-500">
                  Redacta con formato simple (negritas, cursivas, subtítulos, listas y citas) y
                  previsualiza antes de publicar.
                </p>
              </div>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 text-xs font-medium text-neutral-700 hover:border-[#0d0d0d] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear nueva</span>
              </button>
            )}
          </div>

          {formError && (
            <div role="alert" className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="news-category" className="block text-xs font-medium text-neutral-700 mb-1">
                Categoría editorial
              </label>
              <select
                id="news-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NewsCategory)}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
              >
                {NEWS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {NEWS_CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="news-discipline" className="block text-xs font-medium text-neutral-700 mb-1">
                Disciplina asociada
              </label>
              <select
                id="news-discipline"
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value as DisciplineId | 'general')}
                className="w-full bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
              >
                <option value="general">Campeonato General (Todas)</option>
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="news-title" className="text-xs font-medium text-neutral-700">
                Titular *
              </label>
              <span className="text-[11px] text-neutral-400 tabular-nums">{title.length}/160</span>
            </div>
            <input
              id="news-title"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Comienzan los Playoffs de Fútbol 7 Primera División en Complejo UFRO"
              className="w-full border border-neutral-300 px-3.5 py-2.5 text-sm font-medium text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="news-summary" className="text-xs font-medium text-neutral-700">
                Bajada / resumen breve en portada *
              </label>
              <span className="text-[11px] text-neutral-400 tabular-nums">{summary.length}/360</span>
            </div>
            <textarea
              id="news-summary"
              required
              rows={2}
              maxLength={360}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resumen en 1 o 2 frases que aparece en la tarjeta destacada de la página de inicio..."
              className="w-full border border-neutral-300 px-3.5 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            />
          </div>

          {/* Cover Image URL + Quick Gallery 2025 Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="news-cover" className="text-xs font-medium text-neutral-700">
                Fotografía de portada (opcional)
              </label>
              {galleryPhotoChoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPhotoPicker((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#707ef9] hover:text-[#5766eb] cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{showPhotoPicker ? 'Ocultar Galería 2025' : 'Elegir foto de Galería 2025'}</span>
                </button>
              )}
            </div>
            <input
              id="news-cover"
              type="url"
              maxLength={1000}
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://... o selecciona una fotografía oficial abajo"
              className="w-full border border-neutral-300 px-3.5 py-2 text-xs text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
            />
            {showPhotoPicker && galleryPhotoChoices.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 bg-[#f5f6f8] border border-neutral-200">
                {galleryPhotoChoices.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => {
                      setCoverImageUrl(item.url);
                      setShowPhotoPicker(false);
                    }}
                    className={`group relative h-16 overflow-hidden border text-left cursor-pointer ${
                      coverImageUrl === item.url ? 'border-[#707ef9] ring-2 ring-[#707ef9]' : 'border-neutral-300'
                    }`}
                    title={item.label}
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5 truncate">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Simple Text Editor with Toolbar & Live Preview */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="news-content" className="text-xs font-medium text-neutral-700">
                Cuerpo de la noticia (Editor de texto simple) *
              </label>
              <div className="flex items-center gap-1 bg-[#f5f6f8] p-0.5 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditorMode('edit')}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                    editorMode === 'edit' ? 'bg-[#0d0d0d] text-white' : 'text-neutral-600 hover:text-[#0d0d0d]'
                  }`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                    editorMode === 'preview' ? 'bg-[#707ef9] text-white' : 'text-neutral-600 hover:text-[#0d0d0d]'
                  }`}
                >
                  Vista previa
                </button>
              </div>
            </div>

            <div className="border border-neutral-300">
              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 px-2.5 py-2 bg-[#f5f6f8] border-b border-neutral-200">
                <button
                  type="button"
                  onClick={() => handleToolbarAction('bold')}
                  aria-label="Aplicar negrita"
                  title="Negrita (**texto**)"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-700 hover:bg-white hover:text-[#0d0d0d] border border-transparent hover:border-neutral-300 cursor-pointer"
                >
                  <Bold className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Negrita</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToolbarAction('italic')}
                  aria-label="Aplicar cursiva"
                  title="Cursiva (*texto*)"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-700 hover:bg-white hover:text-[#0d0d0d] border border-transparent hover:border-neutral-300 cursor-pointer"
                >
                  <Italic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cursiva</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToolbarAction('heading')}
                  aria-label="Insertar subtítulo"
                  title="Subtítulo (## Título)"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-700 hover:bg-white hover:text-[#0d0d0d] border border-transparent hover:border-neutral-300 cursor-pointer"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Subtítulo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToolbarAction('list')}
                  aria-label="Insertar lista"
                  title="Lista con viñetas (- elemento)"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-700 hover:bg-white hover:text-[#0d0d0d] border border-transparent hover:border-neutral-300 cursor-pointer"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lista</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToolbarAction('quote')}
                  aria-label="Insertar cita"
                  title="Cita destacada (> texto)"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-700 hover:bg-white hover:text-[#0d0d0d] border border-transparent hover:border-neutral-300 cursor-pointer"
                >
                  <Quote className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cita</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToolbarAction('link')}
                  aria-label="Insertar enlace"
                  title="Enlace ([texto](https://...))"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neutral-700 hover:bg-white hover:text-[#0d0d0d] border border-transparent hover:border-neutral-300 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enlace</span>
                </button>
              </div>

              {editorMode === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  id="news-content"
                  required
                  rows={9}
                  maxLength={12000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe aquí el comunicado o crónica... Usa la barra superior para añadir **negritas**, ## subtítulos, listas o citas."
                  className="w-full px-3.5 py-3 text-sm text-[#0d0d0d] leading-relaxed focus:outline-none resize-y"
                />
              ) : (
                <div className="p-4 min-h-[210px] bg-white">
                  <RichTextRenderer content={content} compact />
                </div>
              )}
            </div>
          </div>

          {/* Publication Controls */}
          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-neutral-200">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[#0d0d0d] cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Anuncio destacado en portada</span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-[#0d0d0d] cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="accent-[#707ef9] w-4 h-4"
              />
              <span>Publicar inmediatamente en Inicio</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[#707ef9] hover:bg-[#5766eb] disabled:opacity-50 text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
            >
              {saving
                ? 'Guardando...'
                : editingId
                ? 'Guardar cambios de noticia'
                : published
                ? 'Publicar noticia en Inicio'
                : 'Guardar como borrador'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-3 border border-neutral-300 hover:border-[#0d0d0d] text-xs font-medium text-neutral-700 cursor-pointer"
            >
              Limpiar editor
            </button>
          </div>
        </form>

        {/* Right: Existing News Management Directory */}
        <div className="lg:col-span-5 border border-neutral-200 bg-white">
          <div className="p-5 border-b border-neutral-200 space-y-3 bg-[#f5f6f8]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                Archivo de noticias ({state.news.length})
              </h3>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por titular o autor..."
                aria-label="Buscar noticias"
                className="w-full bg-white border border-neutral-300 pl-9 pr-3 py-2 text-xs text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
              />
            </div>

            <div className="flex flex-wrap gap-1">
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
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-[#0d0d0d] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-600 hover:text-[#0d0d0d]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-200 max-h-[680px] overflow-y-auto">
            {filteredNews.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="font-display text-lg font-bold uppercase text-[#0d0d0d]">
                  Sin noticias en esta vista
                </p>
                <p className="text-xs text-neutral-500">
                  Usa el generador automático arriba o redacta tu primer anuncio destacado en el
                  editor de la izquierda.
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
                      isSelected ? 'bg-[#707ef9]/5 border-l-4 border-[#707ef9]' : 'hover:bg-[#f9fafb]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 font-display font-bold uppercase tracking-wider ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                        {article.featured && (
                          <span className="px-2 py-0.5 bg-[#707ef9]/15 text-[#707ef9] font-bold uppercase">
                            Destacada
                          </span>
                        )}
                        {!article.published && (
                          <span className="px-2 py-0.5 bg-neutral-200 text-neutral-700 font-bold uppercase">
                            Borrador
                          </span>
                        )}
                      </div>
                      <span className="text-neutral-400 tabular-nums shrink-0">
                        {formatShortDate(article.createdAt)}
                      </span>
                    </div>

                    <p className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d] leading-snug">
                      {article.title}
                    </p>
                    <p className="text-xs text-neutral-600 line-clamp-2">{article.summary}</p>
                    <p className="text-[11px] text-neutral-400">
                      Por {article.authorName} · {article.authorRole === 'prensa' ? 'Prensa' : 'Admin'}
                      {article.aiGenerated ? ' · Breve IA' : ''}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => loadForEdit(article)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-neutral-300 hover:border-[#0d0d0d] text-[11px] font-medium text-[#0d0d0d] cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggle(article, 'featured')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-neutral-300 hover:border-[#707ef9] text-[11px] font-medium text-neutral-700 cursor-pointer"
                      >
                        <Star className={`w-3 h-3 ${article.featured ? 'fill-[#707ef9] text-[#707ef9]' : ''}`} />
                        <span>{article.featured ? 'Quitar destacado' : 'Destacar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggle(article, 'published')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-neutral-300 hover:border-[#0d0d0d] text-[11px] font-medium text-neutral-700 cursor-pointer"
                      >
                        {article.published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{article.published ? 'Ocultar' : 'Publicar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingDelete(article)}
                        aria-label={`Eliminar noticia ${article.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 hover:border-red-600 text-[11px] font-medium text-red-700 ml-auto cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
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
        title="Eliminar noticia del campeonato"
        description={
          pendingDelete
            ? `¿Seguro que deseas eliminar permanentemente "${pendingDelete.title}"? Dejará de mostrarse en la portada y se borrará de Firestore.`
            : ''
        }
        confirmLabel="Eliminar definitivamente"
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          await onDeleteNews(target);
          if (editingId === target.id) {
            resetForm();
          }
          setStatusBanner(`Noticia "${target.title}" eliminada correctamente.`);
        }}
      />
    </div>
  );
}
