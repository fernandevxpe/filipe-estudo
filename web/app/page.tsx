import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import DashboardHome from "@/components/DashboardHome";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseUserId } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  noStore();
  if (isSupabaseConfigured()) {
    const uid = await getSupabaseUserId();
    if (!uid) {
      redirect("/login");
    }
  }
  return <DashboardHome />;
}
