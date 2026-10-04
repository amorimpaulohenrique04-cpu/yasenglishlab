"use client";

import { useState, type ReactNode } from "react";

import { Button } from "./controls";
import { Dialog, Drawer } from "./overlays";

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
