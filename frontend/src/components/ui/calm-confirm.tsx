import { useState, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Calm inline confirmation indicator.
 * Shows a brief ✓ checkmark with gentle fade — no intrusive toast needed.
 * Use for routine saves, copies, and small actions where a toast is overkill.
 *
 * Usage:
 *   const { showConfirm, ConfirmIndicator } = useCalmConfirm();
 *   // After some action:
 *   showConfirm();
 *   // In JSX:
 *   <ConfirmIndicator className="ml-2" />
 */

interface CalmConfirmOptions {
  duration?: number; // ms to show, default 1500
}

export function useCalmConfirm(options?: CalmConfirmOptions) {
  const { duration = 1500 } = options ?? {};
  const [visible, setVisible] = useState(false);

  const showConfirm = useCallback(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  function ConfirmIndicator({ className }: { className?: string }) {
    if (!visible) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 calm-confirm text-emerald-400',
          className
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">Saved</span>
      </span>
    );
  }

  return { showConfirm, visible, ConfirmIndicator };
}
