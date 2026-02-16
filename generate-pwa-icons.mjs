/**
 * Script per generare tutte le icone PWA necessarie (ES Module)
 * 
 * Uso:
 * 1. Assicurati di avere sharp installato: pnpm add -D sharp
 * 2. Esegui: node generate-pwa-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Percorsi
const INPUT_LOGO = path.join(__dirname, 'apps/frontend/public/logo.png');
const OUTPUT_DIR = path.join(__dirname, 'apps/frontend/public/icons');

// Dimensioni richieste per PWA e iOS
const SIZES = [
  72,   // Android Chrome
  96,   // Android Chrome
  128,  // Android Chrome
  144,  // Android Chrome
  152,  // iOS Safari
  167,  // iOS iPad Pro
  180,  // iOS Safari
  192,  // Android Chrome (standard)
  384,  // Android Chrome
  512,  // Android Chrome (splash)
];

// Crea la cartella icons se non esiste
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ Creata cartella: ${OUTPUT_DIR}`);
}

// Verifica che il logo esista
if (!fs.existsSync(INPUT_LOGO)) {
  console.error(`❌ Logo non trovato: ${INPUT_LOGO}`);
  console.log('💡 Assicurati che apps/frontend/public/logo.png esista');
  process.exit(1);
}

console.log(`📸 Generazione icone da: ${INPUT_LOGO}\n`);

// Genera tutte le icone
let successCount = 0;
let errorCount = 0;

const generateIcons = async () => {
  for (const size of SIZES) {
    try {
      const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
      
      await sharp(INPUT_LOGO)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 9, g: 9, b: 11, alpha: 1 } // #09090b
        })
        .png()
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      console.log(`✅ ${size}x${size} -> ${outputPath} (${sizeKB} KB)`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Errore generando ${size}x${size}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Completato:`);
  console.log(`   ✅ ${successCount} icone generate`);
  if (errorCount > 0) {
    console.log(`   ❌ ${errorCount} errori`);
  }
  console.log(`\n📁 Icone salvate in: ${OUTPUT_DIR}`);
};

generateIcons().catch(error => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});
