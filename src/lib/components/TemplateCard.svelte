<script>
    export let template;
    export let selected = false;

    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    function handleClick() {
        dispatch("click");
    }
</script>

<div class="template-card {selected ? 'selected' : ''}" on:click={handleClick}>
    <h3>{template.name}</h3>
    <p>{template.description || "No description"}</p>
    <div class="date">
        {#if template.updatedAt}
            Updated: {new Date(template.updatedAt).toLocaleDateString()}
        {:else if template.createdAt}
            Created: {new Date(template.createdAt).toLocaleDateString()}
        {/if}
    </div>
</div>

<style>
    .template-card {
        padding: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        margin-bottom: 0.5rem;
        transition: all 0.2s;
    }

    .template-card:hover {
        background-color: #f0f0f0;
    }

    .template-card.selected {
        border-color: #007bff;
        background-color: #e6f2ff;
    }

    h3 {
        margin: 0;
        font-size: 1.2rem;
    }

    p {
        margin: 0.5rem 0;
        color: #555;
    }

    .date {
        font-size: 0.8rem;
        color: #777;
        margin-top: 0.5rem;
    }
</style>
