# gxypi

An AI co-scientist for [Galaxy](https://galaxyproject.org) bioinformatics, built on [Pi.dev](https://pi.dev).

gxypi turns Pi into a structured analysis partner — it creates plans, runs Galaxy tools, documents every decision, and saves everything to a persistent notebook you can share, resume, and reproduce.

## Install

```bash
# Install Pi
npm install -g @mariozechner/pi-coding-agent

# Install gxypi
pi install npm:gxypi
```

You'll also need the [Galaxy MCP server](https://github.com/galaxyproject/galaxy-mcp) to connect to Galaxy. See [Galaxy MCP Setup](#galaxy-mcp-setup) below.

## Usage

Start Pi with gxypi installed, then just describe what you want to analyze:

```
$ pi

You: I have RNA-seq data from a drug treatment experiment — 6 samples,
     3 treated and 3 control HeLa cells. I want to find differentially
     expressed genes. The data is at GEO accession GSE164073.

Pi:  I'll help you set up a structured analysis. Let me start by refining
     the research question.

     Research Question: "Does drug X treatment alter gene expression
     in HeLa cells, specifically in inflammatory response pathways?"

     I've created an analysis plan and saved it to:
     📓 rna-seq-drug-treatment-notebook.md

     The plan has 5 steps:
       1. ⬜ Quality Control (FastQC + MultiQC)
       2. ⬜ Read Trimming (Cutadapt)
       3. ⬜ Alignment (HISAT2 to hg38)
       4. ⬜ Quantification (featureCounts)
       5. ⬜ Differential Expression (DESeq2)

     Ready to start with QC?

You: Yes, run FastQC on all samples.

Pi:  Running FastQC via Galaxy...

     ✅ FastQC complete. Results:
     - All samples: Q30 > 88%
     - Adapter content detected in samples 2 and 5
     - Recommendation: proceed with trimming

     I've logged this as a QC checkpoint. Move on to trimming?
```

The next day, come back to the same directory and everything picks up where you left off:

```
$ pi

Pi:  Loaded notebook: RNA-seq Drug Treatment (1/5 steps completed)

     Last session completed Quality Control (passed).
     Next step: Read Trimming with Cutadapt.

     Ready to continue?
```

### Commands

| Command | What it does |
|---------|-------------|
| `/status` | Galaxy connection state, current plan progress |
| `/plan` | View analysis plan with step status |
| `/plan-decisions` | View the decision log |
| `/notebook` | Notebook info or list available notebooks |
| `/connect` | Connect to a Galaxy server (prompts for credentials) |

## How It Works

gxypi guides analyses through five phases:

**1. Problem Definition** — Refine your research question using the PICO framework, add literature references.

**2. Data Acquisition** — Track data sources (GEO, SRA, local files), register samples, generate samplesheets, link to Galaxy datasets.

**3. Analysis** — Create a step-by-step plan, execute tools/workflows via Galaxy, log every decision, create QC checkpoints that require your approval before proceeding.

**4. Interpretation** — Review results in biological context, pathway analysis.

**5. Publication** — Generate methods sections from the tool versions actually used, track figures, prepare data sharing.

Everything is saved to a **notebook file** — a readable markdown document with YAML blocks for structured data. You can open it in any editor, share it with collaborators, or use it to reproduce the analysis later.

## Galaxy MCP Setup

gxypi talks to Galaxy through the [Galaxy MCP server](https://github.com/galaxyproject/galaxy-mcp). To set it up:

```bash
# Clone the Galaxy MCP server
git clone https://github.com/galaxyproject/galaxy-mcp.git ~/.galaxy-mcp

# Install pi-mcp-adapter
pi install npm:pi-mcp-adapter
```

Create `~/.pi/agent/mcp.json`:

```json
{
  "mcpServers": {
    "galaxy": {
      "command": "uv",
      "args": ["run", "--python", "3.12", "--directory", "~/.galaxy-mcp/mcp-server-galaxy-py", "galaxy-mcp"],
      "lifecycle": "lazy",
      "directTools": [
        "connect", "get_histories", "create_history",
        "get_history_contents", "get_dataset_details",
        "upload_file", "search_tools_by_name",
        "get_tool_details", "run_tool", "get_job_details",
        "recommend_iwc_workflows", "invoke_workflow",
        "get_invocations"
      ]
    }
  }
}
```

Set your Galaxy credentials:

```bash
export GALAXY_URL="https://usegalaxy.org"
export GALAXY_API_KEY="your-api-key"
```

Or just use `/connect` after starting Pi — it'll prompt you.

> **Note:** Python 3.12 is recommended. Python 3.14+ has compatibility issues with pydantic-core.

## Using Local LLMs

Pi supports any OpenAI-compatible API. To use a local provider like [LiteLLM](https://litellm.ai/), create `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "litellm": {
      "baseUrl": "http://localhost:4000/v1",
      "api": "openai-completions",
      "apiKey": "your-key",
      "models": [
        {
          "id": "your-model-name",
          "contextWindow": 128000,
          "maxTokens": 16384
        }
      ]
    }
  }
}
```

Then start Pi with `--provider litellm --model your-model-name`, or set defaults in `~/.pi/agent/settings.json`.

## One-Line Install

For a fully automated setup (Pi + MCP + gxypi + launcher script):

```bash
curl -fsSL https://raw.githubusercontent.com/galaxyproject/gxypi/main/install.sh | bash
```

This creates a `gxypi` launcher at `~/.local/bin/gxypi` that handles Galaxy credentials on first run.

## Tool Reference

gxypi registers 26 tools across the analysis lifecycle:

| Category | Tools |
|----------|-------|
| **Phase management** | `analysis_set_phase` |
| **Problem definition** | `research_question_refine`, `research_add_literature` |
| **Data acquisition** | `data_set_source`, `data_add_sample`, `data_add_file`, `data_link_galaxy`, `data_generate_samplesheet`, `data_get_provenance` |
| **Analysis** | `analysis_plan_create`, `analysis_plan_add_step`, `analysis_plan_update_step`, `analysis_plan_get`, `analysis_plan_activate`, `analysis_plan_summary`, `analysis_step_log`, `analysis_checkpoint` |
| **Notebooks** | `analysis_notebook_create`, `analysis_notebook_open`, `analysis_notebook_list` |
| **Publication** | `publication_init`, `publication_generate_methods`, `publication_add_figure`, `publication_update_figure`, `publication_recommend_figures`, `publication_get_status` |

## Related Projects

- [Galaxy](https://galaxyproject.org) — Open-source platform for data-intensive biomedical research
- [galaxy-mcp](https://github.com/galaxyproject/galaxy-mcp) — MCP server for the Galaxy API
- [Pi coding agent](https://github.com/badlogic/pi-mono) — The Pi.dev agent framework

## License

MIT
