import type { Metadata } from "next";
import { Logo, Wordmark } from "@/components/Logo";
import { HeroDemo, StepYears, StepPicks, StepEdit, FanDemo, DocsDemo, ChecksDemo, VtlmDemo } from "@/components/landing/Demos";
import { ClockProvider } from "@/components/landing/Clock";
import { Icon, ICONS } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db";
import { OUTPUT_TYPES } from "@/lib/generator/outputs";
import { CONTACT_EMAIL, FAQ, HOME_DESCRIPTION, HOME_TITLE, LEARNING_AREAS, SITE_NAME, SITE_URL } from "@/lib/ui/landing-content";
import { OUTPUT_UI } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: SITE_NAME, title: HOME_TITLE, description: HOME_DESCRIPTION, locale: "en_AU" },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION },
  robots: { index: true, follow: true },
};

/** Structured data for search engines. The FAQ is the same text as the page shows. */
function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        email: CONTACT_EMAIL,
        logo: `${SITE_URL}/apple-icon.png`,
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: CONTACT_EMAIL, areaServed: "AU-VIC", availableLanguage: "en-AU" },
      },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, inLanguage: "en-AU", publisher: { "@id": `${SITE_URL}/#organization` } },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        description: HOME_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: "en-AU",
        audience: { "@type": "EducationalAudience", educationalRole: "teacher" },
        areaServed: { "@type": "AdministrativeArea", name: "Victoria, Australia" },
        publisher: { "@id": `${SITE_URL}/#organization` },
        featureList: [
          "Lesson plans, unit plans and activities",
          "Worksheets, quizzes and rubrics",
          "Three-level tasks and notes for families",
          "Victorian Curriculum F–10 Version 2.0 alignment",
          "Composite class planning",
          "Edit, rewrite and undo",
          "Print and Word download",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}

const H2 = "m-0 font-display text-[clamp(32px,4.2vw,46px)] font-bold leading-[1.08] tracking-[-0.02em]";
const EYEBROW = "m-0 text-sm font-bold uppercase tracking-[0.1em] text-euc";
const H3_BENEFIT = "m-0 font-display text-[clamp(28px,3.4vw,36px)] font-bold leading-[1.1] tracking-[-0.015em]";

function StepCard({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-[1_1_320px] flex-col gap-3.5 rounded-2xl border border-[#D9DDD3] bg-white p-[26px]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-bold text-white">{n}</span>
      <h3 className="m-0 font-display text-[25px] font-bold leading-[1.15]">{title}</h3>
      <p className="m-0 text-ink-soft">{text}</p>
      {children}
    </li>
  );
}

export default async function HomePage() {
  const signedIn = isDbConfigured() ? Boolean(await getCurrentUser()) : true; // local mode has no accounts
  const start = signedIn ? { href: "/plan", label: "Open Lessonroo" } : { href: "/login", label: "Start planning" };
  const json = JSON.stringify(structuredData()).replace(/</g, "\\u003c");

  return (
    <div className="min-h-screen bg-paper text-[18px] leading-[1.55] text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />

      <header className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-[18px] print:hidden">
        <a href="#top" aria-label="Lessonroo home" className="flex items-center text-ink no-underline hover:text-ink">
          <Logo size={40} textClass="text-[26px]" />
        </a>
        <nav aria-label="Main" className="flex flex-[1_1_auto] flex-wrap gap-0.5 text-base">
          {[
            ["#how", "How it works"],
            ["#make", "What you can make"],
            ["#curriculum", "Curriculum"],
            ["#faq", "Questions"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-[10px] px-3 py-2.5 text-ink-soft no-underline hover:bg-[#EEF0EA] hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft">
          <Icon d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" size={14} />
          Victoria, Australia
        </span>
        {signedIn ? (
          <a href="/plan" className="px-3.5 py-2.5 font-bold text-ink no-underline hover:text-ink">Open Lessonroo</a>
        ) : (
          <a href="/login" className="px-3.5 py-2.5 font-bold text-ink no-underline hover:text-ink">Sign in</a>
        )}
      </header>

      <main id="top">
        <ClockProvider>
          {/* ---------- hero ---------- */}
          <section aria-labelledby="hero-title" className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 pb-[88px] pt-9">
            <div className="flex flex-[1_1_460px] flex-col gap-6">
              <p className={EYEBROW}>For Prep to Year 6 teachers in Victoria</p>
              <h1 id="hero-title" className="m-0 font-display text-[clamp(42px,6.2vw,70px)] font-bold leading-[1.02] tracking-[-0.03em]">
                Ready-to-teach lessons from a rough idea.
              </h1>
              <p className="m-0 max-w-[34em] text-xl text-ink-soft">
                Type what you want to teach, or upload the plan you already have. Lessonroo writes a timed lesson plan, worksheet, rubric or quiz matched to the
                Victorian Curriculum F–10 Version 2.0. Then you edit it until it sounds like you.
              </p>
              <div className="mt-1 flex flex-wrap gap-3.5">
                <a className="btn-main" href={start.href}>{start.label}</a>
                <a className="btn-line" href="#how">See how it works</a>
              </div>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-[22px] gap-y-2 p-0 text-[15px] text-ink-soft">
                <li>All learning areas</li>
                <li>Prep to Year 6</li>
                <li>Composite classes</li>
                <li>Print or Word</li>
              </ul>
            </div>
            <HeroDemo />
          </section>

          {/* ---------- how it works ---------- */}
          <section id="how" aria-labelledby="how-title" className="border-y border-[#E3E6DE] bg-mist">
            <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-6 py-[88px]">
              <div className="flex max-w-[36em] flex-col gap-3">
                <p className={EYEBROW}>How it works</p>
                <h2 id="how-title" className={H2}>Three steps, and the last one is yours.</h2>
              </div>
              <ol className="m-0 flex list-none flex-wrap gap-6 p-0">
                <StepCard n={1} title="Tell it about your class" text="Pick the year, or two years for a composite class, the subject and how long the lesson runs.">
                  <StepYears />
                </StepCard>
                <StepCard n={2} title="Say what you need" text="Choose a lesson plan, worksheet, quiz or PowerPoint slides or any of nine kinds of material. Then type your idea, and upload a plan, slides or a reading for reference.">
                  <StepPicks />
                </StepCard>
                <StepCard n={3} title="Make it yours" text="Edit any word, have the AI rewrite just one section, and undo anything. Print it, or download it as a Word file.">
                  <StepEdit />
                </StepCard>
              </ol>
            </div>
          </section>

          {/* ---------- benefits ---------- */}
          <section aria-labelledby="why-title" className="mx-auto flex max-w-[1240px] flex-col gap-24 px-6 pb-10 pt-24">
            <div className="flex max-w-[36em] flex-col gap-3">
              <p className={EYEBROW}>Why teachers use it</p>
              <h2 id="why-title" className={H2}>Less time at the desk. Better material in the room.</h2>
            </div>

            <div className="flex flex-wrap items-center gap-12">
              <div className="flex flex-[1_1_380px] flex-col gap-3.5">
                <h3 className={H3_BENEFIT}>Save hours of work a week.</h3>
                <p className="m-0 text-ink-soft">
                  One idea becomes the lesson, the worksheet, the quiz, the rubric and the note home. Timings add up to the minute, and if they ever don&apos;t, one click fixes them.
                </p>
                <p className="m-0 -rotate-[1.5deg] font-hand text-[28px] leading-[1.1] text-[#20336B]">no more starting from a blank page</p>
              </div>
              <FanDemo />
            </div>

            <div className="flex flex-row-reverse flex-wrap items-center gap-12">
              <div className="flex flex-[1_1_380px] flex-col gap-3.5">
                <h3 className={H3_BENEFIT}>The same words, everywhere.</h3>
                <p className="m-0 text-ink-soft">
                  Materials made together share vocabulary, examples and learning intentions. Students meet the same language in the lesson, on the worksheet and in the quiz, so the learning sticks.
                </p>
              </div>
              <DocsDemo />
            </div>

            <div className="flex flex-wrap items-center gap-12">
              <div className="flex flex-[1_1_380px] flex-col gap-3.5">
                <h3 className={H3_BENEFIT}>More than a first draft.</h3>
                <p className="m-0 text-ink-soft">
                  Every plan cites real curriculum codes and follows the Victorian Teaching and Learning Model 2.0. Reading lessons for Prep to Year 2 use structured phonics. Student copies leave the answers out.
                  You stay the teacher: you review, edit and decide.
                </p>
              </div>
              <ChecksDemo />
            </div>
          </section>

          {/* ---------- what you can make ---------- */}
          <section id="make" aria-labelledby="make-title" className="mx-auto flex max-w-[1240px] flex-col gap-10 px-6 pb-24 pt-[88px]">
            <div className="flex max-w-[36em] flex-col gap-3">
              <p className={EYEBROW}>What you can make</p>
              <h2 id="make-title" className={H2}>Nine kinds of teaching material.</h2>
              <p className="m-0 text-ink-soft">All of them are linked to the Victorian Curriculum, and you can make several from the same idea.</p>
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
              {OUTPUT_TYPES.map((type) => (
                <li key={type} className="flex flex-[1_1_250px] flex-col gap-2.5 rounded-[14px] border border-[#D9DDD3] bg-white p-[22px]">
                  <span className="text-euc"><Icon d={OUTPUT_UI[type].icon} size={30} strokeWidth={1.7} /></span>
                  <h3 className="m-0 font-display text-[22px] font-bold leading-[1.15]">{OUTPUT_UI[type].label}</h3>
                  <p className="m-0 text-base text-ink-soft">{OUTPUT_UI[type].hint}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- curriculum ---------- */}
          <section id="curriculum" aria-labelledby="cur-title" className="bg-euc-dark text-paper">
            <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-14 px-6 py-24">
              <div className="flex flex-[1_1_400px] flex-col gap-[18px]">
                <p className="m-0 text-sm font-bold uppercase tracking-[0.1em] text-wattle">Built for Victoria</p>
                <h2 id="cur-title" className={H2}>Built around the Victorian Curriculum.</h2>
                <p className="m-0 text-[#DCE8E1]">
                  The content descriptions and achievement standards for Prep to Year 6 are built in, across every learning area. Plans cite real codes, and any code the AI makes up is removed before you see it.
                </p>
                <p className="m-0 text-[#DCE8E1]">
                  Each lesson follows the Victorian Teaching and Learning Model 2.0, in six phases, with timings that add up to the length of your lesson.
                </p>
                <p className="m-0 mt-2 text-[15px] text-[#BFD3C8]">{LEARNING_AREAS}</p>
                <p className="m-0 mt-1 text-[15px]">
                  <a href="/curriculum" className="font-bold text-wattle underline hover:text-wattle">Browse the curriculum</a>
                </p>
              </div>
              <VtlmDemo />
            </div>
          </section>

          {/* ---------- FAQ ---------- */}
          <section id="faq" aria-labelledby="faq-title" className="mx-auto flex max-w-[900px] flex-col gap-8 px-6 py-24">
            <h2 id="faq-title" className={H2}>Questions teachers ask.</h2>
            <div className="flex flex-col">
              {FAQ.map((item, i) => (
                <details key={item.q} className={`group border-t border-line-strong py-1 ${i === FAQ.length - 1 ? "border-b" : ""}`}>
                  <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 rounded-lg font-display text-[21px] font-bold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="transition-transform group-open:rotate-180"><Icon d={ICONS.chevronDown} size={22} /></span>
                  </summary>
                  <p className="m-0 mb-[18px] max-w-[40em] text-ink-soft">
                    {item.q === "How do I get an account?" ? (
                      <>
                        Lessonroo is invite-only while it is being tested. If you have been invited, sign in or create your account. To ask for access, email{" "}
                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                      </>
                    ) : (
                      item.a
                    )}
                  </p>
                </details>
              ))}
            </div>
          </section>

          {/* ---------- closing call to action ---------- */}
          <section aria-labelledby="cta-title" className="bg-wattle">
            <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-7 px-6 py-[72px]">
              <div className="flex flex-[1_1_420px] flex-col gap-2.5">
                <h2 id="cta-title" className="m-0 font-display text-[clamp(30px,4vw,44px)] font-bold leading-[1.08] tracking-[-0.02em]">Your next lesson starts with a few words.</h2>
                <p className="m-0">Type your idea for tomorrow and see what comes back.</p>
              </div>
              <a
                href={start.href}
                className="inline-flex min-h-[54px] items-center justify-center rounded-xl border-2 border-ink bg-ink px-7 text-lg font-bold text-white no-underline hover:bg-ink hover:text-white"
              >
                {start.label}
              </a>
            </div>
          </section>
        </ClockProvider>
      </main>

      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-4 px-6 pb-12 pt-9 text-[15px] text-ink-soft print:hidden">
        <Wordmark className="text-xl" />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-[18px] gap-y-1">
          <a href="#how">How it works</a>
          <a href="#make">What you can make</a>
          <a href="#faq">Questions</a>
          <a href="/login">Sign in</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </nav>
        <span className="flex-[1_1_300px] text-right">Generated material should be reviewed by a teacher before use.</span>
      </footer>
    </div>
  );
}
