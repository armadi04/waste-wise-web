import { BadRequestException } from '@nestjs/common';
import type { PortalContentSection } from '@/portal/catalog/entities/portal-content-entry.entity';

type ContentData = Record<string, unknown>;

export interface PortalContentDefinition {
  title: string;
  description: string;
  maxSections: number;
  /** Sections need a heading (legal/claim steps) or only a body (facts). */
  sectionHeading: 'required' | 'optional';
  validateData: (data: ContentData) => ContentData;
}

const text = (value: unknown, field: string, max: number, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new BadRequestException(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string' || value.length > max)
    throw new BadRequestException(
      `${field} must be text up to ${max} characters`,
    );
  return value.trim();
};

const httpsUrl = (value: unknown, field: string) => {
  const url = text(value, field, 255);
  if (url && !/^https:\/\/[^\s]+$/i.test(url))
    throw new BadRequestException(`${field} must be an https:// URL`);
  return url;
};

const noData = () => ({});

/**
 * Editable portal copy. Keys are fixed in code so the portal knows where each
 * entry renders; unpublished or missing entries fall back to built-in copy.
 */
export const PORTAL_CONTENT: Record<string, PortalContentDefinition> = {
  'page.terms': {
    title: 'Syarat & Ketentuan',
    description: 'Legal terms page (/terms).',
    maxSections: 30,
    sectionHeading: 'required',
    validateData: noData,
  },
  'page.privacy': {
    title: 'Privasi',
    description: 'Privacy policy page (/privacy).',
    maxSections: 30,
    sectionHeading: 'required',
    validateData: noData,
  },
  'page.night-work': {
    title: 'Kerja Malam',
    description:
      'Night-work page (/night-work) and its external job board link.',
    maxSections: 10,
    sectionHeading: 'optional',
    validateData: (data) => ({
      externalUrl: httpsUrl(data.externalUrl, 'externalUrl'),
      ctaLabel: text(data.ctaLabel, 'ctaLabel', 60),
    }),
  },
  'home.claim-guide': {
    title: 'Cara klaim kupon',
    description:
      'Home "how to claim" block: steps as sections, trust facts in data.',
    maxSections: 6,
    sectionHeading: 'required',
    validateData: (data) => {
      const facts = data.facts ?? [];
      if (!Array.isArray(facts) || facts.length > 6)
        throw new BadRequestException('facts must be a list of up to 6 items');
      return {
        facts: facts
          .map((fact, index) => text(fact, `facts[${index}]`, 160))
          .filter(Boolean),
      };
    },
  },
  'help.contact': {
    title: 'Hubungi support',
    description: 'Help page support channels.',
    maxSections: 0,
    sectionHeading: 'optional',
    validateData: (data) => {
      const email = text(data.email, 'email', 160);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new BadRequestException('email must be a valid address');
      const whatsapp = text(data.whatsapp, 'whatsapp', 20).replace(
        /[^\d+]/g,
        '',
      );
      if (whatsapp && !/^\+?\d{8,15}$/.test(whatsapp))
        throw new BadRequestException(
          'whatsapp must be an international phone number',
        );
      return { email, whatsapp, hours: text(data.hours, 'hours', 120) };
    },
  },
  'status.notice': {
    title: 'Status layanan',
    description: 'Optional notice on the status page; summary is the message.',
    maxSections: 0,
    sectionHeading: 'optional',
    validateData: (data) => {
      const level = data.level ?? 'info';
      if (
        typeof level !== 'string' ||
        !['info', 'warning', 'critical'].includes(level)
      )
        throw new BadRequestException(
          'level must be info, warning or critical',
        );
      return { level };
    },
  },
};

export const portalContentDefinition = (key: string) => {
  const definition = PORTAL_CONTENT[key];
  if (!definition)
    throw new BadRequestException(`Unknown content key "${key}"`);
  return definition;
};

export function normalizeContentSections(
  definition: PortalContentDefinition,
  sections: Array<Partial<PortalContentSection>> = [],
): PortalContentSection[] {
  if (sections.length > definition.maxSections)
    throw new BadRequestException(
      `Use at most ${definition.maxSections} sections for this content`,
    );
  return sections.map((section, index) => {
    const heading = text(
      section.heading,
      `sections[${index}].heading`,
      180,
      definition.sectionHeading === 'required',
    );
    const body = text(section.body, `sections[${index}].body`, 5000, true);
    const id =
      text(section.id, `sections[${index}].id`, 60) ||
      heading
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      `section-${index + 1}`;
    return { id, heading, body };
  });
}
