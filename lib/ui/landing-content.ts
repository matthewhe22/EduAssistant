/** Facts and copy shared by the home page and its search-engine data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://edassistant-web.onrender.com").replace(/\/$/, "");
export const SITE_NAME = "EduAssistant";
export const CONTACT_EMAIL = "admin@capconnex.com.au";

export const HOME_TITLE = "EduAssistant: lesson plans and teaching materials for Victorian primary teachers";
export const HOME_DESCRIPTION =
  "Turn a rough idea into a timed lesson plan, worksheet, rubric or quiz matched to the Victorian Curriculum F–10 Version 2.0. For Prep to Year 6 teachers in Victoria, Australia.";

/** Question and answer pairs. Shown on the page and in the FAQPage structured data. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Who is EduAssistant for?",
    a: "It is made for primary teachers in Victoria, from Prep to Year 6, in any learning area. It helps with the planning and the paperwork so there is more time for the teaching.",
  },
  {
    q: "Does it follow the Victorian Curriculum?",
    a: "Yes. Plans use the content descriptions and achievement standards of the Victorian Curriculum F–10 Version 2.0, and lessons follow the Victorian Teaching and Learning Model 2.0. Any curriculum code that is not in the curriculum is removed before you see it.",
  },
  {
    q: "Do I still need to check what it writes?",
    a: "Yes. EduAssistant drafts, and you decide. Read it, edit any word, rewrite a section, and make sure it suits your class before you teach it. Every change can be undone.",
  },
  {
    q: "Can I plan for a composite class?",
    a: "Yes. Pick two year levels, such as Year 3/4, and you get one shared lesson with clear adjustments for each year level.",
  },
  {
    q: "What happens to my ideas and plans?",
    a: "Your materials are saved in your own library and are not shared with other teachers. Please keep student names out of your ideas and uploads.",
  },
  {
    q: "How do I get an account?",
    a: `EduAssistant is invite-only while it is being tested. If you have been invited, sign in or create your account. To ask for access, email ${CONTACT_EMAIL}.`,
  },
];

export const LEARNING_AREAS =
  "English · Mathematics · Science · History · Geography · Civics and Citizenship · Economics and Business · Health and Physical Education · Digital Technologies · Design and Technologies · The Arts · Languages · Capabilities";
