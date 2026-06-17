import { isSupabaseConfigured } from "@/lib/supabase";

// Supabase 환경 변수가 없을 때 안내 배너를 보여준다.
export function ConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mx-auto mt-4 max-w-xl rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      ⚠️ Supabase 환경 변수가 설정되지 않았습니다. 프로젝트 루트의{" "}
      <code className="rounded bg-amber-100 px-1">.env.local</code> 에{" "}
      <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
      와{" "}
      <code className="rounded bg-amber-100 px-1">
        NEXT_PUBLIC_SUPABASE_ANON_KEY
      </code>{" "}
      를 넣어주세요.
    </div>
  );
}
