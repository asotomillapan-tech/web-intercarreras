import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { buildShareUrl, type EntityDeepLinkType } from '../domain/navigationRoutes';

interface ShareEntityLinkButtonProps {
  entityType: EntityDeepLinkType;
  entityId: string;
  shareTitle: string;
  shareText?: string;
}

export function ShareEntityLinkButton({
  entityType,
  entityId,
  shareTitle,
  shareText,
}: ShareEntityLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = buildShareUrl(window.location.origin, entityType, entityId);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText || shareTitle,
          url,
        });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      aria-label={`Compartir enlace de ${shareTitle}`}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
        copied
          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
          : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.14] text-zinc-200 hover:text-white'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-300" />
          <span>Enlace copiado</span>
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5 text-[#9aa5ff]" />
          <span>Compartir</span>
        </>
      )}
    </button>
  );
}
