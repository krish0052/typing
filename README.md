# Type Along

Type lyrics while a YouTube video plays. If you have not finished a line when the next one starts, the video pauses until you do.

## Run it
YouTube refuses to play inside a page opened straight from disk, so serve the folder:

    cd type-along
    python -m http.server 8000

Then open http://localhost:8000. To put it online, drag the folder onto Netlify Drop or push it to GitHub Pages.

## Files
- index.html: page structure
- style.css: look and colors
- app.js: all the logic (storage, YouTube player, timing, typing rules)

## Known limits
- Lyrics and captions are not fetched for you. Paste them or load an .srt, .vtt or .lrc file.
- Songs are stored in this browser only (localStorage).
- Some videos block embedding and will not play.
- Needs a physical keyboard.

## Ideas to refine
Previous/next line buttons, punctuation mode, per-song best scores, export/import of songs, speed slider, accounts.
