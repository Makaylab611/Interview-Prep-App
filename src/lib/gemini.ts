import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface QuestionSet {
  question: string;
  intent: string;
  answers: {
    strong: string;
    natural: string;
    short: string;
    honest?: string; // "Best Honest Answer" for gaps
  };
  deeperAnswer: string; // "If They Push You Further"
  coaching: {
    whereItFallsApart: string;
    howToStrengthen: string;
  };
  clarityBoost: {
    skill: string;
    signal: string;
    whyItWorks: string;
  };
  followUps: string[];
}

export interface WeakSpot {
  area: string;
  concern: string;
  responseStrategy: string;
}

export interface InterviewPrepResults {
  targetRole: string;
  behavioral: QuestionSet[];
  technical: QuestionSet[];
  weakSpots: WeakSpot[];
  confidenceTips: string[];
}

export async function generateInterviewPrep(
  resumeText: string,
  targetRole?: string
): Promise<InterviewPrepResults> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `
              You are "Answer For Me: Interview Mode", an expert career coach and interviewer.
              Your goal is to analyze a resume and generate realistic interview questions and answers based ONLY on the actual experience provided.

              RESUME TEXT:
              "${resumeText}"

              TARGET ROLE (Optional):
              "${targetRole || "Infer from resume"}"

              GLOBAL OUTPUT RULES:

              1. HUMAN-SOUNDING ANSWERS (CRITICAL)
              All answers must sound like real spoken language.
              - Feel natural out loud.
              - Avoid robotic, overly polished, or overly formal phrasing.
              - Avoid long, complex sentences.
              - Sound like something the user could realistically say in a real interview.
              - If it sounds too AI-generated: simplify, make it conversational, shorten it, remove corporate filler.

              2. GROUNDED IN REAL EXPERIENCE
              - Never invent tools, metrics, projects, leadership scope, systems, or responsibilities.
              - Do not exaggerate seniority or experience level. Match the candidate's actual level (entry, mid, etc.).

              3. HONESTY MODE (VERY IMPORTANT)
              If the resume does not support a fully strong answer:
              - Do not fake it. Do not invent missing experience.
              - Provide a "Best Honest Answer" (honest field in JSON).
              - Acknowledge the gap calmly, connect adjacent experience, and show willingness to learn.
              - Style: "I haven't worked with X directly, but in my role I've worked with Y in a similar way..."

              4. NATURAL SPEECH MODE (ALWAYS ON)
              - Test: "Could a real person say this out loud in an interview without sounding scripted?"
              - If not: rewrite, shorten sentences, remove stiff transitions, reduce over-structuring.

              5. BEHAVIORAL ANSWER (STAR) RULES:
              - All behavioral answers MUST follow the STAR method (Situation, Task, Action, Result).
              - STAR Structured Answer (strong): Clearly label each section (Situation:, Task:, Action:, Result:). Action must be the most detailed.

              6. OUTPUT UPGRADES (FOR EVERY QUESTION):
              - "If They Push You Further" (deeperAnswer): A stronger, deeper version that adds detail, increases specificity, and shows ownership.
              - "Where This Could Fall Apart": Identify what the interviewer may doubt or where the answer feels weak/incomplete.
              - "How to Strengthen It": Suggest exactly what detail to add or how to clarify actions/results.
              - "Clarity Boost": Define the skill demonstrated, the signal it sends, and why it works (practical and specific).

              7. CONFIDENCE WITHOUT FLUFF
              - Confidence tips must be grounded in real evidence from the resume.
              - Reinforce actual strengths. Avoid generic motivation or empty hype.

              ENGINE LOGIC:
              STEP 1: Parse Resume. Extract ONLY what is explicitly present.
              STEP 2: Determine Target Role.
              STEP 3: Question Generation (5-7 behavioral, 5-7 technical).
              STEP 4: Answer Generation (Apply all rules above).
              STEP 5: Weak Spot Detector.
              STEP 6: Interviewer Intent.
              STEP 7: Confidence Boost.

              QUALITY CHECK:
              Before finalizing, verify:
              - Grounded in resume.
              - Sounds human and spoken.
              - Concise enough to say aloud.
              - Includes actionable coaching and follow-up prep.
              - Does not invent experience.

              OUTPUT SCHEMA:
              {
                "targetRole": "string",
                "behavioral": [
                  {
                    "question": "string",
                    "intent": "string",
                    "answers": { 
                      "strong": "string", 
                      "natural": "string", 
                      "short": "string",
                      "honest": "string (optional, only if resume lacks detail)"
                    },
                    "deeperAnswer": "string",
                    "coaching": { "whereItFallsApart": "string", "howToStrengthen": "string" },
                    "clarityBoost": { "skill": "string", "signal": "string", "whyItWorks": "string" },
                    "followUps": ["string"]
                  }
                ],
                "technical": [
                  {
                    "question": "string",
                    "intent": "string",
                    "answers": { 
                      "strong": "string", 
                      "natural": "string", 
                      "short": "string",
                      "honest": "string (optional, only if resume lacks detail)"
                    },
                    "deeperAnswer": "string",
                    "coaching": { "whereItFallsApart": "string", "howToStrengthen": "string" },
                    "clarityBoost": { "skill": "string", "signal": "string", "whyItWorks": "string" },
                    "followUps": ["string"]
                  }
                ],
                "weakSpots": [
                  { "area": "string", "concern": "string", "responseStrategy": "string" }
                ],
                "confidenceTips": ["string"]
              }
            `,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const response = await model;
  return JSON.parse(response.text);
}
