#!/usr/bin/env node

/**
 * Script post-build pour créer admin.html
 * Ce fichier permet d'accéder à /admin même si le serveur ne redirige pas les routes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distDir, 'index.html');
const adminHtml = path.join(distDir, 'admin.html');
const adminDir = path.join(distDir, 'admin');
const adminIndexHtml = path.join(adminDir, 'index.html');

try {
  if (fs.existsSync(indexHtml)) {
    const content = fs.readFileSync(indexHtml, 'utf8');
    
    // Créer admin.html à la racine
    fs.writeFileSync(adminHtml, content, 'utf8');
    console.log('✅ admin.html créé avec succès');
    
    // Créer le dossier admin/ avec index.html pour gérer /admin/
    if (!fs.existsSync(adminDir)) {
      fs.mkdirSync(adminDir, { recursive: true });
    }
    fs.writeFileSync(adminIndexHtml, content, 'utf8');
    console.log('✅ admin/index.html créé avec succès');
  } else {
    console.error('❌ index.html non trouvé dans dist/');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Erreur lors de la création des fichiers admin:', error);
  process.exit(1);
}

