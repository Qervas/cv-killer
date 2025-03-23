import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import latexInstaller from "./latex-installer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function compileLatex(templateContent, companyData, outputPath) {
  // Create a temp directory for processing
  const tempDir = path.join(__dirname, "temp", Date.now().toString());
  await fs.ensureDir(tempDir);

  try {
    // Replace placeholders with company data
    let processedTemplate = templateContent;

    // Log the data we're using for replacements
    console.log("Data for template replacements:", companyData);

    // First, handle keys with explicit values
    for (const [key, value] of Object.entries(companyData)) {
      if (value !== undefined && value !== null) {
        // Use regex to replace all instances of {key}
        const regex = new RegExp(`\\{${key}\\}`, "g");
        processedTemplate = processedTemplate.replace(regex, value || "");
      }
    }

    // For debugging - log the processed template
    console.log("Processed template after replacements:");
    console.log(processedTemplate.substring(0, 500) + "..."); // Show first 500 chars for debugging

    // Write the processed file
    const processedFilePath = path.join(tempDir, "output.tex");
    await fs.writeFile(processedFilePath, processedTemplate);

    // Find a LaTeX executable - prioritize system LaTeX over bundled
    let pdflatexCmd;

    // First try to find system LaTeX
    try {
      const systemLatexPath = await latexInstaller.findSystemLatex();
      if (systemLatexPath) {
        pdflatexCmd = systemLatexPath;
        console.log("Using system LaTeX at:", pdflatexCmd);
      } else {
        // Fall back to bundled LaTeX only if it actually exists
        const bundledPath = latexInstaller.getBinaryPath();
        try {
          await fs.access(bundledPath);
          pdflatexCmd = bundledPath;
          console.log("Using bundled LaTeX at:", pdflatexCmd);
        } catch (err) {
          throw new Error(
            "No LaTeX installation found. Please install LaTeX to generate PDFs.",
          );
        }
      }
    } catch (err) {
      // Last resort - try to use "pdflatex" directly from PATH
      pdflatexCmd = "pdflatex";
      console.log("Falling back to system pdflatex on PATH");
    }

    console.log(`Using LaTeX from: ${pdflatexCmd}`);
    console.log(`Processing file: ${processedFilePath}`);

    // Run pdflatex with error capturing - first run
    await new Promise((resolve, reject) => {
      exec(
        `${pdflatexCmd} -interaction=nonstopmode -output-directory="${tempDir}" "${processedFilePath}"`,
        { maxBuffer: 1024 * 1024 * 10 }, // Increase buffer size for large logs
        (error, stdout, stderr) => {
          if (error && error.code !== 0) {
            console.error("First pdflatex run stdout:", stdout);
            console.error("First pdflatex run stderr:", stderr);
            // Don't reject here, as we still want to try the second run
          }
          resolve(stdout);
        },
      );
    });

    // Run second pass for references
    await new Promise((resolve, reject) => {
      exec(
        `${pdflatexCmd} -interaction=nonstopmode -output-directory="${tempDir}" "${processedFilePath}"`,
        { maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          if (error && error.code !== 0) {
            console.error("Second pdflatex run stdout:", stdout);
            console.error("Second pdflatex run stderr:", stderr);
            reject(
              new Error(
                `LaTeX compilation failed: ${stderr || stdout || error.message}`,
              ),
            );
            return;
          }
          resolve(stdout);
        },
      );
    });

    // Check if the PDF was created
    const pdfPath = path.join(tempDir, "output.pdf");
    if (await fs.pathExists(pdfPath)) {
      console.log("PDF generated successfully at:", pdfPath);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.copyFile(pdfPath, outputPath);
      return outputPath;
    } else {
      throw new Error(
        "PDF file not generated - check LaTeX content for errors",
      );
    }
  } catch (error) {
    console.error("LaTeX compilation error:", error);
    throw error;
  } finally {
    // Keep the temp directory for debugging
    console.log("Temp directory (for debugging):", tempDir);
  }
}

export { compileLatex };
