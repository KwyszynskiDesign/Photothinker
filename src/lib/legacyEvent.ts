import { slugify } from '../utils/slugify';

// Wydarzenie-legacy odtworzone z .env sprzed pivotu na multi-event — patrz docs/decisions.md.
export const LEGACY_EVENT_NAME = import.meta.env.VITE_EVENT_NAME || 'Wesele';
export const LEGACY_EVENT_DATE = import.meta.env.VITE_EVENT_DATE || null;
export const LEGACY_EVENT_SLUG = slugify(LEGACY_EVENT_NAME);
