// 수요 측정 (샘플러 가설 검증용). 익명 세션 id + 이벤트명 + 식품코드만 보낸다. 개인정보 없음.
// 저장: Supabase(kangsters-web) 테이블 deukgeun_events / deukgeun_sampler_requests — 익명은 쓰기만 가능, 읽기 불가(RLS).
const SB_URL = "https://ewrvxoinbrjusyjfaxgo.supabase.co/rest/v1";
const SB_KEY = "sb_publishable_mtEfkdjhM38QcA9nOeuedw_qAskqHui"; // 공개용 키 (RLS로 insert만 허용)

export type EventName =
  | "sampler_add" | "sampler_remove" | "sampler_open" | "sampler_submit"
  | "compare_open" | "detail_open" | "taste_view";

function sessionId(): string {
  try {
    let s = sessionStorage.getItem("dg.sid");
    if (!s) {
      s = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("dg.sid", s);
    }
    return s;
  } catch {
    return "nostore";
  }
}

async function post(table: string, body: unknown): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/${table}`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function track(event: EventName, foodCd?: string) {
  if (typeof window === "undefined") return;
  if (/localhost|127\.0\.0\.1/.test(window.location.hostname)) return; // 개발 중 기록 안 함
  void post("deukgeun_events", { event, food_cd: foodCd ?? null, session_id: sessionId() });
}

export type SamplerRequest = {
  items: string[];
  price_band: "under10k" | "10k-15k" | "15k-20k" | "over20k";
  email: string;
  sport: string | null;
  note: string | null;
  consent: true;
};

export function submitSampler(req: SamplerRequest): Promise<boolean> {
  return post("deukgeun_sampler_requests", req);
}
