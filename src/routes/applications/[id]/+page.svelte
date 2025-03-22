<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { getApplication, saveApplication, getCompanies } from "$lib/api";

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
          }
        : null;

    let companies = [];
    let loading = true;
    let saving = false;
    let error = null;
    let successMessage = null;

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
    </div>

    {#if loading}
        <div class="loading">Loading application data...</div>
    {:else}
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
                    <label>Status History</label>
                    <div class="status-history">
                        {#each application.statusHistory as statusEntry}
                            <div class="status-entry">
                                <span
                                    class="status-badge {statusEntry.status.toLowerCase()}"
                                >
                                    {statusEntry.status}
                                </span>
                                <span class="status-date"
                                    >{formatDate(statusEntry.date)}</span
                                >
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if !isNew && (application.cvPath || application.coverLetterPath)}
                <div class="form-group">
                    <label>Documents</label>
                    <div class="documents">
                        {#if application.cvPath}
                            <a
                                href="/build/{application.cvPath}"
                                target="_blank"
                                class="document-link"
                            >
                                View CV
                            </a>
                        {/if}
                        {#if application.coverLetterPath}
                            <a
                                href="/build/{application.coverLetterPath}"
                                target="_blank"
                                class="document-link"
                            >
                                View Cover Letter
                            </a>
                        {/if}
                    </div>
                </div>
            {/if}

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
                <button type="submit" class="button primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Application"}
                </button>
            </div>
        </form>
    {/if}
</div>

<style>
    .application-editor {
        max-width: 800px;
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
    }

    textarea {
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

    .documents {
        display: flex;
        gap: 1rem;
    }

    .document-link {
        display: inline-block;
        padding: 0.5rem 1rem;
        background-color: #f8f9fa;
        color: #333;
        text-decoration: none;
        border-radius: 4px;
        border: 1px solid #ddd;
    }

    .document-link:hover {
        background-color: #e9ecef;
    }

    .form-actions {
        margin-top: 2rem;
        display: flex;
        justify-content: flex-end;
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
