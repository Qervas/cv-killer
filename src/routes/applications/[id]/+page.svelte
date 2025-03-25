<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { getApplication, saveApplication, getCompanies } from "$lib/api";
    import DocumentEditor from "$lib/components/DocumentEditor.svelte";
    import { formatDateTime, formatRelativeTime } from "$lib/utils";

    const id = $page.params.id;
    const isNew = id === "new";

    let application = isNew
        ? {
              companyId: null,
              company: {},
              cvTemplateId: null,
              coverLetterTemplateId: null,
              cvPath: null,
              coverLetterPath: null,
              customContent: "",
              notes: "",
              status: "Applied",
              statusHistory: [],
              documents: {},
          }
        : null;

    let companies = [];
    let loading = true;
    let saving = false;
    let regenerating = false;
    let error = null;
    let successMessage = null;
    let activeTab = "details"; // 'details', 'cv', 'coverLetter'

    // Status options
    const statusOptions = [
        "Applied",
        "Interview",
        "Offer",
        "Rejected",
        "Withdrawn",
    ];

    onMount(async () => {
        try {
            // Get available companies
            companies = await getCompanies();

            if (!isNew) {
                // Fetch existing application data
                application = await getApplication(id);

                // Ensure documents object exists
                if (!application.documents) {
                    application.documents = {};
                }
            }
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    // Update company details when companyId changes
    $: if (application?.companyId && companies.length > 0) {
        const selectedCompany = companies.find(
            (c) => c.id === application.companyId,
        );
        if (selectedCompany) {
            application.company = {
                name: selectedCompany.name,
                position: selectedCompany.position,
                location: selectedCompany.location,
            };
        }
    }

    // Handle status change to update history
    function updateStatus(newStatus) {
        if (!application.statusHistory) {
            application.statusHistory = [];
        }

        // Only add to history if status actually changed
        if (application.status !== newStatus) {
            application.statusHistory.push({
                status: newStatus,
                date: new Date().toISOString(),
            });
            application.status = newStatus;
        }
    }

    // Save application
    async function handleSubmit() {
        saving = true;
        error = null;
        successMessage = null;

        try {
            if (!application.companyId) {
                throw new Error("Please select a company");
            }

            // Add initial status history entry if this is a new application
            if (isNew && !application.statusHistory.length) {
                application.statusHistory = [
                    {
                        status: application.status,
                        date: new Date().toISOString(),
                    },
                ];
            }

            const result = await saveApplication(application);
            application = result;
            successMessage = "Application saved successfully!";

            // If it was new, redirect to the edit page
            if (isNew && result.id) {
                setTimeout(() => {
                    window.location.href = `/applications/${result.id}`;
                }, 1500);
            }
        } catch (err) {
            error = err.message;
        } finally {
            saving = false;
        }
    }

    // Format date for display
    function formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    // Regenerate documents
    async function regenerateDocument(type) {
        regenerating = true;
        error = null;
        successMessage = null;

        try {
            const response = await fetch(
                `http://localhost:3001/api/applications/${id}/regenerate`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        documentType: type,
                        customContent: application.customContent,
                    }),
                },
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to regenerate document");
            }

            const result = await response.json();
            successMessage = `Document${result.regenerated.length > 1 ? "s" : ""} regenerated successfully!`;

            // Update application paths
            if (result.paths.cv) {
                application.cvPath = result.paths.cv;
            }

            if (result.paths.coverLetter) {
                application.coverLetterPath = result.paths.coverLetter;
            }

            // Refresh data (optional)
            application = await getApplication(id);
        } catch (err) {
            error = err.message;
        } finally {
            regenerating = false;
        }
    }
</script>

<div class="application-editor">
    <h1>
        {isNew
            ? "New Application"
            : `Application for ${application?.company?.name || "Unknown Company"}`}
    </h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="success">{successMessage}</div>
    {/if}

    <div class="action-bar">
        <a href="/applications" class="button">Back to Applications</a>

        {#if (!isNew && application?.coverLetterPath) || application?.cvPath}
            <div class="dropdown">
                <button class="button dropdown-toggle">View Documents</button>
                <div class="dropdown-content">
                    {#if application.cvPath}
                        <a
                            href="http://localhost:3001/build/{application.cvPath}"
                            target="_blank">View CV</a
                        >
                    {/if}
                    {#if application.coverLetterPath}
                        <a
                            href="http://localhost:3001/build/{application.coverLetterPath}"
                            target="_blank">View Cover Letter</a
                        >
                    {/if}
                </div>
            </div>

            <button
                class="button"
                disabled={regenerating}
                on:click={() => regenerateDocument()}
            >
                {regenerating ? "Regenerating..." : "Regenerate Documents"}
            </button>
        {/if}
    </div>

    {#if loading}
        <div class="loading">Loading application data...</div>
    {:else}
        <div class="tabs">
            <button
                class="tab-button {activeTab === 'details' ? 'active' : ''}"
                on:click={() => (activeTab = "details")}
            >
                Details
            </button>

            {#if !isNew && application.documents?.cvContent}
                <button
                    class="tab-button {activeTab === 'cv' ? 'active' : ''}"
                    on:click={() => (activeTab = "cv")}
                >
                    CV Document
                </button>
            {/if}

            {#if !isNew && application.documents?.coverLetterContent}
                <button
                    class="tab-button {activeTab === 'coverLetter'
                        ? 'active'
                        : ''}"
                    on:click={() => (activeTab = "coverLetter")}
                >
                    Cover Letter Document
                </button>
            {/if}
        </div>

        {#if activeTab === "details"}
            <form on:submit|preventDefault={handleSubmit}>
                <div class="form-group">
                    <label for="company">Company *</label>
                    <select
                        id="company"
                        bind:value={application.companyId}
                        required
                    >
                        <option value="">-- Select Company --</option>
                        {#each companies as company}
                            <option value={company.id}
                                >{company.name} - {company.position ||
                                    "No position"}</option
                            >
                        {/each}
                    </select>
                </div>

                <div class="form-group">
                    <label for="status">Status *</label>
                    <select
                        id="status"
                        bind:value={application.status}
                        on:change={() => updateStatus(application.status)}
                        required
                    >
                        {#each statusOptions as status}
                            <option value={status}>{status}</option>
                        {/each}
                    </select>
                </div>

                {#if !isNew && application.statusHistory?.length > 0}
                    <div class="form-group">
                        <label for="status-history">Status History</label>
                        <div id="status-history" class="status-history">
                            {#each application.statusHistory as statusEntry}
                                <div class="status-entry">
                                    <span
                                        class="status-badge {statusEntry.status.toLowerCase()}"
                                    >
                                        {statusEntry.status}
                                    </span>
                                    <span class="status-date"
                                        >{formatDateTime(
                                            statusEntry.date,
                                        )}</span
                                    >
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if application?.updatedAt}
                    <div class="last-updated">
                        Last updated: {formatRelativeTime(
                            application.updatedAt,
                        )}
                    </div>
                {/if}

                <div class="form-group">
                    <label for="customContent"
                        >Custom Content for Cover Letter</label
                    >
                    <textarea
                        id="customContent"
                        bind:value={application.customContent}
                        rows="5"
                        placeholder="Add custom content for your cover letter"
                    ></textarea>
                </div>

                <div class="form-group">
                    <label for="notes">Notes</label>
                    <textarea
                        id="notes"
                        bind:value={application.notes}
                        rows="5"
                        placeholder="Add your notes about this application, interview feedback, etc."
                    ></textarea>
                </div>

                <div class="form-actions">
                    <button
                        type="submit"
                        class="button primary"
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Application"}
                    </button>
                </div>
            </form>
        {:else if activeTab === "cv" && application.documents?.cvContent}
            <div class="document-tab">
                <h2>CV Document</h2>
                <p class="hint">
                    Edit the LaTeX document directly. Changes here will be used
                    when regenerating the PDF.
                </p>

                <DocumentEditor
                    content={application.documents.cvContent}
                    documentType="cv"
                    applicationId={application.id}
                    height="500px"
                />

                <div class="document-actions">
                    <button
                        class="button primary"
                        disabled={regenerating}
                        on:click={() => regenerateDocument("cv")}
                    >
                        {regenerating ? "Regenerating..." : "Regenerate CV PDF"}
                    </button>

                    {#if application.cvPath}
                        <a
                            href="http://localhost:3001/build/{application.cvPath}"
                            target="_blank"
                            class="button">View PDF</a
                        >
                    {/if}
                </div>
            </div>
        {:else if activeTab === "coverLetter" && application.documents?.coverLetterContent}
            <div class="document-tab">
                <h2>Cover Letter Document</h2>
                <p class="hint">
                    Edit the LaTeX document directly. Changes here will be used
                    when regenerating the PDF.
                </p>

                <DocumentEditor
                    content={application.documents.coverLetterContent}
                    documentType="coverLetter"
                    applicationId={application.id}
                    height="500px"
                />

                <div class="document-actions">
                    <button
                        class="button primary"
                        disabled={regenerating}
                        on:click={() => regenerateDocument("coverLetter")}
                    >
                        {regenerating
                            ? "Regenerating..."
                            : "Regenerate Cover Letter PDF"}
                    </button>

                    {#if application.coverLetterPath}
                        <a
                            href="http://localhost:3001/build/{application.coverLetterPath}"
                            target="_blank"
                            class="button">View PDF</a
                        >
                    {/if}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .application-editor {
        max-width: 900px;
        margin: 0 auto;
        padding: 1.5rem;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
    }

    input,
    select,
    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
        resize: vertical;
    }

    .status-history {
        border: 1px solid #eee;
        border-radius: 4px;
        padding: 1rem;
        background-color: #f9f9f9;
    }

    .status-entry {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #eee;
    }

    .status-entry:last-child {
        border-bottom: none;
    }

    .status-badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 1rem;
        font-size: 0.8rem;
        font-weight: 500;
        text-transform: uppercase;
    }

    .status-badge.applied {
        background-color: #cff4fc;
        color: #055160;
    }

    .status-badge.interview {
        background-color: #fff3cd;
        color: #664d03;
    }

    .status-badge.offer {
        background-color: #d1e7dd;
        color: #0f5132;
    }

    .status-badge.rejected {
        background-color: #f8d7da;
        color: #842029;
    }

    .status-badge.withdrawn {
        background-color: #e2e3e5;
        color: #41464b;
    }

    .form-actions {
        margin-top: 2rem;
        display: flex;
        justify-content: flex-end;
    }

    .action-bar {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .tabs {
        display: flex;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid #ddd;
    }

    .tab-button {
        padding: 0.75rem 1.5rem;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1rem;
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
    }

    .tab-button.active {
        border-bottom: 3px solid #007bff;
        font-weight: 500;
    }

    .tab-button:hover {
        background-color: #f0f0f0;
    }

    .document-tab {
        padding: 1rem 0;
    }

    .hint {
        color: #666;
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }

    .document-actions {
        margin-top: 1rem;
        display: flex;
        gap: 1rem;
    }

    .dropdown {
        position: relative;
        display: inline-block;
    }

    .dropdown-content {
        display: none;
        position: absolute;
        background-color: #f9f9f9;
        min-width: 160px;
        box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
        z-index: 1;
        border-radius: 4px;
        overflow: hidden;
    }

    .dropdown-content a {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
    }

    .dropdown-content a:hover {
        background-color: #f1f1f1;
    }

    .dropdown:hover .dropdown-content {
        display: block;
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

    .button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
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

    .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
    }
</style>
