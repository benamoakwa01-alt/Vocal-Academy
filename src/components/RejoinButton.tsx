"use client";

export default function RejoinButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="rounded-lg bg-teal-400 px-3 py-1.5 font-medium text-black hover:bg-teal-300"
    >
      Rejoin
    </button>
  );
}
