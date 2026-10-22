"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";

import { Button, type ButtonSize, type ButtonVariant } from "./controls";
import { Icon, type IconName } from "./icons";
import { cx } from "./utils";

export interface TooltipProps {
  content: string;
  children: ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  const trigger = isValidElement(children)
    ? cloneElement(children, { "aria-describedby": id } as Record<string, string>)
    : children;

  return (
    <span className="yas-tooltip">
      {trigger}
      <span id={id} role="tooltip" className="yas-tooltip-content">
        {content}
      </span>
    </span>
  );
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  closeLabel?: string;
  /** Icon tile shown before the title. */
  icon?: IconName;
  /** Sticky action bar at the bottom of the panel. */
  footer?: ReactNode;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  className,
  closeLabel = "Fechar",
  icon,
  footer,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) return;
    // Plays the exit keyframes before the native close, which also restores focus to the opener.
    if (prefersReducedMotion()) {
      dialog.close();
      return;
    }
    dialog.setAttribute("data-closing", "");
    const finish = () => {
      if (dialog.hasAttribute("data-closing")) {
        dialog.removeAttribute("data-closing");
        dialog.close();
      }
    };
    const timer = window.setTimeout(finish, 320);
    dialog.addEventListener("animationend", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      dialog.removeEventListener("animationend", finish);
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx("yas-dialog", className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
    >
      <div className="yas-dialog-inner">
        <div className="yas-dialog-header">
          {icon && (
            <span className="yas-dialog-icon" aria-hidden="true">
              <Icon name={icon} size={22} />
            </span>
          )}
          <div className="yas-dialog-heading">
            <h2 className="yas-dialog-title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="yas-dialog-description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="yas-dialog-close"
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="yas-dialog-body">{children}</div>
        {actions && <div className="yas-cluster">{actions}</div>}
        {footer && <div className="yas-dialog-footer">{footer}</div>}
      </div>
    </dialog>
  );
}

export type DialogProps = Omit<ModalProps, "className">;

export function Dialog(props: DialogProps) {
  return <Modal {...props} />;
}

export interface DrawerProps extends Omit<ModalProps, "className"> {
  /** md ≈ 30rem (forms), lg ≈ 40rem, xl ≈ 64rem (schedules). Full screen below 40rem. */
  size?: "md" | "lg" | "xl";
}

export function Drawer({ size = "md", ...props }: DrawerProps) {
  return <Modal {...props} className={cx("yas-drawer", size !== "md" && `yas-drawer--${size}`)} />;
}

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

function OperationOverlay({
  mode,
  trigger,
  triggerText,
  triggerVariant = "outline",
  triggerSize = "md",
  triggerIcon,
  title,
  description,
  children,
}: {
  mode: "dialog" | "drawer";
  /** Nome acessível do botão; também é o texto visível quando `triggerText` não é informado. */
  trigger: string;
  /** Texto visível mais curto; o nome acessível continua sendo `trigger`. */
  triggerText?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerIcon?: IconName;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const Overlay = mode === "dialog" ? Dialog : Drawer;
  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        aria-disabled={!hydrated}
        {...(triggerText && triggerText !== trigger ? { "aria-label": trigger } : {})}
        {...(triggerIcon ? { leadingIcon: <Icon name={triggerIcon} size={16} /> } : {})}
        onClick={() => {
          if (hydrated) setOpen(true);
        }}
      >
        {triggerText ?? trigger}
      </Button>
      <Overlay
        open={open}
        onOpenChange={setOpen}
        title={title}
        {...(description ? { description } : {})}
      >
        {children}
      </Overlay>
    </>
  );
}

export function DetailDrawer(props: Omit<Parameters<typeof OperationOverlay>[0], "mode">) {
  return <OperationOverlay {...props} mode="drawer" />;
}

export function FormDialog(props: Omit<Parameters<typeof OperationOverlay>[0], "mode">) {
  return <OperationOverlay {...props} mode="dialog" />;
}
