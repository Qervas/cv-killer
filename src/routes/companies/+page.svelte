<script>
    import { onMount } from "svelte";
    import { getCompanies, deleteCompany } from "$lib/api";
    import { fade } from "svelte/transition";

    let companies = [];
    let filteredCompanies = [];
    let loading = true;
    let error = null;
    let searchQuery = "";

    onMount(async () => {
        try {
            companies = await getCompanies();
            filteredCompanies = [...companies];
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    // Search/filter functionality
    $: {
        if (companies) {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filteredCompanies = companies.filter(
                    (company) =>
                        company.name.toLowerCase().includes(query) ||
                        (company.position &&
                            company.position.toLowerCase().includes(query)) ||
                        (company.location &&
                            company.location.toLowerCase().includes(query)),
                );
            } else {
                filteredCompanies = [...companies];
            }
        }
    }

    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this company?")) {
            return;
        }

        try {
            await deleteCompany(id);
            companies = companies.filter((c) => c.id !== id);
            // filteredCompanies will update reactively
        } catch (err) {
            error = err.message;
        }
    }
</script>

<div class="companies-page">
    <h1>Companies</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    <div class="toolbar">
        <div class="search">
            <input
                type="text"
                placeholder="Search companies..."
                bind:value={searchQuery}
            />
        </div>
        <div class="actions">
            <a href="/" class="button">Dashboard</a>
            <a href="/companies/new" class="button primary">Add Company</a>
        </div>
    </div>

    {#if loading}
        <div class="loading">Loading companies...</div>
    {:else if filteredCompanies.length === 0}
        <div class="empty-state">
            {searchQuery
                ? "No companies match your search criteria."
                : "No companies found. Add your first company!"}
        </div>
    {:else}
        <div class="companies-list" transition:fade>
            <table>
                <thead>
                    <tr>
                        <th>Company</th>
                        <th>Position</th>
                        <th>Location</th>
                        <th>Date Added</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each filteredCompanies as company}
                        <tr>
                            <td class="company-name">{company.name}</td>
                            <td>{company.position || "—"}</td>
                            <td>{company.location || "—"}</td>
                            <td
                                >{new Date(
                                    company.createdAt,
                                ).toLocaleDateString()}</td
                            >
                            <td class="actions">
                                <a
                                    href="/companies/{company.id}"
                                    class="button small">Edit</a
                                >
                                <button
                                    class="button small danger"
                                    on:click={() => handleDelete(company.id)}
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
    .companies-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
    }

    .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .search {
        flex-grow: 1;
        max-width: 500px;
    }

    .search input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        background: white;
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

    .company-name {
        font-weight: 500;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    .empty-state {
        text-align: center;
        padding: 3rem;
        background-color: #f8f9fa;
        border-radius: 4px;
        color: #6c757d;
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
