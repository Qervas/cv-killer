import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { getBinaryPath } from "./latex-installer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ultra-minimal template without special fonts or packages
const FALLBACK_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}

% Avoid using any special fonts or packages that might not be included in TinyTeX

\\begin{document}

\\begin{center}
{\\large\\bfseries CV for [[companyName]]}
\\end{center}

\\section*{Experience}
Position: [[position]]

Location: [[location]]

\\vfill
\\begin{center}
Generated: \\today
\\end{center}

\\end{document}`;

// Ultra minimal error template
const ERROR_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}

\\begin{document}

\\begin{center}
{\\large Template Error}
\\end{center}

\\vspace{1cm}
There was an error processing your template.
Please check for LaTeX syntax errors or try a different template.

\\end{document}`;

// Function to install missing LaTeX packages
async function installMissingPackage(packageName) {
  try {
    console.log(`Installing missing LaTeX package: ${packageName}`);
    const tlmgrPath = getBinaryPath().replace('pdflatex', 'tlmgr');

    if (!fs.existsSync(tlmgrPath)) {
      console.error("tlmgr not found at:", tlmgrPath);
      return false;
    }

    // Run tlmgr to install the package
    const cmd = `${tlmgrPath} install ${packageName}`;
    console.log("Running command:", cmd);

    return new Promise((resolve) => {
      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error("Package installation failed:", error);
          console.log(stdout);
          resolve(false);
        } else {
          console.log("Package installation succeeded:", stdout);
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error("Error installing package:", err);
    return false;
  }
}

async function compileLatex(templateContent, companyData, outputPath) {
  // Create temp directory for processing
  const tempDir = path.join(__dirname, "temp", Date.now().toString());
  await fs.ensureDir(tempDir);

  try {
    console.log("Starting LaTeX compilation process");
    console.log("Company data:", JSON.stringify(companyData));
    console.log("Output path:", outputPath);

    // Process template with advanced variable replacement
    const processedTemplate = preprocessTemplate(templateContent, companyData);

    // Write the processed template for inspection (debugging)
    const debugTemplateFile = path.join(tempDir, "processed_template.tex");
    await fs.writeFile(debugTemplateFile, processedTemplate);
    console.log("Processed template written to:", debugTemplateFile);

    // Try to generate PDF with user template first
    let success = await tryGeneratePDF(tempDir, processedTemplate, outputPath);

    // If failed, try to install cm-super package which contains many common fonts
    if (!success) {
      console.log("First attempt failed - trying to install required packages");
      await installMissingPackage("cm-super");

      // Try again after installing packages
      success = await tryGeneratePDF(tempDir, processedTemplate, outputPath);
    }

    // If user template still failed, try fallback template
    if (!success) {
      console.log("User template failed, trying fallback template");
      const processedFallback = preprocessTemplate(FALLBACK_TEMPLATE, companyData);
      success = await tryGeneratePDF(tempDir, processedFallback, outputPath);
    }

    // If fallback template also failed, use error template
    if (!success) {
      console.log("Fallback template failed, using error template");
      success = await tryGeneratePDF(tempDir, ERROR_TEMPLATE, outputPath);

      if (!success) {
        throw new Error("Failed to generate PDF. Check your LaTeX installation.");
      }
    }

    console.log("Successfully generated PDF at:", outputPath);
    return outputPath;
  } catch (error) {
    console.error("LaTeX compilation error:", error);
    throw error;
  } finally {
    // Keep temp directory for debugging
    console.log("Temporary files are saved in:", tempDir);
  }
}

/**
 * Advanced LaTeX template preprocessor
 */
function preprocessTemplate(template, data) {
  if (!template || !data) {
    return template || "";
  }

  // Make a copy of the template to process
  let result = template;

  // Log the variables available and their types
  console.log("Preprocessing variables:", Object.keys(data).map(key =>
    `${key} (${typeof data[key]})`).join(", "));

  // Replace variables using different patterns
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return; // Skip null/undefined values
    }

    // Convert value to string and escape LaTeX special characters
    const safeValue = escapeLatex(value.toString());

    // Replace patterns:
    // 1. Direct word replacement (only for safe variable names)
    if (/^[a-zA-Z0-9]+$/.test(key)) {
      // Only replace as whole words to prevent partial replacements
      const wordRegex = new RegExp(`\\b${key}\\b`, 'g');
      result = result.replace(wordRegex, safeValue);
    }

    // 2. Standard placeholders with variations
    const patterns = [
      `{${key}}`,     // {companyName}
      `{{${key}}}`,   // {{companyName}}
      `\\{${key}\\}`, // \{companyName\}
      `[[${key}]]`,   // [[companyName]]
    ];

    patterns.forEach(pattern => {
      result = result.replace(new RegExp(escapeRegExp(pattern), 'g'), safeValue);
    });
  });

  return result;
}

// Helper function to escape LaTeX special characters
function escapeLatex(text) {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to try compiling a LaTeX template
async function tryGeneratePDF(tempDir, content, outputPath) {
  try {
    // Create temp tex file
    const texPath = path.join(tempDir, "document.tex");
    await fs.writeFile(texPath, content);

    // Run pdflatex twice to resolve references
    console.log("Running pdflatex (1st pass) on", texPath);
    const result1 = await runPdfLatex(texPath, tempDir);

    // Only run second pass if first was successful
    if (!result1.error) {
      console.log("Running pdflatex (2nd pass) on", texPath);
      await runPdfLatex(texPath, tempDir);
    }

    // Check if PDF was created
    const pdfPath = path.join(tempDir, "document.pdf");
    const pdfExists = await fs.pathExists(pdfPath);

    console.log("PDF exists:", pdfExists);

    if (pdfExists) {
      // Copy to desired output location
      await fs.ensureDir(path.dirname(outputPath));
      await fs.copyFile(pdfPath, outputPath);
      return true;
    }

    return false;
  } catch (err) {
    console.error("Error in tryGeneratePDF:", err);
    return false;
  }
}

// Run pdflatex with proper error handling
function runPdfLatex(texPath, outputDir) {
  return new Promise((resolve) => {
    // Get the path to our installed pdflatex binary
    const pdflatexPath = getBinaryPath();

    console.log("pdflatex path:", pdflatexPath);
    console.log("Checking if pdflatex exists:", fs.existsSync(pdflatexPath));

    // Use the installed pdflatex binary with absolute path
    const pdflatexCmd = fs.existsSync(pdflatexPath)
      ? `"${pdflatexPath}"`  // Quote the path to handle spaces
      : "pdflatex";

    // Create the command with proper escaping for spaces in paths
    const cmd = `${pdflatexCmd} -interaction=nonstopmode -output-directory="${outputDir}" "${texPath}"`;

    console.log("Running LaTeX command:", cmd);

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.log("pdflatex execution error:", error.message);
        console.log("pdflatex stdout:", stdout);
        console.log("pdflatex stderr:", stderr);

        // Look for missing font errors
        if (stdout && stdout.includes("Font") && stdout.includes("not found")) {
          console.log("Font missing error detected");

          // Extract missing package information
          const fontMatch = stdout.match(/Font (.*?) at/);
          if (fontMatch) {
            console.log("Missing font:", fontMatch[1]);
          }
        }
      }

      // Check for successful compilation
      if (stdout && stdout.includes("Output written on")) {
        console.log("LaTeX success:", stdout.match(/Output written on.*?(\d+) pages?/)[0]);
      }

      resolve({ error, stdout, stderr });
    });
  });
}

export { compileLatex };
