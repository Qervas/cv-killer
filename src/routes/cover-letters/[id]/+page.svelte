<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { getCoverLetterTemplate, saveCoverLetterTemplate } from "$lib/api";

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
    const placeholderText = String.raw`\documentclass[11pt,a4paper]{letter}

\usepackage[margin=1in]{geometry}
\usepackage{hyperref}

\signature{{yourName}}
\address{{yourAddress} \\ {yourCity}, {yourZip} \\ {yourPhone} \\ {yourEmail}}

\begin{document}

\begin{letter}{
{companyName} \\
{companyAddress} \\
{companyCity}, {companyZip}
}
\opening{Dear Hiring Manager,}

I am writing to express my interest in the {position} position at {companyName}.

{customContent}

Thank you for considering my application. I look forward to the opportunity to discuss how my skills and experience align with your needs.

\closing{Sincerely,}
\end{letter}
\end{document}`;

    onMount(async () => {
        if (!isNew) {
            try {
                template = await getCoverLetterTemplate(id);
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

            const result = await saveCoverLetterTemplate(template);
            template = result;
            successMessage = "Cover letter template saved successfully!";

            // If it was new, redirect to the edit page with the new ID
            if (isNew && result.id) {
                setTimeout(() => {
                    window.location.href = `/cover-letters/${result.id}`;
                }, 1500);
            }
        } catch (err) {
            error = err.message;
        } finally {
            saving = false;
        }
    }

    function insertDefaultTemplate() {
        template.content = String.raw`\documentclass[11pt,a4paper]{letter}

    \usepackage[utf8]{inputenc}
    \usepackage[margin=1in]{geometry}
    \usepackage{hyperref}

    % Custom command to make closing left-aligned instead of centered
    \makeatletter
    \renewcommand{\closing}[1]{\par\nobreak\vspace{\parskip}%
      \stopbreaks
      \noindent
      #1\par
      \nobreak
      \vspace{1\parskip}%
      \noindent
      \fromsig{}}
    \makeatother

    \signature{{yourName}}
    \address{{yourAddress} \\ {yourCity}, {yourZip} \\ {yourPhone} \\ {yourEmail}}

    \begin{document}

    \begin{letter}{
    {companyName} \\
    {companyAddress} \\
    {companyCity}, {companyZip}
    }

    \opening{Dear Hiring Manager,}

    I am writing to express my interest in the {position} position at {companyName}, as advertised on your website. With my background in {background} and experience in {relevantExperience}, I am confident in my ability to make a valuable contribution to your team.

    {customContent}

    I am particularly drawn to {companyName} because of your commitment to {companyValues} and your impressive work in {companyAchievements}. I believe my skills in {skills} align perfectly with what you're looking for, and I'm excited about the opportunity to bring my expertise to your organization.

    Thank you for considering my application. I would welcome the opportunity to discuss how my skills and experiences match your team's needs.

    \closing{Sincerely,}

    \end{letter}
    \end{document}`;

        // Visual feedback
        insertedDefault = true;
        setTimeout(() => {
            insertedDefault = false;
        }, 3000);
    }
</script>

<div class="template-editor">
    <h1>
        {isNew
            ? "New Cover Letter Template"
            : `Edit Cover Letter: ${template.name}`}
    </h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="success">{successMessage}</div>
    {/if}

    <div class="action-bar">
        <a href="/cover-letters" class="button">Back to Cover Letters</a>
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
                    placeholder="E.g. Standard Cover Letter"
                />
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea
                    id="description"
                    bind:value={template.description}
                    rows="2"
                    placeholder="A brief description of this cover letter template"
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
                            : "Insert Default Cover Letter Template"}
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
                        <code>{"{yourName}"}</code>,
                        <code>{"{yourEmail}"}</code> - Your personal information
                    </li>
                    <li>
                        <code>{"{customParagraph1}"}</code>,
                        <code>{"{customParagraph2}"}</code> - For custom content
                        blocks
                    </li>
                    <li>
                        <code>{"{anyFieldName}"}</code> - Will be replaced with any
                        custom field defined in the company data
                    </li>
                </ul>
            </div>

            <div class="form-actions">
                <button type="submit" class="button primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Cover Letter Template"}
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
