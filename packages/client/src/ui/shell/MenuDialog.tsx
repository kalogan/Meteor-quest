import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Accessible modal dialog scaffold shared by the pause menu and the settings panel.
 *
 * ARIA contract:
 *   - The card is `role="dialog"` + `aria-modal="true"`, named by its title via
 *     `aria-labelledby`.
 *   - On mount, focus moves into the dialog (first focusable, else the card), and on
 *     unmount it returns to whatever was focused before — so keyboard users are never
 *     stranded.
 *   - Tab/Shift-Tab are trapped within the dialog (focus wrap), and Escape calls
 *     `onClose` (the title-screen variant passes no scrim-close to avoid stranding).
 *
 * Purely cosmetic: it touches no sim state. A solid scrim (no opacity dimming of
 * content) sits behind the card; clicking the scrim closes when `onScrimClose` is set.
 */
export function MenuDialog({
  title,
  children,
  onClose,
  onScrimClose,
  labelledBy,
}: {
  title?: ReactNode;
  children: ReactNode;
  /** Escape handler. Omit to make the dialog non-dismissable via keyboard. */
  onClose?: () => void;
  /** When set, clicking the scrim runs this (usually === onClose). */
  onScrimClose?: () => void;
  /** Override the generated label id (when the title lives outside this component). */
  labelledBy?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const titleId = labelledBy ?? generatedId;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    // Move focus into the dialog on open.
    const first = focusables()[0];
    (first ?? card).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      const active = document.activeElement;
      if (e.shiftKey && active === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    card.addEventListener("keydown", onKeyDown);
    return () => {
      card.removeEventListener("keydown", onKeyDown);
      // Restore focus to the launcher on close.
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className={["shell-center", onScrimClose ? "shell-scrim" : null].filter(Boolean).join(" ")}
      onClick={onScrimClose ? (e) => e.target === e.currentTarget && onScrimClose() : undefined}
    >
      <div
        ref={cardRef}
        className="shell-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title || labelledBy ? titleId : undefined}
        tabIndex={-1}
      >
        {title ? (
          <h2 id={titleId} className="shell-menu-heading">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
