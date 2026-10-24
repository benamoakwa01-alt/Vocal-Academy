"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";

export async function saveAttendance(formData: FormData) {
  const { supabase, user, profile } = await requireAccess();
  if (profile.role === "student") redirect("/dashboard");
  const classId = String(formData.get("class_id") ?? "");
  const ids = formData.getAll("student_id").map(String).filter(Boolean);

  // The database only lets the class tutor or an admin change this.
  for (const sid of ids) {
    const v = String(formData.get(`s_${sid}`) ?? "absent");
    if (v === "absent") {
      await supabase.from("attendance").delete().eq("class_id", classId).eq("student_id", sid);
    } else {
      await supabase.from("attendance").upsert(
        { class_id: classId, student_id: sid, status: v === "excused" ? "excused" : "present", marked_by: user.id },
        { onConflict: "class_id,student_id" }
      );
    }
  }
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/grades");
  redirect(`/classes/${classId}`);
}
