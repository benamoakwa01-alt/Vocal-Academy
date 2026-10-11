import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { money } from "@/lib/pricing";
import ConfirmButton from "@/components/ConfirmButton";
import { cancelRequest, reportPayment } from "../../actions";

export default async function EnrollPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { saved, error } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: course } = await supabase
    .from("courses").select("id, title, slug").eq("slug", slug).maybeSingle();
  if (!course) notFound();

  const { data: e } = await supabase
    .from("enrollments")
    .select("id, status, list_price, discount, amount_due, promo_label, payment_reference, payment_reported_at")
    .eq("course_id", course.id).eq("student_id", user.id).maybeSingle();
  if (!e || e.status !== "pending") redirect(`/courses/${slug}`);

  const { data: setting } = await supabase
    .from("site_settings").select("value").eq("key", "payment_instructions").maybeSingle();

  const ref = `PNEUMA-${String(e.id).slice(0, 6).toUpperCase()}`;
  const details = setting?.value && !setting.value.startsWith("Payment details have not been added")
    ? setting.value.trim()
    : "";
  const reported = !!e.payment_reported_at;

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-xl space-y-5">
        <Link href={`/courses/${slug}`} className="text-sm underline">Back to {course.title}</Link>
        <h1 className="text-2xl font-bold">Complete your enrollment</h1>

        <section className="space-y-2 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">{course.title}</h2>
          <div className="flex justify-between text-sm"><span>Course fee</span><span>{money(Number(e.list_price ?? 0))}</span></div>
          {Number(e.discount) > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>{e.promo_label ?? "Discount"}</span><span>- {money(Number(e.discount))}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
            <span>Amount to pay</span><span>{money(Number(e.amount_due ?? 0))}</span>
          </div>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">How to pay</h2>
          <a href="/payment-card.jpg" target="_blank" rel="noopener noreferrer" className="block">
            <Image src="/payment-card.jpg" alt="Pneuma Music Academy MTN MoMo payment card"
              width={1000} height={1043} className="h-auto w-full rounded-xl" />
          </a>
          <p className="text-xs text-gray-500">Tap the card to open it full size.</p>
          {details && <p className="whitespace-pre-line rounded-lg bg-gray-50 p-3 text-gray-800">{details}</p>}
          <p className="rounded-lg bg-gray-50 p-3 text-sm">
            Use this reference when you pay: <strong>{ref}</strong>
          </p>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow">
          <h2 className="font-semibold">After you have paid</h2>
          {reported && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              Thank you. We have your payment details and the academy will confirm shortly. You will get an email and a notification once your access is active.
            </p>
          )}
          {saved && !reported && <p className="text-sm text-green-700">Saved.</p>}
          {error && (
            <p className="text-sm text-red-600">
              {error === "reference" ? "Please enter your transaction ID or the name you paid under." : "Something went wrong. Please try again."}
            </p>
          )}
          <form action={reportPayment} className="space-y-3">
            <input type="hidden" name="enrollment_id" value={e.id} />
            <input type="hidden" name="slug" value={slug} />
            <label className="block text-sm">Transaction ID, or the name you paid under
              <input name="reference" required defaultValue={e.payment_reference ?? ""}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-black" />
            </label>
            <button className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">
              {reported ? "Update details" : "I have paid"}
            </button>
          </form>
        </section>

        <form action={cancelRequest}>
          <input type="hidden" name="enrollment_id" value={e.id} />
          <input type="hidden" name="slug" value={slug} />
          <ConfirmButton label="Cancel this request"
            message="Cancel this enrollment request? You can enroll again later."
            className="text-sm text-red-600 underline" />
        </form>
      </div>
    </main>
  );
}
