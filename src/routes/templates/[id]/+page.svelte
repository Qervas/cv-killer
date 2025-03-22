<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { getTemplate, saveTemplate } from "$lib/api";

    const id = $page.params.id;
    const isNew = id === "new";

    let template = {
        name: "",
        description: "",
        content: "",
    };

    let loading = !isNew;
    let saving = false;
    let error = null;
    let successMessage = null;
    let insertedDefault = false;

    // Placeholder for textarea to avoid Svelte parsing issues with curly braces
    const placeholderText = String.raw`\documentclass{article}

\begin{document}
\title{{title}}
\author{{authorName}}
\maketitle

This is a template for {companyName}.

\end{document}`;

    onMount(async () => {
        if (!isNew) {
            try {
                template = await getTemplate(id);
            } catch (err) {
                error = err.message;
            } finally {
                loading = false;
            }
        } else {
            loading = false;
        }
    });

    async function handleSubmit() {
        saving = true;
        error = null;
        successMessage = null;

        try {
            if (!template.name) {
                throw new Error("Template name is required");
            }
            if (!template.content || template.content.trim() === "") {
                throw new Error("Template content cannot be empty");
            }

            const result = await saveTemplate(template);
            template = result;
            successMessage = "Template saved successfully!";

            // If it was new, redirect to the edit page with the new ID
            if (isNew && result.id) {
                setTimeout(() => {
                    window.location.href = `/templates/${result.id}`;
                }, 1500);
            }
        } catch (err) {
            error = err.message;
        } finally {
            saving = false;
        }
    }

    function insertDefaultTemplate() {
        template.content = String.raw`\documentclass[a4paper,11pt]{article}

\usepackage[utf8]{inputenc}
\usepackage[margin=1in]{geometry}
\usepackage{hyperref}

% Define custom commands for CV sections
\newcommand{\cvSection}[1]{\section{#1}\hrule\medskip}

% Personal info commands
\newcommand{\name}[1]{\centerline{\Huge \textbf{#1}}\bigskip}
\newcommand{\contact}[1]{\centerline{#1}\medskip}

\begin{document}

% Replace placeholders with actual data when generating PDF
\name{{name}}
\contact{{email}} | {phone} | {location}}
\contact{{website}} | {linkedin} | {github}}

\cvSection{Summary}
{summary}

\cvSection{Skills}
\begin{itemize}
  \item {skills}
\end{itemize}

\cvSection{Experience}
\begin{itemize}
  \item \textbf{{companyName}} - {position}
  \begin{itemize}
    \item {jobDescription}
  \end{itemize}
\end{itemize}

\cvSection{Education}
\begin{itemize}
  \item \textbf{{university}} - {degree}
\end{itemize}

\end{document}`;

        // Visual feedback
        insertedDefault = true;
        setTimeout(() => {
            insertedDefault = false;
        }, 3000);
    }
</script>

<div class="template-editor">
    <h1>{isNew ? "New Template" : `Edit Template: ${template.name}`}</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="success">{successMessage}</div>
    {/if}

    <div class="action-bar">
        <a href="/templates" class="button">Back to Templates</a>
    </div>

    {#if loading}
        <div class="loading">Loading template...</div>
    {:else}
        <form on:submit|preventDefault={handleSubmit}>
            <div class="form-group">
                <label for="name">Template Name *</label>
                <input
                    type="text"
                    id="name"
                    bind:value={template.name}
                    required
                    placeholder="E.g. Software Developer CV"
                />
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea
                    id="description"
                    bind:value={template.description}
                    rows="2"
                    placeholder="A brief description of this template"
                ></textarea>
            </div>

            <div class="form-group latex-editor">
                <label for="content">LaTeX Template Content *</label>
                <div class="editor-controls">
                    <button
                        type="button"
                        class="button {insertedDefault ? 'success' : ''}"
                        on:click={insertDefaultTemplate}
                    >
                        {insertedDefault
                            ? "✓ Default Template Inserted"
                            : "Insert Default Template"}
                    </button>
                    <span class="hint"
                        >Use {"{placeholders}"} that will be replaced with company
                        data</span
                    >
                </div>
                <textarea
                    id="content"
                    bind:value={template.content}
                    rows="20"
                    placeholder={placeholderText}
                ></textarea>
            </div>

            <div class="placeholder-help">
                <h3>Placeholder Help</h3>
                <p>
                    Use curly braces to create placeholders that will be
                    replaced with company data:
                </p>
                <ul>
                    <li>
                        <code>{"{companyName}"}</code> - Will be replaced with the
                        company name
                    </li>
                    <li>
                        <code>{"{position}"}</code> - Will be replaced with the position
                    </li>
                    <li>
                        <code>{"{anyFieldName}"}</code> - Will be replaced with any
                        custom field defined in the company data
                    </li>
                </ul>
            </div>

            <div class="form-actions">
                <button type="submit" class="button primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Template"}
                </button>
            </div>
        </form>
    {/if}
</div>

<style>
    .template-editor {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
    }

    .form-group {
        margin-bottom: 1rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }

    input,
    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
    }

    textarea {
        font-family: monospace;
    }

    .latex-editor textarea {
        font-family: monospace;
        background-color: #f8f9fa;
    }

    .editor-controls {
        display: flex;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .hint {
        font-size: 0.8rem;
        color: #666;
        margin-left: 1rem;
    }

    .placeholder-help {
        margin-top: 2rem;
        padding: 1rem;
        background-color: #f8f9fa;
        border-left: 4px solid #007bff;
        border-radius: 4px;
    }

    .placeholder-help h3 {
        margin-top: 0;
    }

    .placeholder-help code {
        background-color: #e9ecef;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: monospace;
    }

    .form-actions {
        margin-top: 1.5rem;
        text-align: right;
    }

    .success {
        background-color: #d4edda;
        color: #155724;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .button {
        display: inline-block;
        padding: 0.5rem 1rem;
        background-color: #f0f0f0;
        color: #333;
        text-decoration: none;
        border-radius: 4px;
        border: 1px solid #ddd;
        cursor: pointer;
    }

    .button.primary {
        background-color: #007bff;
        color: white;
        border-color: #0069d9;
    }

    .button.success {
        background-color: #28a745;
        color: white;
        border-color: #218838;
    }

    .button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .action-bar {
        margin-bottom: 1.5rem;
    }
</style>
