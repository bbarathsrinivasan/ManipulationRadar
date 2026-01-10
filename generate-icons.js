// Simple script to generate placeholder icons
// Run with: node generate-icons.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon
const svgIcon = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#3B82F6"/>
  <text x="64" y="80" font-family="Arial" font-size="64" font-weight="bold" fill="white" text-anchor="middle">🛡️</text>
</svg>`;

// For now, create a note file - actual PNG icons should be created separately
// You can use an online tool like https://www.favicon-generator.org/ or
// use ImageMagick: convert -size 128x128 xc:#3B82F6 -pointsize 64 -fill white -gravity center -annotate +0+0 "🛡️" icons/icon128.png

const readme = `# Icons

Place your extension icons here:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)  
- icon128.png (128x128 pixels)

You can create these using:
1. Online tools like https://www.favicon-generator.org/
2. ImageMagick: convert -size 128x128 xc:#3B82F6 icon128.png
3. Any image editor

For now, you can use the SVG template below or create simple colored squares.
`;

fs.writeFileSync(path.join(iconsDir, 'README.txt'), readme);
fs.writeFileSync(path.join(iconsDir, 'icon-template.svg'), svgIcon);

console.log('Icon directory created. Please add icon16.png, icon48.png, and icon128.png files.');
console.log('A template SVG has been created at icons/icon-template.svg');
