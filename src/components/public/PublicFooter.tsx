import PianoStrip from "@/components/PianoStrip";

export default function PublicFooter() {
  return (
    <footer className="bg-[#0b1423] text-center">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="font-display text-xl text-[#D8BC7E]">Equipping hearts. Elevating sound. Transforming nations.</p>
        <p className="mt-2 text-sm text-[#9aa6bd]">Pneuma Music Academy</p>
      </div>
      <PianoStrip />
    </footer>
  );
}
