# Galaxy integration and routing

Three operating modes are an _outcome_ of the plan you draft, not a
configuration setting:

- **local** — every step runs locally
- **hybrid** — some local, some Galaxy
- **remote** — entire plan is one Galaxy workflow invocation

The agent makes the routing decision **per plan, during drafting**,
once Galaxy is connected. The mode follows from those step-by-step
decisions.

## When Galaxy is connected

Galaxy MCP runs in **code-mode**: three meta-tools (`search`,
`get_schema`, `run_galaxy_tool`) replace the ~40 named tools. Underlying
tool names (e.g. `get_histories`, `run_tool`, `invoke_workflow`,
`search_iwc_workflows`, `create_user_tool`) are dispatched by name
through `run_galaxy_tool`.

Before drafting a plan, consult Galaxy resources:

1. **Search the IWC workflow registry** with `search("iwc <topic>")`.
   If a full match exists, propose running the plan as a single Galaxy
   workflow invocation (mode: **remote**) -- import via
   `run_galaxy_tool({ name: "import_workflow_from_iwc", ... })` and
   invoke via `run_galaxy_tool({ name: "invoke_workflow", ... })`.
2. **Search the Galaxy tool catalog** per step with `search("<tool>")`.
   Fetch schemas with `get_schema(["<tool_name>"])` before the first
   call -- don't guess parameter names or versions. For each step:
   - Heavy compute (alignment, large variant calling, big assemblies,
     long-running BLAST) -- if the Galaxy server has the tool, mark it
     Galaxy.
   - Light/exploratory (parsing, summarization, awk/sed/jq, small
     scripts) -- mark it local.
3. Document each routing decision inline in the markdown plan section.

## When Galaxy is not connected

All execution is local. Suggest connecting via `/connect` once if the
plan would benefit from Galaxy compute, but don't badger.

## Invocation tracking

After invoking a Galaxy workflow and getting an `invocationId` back:

```
galaxy_invocation_record({
  invocationId,
  notebookAnchor: "plan-a-step-3",
  label: "BWA alignment"
})
```

This writes a `loom-invocation` YAML block to the notebook so polling
tools can find it later.

Periodically call `galaxy_invocation_check_all` to advance in-flight
work. The tool auto-transitions YAML status (all-jobs-ok → completed,
any-error → failed) and writes results back to the notebook. After a
transition, edit the markdown checkbox: `- [ ]` → `- [x]` (or `- [!]`
on failure).
