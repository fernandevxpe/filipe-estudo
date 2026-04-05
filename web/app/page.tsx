import { unstable_noStore as noStore } from "next/cache";
import DashboardHome from "@/components/DashboardHome";
import HomeLanding from "@/components/HomeLanding";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  noStore();
  if (isSupabaseConfigured()) {
    const uid = await getSupabaseUserId();
    if (!uid) {
      return <HomeLanding />;
    }
  }
  return <DashboardHome />;
}
