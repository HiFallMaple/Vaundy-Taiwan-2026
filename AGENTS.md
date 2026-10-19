# Project instructions

This is a Vite static PWA for a Vaundy fan guide. Work from source files; `dist/` is generated output. Preserve existing user changes and keep each patch limited to the requested scope.

## Commits and versioning

- Development commits and preview deployments do not constitute a formal release. Keep existing version markers until a formal release is explicitly requested; select and apply the release version from the complete release scope at that time.

- Use Conventional Commits for every commit: `<type>(<scope>): <summary>`, with an optional scope. Use `feat` for user-visible functionality, `fix` for bug fixes, and `docs`, `refactor`, `style`, `perf`, `test`, `build`, `ci`, or `chore` for the corresponding work. Keep release commits exactly `chore(release): publish guide vX.Y.Z`; use `docs(changelog): link vX.Y.Z release commit` for the follow-up changelog link commit.
- Select the SemVer bump from the complete release scope before editing version markers. Use a `MAJOR` bump for breaking or incompatible changes, a `MINOR` bump for a new backward-compatible user-visible capability or substantial feature, and a `PATCH` bump for fixes, content or timing corrections, documentation, styling, refactors, and maintenance without a new capability. A large feature such as a new desktop mode must advance the minor version, for example `1.8.x` to `1.9.0`.
- Keep the selected version consistent across the changelog heading, `package.json`, both root version fields in `package-lock.json`, `src/main.js` (`BUILD`), and `sw.js` (`CACHE_VERSION`). Done when the commit subjects and version bump match the release scope.

## Workflow

1. Inspect `git status --short --branch`, the relevant files, and `package.json` before editing. Read `DESIGN.md` for visual or accessibility work and the relevant `README.md` section for user-facing behavior. Done when the affected files and verification command are clear.
2. Edit the source of truth: lyrics, translations and timing in `src/song-content.js`; song metadata in `src/song-metadata.js`; shared metadata in `src/data.js`; readings in `src/furigana-corrections.js` and `furigana.js`; karaoke timing in `karaoke-sources.js`; app behavior in `src/main.js`; styles and icons in `src/*.css` and `src/ui/icons.js`; caching and packaging in `sw.js` and `vite.config.js`. On branches with the chant refactor, edit audience cues in `src/chant/version-data.js` and regenerate `src/song-mark-metadata.js`; `src/chant-guide.js` holds guide descriptions. Older branches retain their existing chant schema. Preserve the spoiler gate and the non-official status of reference setlist data. Done when the intended source files express the complete change.
3. Verify the result: run `npm run check:lyrics` for lyric or romaji changes, `npm run build` for application changes, and `git diff --check` for every text change. Inspect the final diff and status. Done when all applicable checks pass and only intentional files changed.

## Branches and deployment

- `origin` is the user's fork, `HiFallMaple/Vaundy-Taiwan-2026`; `upstream` is the original author's `watain666/Vaundy-Taiwan-2026`. Never publish or push to upstream without explicit authorization.
- `main` is the production branch for `https://vaundy.fans`. Production deployment is manual and only runs from `main`; pushing or merging alone must not publish it.
- `develop` integrates development and automatically deploys to `https://preview.vaundy.fans` through the artifact-only `HiFallMaple/Vaundy-Taiwan-preview` repository. Preview requests do not require release commits, changelog entries, version bumps or PR creation.
- New work branches start from `develop` and merge back into `develop`. Preserve existing `fix/lyrics`, `fix/karaoke-timing` and `refactor/chant-versions` as independent review history; do not rebase them onto an integration branch that already contains their changes. For upstream contributions, create a clean branch from an appropriate upstream base and pick only the relevant commits.
- The initial clean integration base is upstream commit `7159b52`. Keep production-domain configuration separate from feature commits. Do not merge production or deployment changes into an upstream contribution accidentally.

## Explicit release requests

When the user explicitly asks for a formal release or production deployment (not a preview deployment):

1. Inspect status, remotes, and the intended release branch; resolve release scope before staging. Done when unrelated work is excluded.
2. Update `CHANGELOG.md` from the complete release scope. Use Traditional Chinese, follow its existing version-commit boundary and link format, put the newest section at the top, and cover every user-visible change in the release. Resolve every song name through the Japanese original title in `src/data.js` (for example, `〈不可幸力〉` and `〈恋風邪にのせて〉`) before writing it. Attribute every user-visible bullet to its responsible PR with a linked `[PR #N]`. Add a separate thank-you bullet only for external contributors, linking their handle and PR; the owner's own PRs (`@HiFallMaple`) need only the change description and PR link. When an older PR is already covered by an existing version, add its linked attribution to that version section instead of creating a duplicate release entry. Done when every bullet is traceable to a linked PR, external contributor thanks use linked handles and PRs, the new section is complete, uses Japanese song titles, and contains no placeholder commit links.
3. Apply the SemVer bump selected above. Synchronize `package.json`, both root version fields in `package-lock.json`, `src/main.js` (`BUILD`), and `sw.js` (`CACHE_VERSION`). Done when every shipped version marker matches the selected release version.
4. Run `npm run build` and `git diff --check`. Done when both succeed.
5. Stage only the approved release files and create `chore(release): publish guide vX.Y.Z`. Then create a follow-up `docs(changelog): link vX.Y.Z release commit` that links the changelog heading to the release commit's final full SHA; do not amend the release commit to include its own SHA. Push both commits to `origin/main` (`HiFallMaple/Vaundy-Taiwan-2026`), manually run the production Pages workflow from `main`, and verify the deployment, remote commits and changelog link. `upstream` is not a release target. Done when the remote readback and production deployment match; report the version, release subject, and commit URL only then.
