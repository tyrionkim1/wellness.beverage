"use client";
// 샘플러 — 수요 측정용(가짜 문). 실제 판매·결제 없음. 담은 조합 + 지불 의향 + 연락처만 받는다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Dataset, Drink, effectiveBasis, fmtNum, fmtSize, loadData, nut } from "@/lib/data";
import { MAX_SAMPLER, useSampler } from "@/lib/compare";
import { SamplerRequest, submitSampler, track } from "@/lib/track";
import { Footer, Header } from "./ui";
import Pack from "./Pack";

const PRICE: { v: SamplerRequest["price_band"]; label: string }[] = [
  { v: "under10k", label: "1만원 미만" },
  { v: "10k-15k", label: "1만~1.5만원" },
  { v: "15k-20k", label: "1.5만~2만원" },
  { v: "over20k", label: "2만원 이상" },
];

export default function SamplerView() {
  const { ids, toggle, clear } = useSampler();
  const [data, setData] = useState<Dataset | null>(null);
  const [price, setPrice] = useState<SamplerRequest["price_band"] | "">("");
  const [email, setEmail] = useState("");
  const [sport, setSport] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    loadData().then(setData).catch(() => setData(null));
    track("sampler_open");
  }, []);

  const items = data ? ids.map((i) => data.byId.get(i)).filter((x): x is Drink => !!x) : [];
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSend = items.length > 0 && !!price && emailOk && consent && state !== "sending";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || !price) return;
    setState("sending");
    const ok = await submitSampler({
      items: items.map((d) => d.id), price_band: price, email: email.trim(),
      sport: sport.trim() || null, note: note.trim() || null, consent: true,
    });
    if (ok) {
      track("sampler_submit");
      setState("done");
      clear();
    } else setState("error");
  };

  return (
    <>
      <Header active="sampler" />
      <main className="wrap">
        <div className="ctitle">
          <h1>먼저 한 캔씩.</h1>
          <p>박스 단위로 사기 전에, 궁금한 음료만 골라 1개씩 맛보는 샘플러를 준비하고 있어요.</p>
        </div>

        {state === "done" ? (
          <div className="done">
            <h3 style={{ margin: 0 }}>신청 완료</h3>
            <p className="note" style={{ fontSize: 13 }}>샘플러가 열리면 가장 먼저 알려드릴게요. 담아주신 조합과 가격은 어떤 음료를 먼저 준비할지 정하는 데만 씁니다.</p>
            <Link href="/" className="btn-line" style={{ display: "inline-block", marginTop: 6 }}>음료 더 둘러보기</Link>
          </div>
        ) : (
          <form className="sform" onSubmit={send}>
            <div className="notebox">
              아직 판매하지 않아요. 지금은 어떤 조합을, 얼마에 원하는지 알려주시면 출시할 때 먼저 연락드리는 사전 신청입니다. 결제 정보는 받지 않습니다.
            </div>

            <fieldset>
              <legend>담은 음료 {items.length}/{MAX_SAMPLER}</legend>
              {!data ? <div className="skel" style={{ height: 80 }} /> : items.length === 0 ? (
                <div className="taste-empty">
                  <span>목록이나 상세 화면에서 ‘+ 샘플러’를 눌러 최대 {MAX_SAMPLER}개까지 담아보세요.</span>
                  <Link href="/" className="btn-acc" style={{ justifySelf: "start" }}>음료 고르러 가기</Link>
                </div>
              ) : (
                <div className="slist">
                  {items.map((d) => {
                    const b = effectiveBasis(d, "pack");
                    return (
                      <div key={d.id} className="sitem">
                        <Pack d={d} className="thumb" />
                        <Link href={`/p/?id=${encodeURIComponent(d.id)}`}>
                          <div className="meta2 mono">{d.maker || "–"}</div>
                          <div className="nm">{d.name}</div>
                          <div className="meta2">{fmtSize(d)} · 단백질 {fmtNum(nut(d, "protein", b))}g · 당류 {fmtNum(nut(d, "sugar", b))}g · {fmtNum(nut(d, "kcal", b))}kcal</div>
                        </Link>
                        <button type="button" className="cbar-clear" style={{ color: "var(--sub)" }} onClick={() => { toggle(d.id); track("sampler_remove", d.id); }}>빼기</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>이 조합({items.length || "N"}개 · 1개씩)에 낼 수 있는 가격은?</legend>
              <div className="radio" role="radiogroup">
                {PRICE.map((p) => (
                  <label key={p.v}>
                    <input type="radio" name="price" value={p.v} checked={price === p.v} onChange={() => setPrice(p.v)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>연락받을 이메일</legend>
              <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </fieldset>

            <fieldset>
              <legend>주로 하는 운동 <span className="note">(선택)</span></legend>
              <input type="text" maxLength={40} placeholder="예: 크로스핏, 하이록스, 러닝, 헬스" value={sport} onChange={(e) => setSport(e.target.value)} />
            </fieldset>

            <fieldset>
              <legend>더 담고 싶은 음료나 하고 싶은 말 <span className="note">(선택)</span></legend>
              <textarea maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            </fieldset>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ accentColor: "var(--acc)", marginRight: 8 }} />
              <b style={{ color: "var(--ink)" }}>[필수] 개인정보 수집·이용 동의</b><br />
              수집 항목: 이메일, 운동 종목(선택) · 목적: 샘플러 출시 안내와 수요 조사 · 보유 기간: 2026년 12월 31일까지 후 파기 ·
              동의하지 않을 수 있으며, 이 경우 신청할 수 없습니다. (KAIST 수업 프로젝트 8조)
            </label>

            {state === "error" ? <p className="note" style={{ color: "var(--acc)" }}>전송에 실패했어요. 잠시 후 다시 시도해 주세요.</p> : null}
            <button type="submit" className="btn-acc" style={{ padding: 16, fontSize: 15, opacity: canSend ? 1 : 0.45 }} disabled={!canSend}>
              {state === "sending" ? "보내는 중…" : "샘플러 사전 신청"}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
