<script>
    import { onMount } from "svelte";
    import { getApplications, deleteApplication } from "$lib/api";
    import { formatDateTime, formatRelativeTime } from "$lib/utils";

    let applications = [];
    let loading = true;
    let error = null;
    let searchQuery = "";
    let statusFilter = "All";

    // Status options for filtering
    const statusOptions = [
        "All",
        "Applied",
        "Interview",
        "Offer",
        "Rejected",
        "Withdrawn",
    ];

    onMount(async () => {
        try {
            applications = await getApplications();
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    // Filter applications based on search query and status
    $: filteredApplications = applications.filter((app) => {
        const matchesSearch =
            searchQuery.trim() === "" ||
            app.company?.name
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
            app.company?.position
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase());

        const matchesStatus =
            statusFilter === "All" || app.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Handle deleting an application
    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this application?")) {
            return;
        }

        try {
            await deleteApplication(id);
            applications = applications.filter((app) => app.id !== id);
        } catch (err) {
            error = err.message;
        }
    }

    // Format date function
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }
</script>

<div class="applications-page">
    <h1>Job Applications</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    <div class="toolbar">
        <div class="filters">
            <div class="search">
                <input
                    type="text"
                    placeholder="Search by company or position..."
                    bind:value={searchQuery}
                />
            </div>

            <div class="status-filter">
                <label for="status">Status:</label>
                <select id="status" bind:value={statusFilter}>
                    {#each statusOptions as status}
                        <option value={status}>{status}</option>
                    {/each}
                </select>
            </div>
        </div>

        <div class="actions">
            <a href="/" class="button">Dashboard</a>
            <a href="/applications/new" class="button primary"
                >New Application</a
            >
        </div>
    </div>

    {#if loading}
        <div class="loading">Loading applications...</div>
    {:else if filteredApplications.length === 0}
        <div class="empty-state">
            {searchQuery || statusFilter !== "All"
                ? "No applications match your search criteria."
                : "No applications found. Create your first job application!"}
        </div>
    {:else}
        <div class="applications-table">
            <table>
                <thead>
                    <tr>
                        <th>Company</th>
                        <th>Position</th>
                        <th>Application Date</th>
                        <th>Status</th>
                        <th>Documents</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each filteredApplications as app}
                        <tr class="application-row {app.status?.toLowerCase()}">
                            <td>{app.company?.name || "Unknown Company"}</td>
                            <td
                                >{app.company?.position ||
                                    "Unknown Position"}</td
                            >
                            <td title={formatDateTime(app.createdAt)}>
                                {formatRelativeTime(app.createdAt)}
                            </td>
                            <td>
                                <span
                                    class="status-badge {app.status?.toLowerCase()}"
                                    >{app.status || "Unknown"}</span
                                >
                            </td>
                            <td class="documents">
                                {#if app.cvPath}
                                    <a
                                        href="/build/{app.cvPath}"
                                        target="_blank"
                                        class="document-link">CV</a
                                    >
                                {/if}
                                {#if app.coverLetterPath}
                                    <a
                                        href="/build/{app.coverLetterPath}"
                                        target="_blank"
                                        class="document-link">Cover Letter</a
                                    >
                                {/if}
                            </td>
                            <td class="actions">
                                <a
                                    href="/applications/{app.id}"
                                    class="button small">View/Edit</a
                                >
                                <button
                                    class="button small danger"
                                    on:click={() => handleDelete(app.id)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .applications-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1.5rem;
    }

    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .filters {
        display: flex;
        flex-grow: 1;
        max-width: 700px;
        gap: 1rem;
        align-items: center;
        flex-wrap: wrap;
    }

    .search {
        flex-grow: 1;
        min-width: 200px;
    }

    .search input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .status-filter {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .status-filter select {
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: white;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-radius: 4px;
        overflow: hidden;
    }

    th {
        text-align: left;
        padding: 1rem;
        background-color: #f8f9fa;
        border-bottom: 2px solid #dee2e6;
    }

    td {
        padding: 1rem;
        border-bottom: 1px solid #dee2e6;
    }

    .application-row:hover {
        background-color: #f8f9fa;
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
        gap: 0.5rem;
    }

    .document-link {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        background-color: #f0f0f0;
        color: #333;
        text-decoration: none;
        border-radius: 4px;
        font-size: 0.8rem;
    }

    .document-link:hover {
        background-color: #e0e0e0;
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

    .button.danger {
        background-color: #dc3545;
        color: white;
        border-color: #c82333;
    }

    .button.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
    }

    .empty-state {
        padding: 3rem;
        text-align: center;
        background-color: #f8f9fa;
        border-radius: 4px;
        color: #6c757d;
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
