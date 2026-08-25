# SmartDocs Phase 0.5 Migration Scope

**Status:** Pre-migration record  
**Author:** **Manus AI**

## Portfolio-specific surface identified for replacement

The existing application is a personal portfolio for Gulshan Kumar. Its portfolio-only surface includes the personal name and developer identity, the “Innovative IT Mind” hero, “Hire Me” CTA, live clock, skills section, project gallery, portfolio project modal, personal contact form, hard-coded WhatsApp link, generic social links, personal footer, personal SEO metadata, neon/cyberpunk palette, animated starfield, and portfolio-specific JavaScript for typing, parallax, tilt, and clock behavior.

These elements are being removed from the primary product surface because they do not represent SmartDocs and would mislead users about the purpose of the product.

## Engineering patterns to preserve or evolve

The migration will preserve the existing static deployment model, semantic HTML structure, responsive layout approach, CSS custom-property usage, accessible labels and landmarks, and the general practice of progressive enhancement. The new shell will continue to work without a server, but it will not claim that file processing exists until a real implementation is added.

The portfolio’s heavy visual effects, custom clock, starfield, project modal, and contact demo are not technically necessary for the SmartDocs shell and will be removed rather than carried forward.

## Migration boundary

This phase creates only a clean SmartDocs product shell. It does **not** implement file upload, compression, PDF tools, OCR, AI, intent parsing, workflow planning, authentication, databases, cloud storage, backend processing, payments, or fake progress states. Future capabilities will be represented only by clearly labeled unavailable or planned states.
