# Developer docs

The developer site for this repo: for the people who build and run it, how it works and why. The agents' own docs are in `agent_docs/`.

Replace this stub with the repo's own pages, and add each page to `nav` in `zensical.toml`.

## Decisions

To show an ADR here, add a symlink, `dev_docs/adr/<file>.md` to `../../agent_docs/adr/<file>.md`, and a line in
`zensical.toml`'s `nav`, under a `Decisions` section. Zensical follows a symlinked file, not a symlinked directory.
A link inside an ADR resolves from `dev_docs/adr/`, not `agent_docs/adr/`, so it must point at a file under `dev_docs/`
or be an absolute GitHub URL: `--strict` fails on a relative link such as `../agents/workflow.md`.

## Serve it

```bash
uvx zensical@0.0.67 serve
```

`serve` (and `build`) write the site to `site_dir` (`site/`). The workflow doesn't touch your `.gitignore`, so add `site/` to it.
A new repo's `scripts/check.sh` runs `build --strict` in its full gate; `--fast` never builds. A repo that
already had its own `check.sh` keeps it, so add this line to its full branch, outside `--fast`:

```bash
[ ! -f zensical.toml ] || uvx zensical@0.0.67 build --strict
```
