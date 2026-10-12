"use client";

export default function ConfirmButton({
  label, message, className,
}: {
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <button
      data-has-confirm="true"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {label}
    </button>
  );
}
