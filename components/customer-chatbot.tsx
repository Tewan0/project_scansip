// @refresh reset
"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
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
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const bottom = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { generation.current++; active.current?.abort(); active.current = null; }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, busy, open]);

  async function send(value = question) {
    const content = value.trim();
    if (!enabled || active.current || !content || content.length > 1200) return;
    const controller = new AbortController(); active.current = controller;
    const version = generation.current;
    const history = [...messages, { role: "user" as const, content }].slice(-9);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/customer/chat", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ storeSlug, tableNumber: Number(tableNumber), messages: history.map(({ role, content }) => ({ role, content: content.slice(0, 1200) })) }),
      });
      const result = await response.json();
      if (generation.current !== version) return;
      if (result.sessionExpired) onSessionExpired();
      if (!response.ok || !result.success) throw new Error(result.error || "AI ไม่พร้อม กรุณาลองใหม่");
      setMessages((previous) => [...previous.slice(-18), { role: "user", content }, { role: "assistant", content: result.data.answer, recommendations: result.data.recommendations }]);
      setQuestion("");
    } catch (error) {
      if (generation.current === version && !controller.signal.aborted) setError(error instanceof Error ? error.message : "เชื่อมต่อไม่ได้ กรุณาลองใหม่");
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }

  return <>
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40">
      <Button
        variant="default"
        className="group relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-black/20 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-background cursor-pointer p-0"
        disabled={!enabled}
        onClick={() => setOpen(true)}
        aria-label="ถาม AI ช่วยเลือกเมนู"
      >
        <span className="relative flex items-center justify-center">
          <MessageCircle className="size-6 transition-transform duration-200 group-hover:rotate-12" />
          <span className="sr-only">ถาม AI ช่วยเลือกเมนู</span>
        </span>
        <span className="absolute -top-1 -right-1 flex size-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full size-3 bg-emerald-500 border border-background"></span>
        </span>
      </Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader><DialogTitle>ผู้ช่วยเลือกเมนู AI</DialogTitle><DialogDescription>ถามความชอบ งบประมาณ หรือรายละเอียดเมนูของร้านนี้</DialogDescription></DialogHeader>
        <p className="text-xs text-muted-foreground">ข้อความและข้อมูลเมนูจะส่งให้บริการ AI เพื่อช่วยตอบ หลีกเลี่ยงข้อมูลส่วนตัว · เรื่องแพ้อาหารให้ยืนยันกับพนักงาน</p>
        <div role="log" aria-label="บทสนทนากับ AI" aria-live="polite" className="min-h-32 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {!messages.length && <div className="space-y-2"><p className="text-sm">อยากทานอะไรดีครับ? ลองเลือกคำถาม หรือพิมพ์ถามได้เลย</p><div className="flex flex-wrap gap-2">{["แนะนำเครื่องดื่มไม่หวาน", "มีเมนูไม่เกิน 100 บาทไหม", "สั่งอาหารอย่างไร"].map((prompt) => <Button key={prompt} variant="outline" className="min-h-11 whitespace-normal" disabled={busy} onClick={() => { setQuestion(prompt); void send(prompt); }}>{prompt}</Button>)}</div></div>}
          {messages.map((message, index) => <div key={index} className={`rounded-xl p-3 text-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ${message.role === "user" ? "ml-6 bg-primary/10" : "mr-4 bg-muted"}`}>
            <p className="mb-1 text-xs font-semibold">{message.role === "user" ? "คุณ" : "ผู้ช่วย AI"}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>
            {message.recommendations?.map((item) => <div key={item.id} className="mt-2 rounded-lg border bg-background p-3"><p className="break-words font-medium">{item.name} · ฿{Number(item.price).toFixed(2)}</p><Button className="mt-2 min-h-11" disabled={!enabled} onClick={() => {
              setNotice(onAdd(item.id) ? `เพิ่ม ${item.name} ในตะกร้าแล้ว ปิดแชตเพื่อดูและส่งออเดอร์` : "เพิ่มไม่ได้ เมนูอาจหมดหรือตะกร้าเต็ม กรุณาตรวจรายการเมนูอีกครั้ง");
            }}>เพิ่มในตะกร้า</Button></div>)}
          </div>)}
          {busy && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted mr-4 w-fit animate-in fade-in duration-200">
              <span className="text-xs text-muted-foreground font-medium">AI กำลังดูเมนูให้</span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="size-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="size-1.5 rounded-full bg-primary/60 animate-bounce"></span>
              </span>
            </div>
          )}
          <div ref={bottom} />
        </div>
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <label className="min-w-0 flex-1"><span className="sr-only">คำถามถึง AI</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} rows={2} disabled={busy || !enabled} placeholder="อยากได้เครื่องดื่มแบบไหน…" className="w-full resize-none rounded-lg border bg-background p-3 text-sm" /></label>
          <Button type="submit" className="min-h-11" disabled={busy || !enabled || !question.trim()} aria-label="ส่งคำถาม"><Send className="size-4" /></Button>
        </form>
        <p className="text-xs text-muted-foreground">เพิ่มตะกร้าแล้วต้องตรวจและกดส่งออเดอร์เอง · AI อาจตอบคลาดเคลื่อน</p>
      </DialogContent>
    </Dialog>
  </>;
}
