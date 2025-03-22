<script>
    import { onMount } from "svelte";
    import {
        getCoverLetterTemplates,
        deleteCoverLetterTemplate,
    } from "$lib/api";

    let templates = [];
    let loading = true;
    let error = null;

    onMount(async () => {
        try {
            templates = await getCoverLetterTemplates();
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    async function handleDelete(id) {
        if (
            !confirm(
                "Are you sure you want to delete this cover letter template?",
            )
        ) {
            return;
        }

        try {
            await deleteCoverLetterTemplate(id);
            templates = templates.filter((t) => t.id !== id);
        } catch (err) {
            error = err.message;
        }
    }
</script>

<div class="container">
    <h1>Cover Letter Templates</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    <div class="action-bar">
        <a href="/" class="button">Back to Dashboard</a>
        <a href="/cover-letters/new" class="button primary"
            >New Cover Letter Template</a
        >
    </div>

    {#if loading}
        <div class="loading">Loading cover letter templates...</div>
    {:else if templates.length === 0}
        <div class="empty-state">
            <p>No cover letter templates found.</p>
            <a href="/cover-letters/new" class="button primary"
                >Create your first cover letter template</a
            >
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
                                    href="/cover-letters/{template.id}"
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

    .empty-state {
        text-align: center;
        padding: 3rem;
        background-color: #f8f9fa;
        border-radius: 4px;
    }

    .button.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
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

    .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
    }

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }
</style>
