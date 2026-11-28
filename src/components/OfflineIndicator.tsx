import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2.5 rounded-2xl bg-[#16130b]/95 border border-amber-400/35 px-4 py-2.5 text-xs text-amber-100 shadow-2xl shadow-black/80 backdrop-blur-md"
    >
      <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
      <span>Sin conexión — Mostrando horarios y tablas guardadas en tu dispositivo.</span>
    </div>
  );
}
