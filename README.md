# Municipal Sky

The personal site of Tyson Welsh, sitting at the crossroads of the humanities and data science. It hosts a mix of writing, creative experiments, and small interactive projects.

## What's here

- **`index.php`, `about.php`** — landing page and about page
- **`blog/`** — short essays
- **`information-graphics/`** — data visualizations (gendered pronouns, Prospero's jukebox, underworld occupations, etc.)
- **`chatbots/`** — chatbot experiments, including the Onomatopoeia bot
- **`oscar-bingo/`** — Oscars bingo card generator
- **`style-guide/`** — site style reference
- **`api/`** — PHP endpoints backing the chat, feedback, guestbook, and tracking features
- **`includes/`** — shared header/footer partials
- **`css/`, `images/`, `data/`** — static assets
- **`local-dev/`** — scratch space and prototypes (not served in production)

## Running locally

The site is plain PHP. From the project root:

```
php -S localhost:8000 router.php
```

Then open <http://localhost:8000>.
