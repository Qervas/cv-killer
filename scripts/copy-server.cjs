const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const buildDir = path.join(sourceDir, 'build');
const serverBuildDir = path.join(buildDir, 'server');

// Ensure build directories exist
fs.ensureDirSync(buildDir);
fs.ensureDirSync(serverBuildDir);

// Copy server files
console.log(`Copying server files to ${serverBuildDir}`);
const serverFiles = [
    'api-routes.js',
    'index.js',
    'latex-installer.js',
    'latex.js',
    'package.json',
    'server-paths.js',
    'startup.cjs',
    'storage.js'
];

serverFiles.forEach(file => {
    const sourcePath = path.join(sourceDir, 'server', file);
    const destPath = path.join(serverBuildDir, file);
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied: ${file}`);
    }
});

// Copy SvelteKit build files
const svelteKitBuildDir = path.join(sourceDir, '.svelte-kit', 'output', 'client');
if (fs.existsSync(svelteKitBuildDir)) {
    console.log('Copying SvelteKit build files...');
    fs.copySync(svelteKitBuildDir, buildDir, {
        filter: (src) => {
            // Skip server directory to avoid overwriting server files
            return !src.includes(path.join('build', 'server'));
        }
    });
    console.log('SvelteKit build files copied successfully');
} else {
    console.error('SvelteKit build directory not found:', svelteKitBuildDir);
}

console.log('Build files copied successfully');
