<script>
    export let url;

    // Ensure URL is properly formatted for both development and production
    $: formattedUrl = url ? (url.startsWith('http') ? url : `http://localhost:3001${url}`) : null;
</script>

<div class="pdf-preview">
    {#if formattedUrl}
        <iframe title="PDF Preview" src={formattedUrl} class="pdf-iframe"></iframe>
    {:else}
        <div class="no-preview">No PDF to preview</div>
    {/if}
</div>

<style>
    .pdf-preview {
        width: 100%;
        height: 600px;
        border: 1px solid #eee;
        border-radius: 4px;
        overflow: hidden;
    }

    .pdf-iframe {
        width: 100%;
        height: 100%;
        border: none;
    }

    .no-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #999;
        font-style: italic;
    }
</style>
