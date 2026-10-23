// @refresh reset
"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, Plus, ShoppingBag, RotateCw, AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Recommendation = { id: string; name: string; price: string };
type Message = { role: "user" | "assistant"; content: string; recommendations?: Recommendation[] };
export function CustomerChatbot({ storeSlug, tableNumber, sessionToken, enabled, onSessionExpired, onAdd }: {
  storeSlug: string; tableNumber: string; sessionToken: string; enabled: boolean;
  onSessionExpired: () => void; onAdd: (id: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [addFailed, setAddFailed] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [slow, setSlow] = useState(false);
  const [expired, setExpired] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const bottom = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { generation.current++; active.current?.abort(); active.current = null; }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest", behavior: "auto" }); }, [messages, busy, open]);

  async function send(value = question) {
    const content = value.trim();
    if (!enabled || expired || active.current || !content || content.length > 1200) return;
    const controller = new AbortController(); active.current = controller;
    const version = generation.current;
    const history = [...messages, { role: "user" as const, content }].slice(-9);
    setBusy(true); setError(""); setNotice(""); setQuestion(content); setPendingQuestion(content); setSlow(false);
    let timedOut = false;
    const slowTimer = setTimeout(() => { if (active.current === controller) setSlow(true); }, 8000);
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
    try {
      const response = await fetch("/api/customer/chat", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ storeSlug, tableNumber: Number(tableNumber), messages: history.map(({ role, content }) => ({ role, content: content.slice(0, 1200) })) }),
      });
      const result = await response.json();
      if (generation.current !== version) return;
      if (controller.signal.aborted) throw new Error("Request aborted");
      if (result.sessionExpired) {
        setExpired(true); onSessionExpired();
        setError("รอบโต๊ะนี้หมดอายุแล้ว กรุณาสแกน QR ของรอบใหม่"); return;
      }
      if (!response.ok || !result.success) {
        setError(typeof result.error === "string" ? result.error : "ผู้ช่วย AI ไม่พร้อมชั่วคราว คุณยังเลือกเมนูเองได้ตามปกติ"); return;
      }
      if (typeof result.data?.answer !== "string" || !Array.isArray(result.data.recommendations)) throw new Error("Invalid response");
      setMessages((previous) => [...previous.slice(-18), { role: "user", content }, { role: "assistant", content: result.data.answer, recommendations: result.data.recommendations }]);
      setQuestion("");
    } catch {
      if (generation.current === version && (!controller.signal.aborted || timedOut)) setError(timedOut
        ? "AI ใช้เวลาตอบนานเกินไป คำถามยังอยู่ ลองส่งใหม่หรือกลับไปเลือกเมนูได้เลย"
        : "เชื่อมต่อ AI ไม่สำเร็จ คำถามยังอยู่ กรุณาลองใหม่เมื่อพร้อม");
    } finally {
      clearTimeout(slowTimer); clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(false); setSlow(false); }
    }
  }

  return <>
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40">
      <Button
        variant="default"
        className="group relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-black/20 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-background cursor-pointer p-0"
        disabled={!enabled || expired}
        onClick={() => setOpen(true)}
        aria-label="ถาม AI ช่วยเลือกเมนู"
      >
        <span className="relative flex items-center justify-center">
          <MessageCircle className="size-6 transition-transform duration-200 group-hover:rotate-12" />
          <span className="sr-only">ถาม AI ช่วยเลือกเมนู</span>
        </span>
        <span aria-hidden="true" className="absolute -top-1 -right-1 rounded-full border-2 border-background bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-emerald-400 dark:text-emerald-950">AI</span>
      </Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[min(46rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-br from-emerald-500/10 via-background to-background px-4 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Sparkles className="size-5" /></div>
            <div><DialogTitle className="font-semibold">วันนี้ทานอะไรดี?</DialogTitle><DialogDescription className="mt-1 text-xs">ผู้ช่วยเลือกเมนู AI · โต๊ะ {tableNumber}</DialogDescription></div>
          </div>
        </DialogHeader>
        <div role="log" aria-label="บทสนทนากับ AI" aria-live="polite" aria-relevant="additions text" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-muted/20 p-4">
          {!messages.length && !busy && <div className="rounded-2xl border bg-background p-4">
            <p className="font-semibold">บอกความชอบ เดี๋ยวช่วยเลือกให้</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">ถามหาเมนูตามงบหรือรสชาติที่ชอบ โดยอ้างอิงรายการของร้านนี้</p>
            <div className="mt-4 flex flex-col gap-2">{["แนะนำเครื่องดื่มไม่หวาน", "มีเมนูไม่เกิน 100 บาทไหม", "สั่งอาหารอย่างไร"].map((prompt) => <Button key={prompt} variant="outline" className="h-auto min-h-11 justify-between gap-3 whitespace-normal py-2 text-left font-normal" disabled={busy || !enabled || expired} onClick={() => void send(prompt)}>{prompt}<Send className="size-3.5 shrink-0 text-muted-foreground" /></Button>)}</div>
          </div>}
          {messages.map((message, index) => <div key={index} className={`rounded-2xl p-3.5 text-sm leading-relaxed ${message.role === "user" ? "ml-10 rounded-tr-sm bg-primary text-primary-foreground" : "mr-2 rounded-tl-sm border bg-background sm:mr-6"}`}>
            <p className="mb-1 text-xs font-semibold">{message.role === "user" ? "คุณ" : "ผู้ช่วย AI"}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>
            {message.recommendations?.map((item) => <div key={item.id} className="mt-3 rounded-xl border bg-muted/30 p-3 text-foreground">
              <p className="break-words font-semibold">{item.name}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="font-semibold tabular-nums">฿{Number(item.price).toFixed(2)}</span>
              <Button className="min-h-11 gap-1.5" disabled={!enabled || expired} aria-label={`เพิ่ม ${item.name} ในตะกร้า`} onClick={() => {
                const added = onAdd(item.id); setAddFailed(!added);
                setNotice(added ? `เพิ่ม ${item.name} แล้ว กลับไปตรวจตะกร้าและกดส่งออเดอร์ได้เลย` : "เพิ่มไม่ได้ เมนูอาจหมดหรือตะกร้าเต็ม กรุณากลับไปตรวจรายการ");
              }}><Plus className="size-4" />เพิ่มในตะกร้า</Button></div>
            </div>)}
          </div>)}
          {busy && (
            <>
              <div className="ml-10 whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-primary p-3.5 text-sm leading-relaxed text-primary-foreground"><p className="mb-1 text-xs font-semibold">คุณ</p>{pendingQuestion}</div>
              <div role="status" className="mr-4 flex w-fit items-center gap-2 rounded-2xl rounded-tl-sm border bg-background p-3.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
                <span>{slow ? "กำลังรอคำตอบ… เลือกเมนูเองระหว่างรอได้เลย" : "กำลังดูเมนูที่เหมาะกับคุณ"}</span>
              </div>
            </>
          )}
          <div ref={bottom} />
        </div>
        <div className="max-h-[55%] shrink-0 space-y-3 overflow-y-auto border-t bg-background p-4">
          {notice && <p role={addFailed ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${addFailed ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>{addFailed ? <AlertCircle className="size-4 shrink-0" /> : <Check className="size-4 shrink-0" />}{notice}</p>}
          {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p role="alert" className="flex items-start gap-2 text-sm leading-relaxed"><AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />{error}</p>
            {!expired && <Button type="button" variant="outline" className="mt-3 min-h-11" disabled={busy || !enabled || !question.trim()} onClick={() => void send()}><RotateCw className="size-4" />ลองส่งอีกครั้ง</Button>}
          </div>}
          <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <label className="min-w-0 flex-1"><span className="sr-only">คำถามถึง AI</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} rows={2} disabled={busy || !enabled || expired} placeholder="เช่น อยากได้ชาที่ไม่หวาน…" className="block w-full resize-none rounded-xl border bg-muted/30 p-3 text-base leading-relaxed placeholder:text-muted-foreground disabled:opacity-60 sm:text-sm" /></label>
            <Button type="submit" className="size-11 shrink-0 rounded-xl" disabled={busy || !enabled || expired || !question.trim()} aria-label="ส่งคำถาม">{busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Send className="size-4" />}</Button>
          </form>
          <Button type="button" variant="ghost" className="min-h-11 w-full text-muted-foreground" onClick={() => setOpen(false)}><ShoppingBag className="size-4" />กลับไปเลือกเมนู / ดูตะกร้า</Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">คำถามส่งให้บริการ AI · หลีกเลี่ยงข้อมูลส่วนตัว · เรื่องแพ้อาหารให้ยืนยันกับพนักงาน · เพิ่มตะกร้าแล้วต้องกดส่งออเดอร์เอง</p>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
