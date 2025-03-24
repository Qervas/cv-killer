/**
 * API client module for CV Killer application
 * Handles all communication with the backend server
 */

// Constants
const API_BASE_URL = "http://localhost:3001/api";

/**
 * Template management functions
 */
export async function getTemplates() {
  const response = await fetch(`${API_BASE_URL}/templates`);
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  return response.json();
}

export async function getTemplate(id) {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`);
  if (!response.ok) {
    throw new Error("Template not found");
  }
  return response.json();
}

export async function saveTemplate(template) {
  const url = `${API_BASE_URL}/templates${template.id ? `/${template.id}` : ""}`;
  const method = template.id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(template),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to save template");
  }

  return response.json();
}

export async function deleteTemplate(id) {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete template");
  }

  return true;
}

/**
 * Company management functions
 */
export async function getCompanies() {
  const response = await fetch(`${API_BASE_URL}/companies`);
  if (!response.ok) {
    throw new Error("Failed to fetch companies");
  }
  return response.json();
}

export async function getCompany(id) {
  const response = await fetch(`${API_BASE_URL}/companies/${id}`);
  if (!response.ok) {
    throw new Error("Company not found");
  }
  return response.json();
}

export async function saveCompany(company) {
  const url = `${API_BASE_URL}/companies${company.id ? `/${company.id}` : ""}`;
  const method = company.id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(company),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to save company");
  }

  return response.json();
}

export async function deleteCompany(id) {
  const response = await fetch(`${API_BASE_URL}/companies/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete company");
  }

  return true;
}

/**
 * Cover letter template functions
 */
export async function getCoverLetterTemplates() {
  const response = await fetch(`${API_BASE_URL}/cover-letter-templates`);
  if (!response.ok) {
    throw new Error("Failed to fetch cover letter templates");
  }
  return response.json();
}

export async function getCoverLetterTemplate(id) {
  const response = await fetch(`${API_BASE_URL}/cover-letter-templates/${id}`);
  if (!response.ok) {
    throw new Error("Cover letter template not found");
  }
  return response.json();
}

export async function saveCoverLetterTemplate(template) {
  const url = `${API_BASE_URL}/cover-letter-templates${template.id ? `/${template.id}` : ""}`;
  const method = template.id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(template),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to save cover letter template");
  }

  return response.json();
}

export async function deleteCoverLetterTemplate(id) {
  const response = await fetch(`${API_BASE_URL}/cover-letter-templates/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete cover letter template");
  }

  return true;
}

/**
 * Application management functions
 */
export async function getApplications() {
  const response = await fetch(`${API_BASE_URL}/applications`);
  if (!response.ok) {
    throw new Error("Failed to fetch applications");
  }
  return response.json();
}

export async function getApplication(id) {
  const response = await fetch(`${API_BASE_URL}/applications/${id}`);
  if (!response.ok) {
    throw new Error("Application not found");
  }
  return response.json();
}

export async function saveApplication(application) {
  const url = `${API_BASE_URL}/applications${application.id ? `/${application.id}` : ""}`;
  const method = application.id ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(application),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to save application");
  }

  return response.json();
}

export async function deleteApplication(id) {
  const response = await fetch(`${API_BASE_URL}/applications/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete application");
  }

  return true;
}

/**
 * Document generation functions
 */
export async function generatePreview(
  templateId,
  companyId,
  additionalData = {},
  type = "cv",
) {
  const response = await fetch(`${API_BASE_URL}/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId,
      companyId,
      additionalData,
      type,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate preview");
  }

  return response.json();
}

export async function buildPDF(templateId, companyId, additionalData = {}) {
  const response = await fetch(`${API_BASE_URL}/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId,
      companyId,
      additionalData,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to build PDF");
  }

  return response.json();
}

export async function buildCoverLetter(
  templateId,
  companyId,
  additionalData = {},
) {
  const response = await fetch(`${API_BASE_URL}/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId,
      companyId,
      additionalData,
      type: "cover-letter",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to build cover letter");
  }

  return response.json();
}

/**
 * Complete application generation
 */
export async function generateApplication(applicationData) {
  const response = await fetch(`${API_BASE_URL}/applications/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(applicationData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate application");
  }

  return response.json();
}

/**
 * Document operations
 */
export async function updateDocument(applicationId, documentType, content) {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/document`,
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
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update document");
  }

  return response.json();
}

export async function regenerateDocument(
  applicationId,
  documentType,
  customContent,
) {
  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/regenerate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentType,
        customContent,
      }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to regenerate document");
  }

  return response.json();
}

/**
 * LaTeX operations
 */
export async function checkLatexStatus() {
  const response = await fetch(`${API_BASE_URL}/latex/status`);
  if (!response.ok) {
    throw new Error("Failed to check LaTeX status");
  }
  return response.json();
}

export async function startLatexInstallation() {
  const response = await fetch(`${API_BASE_URL}/latex/install-start`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to start LaTeX installation");
  }

  return response.json();
}

export async function getLatexInstallationStatus() {
  const response = await fetch(`${API_BASE_URL}/latex/install-status`);
  if (!response.ok) {
    throw new Error("Failed to get LaTeX installation status");
  }
  return response.json();
}

export async function testLatexCompilation(textContent) {
  const response = await fetch(`${API_BASE_URL}/latex/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: textContent }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to test LaTeX compilation");
  }
  return response.json();
}
