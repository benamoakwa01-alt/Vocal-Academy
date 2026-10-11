"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createPromo(formData: FormData) {
  const { supabase } = await requireAdmin();
  const code = get(formData, "code").toUpperCase().replace(/\s+/g, "");
  const type = get(formData, "discount_type");
  const amount = Number(get(formData, "amount"));
  if (!code || !["percent", "fixed"].includes(type) || !isFinite(amount) || amount <= 0 || (type === "percent" && amount > 100)) {
    redirect("/admin/promos?error=invalid");
  }
  const starts = get(formData, "starts_on");
  const ends = get(formData, "expires_on");
  const maxUses = get(formData, "max_uses");

  const { error } = await supabase.from("promo_codes").insert({
    code,
    description: get(formData, "description") || null,
    discount_type: type,
    amount,
    course_id: get(formData, "course_id") || null,
    auto_apply: formData.get("auto_apply") === "on",
    starts_at: starts ? `${starts}T00:00:00Z` : null,
    expires_at: ends ? `${ends}T23:59:59Z` : null,
    max_uses: maxUses ? Math.max(1, parseInt(maxUses, 10) || 1) : null,
  });
  if (error) redirect("/admin/promos?error=exists");
  revalidatePath("/admin/promos");
  redirect("/admin/promos");
}

export async function togglePromo(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("promo_codes").update({ active: formData.get("active") === "true" }).eq("id", get(formData, "id"));
  revalidatePath("/admin/promos");
}

export async function deletePromo(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("promo_codes").delete().eq("id", get(formData, "id"));
  revalidatePath("/admin/promos");
}
