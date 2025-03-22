import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to data files
const DATA_DIR = path.join(__dirname, "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "templates.json");
const COMPANIES_FILE = path.join(DATA_DIR, "companies.json");
const COVER_LETTER_TEMPLATES_FILE = path.join(
  DATA_DIR,
  "cover-letter-templates.json",
);
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Initialize data files if they don't exist
if (!fs.existsSync(TEMPLATES_FILE)) {
  fs.writeJsonSync(TEMPLATES_FILE, []);
}

if (!fs.existsSync(COMPANIES_FILE)) {
  fs.writeJsonSync(COMPANIES_FILE, []);
}

if (!fs.existsSync(COVER_LETTER_TEMPLATES_FILE)) {
  fs.writeJsonSync(COVER_LETTER_TEMPLATES_FILE, []);
}

if (!fs.existsSync(APPLICATIONS_FILE)) {
  fs.writeJsonSync(APPLICATIONS_FILE, []);
}

// Template functions
async function getTemplates() {
  return fs.readJson(TEMPLATES_FILE);
}

async function saveTemplate(template) {
  const templates = await getTemplates();

  if (!template.id) {
    template.id = uuidv4();
    template.createdAt = new Date().toISOString();
    templates.push(template);
  } else {
    const index = templates.findIndex((t) => t.id === template.id);
    if (index === -1) {
      throw new Error("Template not found");
    }
    template.updatedAt = new Date().toISOString();
    templates[index] = template;
  }

  return fs.writeJson(TEMPLATES_FILE, templates);
}

async function deleteTemplate(id) {
  let templates = await getTemplates();
  templates = templates.filter((t) => t.id !== id);
  return fs.writeJson(TEMPLATES_FILE, templates);
}

// Cover Letter Template functions
async function getCoverLetterTemplates() {
  return fs.readJson(COVER_LETTER_TEMPLATES_FILE);
}

async function saveCoverLetterTemplate(template) {
  const templates = await getCoverLetterTemplates();

  if (!template.id) {
    template.id = uuidv4();
    template.createdAt = new Date().toISOString();
    templates.push(template);
  } else {
    const index = templates.findIndex((t) => t.id === template.id);
    if (index === -1) {
      throw new Error("Cover letter template not found");
    }
    template.updatedAt = new Date().toISOString();
    templates[index] = template;
  }

  return fs.writeJson(COVER_LETTER_TEMPLATES_FILE, templates);
}

async function deleteCoverLetterTemplate(id) {
  let templates = await getCoverLetterTemplates();
  templates = templates.filter((t) => t.id !== id);
  return fs.writeJson(COVER_LETTER_TEMPLATES_FILE, templates);
}

// Company functions
async function getCompanies() {
  return fs.readJson(COMPANIES_FILE);
}

async function saveCompany(company) {
  const companies = await getCompanies();

  if (!company.id) {
    company.id = uuidv4();
    company.createdAt = new Date().toISOString();
    companies.push(company);
  } else {
    const index = companies.findIndex((c) => c.id === company.id);
    if (index === -1) {
      throw new Error("Company not found");
    }
    company.updatedAt = new Date().toISOString();
    companies[index] = company;
  }

  return fs.writeJson(COMPANIES_FILE, companies);
}

async function deleteCompany(id) {
  let companies = await getCompanies();
  companies = companies.filter((c) => c.id !== id);
  return fs.writeJson(COMPANIES_FILE, companies);
}

async function getApplications() {
  return fs.readJson(APPLICATIONS_FILE);
}

async function getApplication(id) {
  const applications = await getApplications();
  const application = applications.find((a) => a.id === id);
  if (!application) {
    throw new Error("Application not found");
  }
  return application;
}

async function saveApplication(application) {
  const applications = await getApplications();

  if (!application.id) {
    application.id = uuidv4();
    application.createdAt = new Date().toISOString();
    applications.push(application);
  } else {
    const index = applications.findIndex((a) => a.id === application.id);
    if (index === -1) {
      throw new Error("Application not found");
    }
    application.updatedAt = new Date().toISOString();
    applications[index] = application;
  }

  await fs.writeJson(APPLICATIONS_FILE, applications);
  return application; // Return the application with ID
}

async function deleteApplication(id) {
  let applications = await getApplications();
  applications = applications.filter((a) => a.id !== id);
  return fs.writeJson(APPLICATIONS_FILE, applications);
}

export {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getCoverLetterTemplates,
  saveCoverLetterTemplate,
  deleteCoverLetterTemplate,
  getCompanies,
  saveCompany,
  deleteCompany,
  getApplications,
  getApplication,
  saveApplication,
  deleteApplication,
};
