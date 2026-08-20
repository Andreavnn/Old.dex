Old.dex v0.56 — Upload instructions

This package is a one-time SOURCE patch, not a preview layer.

1. Extract this ZIP.
2. In GitHub, open Andreavnn/Old.dex on main.
3. Upload the CONTENTS of this package, preserving the .github/workflows and scripts folders.
4. Commit the upload.
5. GitHub Actions will apply the v0.56 changes directly to the canonical Vue/TypeScript source, run ODX static analysis, regression tests, and the real production build, then commit the resulting source back to main.
6. The one-time workflow and patch script delete themselves in that resulting commit.
7. Vercel will then deploy the canonical v0.56 source automatically.

If the GitHub Action fails, do not stack another patch. Send the failed Actions log back to ChatGPT so the source assertion/build error can be corrected.
