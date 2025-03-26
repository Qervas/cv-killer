<script>
    export let url;
</script>

<div class="pdf-preview">
    {#if url}
        <iframe title="PDF Preview" src={url} class="pdf-iframe"></iframe>
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
