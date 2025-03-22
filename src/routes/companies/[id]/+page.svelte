<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { getCompany, saveCompany } from "$lib/api";

    const id = $page.params.id;
    const isNew = id === "new";

    let company = {
        name: "",
        position: "",
        location: "",
        data: {}, // This will hold dynamic fields
    };

    // For adding custom fields
    let newFieldName = "";
    let newFieldValue = "";

    let loading = !isNew;
    let saving = false;
    let error = null;
    let successMessage = null;

    onMount(async () => {
        if (!isNew) {
            try {
                company = await getCompany(id);
                // Ensure company.data exists
                if (!company.data) company.data = {};
            } catch (err) {
                error = err.message;
            } finally {
                loading = false;
            }
        } else {
            loading = false; // No need to load for new company
        }
    });

    async function handleSubmit() {
        saving = true;
        error = null;
        successMessage = null;

        try {
            const result = await saveCompany(company);
            company = result;
            successMessage = "Company saved successfully!";

            // If it was new, redirect to the edit page
            if (isNew && result.id) {
                window.location.href = `/companies/${result.id}`;
            }
        } catch (err) {
            error = err.message;
        } finally {
            saving = false;
        }
    }

    function addCustomField() {
        if (!newFieldName.trim()) return;

        company.data = {
            ...company.data,
            [newFieldName]: newFieldValue,
        };

        // Clear the inputs
        newFieldName = "";
        newFieldValue = "";
    }

    function removeCustomField(key) {
        const newData = { ...company.data };
        delete newData[key];
        company.data = newData;
    }
</script>

<div class="container">
    <h1>{isNew ? "New Company" : `Edit Company: ${company.name}`}</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if successMessage}
        <div class="success">{successMessage}</div>
    {/if}

    <div class="action-bar">
        <a href="/companies" class="button">Back to Companies</a>
    </div>

    {#if loading}
        <div class="loading">Loading company...</div>
    {:else}
        <form on:submit|preventDefault={handleSubmit}>
            <div class="form-group">
                <label for="name">Company Name</label>
                <input
                    type="text"
                    id="name"
                    bind:value={company.name}
                    required
                />
            </div>

            <div class="form-group">
                <label for="position">Position</label>
                <input
                    type="text"
                    id="position"
                    bind:value={company.position}
                />
            </div>

            <div class="form-group">
                <label for="location">Location</label>
                <input
                    type="text"
                    id="location"
                    bind:value={company.location}
                />
            </div>

            <h3>Custom Fields</h3>
            <p class="hint">
                These fields will be used to replace placeholders in your
                templates.
            </p>

            <div class="custom-fields">
                {#if Object.keys(company.data || {}).length === 0}
                    <div class="no-fields">No custom fields yet.</div>
                {:else}
                    {#each Object.entries(company.data) as [key, value]}
                        <div class="field-row">
                            <div class="field-key">{key}</div>
                            <div class="field-value">
                                <input
                                    type="text"
                                    bind:value={company.data[key]}
                                />
                            </div>
                            <button
                                type="button"
                                class="button small danger"
                                on:click={() => removeCustomField(key)}
                            >
                                Remove
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>

            <div class="add-field">
                <div class="field-inputs">
                    <input
                        type="text"
                        placeholder="Field name"
                        bind:value={newFieldName}
                    />
                    <input
                        type="text"
                        placeholder="Field value"
                        bind:value={newFieldValue}
                    />
                </div>
                <button
                    type="button"
                    class="button"
                    on:click={addCustomField}
                    disabled={!newFieldName.trim()}
                >
                    Add Field
                </button>
            </div>

            <div class="form-actions">
                <button type="submit" class="button primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Company"}
                </button>
            </div>
        </form>
    {/if}
</div>

<style>
    .container {
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

    input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .hint {
        font-size: 0.8rem;
        color: #666;
        margin-top: 0.25rem;
    }

    .custom-fields {
        margin-bottom: 1rem;
        border: 1px solid #eee;
        border-radius: 4px;
        padding: 1rem;
    }

    .field-row {
        display: grid;
        grid-template-columns: 1fr 3fr auto;
        gap: 1rem;
        align-items: center;
        margin-bottom: 0.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #eee;
    }

    .no-fields {
        color: #999;
        font-style: italic;
    }

    .add-field {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .field-inputs {
        display: flex;
        gap: 0.5rem;
        flex-grow: 1;
    }

    .form-actions {
        margin-top: 1rem;
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

    .button.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
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

    .button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
