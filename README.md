# margintheory-site

The marketing site for Margin Theory. A media brand and financial operating system for owner-operator businesses doing $1M to $20M.

## Stack

- **Framework:** Astro 6
- **Styling:** Tailwind CSS v4 (brand tokens in `src/styles/global.css`)
- **Language:** TypeScript (strict)
- **Deployment:** Vercel (auto-deploy on push to `main`)
- **Domain:** margintheory.co

## Pages

- `/` — Home
- `/cfo` — CFO Services landing page
- `/newsletter` — Newsletter signup (Beehiiv embed)
- `/podcast` — Podcast page + guest application form
- `/about` — Margin Theory manifesto

## Brand tokens

Defined in `src/styles/global.css` under the `@theme` block. Pulled from the PCD brand kit:

- `--color-charcoal` `#1E1E1E` — dominant background
- `--color-margin-blue` `#1E90FF` — accent / CTAs
- `--color-deep-blue` `#1D4ED8` — emphasis backgrounds
- `--color-soft-gray` `#F5F5F5`
- `--color-mid-gray` `#6B7280`
- `--font-sans` `Inter`

Use classes like `bg-charcoal`, `text-margin-blue`, `font-sans`.

## Dev

```sh
npm run dev      # start dev server on localhost:4321
npm run build    # production build to ./dist
npm run preview  # preview production build locally
```

## Editing content

- **Page copy:** edit the relevant `src/pages/*.astro` file.
- **Nav links:** `src/components/Nav.astro`
- **Footer:** `src/components/Footer.astro`
- **Brand colors / typography:** `src/styles/global.css`
- **Calendly URL:** referenced in Nav and CFO page (search for `calendly.com/jake-qmqx`)
- **Beehiiv embed:** `src/pages/newsletter.astro`
- **Podcast guest application:** Google Form URL in `src/pages/podcast.astro`
