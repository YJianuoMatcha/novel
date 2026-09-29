require("dotenv").config();

const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠ OPENAI_API_KEY is not set.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.use(express.json({ limit: "3mb" }));
app.use(express.static(path.join(__dirname)));

function buildContext(book) {
  const novel = book?.novel || {};
  const chapters = novel.chapters || [];
  const characters = novel.characters || [];
  const relationships = novel.relationships || [];
  const summaries = chapters.map((c,i) => c.summary ? `### Summary ${i+1}: ${c.title}\n${JSON.stringify(c.summary)}` : "").filter(Boolean).join("\n\n");

  const characterText = Array.isArray(characters)
    ? characters.map(c =>
        `### ${c.name || "Unnamed"}\n` +
        `Role: ${c.role || ""}\n` +
        `Personality: ${c.personality || ""}\n` +
        `Goals: ${c.goals || ""}\n` +
        `Relationships: ${c.relationships || ""}\n` +
        `Notes: ${c.notes || ""}`
      ).join("\n\n")
    : String(characters || "(none)");

  const relationshipText = Array.isArray(relationships)
    ? relationships.map(r => {
        const source = Array.isArray(characters) ? characters.find(c=>c.id===r.sourceId)?.name || r.sourceId : r.sourceId;
        const target = Array.isArray(characters) ? characters.find(c=>c.id===r.targetId)?.name || r.targetId : r.targetId;
        return `- ${source} -> ${target}: ${r.type || "related"} (${r.note || ""})`;
      }).join("\n")
    : String(relationships || "(none)");

  const chapterText = chapters.map((c, i) =>
    `### Chapter ${i + 1}: ${c.title}\n${c.content || "(empty)"}`
  ).join("\n\n");

  return `
NOVEL TITLE:
${novel.title || "(untitled)"}

OUTLINE:
${novel.outline || "(not created yet)"}

CHARACTER DATABASE:
${characterText || "(no characters yet)"}

RELATIONSHIP DATABASE:
${relationshipText || "(no relationships yet)"}

EXISTING CHAPTERS:
${chapterText || "(no chapters yet)"}

CHAPTER SUMMARIES:
${summaries || "(no saved summaries yet)"}
`.trim();
}

const SYSTEM_PROMPT = `
You are the AI writing partner inside Novel Studio.

The human author has final creative control.
Never silently overwrite established facts.
When information conflicts with the character database, point it out rather than
assuming the database is wrong.

When generating prose:
- Preserve established character personalities, relationships, chronology and world rules.
- Match the requested language and tone.
- Return prose only when prose is requested.

When analyzing character changes:
- Only identify changes supported by the newly provided text.
- Distinguish NEW character facts from possible interpretations.
- Never invent a relationship or personality trait just because it would be narratively convenient.
`;

app.post("/api/ai", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({error:"OPENAI_API_KEY is missing. Create .env from .env.example."});

    const {mode="chat", instruction="", language="Chinese", selectedText="", book={}} = req.body || {};
    const context = buildContext(book);

    const modes = {
      continue: "Continue the current chapter naturally from the provided text. Return ready-to-paste prose.",
      polish: "Polish the provided text while preserving plot facts and character voice. Return only revised prose.",
      expand: "Expand the provided text with concrete action, atmosphere and dialogue while preserving events. Return only revised prose.",
      plot: "Suggest several possible next plot developments with causes and consequences. Do not choose for the author.",
      chat: "Help the author with the requested writing/planning task.",
      outline: "Create or improve a practical novel outline with premise, characters, conflict, turning points and chapter/arc progression.",
      chapter_summary: `
Analyze ONLY the current chapter text and return JSON ONLY using this schema:
{
  "short": "2-5 sentence concise summary",
  "events": ["concrete event 1", "concrete event 2"],
  "characterChanges": ["character change supported by the chapter"],
  "worldChanges": ["new setting/world information introduced"],
  "foreshadowing": ["unresolved clue, question, promise, conflict or future thread"]
}
Rules:
- Focus on the current chapter, not the whole novel.
- Preserve only explicit or strongly supported information.
- Do not invent motivations, facts, relationships or future events.
- Empty arrays are valid.
`,
      database_sync: `
Analyze ONLY the newly provided current chapter and compare it with the existing novel databases.
Return JSON ONLY using this schema:
{
  "summary": {"short":"", "events":[], "characterChanges":[], "worldChanges":[], "foreshadowing":[]},
  "proposals": [{
    "id":"short-id", "domain":"character | relationship | world | timeline | foreshadow",
    "action":"add | update | change | close", "name":"main entity name", "targetName":"target name when needed",
    "field":"role | personality | goals | relationships | notes | type | note | strength | status | category | description | date | title",
    "oldValue":"", "newValue":"", "evidence":"brief evidence from current chapter", "confidence":0.0,
    "chapter":"current chapter title", "status":"active | changed | ended | uncertain"
  }],
  "conflicts": [{"domain":"character | relationship | world | timeline | foreshadow", "description":"possible contradiction", "evidence":"why"}]
}
Rules:
- Current chapter only; do not invent facts.
- Do not repeat information already present unless the chapter clearly changes it.
- Character/relationship proposals require explicit or strongly supported evidence.
- World entries can be locations, organizations, objects, rules, historical facts, or persistent setting facts.
- Timeline entries describe concrete current-chapter events; date only if explicitly stated.
- Foreshadows are unresolved clues/questions/promises introduced or changed in this chapter.
- Confidence below 0.75 for uncertain inferences.
- Conflicts are warnings only; never decide which established fact is correct.
`,
      character_extract: `
Analyze ONLY the newly provided story text and compare it with the existing character database.
Return JSON ONLY using this schema:
{
  "changes": [
    {
      "type": "new_character | update_character | relationship_change | uncertain",
      "characterName": "string",
      "targetCharacterName": "string (required for relationship_change)",
      "field": "role | personality | goals | relationships | notes",
      "oldValue": "string",
      "newValue": "string",
      "evidence": "brief explanation based on the new text",
      "chapter": "current chapter title",
      "strength": 0.0,
      "status": "active | changed | ended | uncertain",
      "confidence": 0.0
    }
  ]
}
Rules:
- If a fact is merely implied, use "uncertain" and confidence below 0.75.
- Do not report unchanged information.
- Do not invent facts.
- For relationship_change, identify both characterName and targetCharacterName and put the relationship type in newValue.
- For relationship_change, also estimate strength from 0 to 1, status, and cite the current chapter title.
- A relationship change must be supported by an explicit interaction, statement, or event in the new text.
- If there are no meaningful changes, return {"changes":[]}.
`
    };

    const prompt = `
WRITING LANGUAGE: ${language}
TASK:
${modes[mode] || modes.chat}

AUTHOR REQUEST:
${instruction || "(none)"}

NEW / SELECTED TEXT:
${selectedText || "(none)"}

FULL NOVEL CONTEXT:
${context}
`;

    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: prompt
    });

    res.json({text: response.output_text || "", model: MODEL});
  } catch (error) {
    console.error(error);
    res.status(500).json({error:error?.message || "AI request failed."});
  }
});

app.get("/api/health", (_req,res) =>
  res.json({ok:true, aiConfigured:Boolean(process.env.OPENAI_API_KEY), model:MODEL})
);

app.listen(PORT, () => console.log(`Novel Studio V0.6 running at http://localhost:${PORT}`));
