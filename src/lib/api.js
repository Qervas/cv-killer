const API_URL = "http://localhost:3001/api";

// CV Templates
export async function getTemplates() {
  const response = await fetch(`${API_URL}/templates`);
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  return response.json();
}

export async function getTemplate(id) {
  const response = await fetch(`${API_URL}/templates/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch template");
  }
  return response.json();
}

export async function saveTemplate(template) {
  const response = await fetch(`${API_URL}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });

  if (!response.ok) {
    throw new Error("Failed to save template");
  }
  return response.json();
}

export async function deleteTemplate(id) {
  const response = await fetch(`${API_URL}/templates/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete template");
  }
  return true;
}

// Cover Letter Templates
export async function getCoverLetterTemplates() {
  const response = await fetch(`${API_URL}/cover-letter-templates`);
  if (!response.ok) {
    throw new Error("Failed to fetch cover letter templates");
  }
  return response.json();
}

export async function getCoverLetterTemplate(id) {
  const response = await fetch(`${API_URL}/cover-letter-templates/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch cover letter template");
  }
  return response.json();
}

export async function saveCoverLetterTemplate(template) {
  const response = await fetch(`${API_URL}/cover-letter-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });

  if (!response.ok) {
    throw new Error("Failed to save cover letter template");
  }
  return response.json();
}

export async function deleteCoverLetterTemplate(id) {
  const response = await fetch(`${API_URL}/cover-letter-templates/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete cover letter template");
  }
  return true;
}

// Companies
export async function getCompanies() {
  const response = await fetch(`${API_URL}/companies`);
  if (!response.ok) {
    throw new Error("Failed to fetch companies");
  }
  return response.json();
}

export async function getCompany(id) {
  const response = await fetch(`${API_URL}/companies/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch company");
  }
  return response.json();
}

export async function saveCompany(company) {
  const response = await fetch(`${API_URL}/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(company),
  });

  if (!response.ok) {
    throw new Error("Failed to save company");
  }
  return response.json();
}

export async function deleteCompany(id) {
  const response = await fetch(`${API_URL}/companies/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete company");
  }
  return true;
}

// PDF Generation
export async function generatePreview(
  templateId,
  companyId,
  additionalData = {},
  type = "cv",
) {
  const payload = {
    templateId,
    companyId,
    type,
    additionalData,
  };

  const response = await fetch(`${API_URL}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Failed to generate preview" }));
    throw new Error(errorData.error || "Failed to generate preview");
  }
  return response.json();
}

export async function buildPDF(templateId, companyId) {
  const response = await fetch(`${API_URL}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, companyId, type: "cv" }),
  });

  if (!response.ok) {
    throw new Error("Failed to build PDF");
  }
  return response.json();
}

export async function buildCoverLetter(
  templateId,
  companyId,
  additionalData = {},
) {
  const response = await fetch(`${API_URL}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId,
      companyId,
      type: "cover-letter",
      additionalData,
    }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Failed to build cover letter" }));
    throw new Error(errorData.error || "Failed to build cover letter");
  }
  return response.json();
}

// Applications
export async function getApplications() {
  const response = await fetch(`${API_URL}/applications`);
  if (!response.ok) {
    throw new Error("Failed to fetch applications");
  }
  return response.json();
}

export async function getApplication(id) {
  const response = await fetch(`${API_URL}/applications/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch application");
  }
  return response.json();
}

export async function saveApplication(application) {
  const response = await fetch(`${API_URL}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Failed to save application" }));
    throw new Error(errorData.error || "Failed to save application");
  }
  return response.json();
}

export async function deleteApplication(id) {
  const response = await fetch(`${API_URL}/applications/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete application");
  }
  return true;
}

export async function generateApplication(data) {
  const response = await fetch(`${API_URL}/applications/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Failed to generate application" }));
    throw new Error(errorData.error || "Failed to generate application");
  }
  return response.json();
}
