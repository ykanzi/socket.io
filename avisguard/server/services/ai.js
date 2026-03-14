const fetch = require('node-fetch');
const config = require('../config');

/**
 * Service IA - Génère des réponses personnalisées aux avis clients
 * Utilise l'API Claude (Anthropic)
 */

async function generateReviewResponse(review, establishment) {
  const { rating, text, authorName, platform } = review;
  const { name, ai_tone, ai_language, ai_use_tu, ai_signature, category } = establishment;

  const sentiment = rating >= 4 ? 'positif' : rating === 3 ? 'neutre' : 'négatif';
  const tutoiement = ai_use_tu === 'tu' ? 'tutoie' : 'vouvoie';

  const systemPrompt = `Tu es un assistant de réponse aux avis clients pour "${name}", un(e) ${category || 'commerce'}.

RÈGLES STRICTES :
- Réponds en ${ai_language === 'fr' ? 'français' : ai_language}
- Ton : ${ai_tone || 'professionnel'}
- ${tutoiement} le client
- Maximum 3-4 phrases
- Personnalise la réponse en mentionnant des détails spécifiques de l'avis
- Ne répète JAMAIS la même formulation
- Sois authentique et humain, évite les réponses robotiques
- N'utilise PAS d'emojis sauf si le ton est "decontracte"
${ai_signature ? `- Termine par "${ai_signature}"` : ''}

CONTEXTE :
- Plateforme : ${platform}
- Note : ${rating}/5 (${sentiment})
- Nom du client : ${authorName || 'Client'}`;

  const userPrompt = `Génère une réponse à cet avis ${sentiment} :

"${text || '(Pas de commentaire, seulement une note de ' + rating + '/5)'}"

La réponse doit être naturelle, variée et adaptée au contexte.`;

  // Si pas de clé API, retourne une réponse template
  if (!config.anthropic.apiKey) {
    return generateFallbackResponse(review, establishment);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.anthropic.model,
        max_tokens: config.anthropic.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[AI] API error:', response.status, errorData);
      return generateFallbackResponse(review, establishment);
    }

    const data = await response.json();
    return {
      text: data.content[0].text.trim(),
      generatedBy: 'ai',
      model: config.anthropic.model,
      tokensUsed: data.usage?.output_tokens || 0
    };
  } catch (error) {
    console.error('[AI] Error generating response:', error.message);
    return generateFallbackResponse(review, establishment);
  }
}

/**
 * Analyse le sentiment d'un avis
 */
function analyzeSentiment(rating, text) {
  if (rating >= 4) return { sentiment: 'positive', score: rating / 5 };
  if (rating === 3) return { sentiment: 'neutre', score: 0.5 };
  return { sentiment: 'negative', score: (5 - rating) / 5 };
}

/**
 * Réponse de secours si l'API IA n'est pas disponible
 */
function generateFallbackResponse(review, establishment) {
  const { rating, authorName } = review;
  const name = authorName || 'Client';
  const estName = establishment.name;
  const useTu = establishment.ai_use_tu === 'tu';

  const positiveResponses = [
    `Merci beaucoup ${name} pour ${useTu ? 'ton' : 'votre'} avis chaleureux ! Toute l'équipe de ${estName} est ravie que ${useTu ? 'tu aies' : 'vous ayez'} apprécié ${useTu ? 'ton' : 'votre'} expérience. Au plaisir de ${useTu ? 'te' : 'vous'} revoir bientôt !`,
    `${name}, ${useTu ? 'ton' : 'votre'} retour nous fait chaud au cœur ! Chez ${estName}, nous mettons tout en œuvre pour offrir la meilleure expérience possible. Merci pour ${useTu ? 'ta' : 'votre'} confiance !`,
    `Un grand merci ${name} ! ${useTu ? 'Ton' : 'Votre'} satisfaction est notre plus belle récompense. L'équipe de ${estName} ${useTu ? 't\'' : 'vous '}attend avec impatience pour une prochaine visite !`
  ];

  const neutralResponses = [
    `Merci ${name} pour ${useTu ? 'ton' : 'votre'} retour. Chez ${estName}, nous cherchons toujours à nous améliorer. N'${useTu ? 'hésite' : 'hésitez'} pas à nous contacter pour nous faire part de ${useTu ? 'tes' : 'vos'} suggestions.`,
    `${name}, merci d'avoir pris le temps de partager ${useTu ? 'ton' : 'votre'} avis. Nous prenons note de ${useTu ? 'tes' : 'vos'} remarques et travaillons à améliorer nos services.`
  ];

  const negativeResponses = [
    `${name}, nous sommes sincèrement désolés que ${useTu ? 'ton' : 'votre'} expérience n'ait pas été à la hauteur de ${useTu ? 'tes' : 'vos'} attentes. Chez ${estName}, la satisfaction client est notre priorité. Nous aimerions comprendre ce qui n'a pas fonctionné. ${useTu ? 'Peux-tu' : 'Pourriez-vous'} nous contacter directement ?`,
    `Merci ${name} pour ${useTu ? 'ton' : 'votre'} retour honnête. Nous regrettons cette expérience et prenons ${useTu ? 'tes' : 'vos'} remarques très au sérieux. L'équipe de ${estName} s'engage à corriger ces points.`
  ];

  let templates;
  if (rating >= 4) templates = positiveResponses;
  else if (rating === 3) templates = neutralResponses;
  else templates = negativeResponses;

  const text = templates[Math.floor(Math.random() * templates.length)];
  const signature = establishment.ai_signature;

  return {
    text: signature ? `${text}\n\n${signature}` : text,
    generatedBy: 'template',
    model: 'fallback',
    tokensUsed: 0
  };
}

module.exports = { generateReviewResponse, analyzeSentiment, generateFallbackResponse };
