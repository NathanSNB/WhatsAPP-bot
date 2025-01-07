const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(process.cwd(), 'all_messages.csv');
const CSV_HEADER = 'Chat Name,Sender,Message,Timestamp\n';

if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, CSV_HEADER, { encoding: 'utf-8', flag: 'w' });
}

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'client-one' }),
    puppeteer: {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080'
        ],
        defaultViewport: null,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        timeout: 0
    }
});

function saveToCSV(chatName, sender, message, timestamp) {
    const escapedMessage = message.replace(/"/g, '""');
    const csvLine = `"${chatName}","${sender}","${escapedMessage}","${new Date(timestamp).toLocaleString('fr-FR')}"\n`;
    fs.appendFileSync(CSV_FILE, csvLine, 'utf-8');
}

async function fetchAllMessages(chat) {
    try {
        const messages = await chat.fetchMessages({ limit: 10000 });
        return messages;
    } catch (error) {
        console.error(`Erreur: ${chat.name}:`, error);
        return [];
    }
}

async function transcribeAllMessages() {
    try {
        console.log('Récupération des chats...');
        const chats = await client.getChats();
        
        for (const chat of chats) {
            console.log(`Transcription: ${chat.name || chat.id._serialized}...`);
            const messages = await fetchAllMessages(chat);
            
            messages.forEach(message => {
                if (message.body) {
                    const sender = message.fromMe ? 'Vous' : message.author || message.from;
                    saveToCSV(chat.name || chat.id._serialized, sender, message.body, message.timestamp * 1000);
                }
            });
            
            console.log(`Terminé: ${chat.name || chat.id._serialized}`);
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

client.on('ready', async () => {
    console.log('Début de la transcription...');
    await transcribeAllMessages();
    console.log('Transcription terminée:', CSV_FILE);
    process.exit(0);
});

client.on('qr', (qr) => {
    console.log('Scannez le QR code:');
    require('qrcode-terminal').generate(qr, { small: true });
});

client.on('auth_failure', msg => console.error('Échec auth:', msg));

client.on('disconnected', reason => {
    console.log('Déconnecté:', reason);
    process.exit(1);
});

client.initialize().catch(err => {
    console.error('Erreur init:', err);
    process.exit(1);
});
# WhatsApp Bot - Version Final - Troll - Transcript données - NatSNB68

#
