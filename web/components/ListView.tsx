"use client";
// FR-1 목록 · FR-2 필터 · FR-5 검색 · FR-6 프리셋 · FR-7 업데이트 표시 · 카드 숫자 선택 · 원재료 필터
import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { Dataset, loadData } from "@/lib/data";
import {
  activeCount, applyPreset, CAFFEINE_OPTS, EMPTY, EXCLUDE_OPTS, FEATURE_OPTS, FIBER_OPTS, Filters, fromQuery, KCAL_OPTS,
  PRESETS, presetActive, PROTEIN_OPTS, run, SUGAR_OPTS, SWEET_OPTS, toQuery,
} from "@/lib/filters";
import { SLOT_OPTIONS, SlotKey, useSlots } from "@/lib/prefs";
import { CompareBar, Footer, Header, ProductCard, UpdateStrip, useToggleCompare, useToggleSampler } from "./ui";

const PAGE = 40;

function Row<T extends string | number>({ label, opts, value, onPick, fmt }: {
  label: string; opts: T[]; value: T | null; onPick: (v: T | null) => void; fmt: (v: T) => React.ReactNode;
}) {
  return (
    <div className="frow">
      <span>{label}</span>
      <div className="chips" role="group" aria-label={label}>
        {opts.map((v) => (
          <button key={String(v)} type="button" className={`chip${value === v ? " on" : ""}`} aria-pressed={value === v}
            onClick={() => onPick(value === v ? null : v)}>
            {fmt(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Multi({ label, opts, value, onChange, note }: {
  label: string; opts: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; note?: string;
}) {
  return (
    <div className="fgroup">
      <span className="flabel">{label}</span>
      <div className="chips wrap-chips" role="group" aria-label={label}>
        {opts.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>
              {o.label}
            </button>
          );
        })}
      </div>
      {note ? <p className="hint">{note}</p> : null}
    </div>
  );
}

export default function ListView() {
  const sp = useSearchParams();
  const [data, setData] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Filters>(() => fromQuery(new URLSearchParams(sp.toString())));
  const [limit, setLimit] = useState(PAGE);
  const advancedInit = f.kcal !== null || f.fiber !== null || f.feats.length + f.excl.length + f.sweet.length + f.types.length > 0 || !f.bulk;
  const [showMore, setShowMore] = useState(advancedInit);
  const [slotEdit, setSlotEdit] = useState(false);
  const { ids, onToggle } = useToggleCompare();
  const { samplerIds, onSampler } = useToggleSampler();
  const { slots, save } = useSlots();
  const qDeferred = useDeferredValue(f.q);

  useEffect(() => {
    loadData().then(setData).catch((e) => setErr(String(e.message || e)));
  }, []);

  // 필터 → URL (공유·새로고침 유지). history API 직접 사용: 정적 배포에서 서버 왕복 없이 주소만 바꾼다
  useEffect(() => {
    const t = setTimeout(() => {
      const next = `${window.location.pathname}${toQuery(f)}`;
      if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  const fEff = useMemo(() => ({ ...f, q: qDeferred }), [f, qDeferred]);
  const res = useMemo(() => (data ? run(data.drinks, fEff, data.tagDefs, data.sweetDefs) : null), [data, fEff]);
  useEffect(() => setLimit(PAGE), [fEff]);

  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch }));
  const s = data?.summary ?? null;
  const n = activeCount(f);
  const ingrPct = s?.ingredientCount ? Math.round((s.ingredientCount / s.count) * 100) : 0;

  const pickSlot = (i: number, k: SlotKey) => {
    const next = slots.slice();
    const j = next.indexOf(k);
    if (j >= 0) next[j] = next[i]; // 이미 다른 칸에 있으면 자리 바꿈
    next[i] = k;
    save(next);
  };

  return (
    <>
      <Header active="list" />
      <main>
        <section className="wrap hero">
          <h1>숫자로 고른다.</h1>
          <p>단백질 · 당류 · 열량 · 원재료. 성분표만 나란히.</p>
        </section>
        <UpdateStrip s={s} />

        <section className="wrap controls" aria-label="검색과 필터">
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <span className="sr">제품명 또는 제조사 검색</span>
            <input type="search" inputMode="search" placeholder="제품명 · 제조사 검색" value={f.q}
              onChange={(e) => set({ q: e.target.value })} enterKeyHint="search" />
            {f.q ? <button type="button" className="clear" onClick={() => set({ q: "" })}>지우기</button> : null}
          </label>

          <div className="fgroup">
            <Row label="단백질" opts={PROTEIN_OPTS} value={f.protein} onPick={(v) => set({ protein: v })} fmt={(v) => <><span className="mono">{v}g</span> 이상</>} />
            <Row label="당류" opts={SUGAR_OPTS} value={f.sugar} onPick={(v) => set({ sugar: v })} fmt={(v) => <><span className="mono">{v}g</span> 이하</>} />
            <Row label="카페인" opts={CAFFEINE_OPTS.map((o) => o.v)} value={f.caffeine || null}
              onPick={(v) => set({ caffeine: (v || "") as Filters["caffeine"] })}
              fmt={(v) => <span className="mono">{CAFFEINE_OPTS.find((o) => o.v === v)?.label}</span>} />
          </div>

          <div className="fgroup">
            <span className="flabel">PRESET</span>
            <div className="chips presets" role="group" aria-label="자주 쓰는 필터 조합">
              {PRESETS.map((p) => {
                const on = presetActive(f, p.f);
                return (
                  <button key={p.id} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on}
                    onClick={() => { setF(on ? { ...EMPTY, q: f.q, sort: f.sort } : { ...applyPreset(p.f), q: f.q, sort: f.sort }); if (!on && (p.f.feats || p.f.excl || p.f.sweet || p.f.kcal)) setShowMore(true); }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="hint">프리셋은 필터 조합입니다. 추천이 아닙니다.</p>
          </div>

          {showMore ? (
            <div className="more-panel">
              <div className="fgroup">
                <Row label="열량" opts={KCAL_OPTS} value={f.kcal} onPick={(v) => set({ kcal: v })} fmt={(v) => <><span className="mono">{v}kcal</span> 이하</>} />
                <Row label="식이섬유" opts={FIBER_OPTS} value={f.fiber} onPick={(v) => set({ fiber: v })} fmt={(v) => <><span className="mono">{v}g</span> 이상</>} />
                {s?.fiberCount !== undefined ? <p className="hint">식이섬유 값이 있는 제품은 {s.fiberCount.toLocaleString("ko-KR")}개뿐이에요. 대신 ‘식이섬유 원료’ 필터를 써보세요.</p> : null}
              </div>
              <Multi label="INGREDIENT · 원재료에 들어 있음" opts={FEATURE_OPTS} value={f.feats} onChange={(v) => set({ feats: v })} />
              <Multi label="FREE FROM · 원재료에 없음" opts={EXCLUDE_OPTS} value={f.excl} onChange={(v) => set({ excl: v })} />
              <Multi label="SWEETENER · 감미료 (하나라도 포함)" opts={SWEET_OPTS} value={f.sweet} onChange={(v) => set({ sweet: v })}
                note={`원재료명 기준 · 원재료 확보 ${ingrPct}% · 원재료가 없는 제품은 이 필터에서 제외돼요. 효능·인증을 뜻하지 않습니다.`} />
              <Multi label="TYPE · 식약처 분류" opts={(data?.types ?? []).map((t) => ({ id: t, label: `${t} ${s?.byType[t]?.toLocaleString("ko-KR") ?? ""}` }))}
                value={f.types} onChange={(v) => set({ types: v })} />
              <label className="toggle">
                <input type="checkbox" checked={f.bulk} onChange={(e) => set({ bulk: e.target.checked })} />
                500ml(g) 넘는 대용량 포함 (100ml 기준으로 표시)
              </label>
              <button type="button" className="more-f" onClick={() => setShowMore(false)}>필터 접기</button>
            </div>
          ) : (
            <button type="button" className="more-f" onClick={() => setShowMore(true)}>
              필터 더보기 — 열량 · 식이섬유 · 원재료(유산균·식물성·락토프리…) · 감미료
            </button>
          )}
        </section>

        <section className="wrap" aria-live="polite">
          <div className="rhead">
            <div className="rcount">
              {res ? (
                <>
                  <b>{res.items.length.toLocaleString("ko-KR")}</b>개 일치
                  {res.excludedNoInfo ? <small>정보 없음 {res.excludedNoInfo.toLocaleString("ko-KR")}개 제외</small> : null}
                </>
              ) : err ? null : "불러오는 중…"}
              {n ? (
                <button type="button" className="cbar-clear" style={{ color: "var(--sub)" }} onClick={() => setF({ ...EMPTY, sort: f.sort })}>필터 {n}개 초기화</button>
              ) : null}
            </div>
            <div className="rtools">
              <button type="button" className={`slot-btn${slotEdit ? " on" : ""}`} onClick={() => setSlotEdit((v) => !v)} aria-expanded={slotEdit}>
                카드 숫자 바꾸기
              </button>
              <div className="sort" role="group" aria-label="정렬">
                <button type="button" className={f.sort === "recent" ? "on" : ""} onClick={() => set({ sort: "recent" })}>최근 등록순</button>
                <button type="button" className={f.sort === "name" ? "on" : ""} onClick={() => set({ sort: "name" })}>이름순</button>
              </div>
            </div>
          </div>

          {slotEdit ? (
            <div className="slot-panel">
              {slots.map((k, i) => (
                <div key={i} className="frow">
                  <span className="mono">{i + 1}번 칸</span>
                  <div className="chips">
                    {SLOT_OPTIONS.map((o) => (
                      <button key={o.key} type="button" className={`chip${k === o.key ? " on" : ""}`} onClick={() => pickSlot(i, o.key)}>{o.label}</button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="hint">고른 숫자는 이 기기에만 저장돼요. ‘단백질 비중’ = 열량 중 단백질에서 오는 비율.</p>
            </div>
          ) : null}

          {err ? (
            <div className="empty"><h3>데이터를 불러오지 못했어요</h3><p>{err}</p></div>
          ) : !res || !data ? (
            <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" />)}</div>
          ) : res.items.length === 0 ? (
            <Empty q={f.q} caffeine={!!f.caffeine} caffeineCount={s?.caffeineCount ?? 0} />
          ) : (
            <>
              <div className="grid">
                {res.items.slice(0, limit).map((d) => (
                  <ProductCard key={d.id} d={d} selected={ids.includes(d.id)} onToggle={onToggle} slots={slots}
                    tagDefs={data.tagDefs} sweetDefs={data.sweetDefs} inSampler={samplerIds.includes(d.id)} onSampler={onSampler} />
                ))}
              </div>
              {limit < res.items.length ? (
                <button type="button" className="loadmore" onClick={() => setLimit((l) => l + PAGE)}>
                  더 보기 <span className="mono" style={{ color: "var(--sub)" }}>{Math.min(limit, res.items.length)} / {res.items.length.toLocaleString("ko-KR")}</span>
                </button>
              ) : <div style={{ height: 96 }} />}
            </>
          )}
        </section>
      </main>
      <Footer />
      <CompareBar />
    </>
  );
}

// FR-5 수용 기준: 결과가 없으면 "DB에 없는 제품"임을 밝히고 미적재 이유를 안내
function Empty({ q, caffeine, caffeineCount }: { q: string; caffeine: boolean; caffeineCount: number }) {
  if (caffeine && caffeineCount === 0) {
    return (
      <div className="empty">
        <h3>카페인 함량(mg)은 입력 중이에요</h3>
        <p>식약처 영양성분DB에는 카페인 항목이 없어서, 제품 표시사항을 보고 약사 확인을 거쳐 한 개씩 입력하고 있습니다. 현재 입력된 제품 {caffeineCount}개.</p>
        <p>대신 ‘필터 더보기 → 원재료에 없음 → 카페인 원료 없음’으로 커피·녹차·과라나 등이 들어가지 않은 음료를 찾을 수 있어요.</p>
      </div>
    );
  }
  return (
    <div className="empty">
      <h3>{q ? `‘${q}’ — DB에 없는 제품이에요` : "조건에 맞는 제품이 없어요"}</h3>
      <p>득근음료는 식약처 식품영양성분DB의 ‘음료류’ 중 바로 마시는 음료만 보여줍니다. 이런 경우 목록에 없을 수 있어요.</p>
      <ul>
        <li>식약처 DB에 아직 등록되지 않은 제품</li>
        <li>우유·가공유·특수영양식품 등 ‘음료류’가 아닌 분류로 등록된 제품 (일부 프로틴 쉐이크 포함)</li>
        <li>원두·분말·농축액처럼 물에 타서 먹는 제품</li>
      </ul>
      <p>제품명 일부나 제조사명으로도 검색해 보세요.</p>
    </div>
  );
}
