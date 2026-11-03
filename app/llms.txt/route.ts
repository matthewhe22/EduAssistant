import { CONTACT_EMAIL, FAQ, HOME_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/ui/landing-content";

export const dynamic = "force-static";

/** A plain-text summary for AI assistants and search tools (the llms.txt convention). */
export function GET() {
  const body = [
    `# ${SITE_NAME}`,
    "",
    `> ${HOME_DESCRIPTION}`,
    "",
    `${SITE_NAME} writes lesson plans, unit plans, activities, worksheets, three-level tasks, rubrics, quizzes and notes for families, for Prep to Year 6 teachers in Victoria, Australia. Content follows the Victorian Curriculum F–10 Version 2.0 and the Victorian Teaching and Learning Model 2.0. Teachers review and edit everything before use.`,
    "",
    "## Pages",
    `- [Home](${SITE_URL}/): what it does, how it works and common questions`,
    `- [Curriculum](${SITE_URL}/curriculum): browse the Victorian Curriculum content descriptions`,
    "",
    "## Common questions",
    ...FAQ.map((f) => `- ${f.q} ${f.a}`),
    "",
    "## Contact",
    `- ${CONTACT_EMAIL}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
