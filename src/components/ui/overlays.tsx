"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { Button } from "./controls";
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
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  className,
  closeLabel = "Fechar",
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
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
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
    >
      <div className="yas-dialog-inner">
        <div className="yas-dialog-header">
          <div>
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
            ×
          </button>
        </div>
        <div>{children}</div>
        {actions && <div className="yas-cluster">{actions}</div>}
      </div>
    </dialog>
  );
}

export type DialogProps = Omit<ModalProps, "className">;

export function Dialog(props: DialogProps) {
  return <Modal {...props} />;
}

export type DrawerProps = Omit<ModalProps, "className">;

export function Drawer(props: DrawerProps) {
  return <Modal {...props} className="yas-drawer" />;
}

function OperationOverlay({
  mode,
  trigger,
  title,
  description,
  children,
}: {
  mode: "dialog" | "drawer";
  trigger: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Overlay = mode === "dialog" ? Dialog : Drawer;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Overlay open={open} onOpenChange={setOpen} title={title} {...(description ? { description } : {})}>
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
