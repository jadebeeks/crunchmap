import Link from "next/link";

const steps = [
  { title: "Paste your Blackboard link", body: "Blackboard → Calendar → Share Calendar → copy link." },
  { title: "See your next 8 weeks", body: "Every deadline lands on a week map: Calm, Busy or Crunch." },
  { title: "Start early", body: "Clash days are flagged, with a tip on what to start and when." },
];

export default function Landing() {
  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">For IE undergrads</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          Paste your Blackboard calendar link and see which weeks will crunch.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-700">
          Every deadline imported automatically, clashes flagged, start-early tips.
        </p>

        <ol className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-stretch" aria-label="How it works">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 font-bold text-white">
                  {i + 1}
                </span>
                <h2 className="mt-3 font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-700">{step.body}</p>
              </div>
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="self-center text-2xl text-slate-500 sm:rotate-0 rotate-90">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>

        <Link
          href="/signup"
          className="mt-10 inline-block rounded-lg bg-teal-700 px-6 py-3 text-lg font-semibold text-white shadow hover:bg-teal-800"
        >
          Sign up
        </Link>
      </main>
      <footer className="mx-auto max-w-4xl px-4 pb-10 text-sm text-slate-600">
        Student project, not affiliated with IE University.
      </footer>
    </>
  );
}
