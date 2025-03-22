<script>
    import { onMount } from "svelte";
    import { getTemplates, deleteTemplate } from "$lib/api";

    let templates = [];
    let loading = true;
    let error = null;

    onMount(async () => {
        try {
            templates = await getTemplates();
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this template?")) {
            return;
        }

        try {
            await deleteTemplate(id);
            templates = templates.filter((t) => t.id !== id);
        } catch (err) {
            error = err.message;
        }
    }
</script>

<div class="container">
    <h1>Templates</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    <div class="action-bar">
        <a href="/" class="button">Back to Dashboard</a>
        <a href="/templates/new" class="button primary">New Template</a>
    </div>

    {#if loading}
        <div class="loading">Loading templates...</div>
    {:else if templates.length === 0}
        <div class="empty-state">
            No templates found. <a href="/templates/new">Create one</a>.
        </div>
    {:else}
        <div class="templates-list">
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each templates as template}
                        <tr>
                            <td>{template.name}</td>
                            <td>{template.description || "—"}</td>
                            <td
                                >{new Date(
                                    template.createdAt,
                                ).toLocaleDateString()}</td
                            >
                            <td class="actions">
                                <a
                                    href="/templates/{template.id}"
                                    class="button small">Edit</a
                                >
                                <button
                                    class="button small danger"
                                    on:click={() => handleDelete(template.id)}
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
    /* Similar styles to the dashboard */
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
    }

    .action-bar {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th,
    td {
        text-align: left;
        padding: 0.5rem;
        border-bottom: 1px solid #eee;
    }

    th {
        background-color: #f9f9f9;
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    .button.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
    }

    .button.danger {
        background-color: #dc3545;
        color: white;
        border-color: #c82333;
    }
</style>
