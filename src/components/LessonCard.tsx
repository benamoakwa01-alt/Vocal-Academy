"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { joinClass } from "@/app/classes/actions";
import {
  TUTOR_EARLY_START_MINUTES, formatCountdown, getLessonState, type ClassRow,
} from "@/lib/classes";
import LocalTime from "./LocalTime";
import EqBars from "./EqBars";

type Props = {
  cls: ClassRow;
  tutorName: string | null;
  serverNow: number;
  isStaff: boolean;
  heading?: string;
};

const joinBtn = "w-full rounded-xl px-5 py-3 text-center font-semibold sm:w-auto";

export default function LessonCard({ cls, tutorName, serverNow, isStaff, heading }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = getLessonState(cls, now);
  const polling = state === "countdown" || state === "waiting" || state === "preparing";

  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [polling, router]);

  const msToStart = new Date(cls.starts_at).getTime() - now;
  const staffCanStart =
    state === "waiting" || (state === "countdown" && msToStart <= TUTOR_EARLY_START_MINUTES * 60000);

  let title = heading ?? "Your Next Lesson";
  let headline = "";
  let sub = "";

  if (state === "countdown") {
    headline = `Starts in ${formatCountdown(msToStart)}`;
    sub = isStaff ? "You can start the lesson shortly before the scheduled time." : "You can join once your tutor starts the lesson.";
  } else if (state === "waiting") {
    headline = isStaff ? "Your class is scheduled now." : "Your lesson is scheduled now.";
    sub = isStaff ? "Start the lesson when you're ready." : "Waiting for your tutor to start the lesson.";
  } else if (state === "preparing") {
    headline = isStaff ? "Lesson started early" : "Your tutor is getting ready";
    sub = "Joining opens at the scheduled time.";
  } else if (state === "live") {
    title = isStaff ? "Lesson in progress" : "Your Lesson is Ready";
    headline = "Live Now";
  } else if (state === "completed") {
    headline = "This lesson has finished.";
    sub = "Recordings will appear here once they are added.";
  } else if (state === "cancelled") {
    headline = "This lesson was cancelled.";
  } else {
    headline = "This lesson was not held.";
  }

  return (
    <section className={`rounded-2xl p-5 shadow ${state === "live" ? "bg-green-50 ring-2 ring-green-500" : "bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <h2 className="mt-1 text-xl font-bold">{cls.title}</h2>
      <p className="text-sm text-gray-600">
        {tutorName ? `with ${tutorName} · ` : ""}
        <LocalTime iso={cls.starts_at} end={cls.ends_at} />
      </p>
      {cls.description && <p className="mt-2 text-sm text-gray-700">{cls.description}</p>}

      <p className={`mt-4 text-lg font-semibold ${state === "live" ? "text-green-700" : ""}`}>
        {state === "live" && <EqBars className="mr-2 h-4 text-green-600" />}
        {headline}
      </p>
      {sub && <p className="text-sm text-gray-600">{sub}</p>}

      <div className="mt-4">
        {isStaff ? (
          state === "live" ? (
            <Link href={`/classes/${cls.id}`} className={`${joinBtn} inline-block bg-green-600 text-white hover:bg-green-700`}>
              Open live lesson
            </Link>
          ) : staffCanStart ? (
            <Link href={`/classes/${cls.id}`} className={`${joinBtn} inline-block bg-black text-white hover:bg-gray-800`}>
              START LESSON
            </Link>
          ) : state === "countdown" ? (
            <button disabled className={`${joinBtn} cursor-not-allowed bg-gray-200 text-gray-500`}>START LESSON</button>
          ) : (
            <Link href={`/classes/${cls.id}`} className="text-sm underline">View class</Link>
          )
        ) : state === "live" ? (
          <form action={joinClass}>
            <input type="hidden" name="class_id" value={cls.id} />
            <button className={`${joinBtn} bg-green-600 text-white hover:bg-green-700`}>JOIN LESSON</button>
          </form>
        ) : state === "countdown" || state === "waiting" || state === "preparing" ? (
          <button disabled className={`${joinBtn} cursor-not-allowed bg-gray-200 text-gray-500`}>
            {state === "waiting" ? "Waiting for tutor…" : "Join Lesson"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
