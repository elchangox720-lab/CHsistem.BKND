import { Router } from 'express';
import { z } from 'zod';
import {
  DEFAULT_SITE_CONTENT,
  withSiteContentDefaults,
} from '../content/defaultSiteContent.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SiteContent } from '../models/SiteContent.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const sectionSchema = z.object({
  eyebrow: z.string().trim().max(80).default(''),
  title: z.string().trim().max(120).default(''),
  accent: z.string().trim().max(120).default(''),
  description: z.string().trim().max(600).default(''),
});

const benefitSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(80),
  text: z.string().trim().min(1, 'El texto es requerido').max(240),
});

const planSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del plan es requerido').max(60),
  price: z.string().trim().min(1, 'El precio es requerido').max(60),
  tagline: z.string().trim().max(160).default(''),
  features: z
    .array(z.string().trim().min(1, 'La característica no puede estar vacía').max(120))
    .max(12)
    .default([]),
  featured: z.boolean().default(false),
});

const stepSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(80),
  text: z.string().trim().min(1, 'El texto es requerido').max(240),
});

const contentSchema = z.object({
  hero: sectionSchema.extend({
    primaryCta: z.string().trim().max(40).default(''),
    secondaryCta: z.string().trim().max(40).default(''),
    points: z
      .array(z.string().trim().min(1, 'El punto no puede estar vacío').max(80))
      .max(6)
      .default([]),
  }),
  services: sectionSchema,
  benefits: z.array(benefitSchema).max(8).default([]),
  catalog: sectionSchema.extend({
    cta: z.string().trim().max(40).default(''),
  }),
  plans: sectionSchema,
  planItems: z.array(planSchema).max(8).default([]),
  plansNote: z.string().trim().max(200).default(''),
  process: sectionSchema,
  steps: z.array(stepSchema).max(8).default([]),
  contact: sectionSchema.extend({
    whatsapp: z
      .string()
      .trim()
      .regex(/^\d{7,15}$/, 'El WhatsApp debe tener entre 7 y 15 dígitos')
      .default(DEFAULT_SITE_CONTENT.contact.whatsapp),
    whatsappLabel: z
      .string()
      .trim()
      .min(1, 'La etiqueta de WhatsApp es requerida')
      .max(40)
      .default(DEFAULT_SITE_CONTENT.contact.whatsappLabel),
    email: z
      .string()
      .trim()
      .email('El correo no es válido')
      .max(120)
      .default(DEFAULT_SITE_CONTENT.contact.email),
  }),
  footer: z.object({
    description: z.string().trim().max(300).default(''),
  }),
});

const updateSchema = z.object({
  content: contentSchema,
});

router.get(
  '/content',
  asyncHandler(async (req, res) => {
    const document = await SiteContent.findOne({ key: 'landing' }).lean();
    res.json({ content: withSiteContentDefaults(document?.content) });
  })
);

router.put(
  '/content',
  authenticate,
  requireRole('admin'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const document = await SiteContent.findOneAndUpdate(
      { key: 'landing' },
      { key: 'landing', content: req.body.content },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    res.json({ content: withSiteContentDefaults(document.content) });
  })
);

export default router;
