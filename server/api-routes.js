import express from "express";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import {
  getTemplates,
  getCompanies,
  saveTemplate,
  saveCompany,
  deleteTemplate,
  deleteCompany,
  getCoverLetterTemplates,
  saveCoverLetterTemplate,
  deleteCoverLetterTemplate,
  getApplications,
  getApplication,
  saveApplication,
  deleteApplication,
} from "./storage.js";
import { compileLatex } from "./latex.js";
import latexInstaller from "./latex-installer.js";
import {
  DATA_DIR,
  PUBLIC_DIR,
  PREVIEWS_DIR,
  BUILD_DIR,
  pathInfo,
} from "./server-paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    serverInfo: {
      environment: process.env.NODE_ENV || "development",
      paths: {
        DATA_DIR,
        PUBLIC_DIR,
        PREVIEWS_DIR,
        BUILD_DIR,
      },
    },
  });
});

// Templates API
router.get("/templates", async (req, res) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/templates/:id", async (req, res) => {
  try {
    const templates = await getTemplates();
    const template = templates.find((t) => t.id === req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const newTemplate = req.body;
    await saveTemplate(newTemplate);
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Companies API
router.get("/companies", async (req, res) => {
  try {
    const companies = await getCompanies();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const companies = await getCompanies();
    const company = companies.find((c) => c.id === req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const newCompany = req.body;
    await saveCompany(newCompany);
    res.status(201).json(newCompany);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    await deleteCompany(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cover Letter Templates API
router.get("/cover-letter-templates", async (req, res) => {
  try {
    const templates = await getCoverLetterTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching cover letter templates:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/cover-letter-templates/:id", async (req, res) => {
  try {
    const templates = await getCoverLetterTemplates();
    const template = templates.find((t) => t.id === req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Cover letter template not found" });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/cover-letter-templates", async (req, res) => {
  try {
    const newTemplate = req.body;
    await saveCoverLetterTemplate(newTemplate);
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/cover-letter-templates/:id", async (req, res) => {
  try {
    await deleteCoverLetterTemplate(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Applications API
router.get("/applications", async (req, res) => {
  try {
    const applications = await getApplications();

    // Expand application data with company names etc. for the UI
    const expandedApplications = await Promise.all(
      applications.map(async (app) => {
        try {
          // Fetch company data if available
          let companyData = null;
          if (app.companyId) {
            const companies = await getCompanies();
            companyData = companies.find((c) => c.id === app.companyId);
          }

          return {
            ...app,
            companyName: companyData?.name || "Unknown Company",
            position:
              companyData?.position || app.position || "Unknown Position",
          };
        } catch {
          return app;
        }
      }),
    );

    res.json(expandedApplications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/applications/:id", async (req, res) => {
  try {
    const application = await getApplication(req.params.id);
    res.json(application);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post("/applications", async (req, res) => {
  try {
    const newApplication = req.body;
    await saveApplication(newApplication);
    res.status(201).json(newApplication);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/applications/:id", async (req, res) => {
  try {
    await deleteApplication(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add the missing routes (preview, build, etc.)

// Preview API for document generation
router.post("/preview", async (req, res) => {
  try {
    const { templateId, companyId, additionalData, type = "cv" } = req.body;

    // Get template and company data
    const companies = await getCompanies();
    const company = companies.find((c) => c.id === companyId);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    let template;
    if (type === "cover-letter") {
      const templates = await getCoverLetterTemplates();
      template = templates.find((t) => t.id === templateId);
    } else {
      const templates = await getTemplates();
      template = templates.find((t) => t.id === templateId);
    }

    if (!template) {
      return res.status(404).json({
        error: `${type === "cover-letter" ? "Cover letter template" : "Template"} not found`,
      });
    }

    // Merge data - prioritize additionalData over company data for overrides
    const basicCompanyData = {
      companyName: company.name,
      position: company.position,
      location: company.location,
    };

    // Then merge in this order: basic company info + company.data + additionalData
    const data = {
      ...basicCompanyData,
      ...(company.data || {}),
      ...(additionalData || {}),
    };

    console.log("Data being used for template:", data);

    // Create a unique filename for the preview
    const previewFilename = `preview-${type}-${templateId}-${companyId}-${Date.now()}.pdf`;

    // Important: Make sure preview is saved to the public directory
    const previewDir = path.join(PUBLIC_DIR, "previews");
    await fs.ensureDir(previewDir);

    const previewPath = path.join(previewDir, previewFilename);

    try {
      // Compile LaTeX to PDF
      await compileLatex(template.content, data, previewPath);

      // Return the URL to the preview PDF - use the public web path
      const previewUrl = `/public/previews/${previewFilename}`;

      console.log("Preview URL:", previewUrl);

      res.json({
        previewUrl: previewUrl,
      });
    } catch (latexError) {
      console.error("LaTeX compilation error:", latexError);
      res.status(500).json({
        error: `LaTeX compilation failed: ${latexError.message}`,
        details: "Check your template for LaTeX syntax errors",
      });
    }
  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: error.message });
  }
});

// Build API endpoint
router.post("/build", async (req, res) => {
  try {
    const { templateId, companyId, additionalData, type = "cv" } = req.body;

    // Get template and company data
    const companies = await getCompanies();
    const company = companies.find((c) => c.id === companyId);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    let template;
    if (type === "cover-letter") {
      const templates = await getCoverLetterTemplates();
      template = templates.find((t) => t.id === templateId);
    } else {
      const templates = await getTemplates();
      template = templates.find((t) => t.id === templateId);
    }

    if (!template) {
      return res.status(404).json({
        error: `${type === "cover-letter" ? "Cover letter template" : "Template"} not found`,
      });
    }

    // Merge data - prioritize additionalData over company data for overrides
    // First, extract basic company fields
    const basicCompanyData = {
      companyName: company.name,
      position: company.position,
      location: company.location,
    };

    // Then merge in this order: basic company info + company.data + additionalData
    const data = {
      ...basicCompanyData,
      ...(company.data || {}),
      ...(additionalData || {}),
    };

    console.log("Data being used for build:", data);

    // Output path for the final PDF
    const filePrefix = type === "cover-letter" ? "cover-letter" : "cv";
    const outputFilename = `${filePrefix}-${company.name.replace(/\s+/g, "-").toLowerCase()}-${template.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    const outputPath = path.join(BUILD_DIR, outputFilename);

    // Compile LaTeX to PDF
    await compileLatex(template.content, data, outputPath);

    res.json({
      success: true,
      filename: outputFilename,
      path: outputPath,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to generate an application with both CV and cover letter
router.post("/applications/generate", async (req, res) => {
  try {
    const {
      companyId,
      cvTemplateId,
      coverLetterTemplateId,
      customContent,
      notes,
    } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    // Get company data
    const companies = await getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Results holder
    const result = {
      cvPath: null,
      coverLetterPath: null,
      applicationId: null,
    };

    // Fetch template content
    let cvContent = null;
    let coverLetterContent = null;

    try {
      // Get CV template and content if provided
      if (cvTemplateId) {
        const templates = await getTemplates();
        const template = templates.find((t) => t.id === cvTemplateId);

        if (!template) {
          return res.status(404).json({ error: "CV template not found" });
        }

        cvContent = template.content;

        // Output path for CV
        const cvFilename = `cv-${company.name.replace(/\s+/g, "-").toLowerCase()}-${template.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
        const cvPath = path.join(BUILD_DIR, cvFilename);

        // Compile CV LaTeX to PDF
        await compileLatex(template.content, company.data || {}, cvPath);
        result.cvPath = cvFilename;
      }

      // Generate cover letter if template provided
      if (coverLetterTemplateId) {
        const templates = await getCoverLetterTemplates();
        const template = templates.find((t) => t.id === coverLetterTemplateId);

        if (!template) {
          return res
            .status(404)
            .json({ error: "Cover letter template not found" });
        }

        coverLetterContent = template.content;

        // Process custom content and prepare data
        const enhancedData = {
          companyName: company.name,
          position: company.position || "",
          location: company.location || "",
          customContent: customContent || "",
          customParagraph1: customContent || "",
          ...(company.data || {}),
        };

        // Output path for cover letter
        const clFilename = `cover-letter-${company.name.replace(/\s+/g, "-").toLowerCase()}-${template.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
        const clPath = path.join(BUILD_DIR, clFilename);

        // Compile cover letter LaTeX to PDF
        await compileLatex(template.content, enhancedData, clPath);
        result.coverLetterPath = clFilename;
      }

      // Create application record
      const newApplication = {
        companyId,
        company: {
          name: company.name,
          position: company.position,
          location: company.location,
        },
        cvTemplateId,
        coverLetterTemplateId,
        cvPath: result.cvPath,
        coverLetterPath: result.coverLetterPath,
        customContent,
        notes,
        status: "Applied",
        statusHistory: [{ status: "Applied", date: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        // Store document content
        documents: {
          cvContent,
          coverLetterContent,
          // Also store the original values to track changes
          cvOriginalContent: cvContent,
          coverLetterOriginalContent: coverLetterContent,
          // Store the rendered values (could be added later)
          lastRenderedAt: new Date().toISOString(),
        },
      };

      // Save application and ensure we get back the object with ID
      const savedApplication = await saveApplication(newApplication);

      if (!savedApplication || !savedApplication.id) {
        throw new Error("Failed to save application or get ID");
      }

      result.applicationId = savedApplication.id;

      res.json(result);
    } catch (docError) {
      console.error("Error in document generation:", docError);
      return res
        .status(500)
        .json({ error: `Document generation failed: ${docError.message}` });
    }
  } catch (error) {
    console.error("Error generating application:", error);
    res.status(500).json({ error: error.message });
  }
});

// LaTeX-related endpoints
let latexInstallStatus = {
  isInstalling: false,
  status: "Not started",
  progress: 0,
  error: null,
};

router.get("/latex/status", async (req, res) => {
  try {
    const bundledLatex = await latexInstaller.isLatexInstalled();
    const systemLatex = await latexInstaller.findSystemLatex();

    res.json({
      installed: bundledLatex || !!systemLatex,
      systemLatex: systemLatex,
      bundledLatex: bundledLatex,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the installation process without blocking
router.post("/latex/install-start", async (req, res) => {
  // If already installing, return current status
  if (latexInstallStatus.isInstalling) {
    return res.json({
      message: "Installation already in progress",
      status: latexInstallStatus.status,
      progress: latexInstallStatus.progress,
    });
  }

  // Reset installation status
  latexInstallStatus = {
    isInstalling: true,
    status: "Starting installation...",
    progress: 10,
    error: null,
  };

  // Send immediate response
  res.json({ message: "Installation started", success: true });

  // Start the installation process in the background
  try {
    console.log("Starting LaTeX installation in the background");

    // Define a progress callback that updates the global status
    const progressCallback = (data) => {
      console.log("Installation progress:", data);
      latexInstallStatus.status = data.status;
      latexInstallStatus.progress = data.progress;

      if (data.progress === -1) {
        latexInstallStatus.error = data.status;
        latexInstallStatus.isInstalling = false;
      }
    };

    // Run the installation
    const result = await latexInstaller.installTinyTex(progressCallback);

    if (result) {
      console.log("LaTeX installation completed successfully");
      latexInstallStatus.status = "Installation complete!";
      latexInstallStatus.progress = 100;
    } else {
      console.log("LaTeX installation failed");
      latexInstallStatus.status = "Installation failed";
      latexInstallStatus.progress = -1;
      latexInstallStatus.error = "Installation process failed";
    }
  } catch (error) {
    console.error("Error during LaTeX installation:", error);
    latexInstallStatus.status = `Error: ${error.message}`;
    latexInstallStatus.progress = -1;
    latexInstallStatus.error = error.message;
  } finally {
    latexInstallStatus.isInstalling = false;
  }
});

// Get the current installation status
router.get("/latex/install-status", (req, res) => {
  res.json(latexInstallStatus);
});

router.post("/latex/test", async (req, res) => {
  try {
    const { content } = req.body;
    const tempOutputPath = path.join(PREVIEWS_DIR, `test-${Date.now()}.pdf`);

    // Minimal test content with just the provided content in document body
    const testContent = content.includes("\\begin{document}")
      ? content
      : `\\documentclass{article}\n\\begin{document}\n${content}\n\\end{document}`;

    await compileLatex(testContent, {}, tempOutputPath);

    res.json({
      success: true,
      message: "LaTeX compilation successful",
      previewUrl: `/public/previews/${path.basename(tempOutputPath)}`,
    });
  } catch (error) {
    console.error("LaTeX test compilation error:", error);
    res.status(500).json({
      error: `LaTeX compilation failed: ${error.message}`,
      success: false,
    });
  }
});

// Document update endpoint
router.put("/applications/:id/document", async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, content } = req.body;

    if (!documentType || !content) {
      return res
        .status(400)
        .json({ error: "Document type and content are required" });
    }

    // Get the application
    let application;
    try {
      application = await getApplication(id);
    } catch (err) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Create documents object if it doesn't exist
    if (!application.documents) {
      application.documents = {};
    }

    // Update the document content
    if (documentType === "cv") {
      application.documents.cvContent = content;
    } else if (documentType === "coverLetter") {
      application.documents.coverLetterContent = content;
    } else {
      return res.status(400).json({ error: "Invalid document type" });
    }

    // Save the updated application
    await saveApplication(application);

    // Return success
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate documents endpoint
router.post("/applications/:id/regenerate", async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType, customContent } = req.body;

    // Get the application
    let application;
    try {
      application = await getApplication(id);
    } catch (err) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Get the company
    const companies = await getCompanies();
    const company = companies.find((c) => c.id === application.companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Prepare result
    const result = {
      regenerated: [],
      paths: {},
    };

    // Regenerate documents based on documentType
    if (!documentType || documentType === "cv") {
      if (application.cvTemplateId && application.documents?.cvContent) {
        // Output path for CV
        const cvFilename =
          application.cvPath ||
          `cv-${company.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;
        const cvPath = path.join(BUILD_DIR, cvFilename);

        // Compile CV LaTeX to PDF using stored content
        await compileLatex(
          application.documents.cvContent,
          company.data || {},
          cvPath,
        );

        // Update application
        application.cvPath = cvFilename;
        application.documents.lastRenderedAt = new Date().toISOString();
        result.regenerated.push("cv");
        result.paths.cv = cvFilename;
      }
    }

    if (!documentType || documentType === "coverLetter") {
      if (
        application.coverLetterTemplateId &&
        application.documents?.coverLetterContent
      ) {
        // Process custom content and prepare data
        const updatedCustomContent =
          customContent || application.customContent || "";
        const enhancedData = {
          companyName: company.name,
          position: company.position || "",
          location: company.location || "",
          customContent: updatedCustomContent,
          customParagraph1: updatedCustomContent,
          ...(company.data || {}),
        };

        // Output path for cover letter
        const clFilename =
          application.coverLetterPath ||
          `cover-letter-${company.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;
        const clPath = path.join(BUILD_DIR, clFilename);

        // Compile cover letter LaTeX to PDF
        await compileLatex(
          application.documents.coverLetterContent,
          enhancedData,
          clPath,
        );

        // Update application
        application.coverLetterPath = clFilename;
        if (customContent) {
          application.customContent = customContent;
        }
        application.documents.lastRenderedAt = new Date().toISOString();
        result.regenerated.push("coverLetter");
        result.paths.coverLetter = clFilename;
      }
    }

    // Save the updated application
    await saveApplication(application);

    res.json(result);
  } catch (error) {
    console.error("Error regenerating document:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
