const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Utilisation du dossier temporaire du système pour éviter les problèmes de permissions
const tempDir = os.tmpdir();
const USER_DATA_DIR = path.join(tempDir, `whatsapp-bot-${Math.random().toString(36).slice(2)}`);

// Configuration des chemins dans le dossier du projet
const PROJECT_DIR = process.cwd();
const CSV_FILE = path.join(PROJECT_DIR, 'messages.csv');
const CSV_HEADER = 'Contenu,Qui,Chez Qui/Ou,Heure\n';

// Configuration sécurisée pour Puppeteer
const PUPPETEER_CONFIG = {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-extensions',
        `--user-data-dir=${USER_DATA_DIR}`,
        '--disable-software-rasterizer',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-throttling',
    ],
};

// Fonction pour créer un dossier avec les bonnes permissions
function createSecureDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
        }
        // S'assurer que seul l'utilisateur actuel a accès au dossier
        fs.chmodSync(dirPath, 0o700);
        return true;
    } catch (error) {
        console.error(`Erreur lors de la création/modification de ${dirPath}:`, error);
        return false;
    }
}

// Fonction pour nettoyer les anciens dossiers temporaires
function cleanupTempDirectories() {
    try {
        if (fs.existsSync(USER_DATA_DIR)) {
            fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
            console.log('Ancien dossier temporaire nettoyé.');
        }
    } catch (error) {
        console.error('Erreur lors du nettoyage des dossiers temporaires:', error);
    }
}

// Préparation de l'environnement
if (!fs.existsSync(USER_DATA_DIR)) {
    cleanupTempDirectories();  // Nettoyage uniquement si le dossier n'existe pas
}
createSecureDirectory(USER_DATA_DIR);

// Vérification/création du fichier CSV
if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, CSV_HEADER, { mode: 0o600 });
}

// État global pour le spam
let spamInterval = null;

// Initialisation du client WhatsApp avec la nouvelle configuration
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'client-one',
        dataPath: USER_DATA_DIR
    }),
    puppeteer: PUPPETEER_CONFIG
});

// Fonction pour les logs avec horodatage
function log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

// Fonction pour sauvegarder un message dans le CSV
function saveToCSV(content, sender, receiver, timestamp) {
    const escapedContent = content.replace(/"/g, '""');
    const formattedDate = new Date(timestamp).toLocaleString('fr-FR');
    const csvLine = `"${escapedContent}","${sender}","${receiver}","${formattedDate}"\n`;

    fs.appendFileSync(CSV_FILE, csvLine, 'utf-8');
}

// Gestion du spam avec meilleure gestion des erreurs
async function startSpam(chat, message) {
    if (spamInterval) {
        log('ERROR', 'Un spam est déjà en cours');
        return;
    }

    log('COMMAND', `Démarrage du spam: ${message}`);
    spamInterval = setInterval(async () => {
        try {
            await chat.sendMessage(message);
        } catch (error) {
            log('ERROR', `Erreur lors de l'envoi du spam: ${error.message}`);
            stopSpam();
        }
    }, 1000);
}

function stopSpam() {
    if (!spamInterval) {
        log('ERROR', 'Aucun spam en cours');
        return;
    }

    clearInterval(spamInterval);
    spamInterval = null;
    log('COMMAND', 'Spam arrêté');
}

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
    log('AUTH', 'Fermeture du programme...');
    if (spamInterval) {
        stopSpam();
    }
    try {
        await client.destroy();
        log('AUTH', 'Client déconnecté proprement');
        process.exit(0);
    } catch (error) {
        log('ERROR', `Erreur lors de la fermeture: ${error.message}`);
        process.exit(1);
    }
});

// Événements du client WhatsApp
client.on('qr', (qr) => {
    log('AUTH', 'QR Code généré');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    log('AUTH', 'Client WhatsApp connecté');
});

client.on('message_create', async (message) => {
    try {
        if (!message.fromMe) {
            log('INFO', 'Message reçu de quelqu\'un d\'autre');
            const chat = await message.getChat();
            const contact = await message.getContact();
            log('INFO', `Message reçu de ${contact.pushname || contact.number}`);
        }

        const chat = await message.getChat();
        const contact = await message.getContact();
        log('INFO', `Message ${message.fromMe ? 'envoyé' : 'reçu'}: ${message.body}`);
        saveToCSV(
            message.body,
            message.fromMe ? 'BOT' : contact.pushname || contact.number,
            chat.name || chat.id._serialized,
            message.timestamp
        );

        if (message.body.startsWith('!')) {
            const [command, ...args] = message.body.split(' ');
            switch (command.toLowerCase()) {
                case '!spam':
                    if (args.length === 0) {
                        log('ERROR', 'Message de spam non fourni');
                        return;
                    }
                    await startSpam(chat, args.join(' '));
                    break;
                case '!stop':
                    stopSpam();
                    break;
                default:
                    log('ERROR', `Commande inconnue: ${command}`);
            }
        }
    } catch (error) {
        log('ERROR', `Erreur lors du traitement du message: ${error.message}`);
    }
});

client.on('disconnected', (reason) => {
    log('AUTH', `Client déconnecté: ${reason}`);
});

// Initialisation du client avec gestion des erreurs
client.initialize().catch(error => {
    log('ERROR', `Erreur d'initialisation: ${error.message}`);
});
