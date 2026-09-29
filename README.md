# Novel Studio V0.7

V0.5 builds on V0.4 and adds a structured **chapter summary system** while preserving the multilingual UI, AI outline/prose tools, character database and relationship graph.

## What is new

- Per-chapter structured summaries stored as part of the chapter data
- AI-generated short summary
- Key events
- Character changes
- Newly introduced world/setting information
- Foreshadowing and unresolved questions
- Review-before-save workflow: AI output is only a draft until the author saves it
- Saved summaries are automatically included in the AI novel context
- Existing V0.4 relationship graph and character-analysis workflow remain available
- Existing V0.2/V0.3 localStorage data is still migrated when possible

## Chapter memory flow

```text
Write chapter
     ↓
Generate summary
     ↓
AI extracts
 ├─ Key events
 ├─ Character changes
 ├─ New world information
 └─ Foreshadowing / unresolved questions
     ↓
Author reviews
     ↓
Save summary
     ↓
Long-term novel context
     ↓
Future AI writing / planning
```

## Data structure

Each chapter can now contain:

```json
{
  "id": "chapter-1",
  "title": "Chapter 1",
  "content": "...",
  "summary": {
    "short": "...",
    "events": ["..."],
    "characterChanges": ["..."],
    "worldChanges": ["..."],
    "foreshadowing": ["..."],
    "generatedAt": "..."
  }
}
```

## Run

```bash
npm install
copy .env.example .env
# put your API key in .env
npm start
```

Open `http://localhost:3000`.

## API-key safety

Never put a real API key into frontend JavaScript or commit `.env` to GitHub. `.gitignore` excludes `.env`; `.env.example` contains placeholders only.

## Next direction

The next structural layer can connect summaries to the world-building database, timeline and foreshadowing tracker, forming the foundation for long-form novel memory/RAG later.


## V0.7 — AI Novel Database Sync
V0.7 adds a human-confirmed synchronization layer across characters, relationships, world-building, timeline events, and foreshadowing. The AI proposes changes from the current chapter; it does not silently overwrite established facts. Potential contradictions are displayed as warnings.

The previous V0.5 chapter summary, character analysis, relationship graph, multilingual UI, and local persistence remain available.


## V0.7 — Novel Knowledge Base
- Added a unified Novel Database overview.
- Search and filter characters, relationships, world settings, timeline events, foreshadowing, and saved chapter summaries.
- Shows source chapters for structured entries and lets the author jump directly to a chapter.
- Provides database statistics and direct access to character/relationship editors.
- Preserves V0.6 AI database synchronization and all previous local data.


## V0.8 — Story Timeline
- Story timeline database with explicit story-time values and chapter order.
- Timeline list and visual timeline view.
- Add/edit/delete timeline events.
- Filter by chapter, event type, and search text.
- Story-time sorting is independent from publication/chapter order.
- Events can be linked back to source chapters.
- Designed to support future linking of characters, relationships, worldbuilding, and foreshadowing.


## V0.9 — Foreshadowing Tracker
- Dedicated foreshadowing database.
- Lifecycle states: planted, developing, near-payoff, resolved, paused, abandoned.
- Progress/history records linked to chapters.
- Search and status filtering.
- Forgotten-foreshadowing detection based on chapter distance.
- Manual add/edit/delete and progress updates.
- Links to source chapters and V0.8 timeline events.
- AI analysis entry point for detecting possible new foreshadowing and possible payoff events; proposals remain user-confirmed.
