<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { formatRelativeTime } from "$lib/utils";

    export let content = "";
    export let documentType = ""; // "cv" or "coverLetter"
    export let applicationId = "";
    export let readonly = false;
    export let height = "400px";

    let originalContent = content;
    let showDiff = false;
    let saving = false;
    let error = null;
    let success = null;
    export let lastUpdated = null; // Pass in the last updated timestamp

    // Function to save document changes
    async function saveDocument() {
        if (!applicationId || !documentType) {
            error = "Missing application ID or document type";
            return;
        }

        saving = true;
        error = null;
        success = null;

        try {
            const response = await fetch(
                `http://localhost:3001/api/applications/${applicationId}/document`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        documentType,
                        content,
                    }),
                },
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save document");
            }

            success = "Document saved successfully";
            originalContent = content; // Update the original content
        } catch (err) {
            error = err.message;
        } finally {
            saving = false;

            // Clear success message after 3 seconds
            if (success) {
                setTimeout(() => {
                    success = null;
                }, 3000);
            }
        }
    }

    function highlightDiff(original, updated) {
        if (!showDiff) return updated;

        // Simple diff highlighting - not perfect but gives visual cue
        const lines1 = original.split("\n");
        const lines2 = updated.split("\n");
        const result = [];

        const maxLength = Math.max(lines1.length, lines2.length);

        for (let i = 0; i < maxLength; i++) {
            const line1 = i < lines1.length ? lines1[i] : "";
            const line2 = i < lines2.length ? lines2[i] : "";

            if (line1 !== line2) {
                result.push(`<span class="diff-line">${line2}</span>`);
            } else {
                result.push(line2);
            }
        }

        return result.join("\n");
    }
</script>

<div class="document-editor">
    {#if !readonly}
        <div class="toolbar">
            <button
                on:click={saveDocument}
                disabled={saving || content === originalContent}
                class="save-button {content !== originalContent
                    ? 'has-changes'
                    : ''}"
            >
                {saving
                    ? "Saving..."
                    : content !== originalContent
                      ? "Save Changes"
                      : "Saved"}
            </button>

            <label class="diff-toggle">
                <input type="checkbox" bind:checked={showDiff} />
                <span>Show Changes</span>
            </label>
            {#if lastUpdated}
                <div class="last-edited">
                    Last edited: {formatRelativeTime(lastUpdated)}
                </div>
            {/if}
        </div>
    {/if}

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if success}
        <div class="success">{success}</div>
    {/if}

    <div class="editor-container" style="height: {height}">
        {#if readonly}
            <div class="readonly-content">
                <pre>{content}</pre>
            </div>
        {:else}
            <textarea
                bind:value={content}
                disabled={saving}
                class={showDiff && content !== originalContent
                    ? "show-diff"
                    : ""}
                spellcheck="false"
            ></textarea>

            {#if showDiff && content !== originalContent}
                <div class="diff-overlay">
                    <pre>{@html highlightDiff(originalContent, content)}</pre>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .document-editor {
        display: flex;
        flex-direction: column;
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
    }

    .toolbar {
        display: flex;
        padding: 0.5rem;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
        justify-content: space-between;
    }

    .save-button {
        padding: 0.25rem 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f0f0f0;
        cursor: pointer;
    }

    .save-button.has-changes {
        background-color: #007bff;
        color: white;
        border-color: #0069d9;
    }

    .save-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .diff-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: #555;
        cursor: pointer;
    }

    .editor-container {
        position: relative;
        flex-grow: 1;
    }

    textarea {
        width: 100%;
        height: 100%;
        padding: 0.5rem;
        border: none;
        resize: none;
        font-family: monospace;
        font-size: 0.9rem;
        line-height: 1.4;
        outline: none;
        box-sizing: border-box;
    }

    textarea.show-diff {
        opacity: 0;
    }

    .diff-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        padding: 0.5rem;
        box-sizing: border-box;
        overflow: auto;
        background-color: white;
    }

    .diff-overlay pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: monospace;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .diff-line {
        background-color: #ffecb3;
        display: block;
    }

    .readonly-content {
        width: 100%;
        height: 100%;
        overflow: auto;
        padding: 0.5rem;
        box-sizing: border-box;
    }

    .readonly-content pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: monospace;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.5rem;
        margin: 0.5rem 0;
        border-radius: 4px;
        font-size: 0.9rem;
    }

    .success {
        background-color: #d4edda;
        color: #155724;
        padding: 0.5rem;
        margin: 0.5rem 0;
        border-radius: 4px;
        font-size: 0.9rem;
    }

    .last-edited {
        font-size: 0.8rem;
        color: #777;
        margin-left: auto;
    }
</style>
