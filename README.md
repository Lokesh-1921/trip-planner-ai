# Trip Planner AI

Continue the prepared Masai capstone as a new Lovable prototype named MakeMyTrip AI Trip Assistant for Rushikesh. The attached build pack is the source of truth; the research, Google Doc and datasets already exist. Build a responsive, polished landing page headed ‘Compare a short trip within your budget’, permanent Synthetic demo / not an official MakeMyTrip service notice, embedded conversational planning panel, editable confirmed trip summary, and at most three flight + hotel cards with deterministic cost breakdown, trusted record IDs, Details in a new tab and Simulate selection. Use attached assistant-prompt.txt as the complete system prompt and retrieval-and-workflows.md for exact calculations, ranking and recovery. Scope: one domestic destination, dates 2026-11-01 to 2027-03-31, 2–4 nights, 1–6 travellers, explicit budget basis, group, diet and personalisation. Attachments include all 20 destinations, 25 origins, 960 flights and 60 hotels, schema and 25 test cases. Preserve IDs and every data row. Build frontend first and prepare Supabase integration; no Supabase organisation is connected yet, so do NOT enable Lovable Cloud or use Lovable AI, paid gateways or paid fallback. We will connect our own Supabase Free project and Groq Free server secret. Show ‘AI connection not configured’ when absent: do not fake generated replies, live retrieval, database saving, success tests or bookings. Anonymous owner-only private storage, server retrieval before real Groq generation, strict JSON/ID/price validation and owner-only fault injection must follow the attached specifications once connected. Provide the /dataset synthetic reference view; ensure private conversations are never public. Use a calm travel design, deep blue and warm coral accents, accessible mobile/keyboard controls, clear loading/empty/no-match/error states and friendly plain English. Build as much as possible now without paid services and explicitly report missing backend configuration.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/48c7c746-e7bf-4edb-a72a-620a510ea7c0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
