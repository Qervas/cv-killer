<script>
    import LatexInstaller from "$lib/components/LatexInstaller.svelte";
    import ServerConnection from "$lib/components/ServerConnection.svelte";
</script>

<ServerConnection />
<LatexInstaller />

<slot></slot>
