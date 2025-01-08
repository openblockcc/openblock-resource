#!/usr/bin/env node
/* eslint-disable require-jsdoc */
/* eslint-disable func-style */
/* eslint-disable max-len */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fetch = require('node-fetch');
const ProgressBar = require('progress');
const {program} = require('commander');

// Define CLI tools
program
    .version('1.0.1')
    .description('CLI tool for managing and downloading resources.')
    .option('-p, --package-arch <package:arch>', 'Specify the package and platform to download, e.g., arduino:avr')
    .option(
        '-A, --target-arch <arch>',
        'Specify target architecture (e.g., i686, x86_64, arm, aarch64, arm64). Note: aarch64 and arm64 are equivalent.'
    )
    .option('-P, --target-platform <platform>', 'Specify target platform (e.g., linux, darwin, win32)')
    .showHelpAfterError(true)
    .showSuggestionAfterError(true)
    .parse(process.argv);

const options = program.opts();

if (options.packageArch && (!options.targetArch || !options.targetPlatform)) {
    console.error(
        'Error: The options "-A, --target-arch" and "-P, --target-platform" are required when using "-p, --package-arch".'
    );
    program.help();
}

const workingDir = path.resolve(process.cwd());
const stagingDir = path.join(workingDir, 'staging/packages');

if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, {recursive: true});
}

// Helper: Calculate SHA-256 checksum
function calculateChecksum (filePath) {
    const hash = crypto.createHash('sha256');
    const fileBuffer = fs.readFileSync(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
}

// Helper: Download and verify file (updated to show speed in MB/s when greater than 1MB/s)
async function downloadAndVerify (url, outputPath, expectedChecksum) {
    // Extract the file name from the URL
    const resourceName = path.basename(new URL(url).pathname);
    console.log(`Downloading: ${resourceName}`);

    // Check if file exists
    if (fs.existsSync(outputPath)) {
        const calculatedChecksum = calculateChecksum(outputPath);
        if (calculatedChecksum === expectedChecksum) {
            console.log(`Already exists, skip downloading`);
            return;
        }
        fs.unlinkSync(outputPath); // Delete the corrupted file
    }

    // Download the file
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file "${resourceName}" from ${url}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = parseInt(contentLength, 10) || 0; // Handle cases where content-length is missing
    const fileStream = fs.createWriteStream(outputPath);
    const progressBar = new ProgressBar(':bar :percent :etas :speed', {
        total: totalBytes,
        width: 50
    });

    let downloadedBytes = 0;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        response.body.on('data', chunk => {
            downloadedBytes += chunk.length;
            const elapsedTime = (Date.now() - startTime) / 1000;
            let speed = (downloadedBytes / elapsedTime / 1024).toFixed(2); // Speed in KB/s

            // Convert to MB/s if greater than 1MB/s
            if (speed > 1024) {
                speed = (speed / 1024).toFixed(2); // Convert to MB/s
                speed = `${speed} MB/s`;
            } else {
                speed = `${speed} KB/s`;
            }

            progressBar.tick(chunk.length, {speed});
        });

        response.body.pipe(fileStream);

        response.body.on('error', err => {
            console.error(`Error while downloading "${resourceName}" from ${url}: ${err.message}`);
            reject(err);
        });
        fileStream.on('finish', async () => {
            const calculatedChecksum = calculateChecksum(outputPath);
            if (calculatedChecksum !== expectedChecksum) {
                console.error(`Checksum mismatch for "${resourceName}" after download.`);
                fs.unlinkSync(outputPath); // Delete the corrupted file
                reject(new Error(`Checksum mismatch for "${resourceName}"`));
                return;
            }
            console.log(`Download completed: "${resourceName}"`);
            resolve();
        });
        fileStream.on('error', err => {
            console.error(`File stream error for "${resourceName}" at ${url}: ${err.message}`);
            reject(err);
        });
    });
}

// Helper: Parse JSON files
function loadJsonFiles () {
    const files = fs.readdirSync(workingDir).filter(file => file.match(/package_.*_index\.json$/));
    files.push('package_index.json'); // Include the main package_index.json

    const data = [];
    files.forEach(file => {
        const filePath = path.join(workingDir, file);
        if (fs.existsSync(filePath)) {
            const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            data.push(jsonData);
        }
    });

    return data;
}

// Helper: Match current system
function matchSystemHost (systems) {
    const inputArch = options.targetArch || os.arch(); // CLI-specified arch or default to current system arch
    const targetPlatform = options.targetPlatform || os.platform(); // CLI-specified platform or default to current system platform

    // Define equivalent architectures
    const archGroup = (inputArch === 'aarch64' || inputArch === 'arm64') ? ['aarch64', 'arm64'] : [inputArch];

    return systems.find(system => {
        const {host} = system;
        return (
            archGroup.some(arch => host.includes(arch)) && // Match any architecture in the group
            ((host.includes('linux') && targetPlatform === 'linux') ||
                (host.includes('darwin') && targetPlatform === 'darwin') ||
                (host.includes('mingw32') && targetPlatform === 'win32'))
        );
    });
}

// Helper: Group packages by architecture and display only one entry per architecture
function groupByArchitecture (packages) {
    const grouped = {};

    packages.forEach(pkg => {
        pkg.platforms.forEach(platform => {
            if (!grouped[platform.architecture]) {
                grouped[platform.architecture] = {
                    name: pkg.name,
                    version: platform.version,
                    architecture: platform.architecture
                };
            }
        });
    });

    return Object.values(grouped);
}


// Helper: Always download tools from the 'builtin' package (only latest versions)
async function downloadBuiltinTools (packages) {
    const builtinPackage = packages.find(pkg => pkg.name === 'builtin');
    if (!builtinPackage) {
        console.error('Builtin package not found.');
        return;
    }

    console.log('Downloading tools from builtin package...');

    // Track downloaded tools by their name to avoid downloading the same tool again
    const downloadedTools = new Set();

    for (const tool of builtinPackage.tools) {
        if (downloadedTools.has(tool.name)) {
            console.log(`Skipping already downloaded tool: ${tool.name}`);
            continue; // Skip if this tool has already been downloaded
        }

        if (tool.systems) {
            const matchedSystem = matchSystemHost(tool.systems);
            if (matchedSystem) {
                const toolFilePath = path.join(stagingDir, matchedSystem.archiveFileName);
                await downloadAndVerify(matchedSystem.url, toolFilePath, matchedSystem.checksum.split(':')[1]);
                downloadedTools.add(tool.name); // Mark this tool as downloaded
            } else {
                console.warn(`No compatible system found for builtin tool: ${tool.name} ${tool.version}.`);
            }
        }
    }
}

async function main () {
    const jsonFiles = loadJsonFiles();
    const packages = jsonFiles.flatMap(data => data.packages);

    if (!options.packageArch) {
        console.log('Available packages and architectures:');
        const groupedPackages = groupByArchitecture(packages);
        groupedPackages.forEach(pkg => {
            console.log(`  ${pkg.name}:${pkg.architecture} (Version: ${pkg.version})`);
        });
        return;
    }

    // Always download tools from the 'builtin' package
    await downloadBuiltinTools(packages);

    const [pkgName, archName] = options.packageArch.split(':');
    const targetPackage = packages.find(pkg => pkg.name === pkgName);
    if (!targetPackage) {
        console.error(`Package "${pkgName}" not found.`);
        process.exit(1);
    }

    const targetPlatform = targetPackage.platforms.find(p => p.architecture === archName);
    if (!targetPlatform) {
        console.error(`Architecture "${archName}" not found in package "${pkgName}".`);
        process.exit(1);
    }

    console.log(`Downloading package "${pkgName}" architecture "${archName}" version "${targetPlatform.version}"...`);
    const platformFilePath = path.join(stagingDir, targetPlatform.archiveFileName);
    await downloadAndVerify(targetPlatform.url, platformFilePath, targetPlatform.checksum.split(':')[1]);

    // Handle tools dependencies
    console.log('Downloading tools dependencies...');
    for (const tool of targetPlatform.toolsDependencies) {
        const toolPackage = packages.find(pkg => pkg.name === tool.packager);
        if (toolPackage) {
            const toolInfo = toolPackage.tools.find(t => t.name === tool.name && t.version === tool.version);
            if (toolInfo && toolInfo.systems) {
                const matchedSystem = matchSystemHost(toolInfo.systems); // Match based on CLI input or default system
                if (matchedSystem) {
                    const toolFilePath = path.join(stagingDir, matchedSystem.archiveFileName);
                    await downloadAndVerify(matchedSystem.url, toolFilePath, matchedSystem.checksum.split(':')[1]);
                } else {
                    console.warn(`No compatible system found for tool: ${tool.name} ${tool.version}.`);
                }
            } else {
                console.warn(`Tool not found: ${tool.name} ${tool.version} in package: ${tool.packager}`);
            }
        } else {
            console.warn(`Package not found: ${tool.packager} for tool: ${tool.name}`);
        }
    }

    console.log('All resources downloaded and verified successfully.');
}

// Run main function
main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
