<script>
    import { onMount } from "svelte";
    import {
        getCoverLetterTemplates,
        getCompanies,
        generatePreview,
        buildCoverLetter,
    } from "$lib/api";
    import PDFPreview from "$lib/components/PDFPreview.svelte";

    let templates = [];
    let companies = [];
    let selectedTemplate = null;
    let selectedCompany = null;
    let previewUrl = null;
    let loading = true;
    let generating = false;
    let error = null;
    let buildResult = null;
    let customContent = "";

    onMount(async () => {
        try {
            [templates, companies] = await Promise.all([
                getCoverLetterTemplates(),
                getCompanies(),
            ]);
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    function sanitizeForLatex(text) {
        if (!text) return "";

        // Handle special LaTeX characters
        return (
            text
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
                // Handle newlines for LaTeX
                .replace(/\n\n+/g, "\n\n") // Convert multiple newlines to just two
                .replace(/\n/g, " \\\\\n")
        ); // Replace single newlines with LaTeX newlines
    }

    async function handleGeneratePreview() {
        if (!selectedTemplate || !selectedCompany) return;

        generating = true;
        error = null;

        try {
            // Process the custom content for LaTeX
            const sanitizedContent = sanitizeForLatex(customContent);

            // Create enhanced company data
            const enhancedData = {
                // Company basic data
                companyName: selectedCompany.name,
                position: selectedCompany.position || "",
                location: selectedCompany.location || "",
                // Custom content with proper formatting
                customContent: sanitizedContent,
                customParagraph1: sanitizedContent,
                // Include all company data
                ...(selectedCompany.data || {}),
            };

            console.log("Sending data for preview:", enhancedData);

            const result = await generatePreview(
                selectedTemplate.id,
                selectedCompany.id,
                enhancedData,
                "cover-letter",
            );

            previewUrl = `http://localhost:3001${result.previewUrl}`;
        } catch (err) {
            error = `Preview generation failed: ${err.message}`;
        } finally {
            generating = false;
        }
    }

    async function handleBuildPDF() {
        if (!selectedTemplate || !selectedCompany) return;

        generating = true;
        error = null;
        buildResult = null;

        try {
            // Process the custom content for LaTeX
            const sanitizedContent = sanitizeForLatex(customContent);

            // Create enhanced company data
            const enhancedData = {
                // Company basic data
                companyName: selectedCompany.name,
                position: selectedCompany.position || "",
                location: selectedCompany.location || "",
                // Custom content with proper formatting
                customContent: sanitizedContent,
                customParagraph1: sanitizedContent,
                // Include all company data
                ...(selectedCompany.data || {}),
            };

            console.log("Sending data for build:", enhancedData);

            buildResult = await buildCoverLetter(
                selectedTemplate.id,
                selectedCompany.id,
                enhancedData,
            );
        } catch (err) {
            error = `Cover letter build failed: ${err.message}`;
        } finally {
            generating = false;
        }
    }
</script>

<div class="generator-page">
    <h1>Cover Letter Generator</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if buildResult}
        <div class="success">
            Cover letter successfully generated! File: {buildResult.filename}
        </div>
    {/if}

    <div class="action-bar">
        <a href="/" class="button">Back to Dashboard</a>
    </div>

    <div class="generator-layout">
        <div class="selection-panels">
            <div class="panel">
                <h2>1. Choose Cover Letter Template</h2>
                {#if loading}
                    <p>Loading templates...</p>
                {:else if templates.length === 0}
                    <div class="empty-state">
                        <p>No cover letter templates found.</p>
                        <a href="/cover-letters/new" class="button"
                            >Add Template</a
                        >
                    </div>
                {:else}
                    <div class="template-grid">
                        {#each templates as template}
                            <div
                                class="template-card {selectedTemplate?.id ===
                                template.id
                                    ? 'selected'
                                    : ''}"
                                on:click={() => (selectedTemplate = template)}
                            >
                                <h3>{template.name}</h3>
                                <p>
                                    {template.description ||
                                        "No description provided"}
                                </p>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="panel">
                <h2>2. Choose Company</h2>
                {#if loading}
                    <p>Loading companies...</p>
                {:else if companies.length === 0}
                    <div class="empty-state">
                        <p>No companies found.</p>
                        <a href="/companies/new" class="button">Add Company</a>
                    </div>
                {:else}
                    <div class="company-grid">
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

            <div class="panel">
                <h2>3. Custom Content</h2>
                <p class="hint">
                    Add personalized content for this specific cover letter:
                </p>
                <textarea
                    bind:value={customContent}
                    rows="8"
                    placeholder="Explain why you're a good fit for this position and company. This will be inserted at the appropriate place in your cover letter template."
                ></textarea>
            </div>
        </div>

        <div class="preview-panel">
            <h2>4. Preview & Generate</h2>

            <div class="preview-actions">
                <button
                    class="button primary"
                    disabled={!selectedTemplate ||
                        !selectedCompany ||
                        generating}
                    on:click={handleGeneratePreview}
                >
                    {generating ? "Generating..." : "Generate Preview"}
                </button>

                <button
                    class="button success"
                    disabled={!previewUrl || generating}
                    on:click={handleBuildPDF}
                >
                    {generating ? "Building..." : "Build Final Cover Letter"}
                </button>
            </div>

            <div class="pdf-container">
                {#if generating}
                    <div class="loading-overlay">
                        <div class="loader"></div>
                        <p>Generating cover letter...</p>
                    </div>
                {/if}

                <PDFPreview url={previewUrl} />

                {#if !previewUrl && !generating}
                    <div class="preview-placeholder">
                        <p>
                            Select a template and company, then click "Generate
                            Preview"
                        </p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .generator-page {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
    }

    .generator-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        margin-top: 1rem;
    }

    .selection-panels {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .panel {
        background: white;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .preview-panel {
        background: white;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        grid-row: span 3;
    }

    .template-grid,
    .company-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
        max-height: 300px;
        overflow-y: auto;
    }

    .template-card,
    .company-card {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .template-card:hover,
    .company-card:hover {
        background-color: #f0f0f0;
    }

    .template-card.selected,
    .company-card.selected {
        border-color: #007bff;
        background-color: #e6f2ff;
    }

    .template-card h3,
    .company-card h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
    }

    .template-card p {
        margin: 0;
        font-size: 0.8rem;
        color: #666;
    }

    .company-card .position {
        font-weight: 500;
        margin-top: 0.25rem;
    }

    .company-card .location {
        color: #555;
        margin-top: 0.25rem;
        font-size: 0.9rem;
    }

    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: inherit;
        resize: vertical;
    }

    .hint {
        margin-top: 0;
        font-size: 0.9rem;
        color: #666;
    }

    .preview-actions {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .pdf-container {
        position: relative;
        height: 600px;
        border: 1px solid #eee;
        border-radius: 4px;
    }

    .preview-placeholder {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f9fa;
        color: #6c757d;
        text-align: center;
        padding: 2rem;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10;
    }

    .loader {
        width: 48px;
        height: 48px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
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

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .success {
        background-color: #d4edda;
        color: #155724;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }
</style>
