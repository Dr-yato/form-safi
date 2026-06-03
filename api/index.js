const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(__dirname, '..', 'responses.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files only when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '..')));
}

// Email Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'eddriouechabdelilah@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASS || 'jlnenyzjxuxjdgdd'; // App Password de 16 lettres sans espaces

// Configurer le transporteur SMTP de Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: ADMIN_EMAIL,
    pass: GMAIL_PASS
  }
});

// Database Cache Connection
let dbClient = null;
let responsesCollection = null;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    return null; // Fallback to local files
  }
  if (dbClient) {
    return responsesCollection;
  }
  try {
    dbClient = new MongoClient(process.env.MONGODB_URI);
    await dbClient.connect();
    const db = dbClient.db('cineplus_safi');
    responsesCollection = db.collection('responses');
    console.log('Connecté à la base de données MongoDB Cloud !');
    return responsesCollection;
  } catch (error) {
    console.error('Erreur de connexion MongoDB :', error);
    return null;
  }
}

// Helper: Charger toutes les réponses depuis le fichier JSON local (synchrone pour compatibilité locale)
function loadResponsesLocalSync() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(rawData) || [];
  } catch (error) {
    console.error('Erreur lors du chargement des réponses local :', error);
    return [];
  }
}

// Helper: Sauvegarder les réponses dans le fichier JSON local
function saveResponsesLocalSync(responses) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'écriture des réponses local :', error);
    return false;
  }
}

// Helper: Charger toutes les réponses (MongoDB ou Fichier)
async function loadResponses() {
  const collection = await connectDB();
  if (collection) {
    try {
      return await collection.find({}).toArray();
    } catch (error) {
      console.error('Erreur lors du chargement des réponses depuis MongoDB :', error);
      return [];
    }
  }
  return loadResponsesLocalSync();
}

// Helper: Formater les listes d'options multiples pour l'e-mail
function formatArray(arr) {
  if (!arr) return 'Non renseigné';
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch (e) {}
  }
  if (Array.isArray(arr)) {
    return arr.length > 0 ? arr.join(', ') : 'Aucun';
  }
  return arr;
}

// Helper: Envoyer l'email de notification
function sendEmailNotification(newResponse, totalCount) {
  const gender = newResponse.q1_gender || 'Non spécifié';
  const age = newResponse.q2_age_group || 'Non spécifié';
  const neighborhood = newResponse.q3_neighborhood || 'Non spécifié';
  const duration = newResponse.q4_residence_duration || 'Non spécifié';
  const education = newResponse.q5_education_level || 'Non spécifié';
  const profession = newResponse.q6_profession || 'Non spécifié';

  const visited = newResponse.q7_visited_cinema || 'Non spécifié';
  const periods = formatArray(newResponse.q8_periods);
  const frequency = newResponse.q9_frequency || 'Non renseigné';
  const companions = formatArray(newResponse.q10_companions);
  const movieTypes = formatArray(newResponse.q11_movie_types);
  const movieOther = newResponse.q11_other ? ` (Autre: ${newResponse.q11_other})` : "";
  
  const memory = newResponse.q12_memory || 'Aucun souvenir renseigné';
  const cinemasText = newResponse.q13_text || 'Aucune salle citée';

  // Génération du tableau HTML pour la question Q13 (mentions de cinémas)
  let cinemasTableHtml = '';
  if (newResponse.q13_table && Array.isArray(newResponse.q13_table) && newResponse.q13_table.length > 0) {
    cinemasTableHtml = `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:13px;">
      <tr style="background-color:#4A0E17; color:#FFFFFF; text-align:left;">
        <th style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">Salle</th>
        <th style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">Localisation</th>
        <th style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">État actuel</th>
      </tr>`;
    newResponse.q13_table.forEach((row, i) => {
      const bgColor = (i % 2 === 0) ? '#fbf9f6' : '#ffffff';
      cinemasTableHtml += `<tr style="background-color:${bgColor};">
        <td style="padding:8px; border:1px solid #e0eae5; font-weight:bold; font-family:sans-serif;">${row.name || '-'}</td>
        <td style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">${row.location || '-'}</td>
        <td style="padding:8px; border:1px solid #e0eae5; font-style:italic; font-family:sans-serif;">${row.current_state || '-'}</td>
      </tr>`;
    });
    cinemasTableHtml += '</table>';
  } else {
    cinemasTableHtml = '<p style="margin:5px 0; color:#777; font-style:italic; font-family:sans-serif; font-size:13px;">Aucun tableau de salles renseigné.</p>';
  }

  const whatBecame = formatArray(newResponse.q14_what_became);
  const mainCause = newResponse.q16_main_cause || 'Non renseigné';
  const meaning = newResponse.q18_meaning || 'Non renseigné';
  const desiredUsage = formatArray(newResponse.q20_desired_usage);
  const desiredOther = newResponse.q20_other ? ` (Autre: ${newResponse.q20_other})` : "";
  const supportType = formatArray(newResponse.q21_support_type);
  const seenContent = newResponse.q22_seen_content || 'Non spécifié';
  const channels = formatArray(newResponse.q23_channels);
  const followPages = newResponse.q24_follow_pages || 'Non spécifié';
  const comments = newResponse.q26_comments || 'Aucun commentaire.';
  const recontact = newResponse.q27_recontact || 'Non spécifié';
  const contactDetails = newResponse.q27_contact_details || '';

  // Construction du template d'e-mail HTML
  let htmlMessage = `
  <div style="background-color: #f4f2f0; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222222; max-width: 600px; margin: 0 auto; border-radius: 8px;">
    
    <!-- En-tête -->
    <div style="background-color: #1a1617; border-top: 4px solid #d4af37; border-bottom: 2px solid #d4af37; padding: 20px; text-align: center; border-top-left-radius: 6px; border-top-right-radius: 6px;">
      <h1 style="color: #d4af37; margin: 0; font-size: 24px; letter-spacing: 1px; font-family: Georgia, serif; font-weight: normal;">🎬 CinePlus Safi</h1>
      <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Nouvelle Enquête Soumise</p>
    </div>
    
    <!-- Corps de l'email -->
    <div style="background-color: #ffffff; padding: 24px; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      
      <!-- Ticket Info -->
      <div style="background-color: #fbf9f6; border: 1px dashed #d4af37; border-radius: 6px; padding: 15px; margin-bottom: 25px; text-align: center;">
        <span style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px;">Statut des Réponses</span>
        <div style="font-size: 26px; font-weight: bold; color: #4A0E17; margin-bottom: 5px;">Questionnaire n°${newResponse.id}</div>
        <div style="background-color: #4A0E17; color: #d4af37; display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: bold;">
          📊 Total : ${totalCount} réponses reçues
        </div>
      </div>
      
      <!-- Section A: Profil -->
      <h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; margin-top: 0; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">👤 Profil du Répondant</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Sexe :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${gender}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Tranche d'âge :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${age}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Quartier à Safi :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${neighborhood}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Durée à Safi :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${duration}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Niveau d'études :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${education}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Situation pro :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${profession}</td>
        </tr>
      </table>
      
      <!-- Section B: Memoire -->
      <h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">🎬 Mémoire et Fréquentation</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">A déjà fréquenté ? :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-weight: bold; font-family: sans-serif;">${visited}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Périodes :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${periods}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Fréquence historique :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${frequency}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Accompagnateurs :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${companions}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Genres favoris :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${movieTypes}${movieOther}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Salles citées (texte) :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${cinemasText}</td>
        </tr>
      </table>
      
      <!-- Tableau des salles -->
      <div style="margin-bottom: 25px;">
        <span style="font-weight: bold; color: #4A0E17; font-size: 13px; display: block; margin-bottom: 5px; font-family: sans-serif;">📋 Salles de cinéma identifiées (Tableau) :</span>
        ${cinemasTableHtml}
      </div>
      
      <!-- Souvenir marquant -->
      <div style="background-color: #fcfaf7; border-left: 3px solid #d4af37; padding: 12px; margin-bottom: 25px; border-radius: 4px;">
        <span style="font-weight: bold; color: #4A0E17; font-size: 13px; display: block; margin-bottom: 5px; font-family: sans-serif;">💭 Souvenir marquant lié aux salles (Q12) :</span>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #444; font-style: italic; font-family: sans-serif;">"${memory}"</p>
      </div>
      
      <!-- Section C: Avenir et fermeture -->
      <h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">🔮 Causes de Fermeture & Avenir</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Devenir des salles :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${whatBecame}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Cause principale :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${mainCause}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Que représentent-elles ? :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${meaning}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Usage souhaité réhab :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${desiredUsage}${desiredOther}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Volonté d'engagement :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${supportType}</td>
        </tr>
      </table>
      
      <!-- Section D: Medias et contact -->
      <h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">📢 Médias & Contact</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Contenu déjà vu ? :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${seenContent}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Canaux de diffusion :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${channels}</td>
        </tr>
        <tr style="background-color: #faf7f5;">
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Suit les pages patrimoine :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">${followPages}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">D'accord pour entretien :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-weight: bold; font-family: sans-serif; color: ${recontact === 'Oui' ? '#2e7d32' : '#c62828'};">${recontact}</td>
        </tr>`;

  if (recontact === 'Oui') {
    htmlMessage += `
        <tr style="background-color: #e8f5e9;">
          <td style="padding: 8px 10px; font-weight: bold; color: #2e7d32; font-size: 13px; border-bottom: 1px solid #c8e6c9; font-family: sans-serif;">Coordonnées :</td>
          <td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #c8e6c9; font-weight: bold; font-family: sans-serif;">${contactDetails}</td>
        </tr>`;
  }

  htmlMessage += `
      </table>

      <!-- Suggestions libres -->
      <div style="background-color: #f7fafc; border-left: 3px solid #4a5568; padding: 12px; margin-bottom: 25px; border-radius: 4px;">
        <span style="font-weight: bold; color: #4a5568; font-size: 13px; display: block; margin-bottom: 5px; font-family: sans-serif;">💭 Suggestions / Commentaires (Q26) :</span>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #444; font-family: sans-serif;">${comments}</p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #333; margin-top: 10px; font-family: sans-serif; line-height: 1.4;">
          Pour consulter le dashboard d'administration en temps réel : <br>
          <a href="http://localhost:8080/admin.html" style="background-color: #4A0E17; color: #d4af37; border: 1px solid #d4af37; padding: 10px 20px; font-size: 13px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif;">
            📂 Ouvrir l'Espace Administration
          </a>
        </p>
      </div>
      
    </div>
    
    <!-- Pied de page académique -->
    <div style="text-align: center; padding: 20px; font-size: 11px; color: #777777; line-height: 1.6;">
      <p style="margin: 0 0 5px 0; font-family: sans-serif;">Université Cadi Ayyad · Faculté Polydisciplinaire de Safi</p>
      <p style="margin: 0 0 5px 0; font-weight: bold; font-family: sans-serif;">Master CMIC : Communication, Médias et Industries Créatives</p>
      <p style="margin: 0 0 5px 0; font-family: sans-serif;">Mémoire : Le patrimoine des salles de cinéma de Safi · BOUBAROUD Karim</p>
      <p style="margin: 0 0 5px 0; font-family: sans-serif; font-style: italic;">Encadrant : Mr. Rachid Naim</p>
      <p style="margin: 15px 0 0 0; font-size: 10px; color: #999; font-family: sans-serif;">Cet e-mail a été envoyé automatiquement suite à une soumission d'enquête.</p>
    </div>
  </div>`;

  const mailOptions = {
    from: `"CinePlus Safi Enquête" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `🎬 CinePlus Safi : Nouvelle réponse n°${newResponse.id} (${totalCount} au total)`,
    html: htmlMessage
  };

  return new Promise((resolve) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Erreur lors de l\'envoi de la notification e-mail :', error);
      } else {
        console.log('Notification e-mail envoyée avec succès :', info.response);
      }
      resolve();
    });
  });
}

// ==========================================
// ROUTES API
// ==========================================

// 1. GET /api/responses - Récupérer toutes les réponses pour le dashboard
app.get('/api/responses', async (req, res) => {
  try {
    const responses = await loadResponses();
    res.json({ status: 'success', data: responses });
  } catch (error) {
    console.error('Erreur API responses :', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

// 2. POST /api/submit - Soumettre un nouveau questionnaire
app.post('/api/submit', async (req, res) => {
  try {
    const data = req.body;
    const collection = await connectDB();
    
    let newId = 1;
    let totalCount = 1;
    let newResponse = null;

    if (collection) {
      // Base de données MongoDB Cloud
      const lastResponse = await collection.findOne({}, { sort: { id: -1 } });
      newId = lastResponse ? (lastResponse.id || 0) + 1 : 1;
      const submissionDate = new Date().toISOString();

      newResponse = {
        ...data,
        id: newId,
        submission_date: submissionDate
      };

      await collection.insertOne(newResponse);
      totalCount = await collection.countDocuments();
    } else {
      // Fichier local fallback
      const responses = loadResponsesLocalSync();
      newId = responses.length > 0 ? Math.max(...responses.map(r => r.id || 0)) + 1 : 1;
      const submissionDate = new Date().toISOString();

      newResponse = {
        ...data,
        id: newId,
        submission_date: submissionDate
      };

      responses.push(newResponse);
      saveResponsesLocalSync(responses);
      totalCount = responses.length;
    }

    // Envoyer la notification email de façon asynchrone sans bloquer la requête
    sendEmailNotification(newResponse, totalCount);

    res.json({
      status: 'success',
      message: 'Merci ! Votre participation a été enregistrée avec succès.',
      id: newId
    });

  } catch (error) {
    console.error('Erreur API submit :', error);
    res.status(500).json({ status: 'error', message: 'Erreur interne du serveur.' });
  }
});

// 3. POST /api/delete/:id - Supprimer une réponse
app.post('/api/delete/:id', async (req, res) => {
  try {
    const idToDelete = parseInt(req.params.id, 10);
    if (isNaN(idToDelete)) {
      return res.status(400).json({ status: 'error', message: 'ID invalide' });
    }

    const collection = await connectDB();
    if (collection) {
      const result = await collection.deleteOne({ id: idToDelete });
      if (result.deletedCount === 0) {
        return res.status(404).json({ status: 'error', message: 'Réponse non trouvée' });
      }
      res.json({ status: 'success', message: `Réponse ${idToDelete} supprimée.` });
    } else {
      let responses = loadResponsesLocalSync();
      const initialLength = responses.length;
      responses = responses.filter(r => r.id !== idToDelete);

      if (responses.length === initialLength) {
        return res.status(404).json({ status: 'error', message: 'Réponse non trouvée' });
      }

      saveResponsesLocalSync(responses);
      res.json({ status: 'success', message: `Réponse ${idToDelete} supprimée.` });
    }
  } catch (error) {
    console.error('Erreur API delete :', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

// 4. POST /api/clear - Effacer toutes les données
app.post('/api/clear', async (req, res) => {
  try {
    const collection = await connectDB();
    if (collection) {
      await collection.deleteMany({});
    } else {
      saveResponsesLocalSync([]);
    }
    res.json({ status: 'success', message: 'Toutes les réponses ont été effacées.' });
  } catch (error) {
    console.error('Erreur API clear :', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

// Démarrer le serveur uniquement en développement local (hors Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🎬 Serveur CinePlusSafi en ligne sur : http://localhost:${PORT}`);
    console.log(`📂 Mode : Local (Fichier responses.json)`);
    console.log(`📧 E-mails de notification envoyés à : ${ADMIN_EMAIL}`);
    console.log(`================================================================`);
  });
}

module.exports = app;
