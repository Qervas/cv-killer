import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ultra-minimal template - absolute bare minimum
const FALLBACK_TEMPLATE = `\\documentclass{article}
\\begin{document}
\\section*{Simple CV}

\\textbf{Company:} COMPANY_NAME

\\textbf{Position:} POSITION_TITLE

\\textbf{Generated:} \\today
\\end{document}`;

// Error template
const ERROR_TEMPLATE = `\\documentclass{article}
\\begin{document}
\\section*{PDF Generation Error}

There was an error processing your CV template.

\\vspace{1cm}
Please check your template for LaTeX syntax errors or use the default template.
\\end{document}`;

async function compileLatex(templateContent, companyData, outputPath) {
  // Create temp directory for processing
  const tempDir = path.join(__dirname, "temp", Date.now().toString());
  await fs.ensureDir(tempDir);

  try {
    // Prepare simple variables for template replacement
    const companyName = companyData.companyName || "Company Name";
    const position = companyData.position || "Position";

    // Try to generate PDF with user template first
    let success = await tryGeneratePDF(
      tempDir,
      templateContent,
      companyData,
      outputPath,
    );

    // If user template failed, try fallback template
    if (!success) {
      console.log("User template failed, trying fallback template");

      // Replace placeholders in fallback template
      let fallbackContent = FALLBACK_TEMPLATE.replace(
        "COMPANY_NAME",
        companyName,
      ).replace("POSITION_TITLE", position);

      success = await tryGeneratePDF(tempDir, fallbackContent, {}, outputPath);
    }

    // If fallback template also failed, use error template
    if (!success) {
      console.log("Fallback template failed, using error template");

      // Generate error PDF
      success = await tryGeneratePDF(tempDir, ERROR_TEMPLATE, {}, outputPath);

      // If even error template fails, create a text file
      if (!success) {
        console.log("Error template failed, creating text file");
        const textPath = outputPath.replace(/\.pdf$/, ".txt");
        await fs.writeFile(
          textPath,
          "Error generating PDF. Please check your LaTeX template.",
        );

        // Try to copy a placeholder PDF if we have one
        const placeholderPath = path.join(__dirname, "placeholder.pdf");
        if (fs.existsSync(placeholderPath)) {
          await fs.copyFile(placeholderPath, outputPath);
          return outputPath;
        }

        throw new Error(
          "Failed to generate PDF. Check your LaTeX installation.",
        );
      }
    }

    console.log("Successfully generated PDF at:", outputPath);
    return outputPath;
  } catch (error) {
    console.error("LaTeX compilation error:", error);
    throw error;
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
