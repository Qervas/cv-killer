<script>
    import { onMount } from "svelte";
    import {
        getTemplates,
        getCompanies,
        getCoverLetterTemplates,
        getApplications,
    } from "$lib/api";

    let templates = [];
    let coverLetterTemplates = [];
    let companies = [];
    let applications = [];
    let loading = true;
    let error = null;
    let stats = {
        totalTemplates: 0,
        totalCoverLetterTemplates: 0,
        totalCompanies: 0,
        totalApplications: 0,
        applicationStatus: {},
        recentActivity: [],
    };

    onMount(async () => {
        try {
            [templates, coverLetterTemplates, companies, applications] =
                await Promise.all([
                    getTemplates(),
                    getCoverLetterTemplates(),
                    getCompanies(),
                    getApplications(),
                ]);

            // Calculate stats
            stats.totalTemplates = templates.length;
            stats.totalCoverLetterTemplates = coverLetterTemplates.length;
            stats.totalCompanies = companies.length;
            stats.totalApplications = applications.length;

            // Calculate application status counts
            stats.applicationStatus = applications.reduce((acc, app) => {
                const status = app.status || "Unknown";
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});

            // Create recent activity
            const activities = [
                ...applications.map((a) => ({
                    type: "application",
                    name: `${a.company?.name || "Unknown"} - ${a.company?.position || "Unknown Position"}`,
                    status: a.status,
                    date: a.updatedAt || a.createdAt,
                    id: a.id,
                })),
                ...templates.map((t) => ({
                    type: "template",
                    name: t.name,
                    date: t.updatedAt || t.createdAt,
                    id: t.id,
                })),
                ...coverLetterTemplates.map((t) => ({
                    type: "cover-letter",
                    name: t.name,
                    date: t.updatedAt || t.createdAt,
                    id: t.id,
                })),
                ...companies.map((c) => ({
                    type: "company",
                    name: c.name,
                    date: c.updatedAt || c.createdAt,
                    id: c.id,
                })),
            ]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5);

            stats.recentActivity = activities;
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });
</script>

<div class="dashboard">
    <h1>CV Killer Dashboard</h1>

    {#if error}
        <div class="error">{error}</div>
    {/if}

    {#if loading}
        <div class="loading">Loading dashboard data...</div>
    {:else}
        <div class="stats-grid">
            <div class="stat-card highlight">
                <h2>Applications</h2>
                <div class="stat-value">{stats.totalApplications}</div>
                <div class="status-counts">
                    {#each Object.entries(stats.applicationStatus) as [status, count]}
                        <div class="status-count">
                            <span class="status-badge {status.toLowerCase()}"
                                >{status}</span
                            >
                            <span class="count">{count}</span>
                        </div>
                    {/each}
                </div>
                <div class="stat-action">
                    <a href="/applications" class="button">View Applications</a>
                    <a href="/applications/new-complete" class="button primary"
                        >+ New</a
                    >
                </div>
            </div>

            <div class="stat-card">
                <h2>CV Templates</h2>
                <div class="stat-value">{stats.totalTemplates}</div>
                <div class="stat-action">
                    <a href="/templates" class="button">View Templates</a>
                    <a href="/templates/new" class="button primary">+ Add</a>
                </div>
            </div>

            <div class="stat-card">
                <h2>Cover Letter Templates</h2>
                <div class="stat-value">{stats.totalCoverLetterTemplates}</div>
                <div class="stat-action">
                    <a href="/cover-letters" class="button">View Templates</a>
                    <a href="/cover-letters/new" class="button primary">+ Add</a
                    >
                </div>
            </div>

            <div class="stat-card">
                <h2>Companies</h2>
                <div class="stat-value">{stats.totalCompanies}</div>
                <div class="stat-action">
                    <a href="/companies" class="button">View Companies</a>
                    <a href="/companies/new" class="button primary">+ Add</a>
                </div>
            </div>
        </div>

        <div class="generator-cards">
            <div class="generator-card">
                <h2>Create Application</h2>
                <p>
                    Generate a complete job application with CV and cover letter
                </p>
                <div class="generator-action">
                    <a href="/applications/new-complete" class="button primary"
                        >New Complete Application</a
                    >
                </div>
            </div>

            <div class="generator-card">
                <h2>Individual Documents</h2>
                <p>Generate individual documents separately</p>
                <div class="generator-buttons">
                    <a href="/generator" class="button">Create CV</a>
                    <a href="/cover-letter-generator" class="button"
                        >Create Cover Letter</a
                    >
                </div>
            </div>
        </div>

        <div class="recent-activity">
            <h2>Recent Activity</h2>
            {#if stats.recentActivity.length === 0}
                <p>No recent activity to show.</p>
            {:else}
                <ul class="activity-list">
                    {#each stats.recentActivity as activity}
                        <li>
                            <div class="activity-type {activity.type}">
                                {activity.type === "template"
                                    ? "CV"
                                    : activity.type === "cover-letter"
                                      ? "CL"
                                      : activity.type === "application"
                                        ? "APP"
                                        : "C"}
                            </div>
                            <div class="activity-details">
                                <span class="activity-name"
                                    >{activity.name}</span
                                >
                                {#if activity.status}
                                    <span
                                        class="activity-status {activity.status.toLowerCase()}"
                                        >{activity.status}</span
                                    >
                                {/if}
                                <span class="activity-date">
                                    {new Date(
                                        activity.date,
                                    ).toLocaleDateString()}
                                </span>
                            </div>
                            <div class="activity-action">
                                <a
                                    href="/{activity.type === 'cover-letter'
                                        ? 'cover-letters'
                                        : activity.type === 'template'
                                          ? 'templates'
                                          : activity.type === 'application'
                                            ? 'applications'
                                            : 'companies'}/{activity.id}"
                                    class="button small">View</a
                                >
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* Complete Dashboard Styles */
    .dashboard {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .generator-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .stat-card,
    .generator-card {
        background-color: #ffffff;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
    }

    .stat-card h2,
    .generator-card h2 {
        margin: 0;
        color: #333;
        font-size: 1.4rem;
        margin-bottom: 0.5rem;
    }

    .stat-value {
        font-size: 3rem;
        font-weight: bold;
        margin: 1rem 0;
        color: #007bff;
    }

    .stat-action,
    .generator-action {
        margin-top: auto;
        display: flex;
        gap: 0.5rem;
    }

    .generator-card {
        background-color: #f8f9fa;
    }

    .generator-card p {
        margin-bottom: 1.5rem;
        color: #555;
    }

    .recent-activity {
        background-color: #ffffff;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .activity-list {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    .activity-list li {
        display: flex;
        align-items: center;
        padding: 0.75rem 0;
        border-bottom: 1px solid #eee;
    }

    .activity-list li:last-child {
        border-bottom: none;
    }

    .activity-type {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 1rem;
        font-weight: bold;
        color: white;
    }

    .activity-type.template {
        background-color: #28a745;
    }

    .activity-type.cover-letter {
        background-color: #6f42c1;
    }

    .activity-type.company {
        background-color: #fd7e14;
    }

    .activity-type.application {
        background-color: #0dcaf0;
    }

    .activity-details {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .activity-name {
        font-weight: 500;
    }

    .activity-date {
        font-size: 0.8rem;
        color: #777;
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
        text-align: center;
    }

    .button.primary {
        background-color: #007bff;
        color: white;
        border-color: #0069d9;
    }

    .button.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
    }

    .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
    }

    /* New styles for applications section */
    .stat-card.highlight {
        background-color: #e6f7ff;
        border-left: 4px solid #007bff;
    }

    .status-counts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .status-count {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .status-badge {
        display: inline-block;
        padding: 0.15rem 0.4rem;
        border-radius: 1rem;
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: uppercase;
    }

    .status-badge.applied {
        background-color: #cff4fc;
        color: #055160;
    }

    .status-badge.interview {
        background-color: #fff3cd;
        color: #664d03;
    }

    .status-badge.offer {
        background-color: #d1e7dd;
        color: #0f5132;
    }

    .status-badge.rejected {
        background-color: #f8d7da;
        color: #842029;
    }

    .status-badge.withdrawn {
        background-color: #e2e3e5;
        color: #41464b;
    }

    .count {
        font-size: 0.8rem;
        font-weight: bold;
    }

    .generator-buttons {
        display: flex;
        gap: 0.5rem;
    }

    .activity-status {
        display: inline-block;
        margin-left: 0.5rem;
        padding: 0.1rem 0.3rem;
        font-size: 0.7rem;
        border-radius: 3px;
    }

    .activity-status.applied {
        background-color: #cff4fc;
        color: #055160;
    }

    .activity-status.interview {
        background-color: #fff3cd;
        color: #664d03;
    }

    .activity-status.offer {
        background-color: #d1e7dd;
        color: #0f5132;
    }

    .activity-status.rejected {
        background-color: #f8d7da;
        color: #842029;
    }

    .activity-status.withdrawn {
        background-color: #e2e3e5;
        color: #41464b;
    }
</style>
