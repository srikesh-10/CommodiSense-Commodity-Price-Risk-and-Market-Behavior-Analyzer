<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Backend analysis API is accessed only through src/lib/api.ts (same-origin /api by default, relayed to the Python server by src/routes/api/$.ts because the browser preview cannot reach the sandbox port); keeps the contract in one place.
- The analysis backend lives in backend/server.py (Python stdlib + numpy, port 8000, deterministic seeded synthetic data); start it with `python3 backend/server.py` — the frontend's health/summary/analysis features all depend on it running.
