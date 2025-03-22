<script>
    import { onMount } from "svelte";
    import TemplateCard from "$lib/components/TemplateCard.svelte";
    import CompanyCard from "$lib/components/CompanyCard.svelte";
    import PDFPreview from "$lib/components/PDFPreview.svelte";
    import {
        getTemplates,
        getCompanies,
        generatePreview,
        buildPDF,
    } from "$lib/api";

    let templates = [];
    let companies = [];
    let selectedTemplate = null;
    let selectedCompany = null;
    let previewUrl = null;
    let loading = true;
    let generating = false;
    let error = null;
    let buildResult = null;

    onMount(async () => {
        try {
            [templates, companies] = await Promise.all([
                getTemplates(),
                getCompanies(),
            ]);
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    async function handleGeneratePreview() {
        if (!selectedTemplate || !selectedCompany) return;

        generating = true;
        error = null;

        try {
            const result = await generatePreview(
                selectedTemplate.id,
                selectedCompany.id,
            );
            // Construct the full URL for the preview
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
            buildResult = await buildPDF(
                selectedTemplate.id,
                selectedCompany.id,
            );
        } catch (err) {
            error = `PDF build failed: ${err.message}`;
        } finally {
            generating = false;
        }
    }
</script>

<div class="generator-page">
    <h1>CV Generator</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if buildResult}
        <div class="success">
            CV successfully generated! File: {buildResult.filename}
        </div>
    {/if}

    <div class="action-bar">
        <a href="/" class="button">Back to Dashboard</a>
    </div>

    <div class="generator-layout">
        <div class="selection-panels">
            <div class="panel">
                <h2>1. Choose Template</h2>
                {#if loading}
                    <p>Loading templates...</p>
                {:else if templates.length === 0}
                    <div class="empty-state">
                        <p>No templates found.</p>
                        <a href="/templates/new" class="button">Add Template</a>
                    </div>
                {:else}
                    <div class="card-grid">
                        {#each templates as template}
                            <TemplateCard
                                {template}
                                selected={selectedTemplate?.id === template.id}
                                on:click={() => (selectedTemplate = template)}
                            />
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
                    <div class="card-grid">
                        {#each companies as company}
                            <CompanyCard
                                {company}
                                selected={selectedCompany?.id === company.id}
                                on:click={() => (selectedCompany = company)}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <div class="preview-panel">
            <h2>3. Preview & Generate</h2>

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
                    {generating ? "Building..." : "Build Final PDF"}
                </button>
            </div>

            <div class="pdf-container">
                {#if generating}
                    <div class="loading-overlay">
                        <div class="loader"></div>
                        <p>Generating PDF...</p>
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
        grid-row: span 2;
    }

    .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1rem;
        max-height: 300px;
        overflow-y: auto;
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

    .empty-state {
        text-align: center;
        padding: 1.5rem;
        background: #f8f9fa;
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
