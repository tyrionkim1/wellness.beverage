"use client";
// FR-1 목록 · FR-2 필터 3종 · FR-5 검색 · FR-6 프리셋 · FR-7 업데이트 표시
import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import { Dataset, loadData } from "@/lib/data";
import {
  applyPreset, CAFFEINE_OPTS, EMPTY, Filters, fromQuery, PRESETS, presetActive, PROTEIN_OPTS, run, SUGAR_OPTS, toQuery,
} from "@/lib/filters";
import { CompareBar, Footer, Header, ProductCard, UpdateStrip, useToggleCompare } from "./ui";

const PAGE = 40;

export default function ListView() {
  const sp = useSearchParams();
  const [data, setData] = useState<Dataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Filters>(() => fromQuery(new URLSearchParams(sp.toString())));
  const [limit, setLimit] = useState(PAGE);
  const [showTypes, setShowTypes] = useState(f.types.length > 0);
  const { ids, onToggle } = useToggleCompare();
  const qDeferred = useDeferredValue(f.q);

  useEffect(() => {
    loadData().then(setData).catch((e) => setErr(String(e.message || e)));
  }, []);

  // 필터 → URL (공유·새로고침 유지)
  useEffect(() => {
    // history API 직접 사용: 정적 배포에서 서버 왕복 없이 주소만 바꾼다
    const t = setTimeout(() => {
      const next = `${window.location.pathname}${toQuery(f)}`;
      if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  const fEff = useMemo(() => ({ ...f, q: qDeferred }), [f, qDeferred]);
  const res = useMemo(() => (data ? run(data.drinks, fEff) : null), [data, fEff]);
  useEffect(() => setLimit(PAGE), [fEff]);

  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch }));
  const toggleType = (t: string) => set({ types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] });
  const anyFilter = f.protein !== null || f.sugar !== null || !!f.caffeine || f.types.length > 0 || !f.bulk;
  const s = data?.summary ?? null;

  return (
    <>
      <Header active="list" />
      <main>
        <section className="wrap hero">
          <h1>숫자로 고른다.</h1>
          <p>단백질 · 당류 · 카페인. 성분표만 나란히.</p>
        </section>
        <UpdateStrip s={s} />

        <section className="wrap controls" aria-label="검색과 필터">
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <span className="sr">제품명 또는 제조사 검색</span>
            <input
              type="search"
              inputMode="search"
              placeholder="제품명 · 제조사 검색"
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              enterKeyHint="search"
            />
            {f.q ? <button type="button" className="clear" onClick={() => set({ q: "" })}>지우기</button> : null}
          </label>

          <div className="fgroup">
            <div className="frow">
              <span>단백질</span>
              <div className="chips" role="group" aria-label="단백질 이상">
                {PROTEIN_OPTS.map((v) => (
                  <button key={v} type="button" className={`chip${f.protein === v ? " on" : ""}`} aria-pressed={f.protein === v}
                    onClick={() => set({ protein: f.protein === v ? null : v })}>
                    <span className="mono">{v}g</span> 이상
                  </button>
                ))}
              </div>
            </div>
            <div className="frow">
              <span>당류</span>
              <div className="chips" role="group" aria-label="당류 이하">
                {SUGAR_OPTS.map((v) => (
                  <button key={v} type="button" className={`chip${f.sugar === v ? " on" : ""}`} aria-pressed={f.sugar === v}
                    onClick={() => set({ sugar: f.sugar === v ? null : v })}>
                    <span className="mono">{v}g</span> 이하
                  </button>
                ))}
              </div>
            </div>
            <div className="frow">
              <span>카페인</span>
              <div className="chips" role="group" aria-label="카페인">
                {CAFFEINE_OPTS.map((o) => (
                  <button key={o.v} type="button" className={`chip${f.caffeine === o.v ? " on" : ""}`} aria-pressed={f.caffeine === o.v}
                    onClick={() => set({ caffeine: f.caffeine === o.v ? "" : o.v })}>
                    <span className="mono">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="fgroup">
            <span className="flabel">PRESET</span>
            <div className="chips presets" role="group" aria-label="자주 쓰는 필터 조합">
              {PRESETS.map((p) => {
                const on = presetActive(f, p.f);
                return (
                  <button key={p.id} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on}
                    onClick={() => setF(on ? { ...EMPTY, q: f.q, sort: f.sort } : { ...applyPreset(p.f), q: f.q, sort: f.sort })}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="hint">프리셋은 필터 조합입니다. 추천이 아닙니다.</p>
          </div>

          {showTypes ? (
            <div className="fgroup">
              <span className="flabel">TYPE · 식약처 분류</span>
              <div className="chips" role="group" aria-label="음료 종류">
                {(data?.types ?? []).map((t) => (
                  <button key={t} type="button" className={`chip${f.types.includes(t) ? " on" : ""}`} aria-pressed={f.types.includes(t)} onClick={() => toggleType(t)}>
                    {t} <span className="mono" style={{ opacity: .6 }}>{s?.byType[t]?.toLocaleString("ko-KR")}</span>
                  </button>
                ))}
              </div>
              <label className="toggle">
                <input type="checkbox" checked={f.bulk} onChange={(e) => set({ bulk: e.target.checked })} />
                500ml(g) 넘는 대용량 포함 (100ml 기준으로 표시)
              </label>
            </div>
          ) : (
            <button type="button" className="more-f" onClick={() => setShowTypes(true)}>음료 종류 · 대용량 필터 열기</button>
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
              {anyFilter ? (
                <button type="button" className="cbar-clear" style={{ color: "var(--sub)" }} onClick={() => setF({ ...EMPTY, sort: f.sort })}>필터 초기화</button>
              ) : null}
            </div>
            <div className="sort" role="group" aria-label="정렬">
              <button type="button" className={f.sort === "recent" ? "on" : ""} onClick={() => set({ sort: "recent" })}>최근 등록순</button>
              <button type="button" className={f.sort === "name" ? "on" : ""} onClick={() => set({ sort: "name" })}>이름순</button>
            </div>
          </div>

          {err ? (
            <div className="empty"><h3>데이터를 불러오지 못했어요</h3><p>{err}</p></div>
          ) : !res ? (
            <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" />)}</div>
          ) : res.items.length === 0 ? (
            <Empty q={f.q} caffeine={!!f.caffeine} caffeineCount={s?.caffeineCount ?? 0} />
          ) : (
            <>
              <div className="grid">
                {res.items.slice(0, limit).map((d) => (
                  <ProductCard key={d.id} d={d} selected={ids.includes(d.id)} onToggle={onToggle} />
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
        <h3>카페인 정보는 입력 중이에요</h3>
        <p>식약처 영양성분DB에는 카페인 항목이 없어서, 제품 표시사항을 보고 약사 확인을 거쳐 한 개씩 입력하고 있습니다. 현재 입력된 제품 {caffeineCount}개.</p>
      </div>
    );
  }
  return (
    <div className="empty">
      <h3>{q ? `‘${q}’ — DB에 없는 제품이에요` : "조건에 맞는 제품이 없어요"}</h3>
      <p>청담음료는 식약처 식품영양성분DB의 ‘음료류’ 중 바로 마시는 음료만 보여줍니다. 이런 경우 목록에 없을 수 있어요.</p>
      <ul>
        <li>식약처 DB에 아직 등록되지 않은 제품</li>
        <li>우유·가공유·특수영양식품 등 ‘음료류’가 아닌 분류로 등록된 제품 (일부 프로틴 쉐이크 포함)</li>
        <li>원두·분말·농축액처럼 물에 타서 먹는 제품</li>
      </ul>
      <p>제품명 일부나 제조사명으로도 검색해 보세요.</p>
    </div>
  );
}
