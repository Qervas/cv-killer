<script>
    import { onMount } from "svelte";

    let installing = false;
    let progress = 0;
    let status = "";
    let error = null;
    let latexInstalled = false;
    let dialogVisible = false;
    let checkingStatus = false;
    let statusCheckInterval;

    // Check LaTeX status on mount
    onMount(async () => {
        try {
            const response = await fetch(
                "http://localhost:3001/api/latex/status",
            );
            const data = await response.json();
            latexInstalled = data.installed;

            if (!latexInstalled) {
                dialogVisible = true;
            }
        } catch (err) {
            console.error("Error checking LaTeX status:", err);
        }

        return () => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
        };
    });

    // Install LaTeX using standard fetch instead of EventSource
    async function installLatex() {
        installing = true;
        progress = 10;
        status = "Starting LaTeX installation...";
        error = null;
        checkingStatus = false;

        try {
            // Start the installation process
            const response = await fetch(
                "http://localhost:3001/api/latex/install-start",
                {
                    method: "POST",
                },
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Installation failed to start");
            }

            // Installation is running in the background, now periodically check status
            status =
                "LaTeX is installing in the background. This may take a few minutes...";
            progress = 30;
            checkingStatus = true;

            // Start checking the installation status periodically
            statusCheckInterval = setInterval(checkInstallationStatus, 3000);
        } catch (err) {
            console.error("Installation error:", err);
            error = err.message;
            installing = false;
        }
    }

    // Check the status of the installation
    async function checkInstallationStatus() {
        try {
            const response = await fetch(
                "http://localhost:3001/api/latex/install-status",
            );
            const data = await response.json();

            console.log("Installation status:", data);

            // Update the UI with the current status
            status = data.status;
            progress = data.progress;

            // Handle completion or failure
            if (data.progress === 100) {
                // Installation completed successfully
                clearInterval(statusCheckInterval);
                latexInstalled = true;
                installing = false;
                checkingStatus = false;

                // Hide dialog after successful installation
                setTimeout(() => {
                    dialogVisible = false;
                }, 2000);
            } else if (data.progress === -1) {
                // Installation failed
                clearInterval(statusCheckInterval);
                error = data.status;
                installing = false;
                checkingStatus = false;
            }
        } catch (err) {
            console.error("Error checking installation status:", err);
            // Don't stop checking just because of one error
            status = "Checking installation status...";
        }
    }

    function closeDialog() {
        dialogVisible = false;
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
    }
</script>

{#if dialogVisible}
    <div class="latex-dialog-overlay">
        <div class="latex-dialog">
            <h2>LaTeX Installation</h2>

            {#if latexInstalled}
                <div class="success">
                    <p>LaTeX is installed and ready to use.</p>
                    <button on:click={closeDialog}>Close</button>
                </div>
            {:else if installing}
                <div class="progress-container">
                    <p>{status}</p>
                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            style="width: {progress}%"
                        ></div>
                    </div>
                    <p class="percentage">{progress}%</p>

                    {#if checkingStatus}
                        <p class="info-text">
                            This process is running in the background and may
                            take several minutes to complete.
                        </p>
                    {/if}
                </div>
            {:else}
                <p>
                    LaTeX is required for document generation but is not
                    installed.
                </p>

                {#if error}
                    <div class="error">
                        <p>Installation error: {error}</p>
                    </div>
                {/if}

                <div class="alternatives">
                    <h3>Alternative Options</h3>

                    <p>
                        You can use the app without LaTeX by installing LaTeX
                        separately:
                    </p>

                    <ul>
                        <li>
                            <strong>MacTeX (for macOS):</strong>
                            <a
                                href="https://www.tug.org/mactex/mactex-download.html"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Download MacTeX
                            </a>
                        </li>
                        <li>
                            <strong>MiKTeX (for Windows):</strong>
                            <a
                                href="https://miktex.org/download"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Download MiKTeX
                            </a>
                        </li>
                        <li>
                            <strong>TeX Live (for Linux):</strong>
                            Install with your package manager (e.g.,
                            <code>sudo apt-get install texlive-full</code>)
                        </li>
                    </ul>

                    <p>After installing LaTeX, restart this application.</p>

                    <div class="skip-option">
                        <button class="button" on:click={closeDialog}>
                            Continue Without LaTeX
                        </button>
                        <p class="warning">
                            Note: PDF generation will not work until LaTeX is
                            installed.
                        </p>
                    </div>
                </div>

                <div class="actions">
                    <button class="primary" on:click={installLatex}
                        >Install TinyTeX (Minimal LaTeX)</button
                    >
                    <button on:click={closeDialog}>Not Now</button>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .latex-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .latex-dialog {
        background-color: white;
        border-radius: 8px;
        padding: 1.5rem;
        width: 500px;
        max-width: 90%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    h2 {
        margin-top: 0;
        margin-bottom: 1rem;
        color: #333;
    }

    .progress-container {
        margin: 1.5rem 0;
    }

    .progress-bar {
        height: 12px;
        background-color: #e9ecef;
        border-radius: 6px;
        overflow: hidden;
        margin: 0.5rem 0;
    }

    .progress-fill {
        height: 100%;
        background-color: #007bff;
        transition: width 0.3s ease;
    }

    .percentage {
        text-align: center;
        font-size: 0.9rem;
        color: #666;
    }

    .info-text {
        font-size: 0.85rem;
        color: #666;
        font-style: italic;
        text-align: center;
        margin-top: 1rem;
    }

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 4px;
        margin: 1rem 0;
    }

    .success {
        background-color: #d4edda;
        color: #155724;
        padding: 0.75rem;
        border-radius: 4px;
        margin: 1rem 0;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    button {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #ccc;
        background-color: #f8f9fa;
        cursor: pointer;
    }

    button.primary {
        background-color: #007bff;
        color: white;
        border-color: #0069d9;
    }

    .alternatives {
        margin-top: 1.5rem;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 4px;
        border-left: 3px solid #17a2b8;
    }

    .alternatives h3 {
        margin-top: 0;
        color: #17a2b8;
    }

    .alternatives ul {
        margin-bottom: 1rem;
    }

    .alternatives a {
        color: #007bff;
        text-decoration: none;
    }

    .alternatives a:hover {
        text-decoration: underline;
    }

    .alternatives code {
        background-color: #f1f1f1;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
    }

    .skip-option {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #dee2e6;
        text-align: center;
    }

    .warning {
        color: #dc3545;
        font-size: 0.9rem;
        margin-top: 0.5rem;
    }
</style>
