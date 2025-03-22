<script>
    import { onMount } from "svelte";
    import {
        getCompanies,
        getTemplates,
        getCoverLetterTemplates,
        generateApplication,
    } from "$lib/api";
    import PDFPreview from "$lib/components/PDFPreview.svelte";

    let companies = [];
    let cvTemplates = [];
    let coverLetterTemplates = [];
    let selectedCompany = null;
    let selectedCvTemplate = null;
    let selectedCoverLetterTemplate = null;
    let customContent = "";
    let notes = "";
    let loading = true;
    let generating = false;
    let error = null;
    let success = null;
    let cvPreviewUrl = null;
    let coverLetterPreviewUrl = null;

    onMount(async () => {
        try {
            [companies, cvTemplates, coverLetterTemplates] = await Promise.all([
                getCompanies(),
                getTemplates(),
                getCoverLetterTemplates(),
            ]);
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    // Sanitize text for LaTeX
    function sanitizeForLatex(text) {
        if (!text) return "";

        return text
            .replace(/\\/g, "\\textbackslash{}")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}")
            .replace(/&/g, "\\&")
            .replace(/%/g, "\\%")
            .replace(/\$/g, "\\$")
            .replace(/#/g, "\\#")
            .replace(/_/g, "\\_")
            .replace(/~/g, "\\textasciitilde{}")
            .replace(/\^/g, "\\textasciicircum{}")
            .replace(/\n\n+/g, "\n\n")
            .replace(/\n/g, " \\\\\n");
    }

    async function generateApplicationDocs() {
        if (!selectedCompany) {
            error = "Please select a company";
            return;
        }

        if (!selectedCvTemplate && !selectedCoverLetterTemplate) {
            error = "Please select at least one template (CV or Cover Letter)";
            return;
        }

        generating = true;
        error = null;
        success = null;

        try {
            // Sanitize inputs
            const sanitizedContent = sanitizeForLatex(customContent);
            const sanitizedNotes = notes.trim();

            // Generate the application and docs
            const result = await generateApplication({
                companyId: selectedCompany.id,
                cvTemplateId: selectedCvTemplate?.id || null,
                coverLetterTemplateId: selectedCoverLetterTemplate?.id || null,
                customContent: sanitizedContent,
                notes: sanitizedNotes,
            });

            // Update with success message
            success = {
                message: "Application created successfully!",
                id: result.applicationId,
                cvPath: result.cvPath,
                coverLetterPath: result.coverLetterPath,
            };

            // Set preview URLs if available
            if (result.cvPath) {
                cvPreviewUrl = `/build/${result.cvPath}`;
            }

            if (result.coverLetterPath) {
                coverLetterPreviewUrl = `/build/${result.coverLetterPath}`;
            }
        } catch (err) {
            error = `Failed to generate application: ${err.message}`;
        } finally {
            generating = false;
        }
    }
</script>

<div class="generator-page">
    <h1>Create Complete Application</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if success}
        <div class="success">
            {success.message}
            <div class="success-actions">
                <a href="/applications/{success.id}" class="button"
                    >View Application</a
                >
                <a href="/applications" class="button">All Applications</a>
            </div>
        </div>
    {/if}

    <div class="action-bar">
        <a href="/applications" class="button">Back to Applications</a>
    </div>

    {#if loading}
        <div class="loading">Loading data...</div>
    {:else}
        <div class="generator-layout">
            <div class="configuration">
                <div class="section">
                    <h2>1. Select Company</h2>
                    {#if companies.length === 0}
                        <div class="empty-message">
                            <p>No companies found.</p>
                            <a href="/companies/new" class="button small"
                                >Add Company</a
                            >
                        </div>
                    {:else}
                        <div class="company-selector">
                            {#each companies as company}
                                <div
                                    class="company-card {selectedCompany?.id ===
                                    company.id
                                        ? 'selected'
                                        : ''}"
                                    on:click={() => (selectedCompany = company)}
                                >
                                    <h3>{company.name}</h3>
                                    {#if company.position}
                                        <div class="position">
                                            {company.position}
                                        </div>
                                    {/if}
                                    {#if company.location}
                                        <div class="location">
                                            {company.location}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="section">
                    <h2>2. Select CV Template (Optional)</h2>
                    {#if cvTemplates.length === 0}
                        <div class="empty-message">
                            <p>No CV templates found.</p>
                            <a href="/templates/new" class="button small"
                                >Add Template</a
                            >
                        </div>
                    {:else}
                        <div class="template-selector">
                            <div
                                class="template-card {selectedCvTemplate ===
                                null
                                    ? 'selected'
                                    : ''}"
                                on:click={() => (selectedCvTemplate = null)}
                            >
                                <h3>None</h3>
                                <p>Don't include a CV</p>
                            </div>

                            {#each cvTemplates as template}
                                <div
                                    class="template-card {selectedCvTemplate?.id ===
                                    template.id
                                        ? 'selected'
                                        : ''}"
                                    on:click={() =>
                                        (selectedCvTemplate = template)}
                                >
                                    <h3>{template.name}</h3>
                                    <p>
                                        {template.description ||
                                            "No description"}
                                    </p>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="section">
                    <h2>3. Select Cover Letter Template (Optional)</h2>
                    {#if coverLetterTemplates.length === 0}
                        <div class="empty-message">
                            <p>No cover letter templates found.</p>
                            <a href="/cover-letters/new" class="button small"
                                >Add Template</a
                            >
                        </div>
                    {:else}
                        <div class="template-selector">
                            <div
                                class="template-card {selectedCoverLetterTemplate ===
                                null
                                    ? 'selected'
                                    : ''}"
                                on:click={() =>
                                    (selectedCoverLetterTemplate = null)}
                            >
                                <h3>None</h3>
                                <p>Don't include a cover letter</p>
                            </div>

                            {#each coverLetterTemplates as template}
                                <div
                                    class="template-card {selectedCoverLetterTemplate?.id ===
                                    template.id
                                        ? 'selected'
                                        : ''}"
                                    on:click={() =>
                                        (selectedCoverLetterTemplate =
                                            template)}
                                >
                                    <h3>{template.name}</h3>
                                    <p>
                                        {template.description ||
                                            "No description"}
                                    </p>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if selectedCoverLetterTemplate}
                    <div class="section">
                        <h2>4. Custom Content for Cover Letter</h2>
                        <textarea
                            bind:value={customContent}
                            rows="6"
                            placeholder="Add custom content for your cover letter here. This will be inserted at the appropriate place in your cover letter template."
                        ></textarea>
                    </div>
                {/if}

                <div class="section">
                    <h2>{selectedCoverLetterTemplate ? "5" : "4"}. Notes</h2>
                    <textarea
                        bind:value={notes}
                        rows="3"
                        placeholder="Add any notes about this application (for your reference only, will not appear in documents)"
                    ></textarea>
                </div>

                <div class="actions">
                    <button
                        class="button primary"
                        disabled={!selectedCompany ||
                            (!selectedCvTemplate &&
                                !selectedCoverLetterTemplate) ||
                            generating}
                        on:click={generateApplicationDocs}
                    >
                        {generating ? "Generating..." : "Generate Application"}
                    </button>
                </div>
            </div>

            <div class="previews">
                {#if success}
                    <div class="preview-tabs">
                        <div class="preview-section">
                            <h2>CV Preview</h2>
                            {#if cvPreviewUrl}
                                <PDFPreview url={cvPreviewUrl} />
                            {:else}
                                <div class="no-preview">No CV generated</div>
                            {/if}
                        </div>

                        <div class="preview-section">
                            <h2>Cover Letter Preview</h2>
                            {#if coverLetterPreviewUrl}
                                <PDFPreview url={coverLetterPreviewUrl} />
                            {:else}
                                <div class="no-preview">
                                    No Cover Letter generated
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="preview-placeholder">
                        <div class="placeholder-content">
                            <h3>Document Previews</h3>
                            <p>
                                Select your options and click "Generate
                                Application" to create and preview your
                                documents
                            </p>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .generator-page {
        max-width: 1400px;
        margin: 0 auto;
        padding: 1.5rem;
    }

    .generator-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
    }

    .configuration {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .section {
        background-color: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .section h2 {
        margin-top: 0;
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }

    .company-selector,
    .template-selector {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
        max-height: 200px;
        overflow-y: auto;
        padding: 0.5rem;
        background-color: #f8f9fa;
        border-radius: 4px;
    }

    .company-card,
    .template-card {
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .company-card:hover,
    .template-card:hover {
        background-color: #f0f0f0;
    }

    .company-card.selected,
    .template-card.selected {
        border-color: #007bff;
        background-color: #e6f2ff;
    }

    .company-card h3,
    .template-card h3 {
        margin: 0;
        font-size: 1rem;
    }

    .company-card .position {
        font-weight: 500;
        margin-top: 0.25rem;
    }

    .company-card .location {
        color: #666;
        font-size: 0.8rem;
        margin-top: 0.25rem;
    }

    .template-card p {
        margin: 0.25rem 0 0 0;
        font-size: 0.8rem;
        color: #666;
    }

    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        resize: vertical;
    }

    .actions {
        text-align: right;
    }

    .previews {
        background-color: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .preview-tabs {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .preview-section h2 {
        margin-top: 0;
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }

    .preview-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        background-color: #f8f9fa;
        border: 1px dashed #ddd;
        border-radius: 4px;
    }

    .placeholder-content {
        text-align: center;
        color: #6c757d;
    }

    .no-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 300px;
        background-color: #f8f9fa;
        border: 1px dashed #ddd;
        border-radius: 4px;
        color: #6c757d;
    }

    .empty-message {
        text-align: center;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 4px;
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

    .button.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
    }

    .button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .success {
        background-color: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1.5rem;
    }

    .success-actions {
        margin-top: 0.75rem;
        display: flex;
        gap: 0.5rem;
    }

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1.5rem;
    }

    .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
    }
</style>
