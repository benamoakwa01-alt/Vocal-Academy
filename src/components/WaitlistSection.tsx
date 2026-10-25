import WaitlistForm from "./WaitlistForm";

export default function WaitlistSection() {
  return (
    <section id="waitlist" className="mx-auto max-w-6xl px-4 pb-16">
      <div className="grid gap-8 rounded-2xl border border-dashed border-[#D8BC7E] bg-white p-6 sm:p-8 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-[#8a6d2f]">Instrument lessons</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-[#101B2D]">Be the first to know</h2>
          <p className="mt-3 text-[#647084]">
            We are starting with vocals. Tell us which instruments you would like to learn, and we will email you first when lessons open.
          </p>
        </div>
        <WaitlistForm />
      </div>
    </section>
  );
}
