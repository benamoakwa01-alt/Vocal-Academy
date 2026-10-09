import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-6 text-center text-gray-900">
      <h1 className="text-4xl font-bold">Vocal Academy</h1>
      <p className="max-w-md text-gray-600">
        Learn to sing with expert teachers. Book live classes and watch lessons anytime.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-lg bg-black px-5 py-2.5 text-white hover:bg-gray-800">
          Sign up
        </Link>
        <Link href="/login" className="rounded-lg border border-gray-300 px-5 py-2.5 hover:bg-gray-100">
          Log in
        </Link>
      </div>
    </main>
  );
}
