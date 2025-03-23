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
    // Verify we have content to work with
    if (!templateContent || templateContent.trim() === "") {
      console.error("Empty template content provided");
      templateContent = `\\documentclass{article}
\\begin{document}
No template content was provided. This is a fallback document.
\\end{document}`;
    }

    // Process template replacements
    console.log("Processing template with data:", Object.keys(companyData));
    let processedTemplate = templateContent;

    // Replace placeholders with values
    for (const [key, value] of Object.entries(companyData)) {
      if (value !== undefined && value !== null) {
        // Create a safe value for LaTeX
        const safeValue = String(value)
          .replace(/\\/g, "\\textbackslash ")
          .replace(/\{/g, "\\{")
          .replace(/\}/g, "\\}")
          .replace(/\$/g, "\\$")
          .replace(/%/g, "\\%")
          .replace(/&/g, "\\&")
          .replace(/#/g, "\\#")
          .replace(/_/g, "\\_")
          .replace(/~/g, "\\textasciitilde ")
          .replace(/\^/g, "\\textasciicircum ");

        // Replace all instances of {key} with the safe value
        const regex = new RegExp(`\\{${key}\\}`, "g");
        processedTemplate = processedTemplate.replace(regex, safeValue);
      }
    }

    // Replace any remaining placeholders with empty strings
    processedTemplate = processedTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "");

    // Create a minimal valid document if the template doesn't have basic structure
    if (!processedTemplate.includes("\\begin{document}")) {
      console.warn("Template missing \\begin{document}, creating fallback");
      processedTemplate = `\\documentclass{article}
\\begin{document}
${processedTemplate}
\\end{document}`;
    }

    // Write to temp file
    const texFilePath = path.join(tempDir, "output.tex");
    await fs.writeFile(texFilePath, processedTemplate);
    console.log(`Template written to ${texFilePath}`);

    // Choose LaTeX command
    let pdflatexCmd;
    try {
      const systemLatex = await latexInstaller.findSystemLatex();
      if (systemLatex) {
        pdflatexCmd = systemLatex;
        console.log("Using system LaTeX:", pdflatexCmd);
      } else {
        // Try to use fallback pdflatex command
        pdflatexCmd = "pdflatex";
        console.log("Using default pdflatex command");
      }
    } catch (err) {
      // If detection fails, try simple command
      pdflatexCmd = "pdflatex";
      console.log("Using default pdflatex command (after error):", err.message);
    }

    // DEBUG: Show the content of the tex file we're about to compile
    const fileContent = await fs.readFile(texFilePath, "utf-8");
    console.log("-------------- TEX FILE CONTENT --------------");
    console.log(
      fileContent.substring(0, 1000) + (fileContent.length > 1000 ? "..." : ""),
    );
    console.log("----------------------------------------------");

    // Run pdflatex - Try simplified single pass approach
    console.log(`Running: ${pdflatexCmd} on ${texFilePath}`);
    await new Promise((resolve, reject) => {
      const cmd = `${pdflatexCmd} -interaction=nonstopmode -output-directory="${tempDir}" "${texFilePath}"`;
      exec(cmd, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        // Log output regardless of errors
        console.log("LaTeX stdout:", stdout);
        if (stderr) console.error("LaTeX stderr:", stderr);

        // Warning: pdflatex often returns non-zero exit code even when PDF is generated
        if (error) {
          console.warn("LaTeX process returned error:", error.message);
          // But we'll continue to check if PDF was generated
        }
        resolve();
      });
    });

    // Check if PDF was created regardless of process exit code
    const pdfPath = path.join(tempDir, "output.pdf");
    const pdfExists = await fs.pathExists(pdfPath);

    console.log(
      `PDF file ${pdfExists ? "exists" : "does not exist"} at: ${pdfPath}`,
    );

    if (pdfExists) {
      // Get file stats to verify it's not empty
      const stats = await fs.stat(pdfPath);
      console.log(`PDF file size: ${stats.size} bytes`);

      if (stats.size < 100) {
        throw new Error("Generated PDF is too small to be valid");
      }

      // Copy to destination
      await fs.ensureDir(path.dirname(outputPath));
      await fs.copyFile(pdfPath, outputPath);
      return outputPath;
    } else {
      // If PDF doesn't exist, check log file for errors
      const logPath = path.join(tempDir, "output.log");
      let logContent = "";

      try {
        if (await fs.pathExists(logPath)) {
          logContent = await fs.readFile(logPath, "utf-8");
          console.error(
            "LaTeX log file content:",
            logContent.substring(0, 1000) + "...",
          );
        }
      } catch (err) {
        console.error("Error reading log file:", err);
      }

      throw new Error(
        `PDF generation failed. LaTeX error: ${logContent.substring(0, 200)}...`,
      );
    }
  } catch (error) {
    console.error("LaTeX compilation error:", error);
    throw error;
  }
}

export async function testLatexCompilation(textContent) {
  const response = await fetch(`${API_URL}/latex/test`, {
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

export { compileLatex };
