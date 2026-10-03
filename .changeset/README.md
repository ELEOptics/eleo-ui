# Changesets

Every PR that changes a published package adds one: `npx changeset`, pick the packages and the bump
(patch: fixes; minor: new renderers, props or tokens; major: anything that breaks a consumer), and
write one line for the changelog. Merging to main opens a "Version packages" PR; merging that publishes.
