/**
 * AvisGuard - Validation des inputs avec Joi
 */

const Joi = require('joi');

// --- Schemas ---
const schemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Email invalide',
      'any.required': 'Email requis'
    }),
    password: Joi.string().min(6).max(128).required().messages({
      'string.min': 'Le mot de passe doit contenir au moins 6 caractères',
      'any.required': 'Mot de passe requis'
    }),
    firstName: Joi.string().max(50).allow('').optional(),
    lastName: Joi.string().max(50).allow('').optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  addReview: Joi.object({
    establishmentId: Joi.string().uuid().required(),
    platform: Joi.string().valid('google', 'facebook', 'tripadvisor', 'pagesjaunes', 'trustpilot', 'booking', 'yelp', 'other').required(),
    authorName: Joi.string().max(100).allow('').optional(),
    rating: Joi.number().integer().min(1).max(5).required(),
    text: Joi.string().max(5000).allow('').optional(),
    platformReviewId: Joi.string().max(255).allow('', null).optional(),
    publishedAt: Joi.string().isoDate().optional()
  }),

  createEstablishment: Joi.object({
    name: Joi.string().min(1).max(200).required().messages({
      'any.required': 'Le nom est requis',
      'string.min': 'Le nom ne peut pas être vide'
    }),
    address: Joi.string().max(500).allow('').optional(),
    city: Joi.string().max(100).allow('').optional(),
    category: Joi.string().valid('restaurant', 'hotel', 'commerce', 'artisan', 'profession_liberale', 'autre').optional()
  }),

  aiSettings: Joi.object({
    tone: Joi.string().valid('professionnel', 'amical', 'formel', 'decontracte').optional(),
    language: Joi.string().max(5).optional(),
    signature: Joi.string().max(200).allow('').optional(),
    useTu: Joi.string().valid('tu', 'vous').optional(),
    autoReplyPositive: Joi.boolean().optional(),
    autoReplyNegative: Joi.boolean().optional()
  }),

  publishResponse: Joi.object({
    responseId: Joi.string().uuid().allow(null).optional(),
    text: Joi.string().max(5000).allow('').optional()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(6).max(128).required()
  })
};

// --- Middleware factory ---
function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({
        error: 'Données invalides',
        details: messages
      });
    }

    req.body = value;
    next();
  };
}

module.exports = { validate, schemas };
