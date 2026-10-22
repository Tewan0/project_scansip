"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Confirmation = { title: string; description: string; confirmLabel?: string };

export function useConfirmation() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);

  function finish(confirmed: boolean) {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(confirmed);
  }

  function confirm(options: Confirmation): Promise<boolean> {
    // Ignore a second action while the first confirmation is still open.
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => {
      pending.current = resolve;
      setRequest(options);
    });
  }

  const confirmationDialog = request ? (
    <Dialog open onOpenChange={open => { if (!open) finish(false); }}>
      <DialogContent initialFocus={cancelRef}>
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{request.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="outline" onClick={() => finish(false)}>ยกเลิก</Button>
          <Button type="button" variant="destructive" onClick={() => finish(true)}>{request.confirmLabel || "ยืนยัน"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { confirm, confirmationDialog };
}
