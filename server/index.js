import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { compileLatex } from "./latex.js";
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
} from "./storage.js";

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define data directory
const DATA_DIR = path.join(__dirname, "data");

const app = express();
const PORT = 3001;
const COVER_LETTER_TEMPLATES_FILE = path.join(
  DATA_DIR,
  "cover-letter-templates.json",
);

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Initialize cover letter templates file if it doesn't exist
if (!fs.existsSync(COVER_LETTER_TEMPLATES_FILE)) {
  fs.writeJsonSync(COVER_LETTER_TEMPLATES_FILE, []);
}

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Allow both localhost and 127.0.0.1
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Ensure directories exist
fs.ensureDirSync(path.join(__dirname, "public/previews"));
fs.ensureDirSync(path.join(__dirname, "../build"));

// Templates API
app.get("/api/templates", async (req, res) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/templates/:id", async (req, res) => {
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

app.post("/api/templates", async (req, res) => {
  try {
    const newTemplate = req.body;
    await saveTemplate(newTemplate);
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/templates/:id", async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Companies API
app.get("/api/companies", async (req, res) => {
  try {
    const companies = await getCompanies();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/companies/:id", async (req, res) => {
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

app.post("/api/companies", async (req, res) => {
  try {
    const newCompany = req.body;
    await saveCompany(newCompany);
    res.status(201).json(newCompany);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/companies/:id", async (req, res) => {
  try {
    await deleteCompany(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cover Letter Templates API
app.get("/api/cover-letter-templates", async (req, res) => {
  try {
    const templates = await getCoverLetterTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching cover letter templates:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/cover-letter-templates/:id", async (req, res) => {
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

app.post("/api/cover-letter-templates", async (req, res) => {
  try {
    const newTemplate = req.body;
    await saveCoverLetterTemplate(newTemplate);
    res.status(201).json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/cover-letter-templates/:id", async (req, res) => {
  try {
    await deleteCoverLetterTemplate(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/preview", async (req, res) => {
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

    // Check if template content is empty
    if (!template.content || template.content.trim() === "") {
      return res.status(400).json({ error: "Template content is empty" });
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

    console.log("Data being used for template:", data); // For debugging

    // Output path for the preview PDF
    const previewFilename = `preview-${type}-${templateId}-${companyId}-${Date.now()}.pdf`;
    const previewPath = path.join(
      __dirname,
      "public/previews",
      previewFilename,
    );

    try {
      // Compile LaTeX to PDF
      await compileLatex(template.content, data, previewPath);

      // Return the URL to the preview PDF
      res.json({
        previewUrl: `/previews/${previewFilename}`,
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

// Similar changes to the build endpoint
app.post("/api/build", async (req, res) => {
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

    console.log("Data being used for build:", data); // For debugging

    // Output path for the final PDF
    const filePrefix = type === "cover-letter" ? "cover-letter" : "cv";
    const outputFilename = `${filePrefix}-${company.name.replace(/\s+/g, "-").toLowerCase()}-${template.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    const outputPath = path.join(__dirname, "../build", outputFilename);

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
