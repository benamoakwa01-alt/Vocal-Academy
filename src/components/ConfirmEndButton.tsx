"use client";

export default function ConfirmEndButton() {
  return (
    <button
      onClick={(e) => {
        if (!window.confirm("End this lesson? Before you do: did you press Record, and have you stopped the recording?")) {
          e.preventDefault();
        }
      }}
      className="rounded-lg bg-red-600 px-3 py-1.5 font-medium hover:bg-red-700"
    >
      End lesson
    </button>
  );
}
