"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { useConfirmation } from "@/hooks/use-confirmation";
import { Button } from "@/components/ui/button";

export interface LogoutButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action?: string | ((formData: FormData) => void | Promise<void>);
  formAction?: string;
  formClassName?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  onConfirm?: () => Promise<void> | void;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link";
  size?:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg";
}

export function LogoutButton({
  action: actionProp,
  formAction,
  formClassName,
  confirmTitle = "ยืนยันการออกจากระบบ",
  confirmDescription = "คุณต้องการออกจากระบบใช่หรือไม่?",
  confirmLabel = "ออกจากระบบ",
  onConfirm,
  variant,
  size,
  className,
  children,
  onClick,
  disabled,
  ...props
}: LogoutButtonProps) {
  const action = formAction || actionProp || "/auth/signout";
  const formRef = useRef<HTMLFormElement>(null);
  const { confirm, confirmationDialog } = useConfirmation();
  const [submitting, setSubmitting] = useState(false);

  const { type: _ignoredType, ...buttonRestProps } = props;

  const handleTrigger = async (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || submitting) return;

    e.preventDefault();
    const ok = await confirm({
      title: confirmTitle,
      description: confirmDescription,
      confirmLabel,
    });

    if (ok) {
      setSubmitting(true);
      try {
        if (onConfirm) {
          await onConfirm();
        } else if (typeof action === "function") {
          const formData = new FormData(formRef.current || undefined);
          await action(formData);
        } else {
          if (typeof formRef.current?.submit === "function") {
            formRef.current.submit();
          }
        }
      } catch (err) {
        console.error("Logout error:", err);
        setSubmitting(false);
      }
    }
  };

  return (
    <>
      <form
        ref={formRef}
        action={typeof action === "string" ? action : undefined}
        method="post"
        className={formClassName}
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {variant ? (
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={handleTrigger}
            disabled={disabled || submitting}
            className={className}
            {...buttonRestProps}
          >
            {children}
          </Button>
        ) : (
          <button
            type="button"
            onClick={handleTrigger}
            disabled={disabled || submitting}
            className={className}
            {...buttonRestProps}
          >
            {children}
          </button>
        )}
      </form>
      {confirmationDialog}
    </>
  );
}
