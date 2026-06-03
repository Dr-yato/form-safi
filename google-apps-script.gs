// ============================================================================
// GOOGLE APPS SCRIPT - Backend Serverless pour l'Enquête Cinémas de Safi
// ============================================================================
// Ce script sert de backend gratuit pour un formulaire d'enquête hébergé
// sur GitHub Pages. Il enregistre les réponses dans Google Sheets et
// fournit une API JSON pour le tableau de bord administrateur.
//
// INSTRUCTIONS DE DÉPLOIEMENT :
// 1. Créez un nouveau Google Spreadsheet
// 2. Allez dans Extensions > Apps Script
// 3. Collez ce code et enregistrez
// 4. Exécutez la fonction initSheet() une première fois
// 5. Déployez : Déployer > Nouveau déploiement > Application Web
//    - Exécuter en tant que : Moi
//    - Accès : Tout le monde
// 6. Copiez l'URL du déploiement dans votre fichier config.js
// ============================================================================

// --- CONFIGURATION ---
const ADMIN_PASSWORD = 'adminSafi2026'; // Mot de passe administrateur
const SHEET_RESPONSES = 'Responses';     // Nom de la feuille des réponses
const SHEET_CINEMAS = 'CinemaMentions';  // Nom de la feuille des cinémas
const NOTIFICATION_EMAIL = 'eddriouechabdelilah@gmail.com'; // E-mail de notification admin

// Colonnes de la feuille "Responses" (dans l'ordre)
const RESPONSE_HEADERS = [
  'id', 'submission_date',
  'q1_gender', 'q2_age_group', 'q3_neighborhood', 'q4_residence_duration',
  'q5_education_level', 'q6_profession',
  'q7_visited_cinema', 'q8_periods', 'q9_frequency', 'q10_companions',
  'q11_movie_types', 'q11_other', 'q12_memory', 'q13_text',
  'q14_what_became',
  'q15_1', 'q15_2', 'q15_3', 'q15_4', 'q15_5',
  'q15_6', 'q15_7', 'q15_8', 'q15_9', 'q15_10',
  'q16_main_cause',
  'q17_1', 'q17_2', 'q17_3', 'q17_4', 'q17_5', 'q17_6',
  'q18_meaning',
  'q19_1', 'q19_2', 'q19_3', 'q19_4', 'q19_5', 'q19_6',
  'q20_desired_usage', 'q20_other',
  'q21_support_type', 'q22_seen_content', 'q23_channels',
  'q24_follow_pages',
  'q25_1', 'q25_2', 'q25_3',
  'q26_comments', 'q27_recontact', 'q27_contact_details'
];

// Colonnes de la feuille "CinemaMentions"
const CINEMA_HEADERS = ['response_id', 'name', 'location', 'current_state'];

// Champs qui contiennent des tableaux (stockés en JSON)
const ARRAY_FIELDS = [
  'q8_periods', 'q10_companions', 'q11_movie_types',
  'q14_what_became', 'q20_desired_usage', 'q21_support_type', 'q23_channels'
];


// ============================================================================
// INITIALISATION - Crée les feuilles et en-têtes si nécessaire
// ============================================================================
function initSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Feuille "Responses" ---
  var responsesSheet = ss.getSheetByName(SHEET_RESPONSES);
  if (!responsesSheet) {
    responsesSheet = ss.insertSheet(SHEET_RESPONSES);
    Logger.log('Feuille "' + SHEET_RESPONSES + '" créée.');
  }
  // Ajouter les en-têtes si la première ligne est vide
  if (responsesSheet.getLastRow() === 0 ||
      responsesSheet.getRange(1, 1).getValue() === '') {
    responsesSheet.getRange(1, 1, 1, RESPONSE_HEADERS.length)
      .setValues([RESPONSE_HEADERS]);
    // Mise en forme des en-têtes
    responsesSheet.getRange(1, 1, 1, RESPONSE_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('#FFFFFF');
    responsesSheet.setFrozenRows(1);
    Logger.log('En-têtes de "' + SHEET_RESPONSES + '" ajoutés.');
  }

  // --- Feuille "CinemaMentions" ---
  var cinemasSheet = ss.getSheetByName(SHEET_CINEMAS);
  if (!cinemasSheet) {
    cinemasSheet = ss.insertSheet(SHEET_CINEMAS);
    Logger.log('Feuille "' + SHEET_CINEMAS + '" créée.');
  }
  if (cinemasSheet.getLastRow() === 0 ||
      cinemasSheet.getRange(1, 1).getValue() === '') {
    cinemasSheet.getRange(1, 1, 1, CINEMA_HEADERS.length)
      .setValues([CINEMA_HEADERS]);
    cinemasSheet.getRange(1, 1, 1, CINEMA_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#34A853')
      .setFontColor('#FFFFFF');
    cinemasSheet.setFrozenRows(1);
    Logger.log('En-têtes de "' + SHEET_CINEMAS + '" ajoutés.');
  }

  Logger.log('Initialisation terminée avec succès.');
}


// ============================================================================
// doPost - Réception des soumissions du formulaire
// ============================================================================
function doPost(e) {
  try {
    // Analyser le corps JSON de la requête
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var responsesSheet = ss.getSheetByName(SHEET_RESPONSES);

    // S'assurer que la feuille existe
    if (!responsesSheet) {
      initSheet();
      responsesSheet = ss.getSheetByName(SHEET_RESPONSES);
    }

    // --- Génération de l'ID auto-incrémenté ---
    var newId = 1;
    var lastRow = responsesSheet.getLastRow();
    if (lastRow > 1) {
      // Lire tous les IDs existants et trouver le maximum
      var ids = responsesSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var maxId = 0;
      for (var i = 0; i < ids.length; i++) {
        var currentId = parseInt(ids[i][0], 10);
        if (!isNaN(currentId) && currentId > maxId) {
          maxId = currentId;
        }
      }
      newId = maxId + 1;
    }

    // --- Horodatage de soumission ---
    var submissionDate = new Date().toISOString();

    // --- Construction de la ligne de données ---
    var row = [];
    for (var h = 0; h < RESPONSE_HEADERS.length; h++) {
      var header = RESPONSE_HEADERS[h];

      if (header === 'id') {
        row.push(newId);
      } else if (header === 'submission_date') {
        row.push(submissionDate);
      } else {
        var value = data[header];
        // Convertir les tableaux en chaînes JSON pour le stockage
        if (ARRAY_FIELDS.indexOf(header) !== -1 && Array.isArray(value)) {
          row.push(JSON.stringify(value));
        } else if (value !== undefined && value !== null) {
          row.push(value);
        } else {
          row.push(''); // Valeur vide par défaut
        }
      }
    }

    // --- Ajout de la ligne à la feuille "Responses" ---
    responsesSheet.appendRow(row);

    // --- Traitement du tableau Q13 (cinémas mentionnés) ---
    if (data.q13_table && Array.isArray(data.q13_table) && data.q13_table.length > 0) {
      var cinemasSheet = ss.getSheetByName(SHEET_CINEMAS);
      if (!cinemasSheet) {
        initSheet();
        cinemasSheet = ss.getSheetByName(SHEET_CINEMAS);
      }

      for (var c = 0; c < data.q13_table.length; c++) {
        var cinema = data.q13_table[c];
        // Vérifier que l'entrée contient au moins un champ renseigné
        if (cinema.name || cinema.location || cinema.current_state) {
          cinemasSheet.appendRow([
            newId,
            cinema.name || '',
            cinema.location || '',
            cinema.current_state || ''
          ]);
        }
      }
    }

    // --- Envoi de la notification par email ---
    try {
      var totalCount = responsesSheet.getLastRow() - 1;
      sendNotificationEmail(newId, data, totalCount);
    } catch (mailErr) {
      Logger.log('Erreur d\'envoi email : ' + mailErr.toString());
    }

    // --- Réponse de succès ---
    return buildJsonResponse({
      status: 'success',
      message: 'Merci ! Votre participation a été enregistrée avec succès.',
      id: newId
    });

  } catch (error) {
    // --- Gestion des erreurs ---
    Logger.log('Erreur doPost : ' + error.toString());
    return buildJsonResponse({
      status: 'error',
      message: 'Une erreur est survenue lors de l\'enregistrement : ' + error.toString()
    });
  }
}


// ============================================================================
// doGet - API de lecture et d'administration
// ============================================================================
function doGet(e) {
  try {
    var action = e.parameter.action || '';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {

      // --- Récupérer toutes les réponses ---
      case 'getAll':
        return handleGetAll(ss);

      // --- Récupérer les statistiques résumées ---
      case 'getStats':
        return handleGetStats(ss);

      // --- Supprimer une réponse par ID ---
      case 'delete':
        return handleDelete(ss, e.parameter);

      // --- Récupérer toutes les mentions de cinémas ---
      case 'getCinemas':
        return handleGetCinemas(ss);

      // --- Action non reconnue ---
      default:
        return buildJsonResponse({
          status: 'info',
          message: 'API Enquête Cinémas de Safi. Actions disponibles : getAll, getStats, delete, getCinemas'
        });
    }

  } catch (error) {
    Logger.log('Erreur doGet : ' + error.toString());
    return buildJsonResponse({
      status: 'error',
      message: 'Erreur serveur : ' + error.toString()
    });
  }
}


// ============================================================================
// GESTIONNAIRES D'ACTIONS
// ============================================================================

/**
 * getAll - Retourne toutes les réponses sous forme de tableau JSON.
 * Les champs tableau sont reconvertis depuis leur forme JSON.
 */
function handleGetAll(ss) {
  var sheet = ss.getSheetByName(SHEET_RESPONSES);
  if (!sheet || sheet.getLastRow() <= 1) {
    return buildJsonResponse({ status: 'success', data: [] });
  }

  var data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var val = data[i][j];

      // Reconvertir les champs tableau depuis JSON
      if (ARRAY_FIELDS.indexOf(key) !== -1 && typeof val === 'string' && val.length > 0) {
        try {
          obj[key] = JSON.parse(val);
        } catch (parseErr) {
          obj[key] = val; // Garder la valeur brute si le JSON est invalide
        }
      } else {
        obj[key] = val;
      }
    }
    results.push(obj);
  }

  return buildJsonResponse({ status: 'success', data: results });
}


/**
 * getStats - Retourne les statistiques résumées des réponses.
 */
function handleGetStats(ss) {
  var sheet = ss.getSheetByName(SHEET_RESPONSES);
  if (!sheet || sheet.getLastRow() <= 1) {
    return buildJsonResponse({
      status: 'success',
      data: { count: 0, today: 0, week: 0, month: 0 }
    });
  }

  var lastRow = sheet.getLastRow();
  var totalCount = lastRow - 1; // Exclure la ligne d'en-tête

  // Lire toutes les dates de soumission (colonne 2)
  var dates = sheet.getRange(2, 2, totalCount, 1).getValues();

  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Début de la semaine (dimanche)
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  var todayCount = 0;
  var weekCount = 0;
  var monthCount = 0;

  for (var i = 0; i < dates.length; i++) {
    var dateVal = dates[i][0];
    var d;

    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'string' && dateVal.length > 0) {
      d = new Date(dateVal);
    } else {
      continue; // Ignorer les dates invalides
    }

    if (isNaN(d.getTime())) continue;

    if (d >= todayStart) todayCount++;
    if (d >= weekStart) weekCount++;
    if (d >= monthStart) monthCount++;
  }

  return buildJsonResponse({
    status: 'success',
    data: {
      count: totalCount,
      today: todayCount,
      week: weekCount,
      month: monthCount
    }
  });
}


/**
 * delete - Supprime une réponse par son ID.
 * Nécessite le mot de passe administrateur.
 */
function handleDelete(ss, params) {
  // Vérification du mot de passe
  var password = params.password || '';
  if (password !== ADMIN_PASSWORD) {
    return buildJsonResponse({
      status: 'error',
      message: 'Mot de passe incorrect. Accès refusé.'
    });
  }

  var targetId = parseInt(params.id, 10);
  if (isNaN(targetId)) {
    return buildJsonResponse({
      status: 'error',
      message: 'ID invalide. Veuillez fournir un ID numérique.'
    });
  }

  // --- Supprimer de la feuille "Responses" ---
  var responsesSheet = ss.getSheetByName(SHEET_RESPONSES);
  var deleted = false;

  if (responsesSheet && responsesSheet.getLastRow() > 1) {
    var ids = responsesSheet.getRange(2, 1, responsesSheet.getLastRow() - 1, 1).getValues();
    // Parcourir de bas en haut pour ne pas décaler les indices
    for (var i = ids.length - 1; i >= 0; i--) {
      if (parseInt(ids[i][0], 10) === targetId) {
        responsesSheet.deleteRow(i + 2); // +2 car ligne 1 = en-tête, indices 0-based
        deleted = true;
      }
    }
  }

  // --- Supprimer les mentions de cinémas associées ---
  var cinemasSheet = ss.getSheetByName(SHEET_CINEMAS);
  if (cinemasSheet && cinemasSheet.getLastRow() > 1) {
    var cinemaIds = cinemasSheet.getRange(2, 1, cinemasSheet.getLastRow() - 1, 1).getValues();
    for (var j = cinemaIds.length - 1; j >= 0; j--) {
      if (parseInt(cinemaIds[j][0], 10) === targetId) {
        cinemasSheet.deleteRow(j + 2);
      }
    }
  }

  if (deleted) {
    return buildJsonResponse({
      status: 'success',
      message: 'Réponse n°' + targetId + ' supprimée avec succès.'
    });
  } else {
    return buildJsonResponse({
      status: 'error',
      message: 'Aucune réponse trouvée avec l\'ID ' + targetId + '.'
    });
  }
}


/**
 * getCinemas - Retourne toutes les mentions de cinémas.
 */
function handleGetCinemas(ss) {
  var sheet = ss.getSheetByName(SHEET_CINEMAS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return buildJsonResponse({ status: 'success', data: [] });
  }

  var data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    results.push(obj);
  }

  return buildJsonResponse({ status: 'success', data: results });
}


// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Construit une réponse JSON avec les en-têtes CORS appropriés.
 * Permet l'accès depuis n'importe quel domaine (GitHub Pages, localhost, etc.)
 */
function buildJsonResponse(data) {
  var output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}


// ============================================================================
// ENVOI DE NOTIFICATION PAR EMAIL
// ============================================================================

/**
 * Construit et envoie un e-mail HTML au design cinéma professionnel pour chaque
 * questionnaire soumis.
 */
function sendNotificationEmail(id, data, totalCount) {
  var recipient = NOTIFICATION_EMAIL;
  var subject = "🎬 CinePlus Safi : Nouvelle réponse n°" + id + " (" + totalCount + " au total)";

  // Formatage des variables individuelles
  var gender = data.q1_gender || 'Non spécifié';
  var age = data.q2_age_group || 'Non spécifié';
  var neighborhood = data.q3_neighborhood || 'Non spécifié';
  var duration = data.q4_residence_duration || 'Non spécifié';
  var education = data.q5_education_level || 'Non spécifié';
  var profession = data.q6_profession || 'Non spécifié';

  var visited = data.q7_visited_cinema || 'Non spécifié';

  // Fonction utilitaire pour formater les tableaux à choix multiples
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

  var periods = formatArray(data.q8_periods);
  var frequency = data.q9_frequency || 'Non renseigné';
  var companions = formatArray(data.q10_companions);
  var movieTypes = formatArray(data.q11_movie_types);
  var movieOther = data.q11_other ? " (Autre: " + data.q11_other + ")" : "";
  
  var memory = data.q12_memory || 'Aucun souvenir renseigné';
  var cinemasText = data.q13_text || 'Aucune salle citée';

  // Génération du tableau HTML pour la question Q13 (mentions de cinémas)
  var cinemasTableHtml = '';
  if (data.q13_table && Array.isArray(data.q13_table) && data.q13_table.length > 0) {
    cinemasTableHtml = '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:13px;">' +
      '<tr style="background-color:#4A0E17; color:#FFFFFF; text-align:left;">' +
      '<th style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">Salle</th>' +
      '<th style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">Localisation</th>' +
      '<th style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">État actuel</th>' +
      '</tr>';
    for (var i = 0; i < data.q13_table.length; i++) {
      var row = data.q13_table[i];
      var bgColor = (i % 2 === 0) ? '#fbf9f6' : '#ffffff';
      cinemasTableHtml += '<tr style="background-color:' + bgColor + ';">' +
        '<td style="padding:8px; border:1px solid #e0eae5; font-weight:bold; font-family:sans-serif;">' + (row.name || '-') + '</td>' +
        '<td style="padding:8px; border:1px solid #e0eae5; font-family:sans-serif;">' + (row.location || '-') + '</td>' +
        '<td style="padding:8px; border:1px solid #e0eae5; font-style:italic; font-family:sans-serif;">' + (row.current_state || '-') + '</td>' +
        '</tr>';
    }
    cinemasTableHtml += '</table>';
  } else {
    cinemasTableHtml = '<p style="margin:5px 0; color:#777; font-style:italic; font-family:sans-serif; font-size:13px;">Aucun tableau de salles renseigné.</p>';
  }

  var whatBecame = formatArray(data.q14_what_became);
  var mainCause = data.q16_main_cause || 'Non renseigné';
  var meaning = data.q18_meaning || 'Non renseigné';
  var desiredUsage = formatArray(data.q20_desired_usage);
  var desiredOther = data.q20_other ? " (Autre: " + data.q20_other + ")" : "";
  var supportType = formatArray(data.q21_support_type);
  var seenContent = data.q22_seen_content || 'Non spécifié';
  var channels = formatArray(data.q23_channels);
  var followPages = data.q24_follow_pages || 'Non spécifié';
  var comments = data.q26_comments || 'Aucun commentaire.';
  var recontact = data.q27_recontact || 'Non spécifié';
  var contactDetails = data.q27_contact_details || '';

  // Essayer d'obtenir l'URL de la feuille de calcul active
  var spreadsheetUrl = '#';
  try {
    spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  } catch (err) {
    Logger.log('Impossible de récupérer l\'URL du Spreadsheet : ' + err.toString());
  }

  // Construction du corps du message HTML
  var htmlMessage = 
    '<div style="background-color: #f4f2f0; padding: 20px; font-family: \'Helvetica Neue\', Helvetica, Arial, sans-serif; color: #222222; max-width: 600px; margin: 0 auto; border-radius: 8px;">' +
      
      '<!-- En-tête -->' +
      '<div style="background-color: #1a1617; border-top: 4px solid #d4af37; border-bottom: 2px solid #d4af37; padding: 20px; text-align: center; border-top-left-radius: 6px; border-top-right-radius: 6px;">' +
        '<h1 style="color: #d4af37; margin: 0; font-size: 24px; letter-spacing: 1px; font-family: Georgia, serif; font-weight: normal;">🎬 CinePlus Safi</h1>' +
        '<p style="color: #ffffff; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Nouvelle Enquête Soumise</p>' +
      '</div>' +
      
      '<!-- Corps du message -->' +
      '<div style="background-color: #ffffff; padding: 24px; border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">' +
        
        '<!-- Ticket Info -->' +
        '<div style="background-color: #fbf9f6; border: 1px dashed #d4af37; border-radius: 6px; padding: 15px; margin-bottom: 25px; text-align: center;">' +
          '<span style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px;">Statut des Réponses</span>' +
          '<div style="font-size: 26px; font-weight: bold; color: #4A0E17; margin-bottom: 5px;">Questionnaire n°' + id + '</div>' +
          '<div style="background-color: #4A0E17; color: #d4af37; display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: bold;">' +
            '📊 Total : ' + totalCount + ' réponses reçues' +
          '</div>' +
        '</div>' +
        
        '<!-- Section A: Profil -->' +
        '<h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; margin-top: 0; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">👤 Profil du Répondant</h3>' +
        '<table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Sexe :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + gender + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Tranche d\'âge :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + age + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Quartier à Safi :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + neighborhood + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Durée à Safi :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + duration + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Niveau d\'études :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + education + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Situation pro :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + profession + '</td>' +
          '</tr>' +
        '</table>' +
        
        '<!-- Section B: Memoire -->' +
        '<h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">🎬 Mémoire et Fréquentation</h3>' +
        '<table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">A déjà fréquenté ? :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-weight: bold; font-family: sans-serif;">' + visited + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Périodes :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + periods + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Fréquence historique :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + frequency + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Accompagnateurs :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + companions + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Genres favoris :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + movieTypes + movieOther + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Salles citées (texte) :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + cinemasText + '</td>' +
          '</tr>' +
        '</table>' +
        
        '<!-- Tableau des salles -->' +
        '<div style="margin-bottom: 25px;">' +
          '<span style="font-weight: bold; color: #4A0E17; font-size: 13px; display: block; margin-bottom: 5px; font-family: sans-serif;">📋 Salles de cinéma identifiées (Tableau) :</span>' +
          cinemasTableHtml +
        '</div>' +
        
        '<!-- Souvenir marquant -->' +
        '<div style="background-color: #fcfaf7; border-left: 3px solid #d4af37; padding: 12px; margin-bottom: 25px; border-radius: 4px;">' +
          '<span style="font-weight: bold; color: #4A0E17; font-size: 13px; display: block; margin-bottom: 5px; font-family: sans-serif;">💭 Souvenir marquant lié aux salles (Q12) :</span>' +
          '<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #444; font-style: italic; font-family: sans-serif;">"' + memory + '"</p>' +
        '</div>' +
        
        '<!-- Section C: Avenir et fermeture -->' +
        '<h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">🔮 Causes de Fermeture & Avenir</h3>' +
        '<table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Devenir des salles :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + whatBecame + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Cause principale :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + mainCause + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Que représentent-elles ? :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + meaning + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Usage souhaité réhab :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + desiredUsage + desiredOther + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Volonté d\'engagement :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + supportType + '</td>' +
          '</tr>' +
        '</table>' +
        
        '<!-- Section D: Medias et contact -->' +
        '<h3 style="color: #4A0E17; border-bottom: 2px solid #4A0E17; padding-bottom: 5px; font-size: 15px; text-transform: uppercase; font-family: sans-serif;">📢 Médias & Contact</h3>' +
        '<table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; width: 40%; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Contenu déjà vu ? :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + seenContent + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Canaux de diffusion :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + channels + '</td>' +
          '</tr>' +
          '<tr style="background-color: #faf7f5;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">Suit les pages patrimoine :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">' + followPages + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #4A0E17; font-size: 13px; border-bottom: 1px solid #f0eae5; font-family: sans-serif;">D\'accord pour entretien :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0eae5; font-weight: bold; font-family: sans-serif; color: ' + (recontact === 'Oui' ? '#2e7d32' : '#c62828') + ';">' + recontact + '</td>' +
          '</tr>';

  if (recontact === 'Oui') {
    htmlMessage += 
          '<tr style="background-color: #e8f5e9;">' +
            '<td style="padding: 8px 10px; font-weight: bold; color: #2e7d32; font-size: 13px; border-bottom: 1px solid #c8e6c9; font-family: sans-serif;">Coordonnées :</td>' +
            '<td style="padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #c8e6c9; font-weight: bold; font-family: sans-serif;">' + contactDetails + '</td>' +
          '</tr>';
  }

  htmlMessage += 
        '</table>' +

        '<!-- Suggestions libres -->' +
        '<div style="background-color: #f7fafc; border-left: 3px solid #4a5568; padding: 12px; margin-bottom: 25px; border-radius: 4px;">' +
          '<span style="font-weight: bold; color: #4a5568; font-size: 13px; display: block; margin-bottom: 5px; font-family: sans-serif;">💭 Suggestions / Commentaires (Q26) :</span>' +
          '<p style="margin: 0; font-size: 13px; line-height: 1.5; color: #444; font-family: sans-serif;">' + comments + '</p>' +
        '</div>' +
        
        '<!-- CTA Button -->' +
        '<div style="text-align: center; margin-top: 30px; margin-bottom: 10px;">' +
          '<a href="' + spreadsheetUrl + '" target="_blank" style="background-color: #4A0E17; color: #d4af37; border: 1px solid #d4af37; padding: 12px 24px; font-size: 13px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif;">' +
            '📂 Ouvrir Google Sheets' +
          '</a>' +
          '<p style="font-size: 11px; color: #666; margin-top: 10px; font-family: sans-serif; line-height: 1.4;">' +
            'Pour consulter le dashboard d\'administration en temps réel : <br>' +
            '<a href="http://localhost:8080/admin.html" style="color: #4A0E17; font-weight: bold; text-decoration: underline;">Ouvrir l\'Espace Administration</a>' +
          '</p>' +
        '</div>' +
        
      '</div>' +
      
      '<!-- Pied de page académique -->' +
      '<div style="text-align: center; padding: 20px; font-size: 11px; color: #777777; line-height: 1.6;">' +
        '<p style="margin: 0 0 5px 0; font-family: sans-serif;">Université Cadi Ayyad · Faculté Polydisciplinaire de Safi</p>' +
        '<p style="margin: 0 0 5px 0; font-weight: bold; font-family: sans-serif;">Master CMIC : Communication, Médias et Industries Créatives</p>' +
        '<p style="margin: 0 0 5px 0; font-family: sans-serif;">Mémoire : Le patrimoine des salles de cinéma de Safi · BOUBAROUD Karim</p>' +
        '<p style="margin: 0 0 5px 0; font-family: sans-serif; font-style: italic;">Encadrant : Mr. Rachid Naim</p>' +
        '<p style="margin: 15px 0 0 0; font-size: 10px; color: #999; font-family: sans-serif;">Cet e-mail a été envoyé automatiquement suite à une soumission d\'enquête.</p>' +
      '</div>' +
    '</div>';

  // Envoi effectif de l'e-mail via l'API Google Apps Script
  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlMessage
  });
  
  Logger.log('Notification email envoyée pour le questionnaire n°' + id + ' à ' + recipient);
}
