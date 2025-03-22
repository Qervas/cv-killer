<script>
    export let company;
    export let selected = false;

    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    function handleClick() {
        dispatch("click");
    }
</script>

<div class="company-card {selected ? 'selected' : ''}" on:click={handleClick}>
    <h3>{company.name}</h3>
    {#if company.position}
        <div class="position">{company.position}</div>
    {/if}
    {#if company.location}
        <div class="location">{company.location}</div>
    {/if}
    <div class="date">
        {#if company.updatedAt}
            Updated: {new Date(company.updatedAt).toLocaleDateString()}
        {:else if company.createdAt}
            Created: {new Date(company.createdAt).toLocaleDateString()}
        {/if}
    </div>
</div>

<style>
    .company-card {
        padding: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        margin-bottom: 0.5rem;
        transition: all 0.2s;
    }

    .company-card:hover {
        background-color: #f0f0f0;
    }

    .company-card.selected {
        border-color: #007bff;
        background-color: #e6f2ff;
    }

    h3 {
        margin: 0;
        font-size: 1.2rem;
    }

    .position {
        font-weight: 500;
        margin-top: 0.5rem;
    }

    .location {
        color: #555;
        margin-top: 0.25rem;
    }

    .date {
        font-size: 0.8rem;
        color: #777;
        margin-top: 0.5rem;
    }
</style>
