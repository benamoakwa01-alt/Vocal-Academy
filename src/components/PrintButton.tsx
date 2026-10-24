"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="no-print inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-[#17253B] hover:bg-gray-50">
      Print or save as PDF
    </button>
  );
}
