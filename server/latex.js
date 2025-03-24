import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ultra-minimal template - absolute bare minimum
const FALLBACK_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}

% Custom colors
\\definecolor{primary}{RGB}{0, 90, 160}
\\definecolor{secondary}{RGB}{100, 100, 100}

% Remove page numbers
\\pagenumbering{gobble}

\\begin{document}

\\begin{center}
{\\Huge\\bfseries\\color{primary} CV for \\MakeUppercase{\\textsc{\\textbf{\\color{primary}{companyName}}}}}
\\\\[0.5em]
{\\Large\\color{secondary} {position}}
\\\\[0.3em]
{\\normalsize\\color{secondary}{location}}
\\end{center}

\\vspace{1em}

\\section*{Experience}
\\begin{itemize}
\\item {\\textbf{\\color{primary}{companyName}}} -- {position}
\\end{itemize}

\\vfill
\\begin{center}
\\textit{Generated: \\today}
\\end{center}

\\end{document}`;

// Error template
const ERROR_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}

% Custom colors
\\definecolor{primary}{RGB}{0, 90, 160}
\\definecolor{secondary}{RGB}{100, 100, 100}

% Remove page numbers
\\pagenumbering{gobble}

\\begin{document}

\\begin{center}
{\\Huge\\bfseries\\color{primary} Template Error}
\\\\[1cm]
{\\large\\color{secondary} There was an error processing your CV template.}
\\\\[0.5cm]
{\\normalsize Please check your template for LaTeX syntax errors or try a different template.}
\\end{center}

\\vfill
\\begin{center}
\\textit{Generated: \\today}
\\end{center}

\\end{document}`;

async function compileLatex(templateContent, companyData, outputPath) {
  // Create temp directory for processing
  const tempDir = path.join(__dirname, "temp", Date.now().toString());
  await fs.ensureDir(tempDir);

  try {
    // Try to generate PDF with user template first
    let success = await tryGeneratePDF(tempDir, templateContent, companyData, outputPath);

    // If user template failed, try fallback template
    if (!success) {
      console.log("User template failed, trying fallback template");
      success = await tryGeneratePDF(tempDir, FALLBACK_TEMPLATE, companyData, outputPath);
    }

    // If fallback template also failed, use error template
    if (!success) {
      console.log("Fallback template failed, using error template");
      success = await tryGeneratePDF(tempDir, ERROR_TEMPLATE, {}, outputPath);

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
    // Clean up temp directory
    try {
      await fs.remove(tempDir);
    } catch (err) {
      console.error("Error cleaning up temp directory:", err);
    }
  }
}

// Helper function to try compiling a LaTeX template
async function tryGeneratePDF(tempDir, content, data, outputPath) {
  try {
    // Create temp tex file
    const texPath = path.join(tempDir, "document.tex");
    await fs.writeFile(texPath, content);

    // Run pdflatex
    console.log("Running pdflatex on", texPath);
    const result = await runPdfLatex(texPath, tempDir);

    // Check if PDF was created
    const pdfPath = path.join(tempDir, "document.pdf");
    const pdfExists = await fs.pathExists(pdfPath);

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
    const pdflatexCmd = "pdflatex";
    const cmd = `${pdflatexCmd} -interaction=nonstopmode -halt-on-error -output-directory="${outputDir}" "${texPath}"`;

    console.log("Running command:", cmd);

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.log("pdflatex error:", error.message);
      }
      resolve({ error, stdout, stderr });
    });
  });
}

export { compileLatex };
