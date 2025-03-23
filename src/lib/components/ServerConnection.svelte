<script>
    import { onMount, onDestroy } from "svelte";

    let serverAvailable = false;
    let checking = true;
    let retryCount = 0;
    let maxRetries = 15;
    let checkInterval;

    onMount(() => {
        checkServerConnection();

        // Set up periodic health checks
        checkInterval = setInterval(checkServerHealth, 30000); // Check every 30 sec
    });

    onDestroy(() => {
        if (checkInterval) clearInterval(checkInterval);
    });

    async function checkServerConnection() {
        try {
            const response = await fetch("http://localhost:3001/api/health", {
                method: "GET",
                headers: { "Cache-Control": "no-cache" },
            });

            if (response.ok) {
                serverAvailable = true;
                checking = false;
            } else {
                retry();
            }
        } catch (err) {
            console.warn("Server connection error:", err);
            retry();
        }
    }

    async function checkServerHealth() {
        if (!serverAvailable) return; // Skip if we already know server is down

        try {
            const response = await fetch("http://localhost:3001/api/health");
            if (!response.ok) {
                serverAvailable = false;
                checking = true;
                retryCount = 0;
                checkServerConnection(); // Start retry process
            }
        } catch (err) {
            serverAvailable = false;
            checking = true;
            retryCount = 0;
            checkServerConnection(); // Start retry process
        }
    }

    function retry() {
        retryCount++;
        if (retryCount < maxRetries) {
            setTimeout(checkServerConnection, 1000);
        } else {
            checking = false;
        }
    }
</script>

{#if checking}
    <div class="server-connection-overlay">
        <div class="connection-status">
            <div class="loader"></div>
            <h2>Connecting to application server...</h2>
            <p>Attempt {retryCount + 1}/{maxRetries}</p>
        </div>
    </div>
{:else if !serverAvailable}
    <div class="server-connection-overlay">
        <div class="connection-status error">
            <h2>Connection Error</h2>
            <p>
                Could not connect to the application server after {maxRetries} attempts.
            </p>
            <p>The application may not function correctly.</p>
            <button on:click={() => window.location.reload()}>Retry</button>
        </div>
    </div>
{/if}

<style>
    .server-connection-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .connection-status {
        background-color: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 80%;
    }

    .connection-status.error {
        border-left: 4px solid #dc3545;
    }

    .loader {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 2s linear infinite;
        margin: 0 auto 1rem;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    h2 {
        margin-top: 0;
    }

    button {
        padding: 0.5rem 1rem;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 1rem;
    }
</style>
