/**
 * Format a date string with detailed time information
 * @param {string} dateString - ISO date string
 * @param {boolean} includeSeconds - Whether to include seconds in the output
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(dateString, includeSeconds = true) {
  if (!dateString) return "Unknown";

  try {
    const date = new Date(dateString);

    // Options for date formatting
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };

    // Add seconds if requested
    if (includeSeconds) {
      options.second = "2-digit";
    }

    return date.toLocaleString(undefined, options);
  } catch (e) {
    return "Invalid date";
  }
}

/**
 * Format relative time (e.g., "2 minutes ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return "Unknown";

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;

    // Convert to seconds
    const diffSeconds = Math.floor(diffMs / 1000);

    // Less than a minute
    if (diffSeconds < 60) {
      return `${diffSeconds} second${diffSeconds !== 1 ? "s" : ""} ago`;
    }

    // Less than an hour
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    }

    // Less than a day
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    }

    // Less than a week
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    }

    // More than a week, use standard date format
    return formatDateTime(dateString, false);
  } catch (e) {
    return "Invalid date";
  }
}
