# Little Rocket: Moon Mail Delivery

A gentle 3D browser game for a five-year-old, built with Three.js, plain JavaScript and Vite.
The child is a space mail carrier: look at the parcel, tap the moon house with the same picture,
and the chubby little rocket flies there by itself to deliver it.

The whole game is a single file, `index.html` (markup, styles and game code). Every mesh, texture
and sound is generated in code. There are no images, models, fonts or audio files.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev        # then open the printed URL, e.g. http://localhost:5173
```

### Make one file you can play offline

```bash
npm run build
```

This writes **`dist/index.html`**, a single self-contained file with Three.js built in
(about 650 KB). You can double-click it to play from disk with no server and no internet,
or copy it to a tablet or any static web host.

Opening the source `index.html` directly from disk will not work, because it imports `three`
from npm. Use `npm run dev`, or open the built `dist/index.html` instead.

## How to play (for grown-ups)

1. A picture tutorial appears first. Tap the big green ▶ button.
2. A parcel with a large picture appears at the bottom-left and on the rocket.
3. Tap the moon house whose sign has the same picture. Anywhere on that moon works.
   - The rocket flies along a smooth curve, lands, and hops the parcel into the house.
   - Each delivery reveals a surprise: a **moon puppy**, a **flower that sings one note**,
     or a **huge birthday hat** that lands on the alien. You can tap each surprise again.
4. If the child taps a different house, its resident waves, then points, and a trail of
   soft dots drifts toward the matching house. Nothing is ever taken away.
5. After three deliveries the residents build a **space playground**. Tap the trampoline,
   the slide and the floating balloons.
6. Tap the big green ↻ button for a new round, with new parcel pictures and redecorated houses.

Anytime extras: tap the smiling stars on the fluffy clouds for musical plinks, the sun for a hum,
or the rocket for a giggle. If nothing is tapped for a while, a tapping hand shows the right house.
For the very first parcel the hand appears straight away.

There is no reading, timer, fuel, crashing or losing. Progress only goes up: three parcel slots
fill each round, and every finished round adds a gold star sticker.

## Settings (top-right picture buttons)

| Button | What it does |
| --- | --- |
| 🔊 speaker | Sound on/off. Sound only starts after the first tap. The choice is remembered. |
| 🐌 snail | **Calm motion.** Moons stop drifting, there is no confetti, wobble or spinning, trails are shorter and flights are slower. It turns on automatically when the device asks for reduced motion (`prefers-reduced-motion`), and the choice is remembered. |
| ? | Shows the picture tutorial again. |

Keyboard (for grown-ups): keys `1`, `2`, `3` tap the houses from left to right, and `Enter` starts the next round.

## Automated check

```bash
npm run verify            # starts Vite and plays the game in headless Chromium
npm run build && npm run verify -- --dist   # checks the single-file build via file://
```

The script taps the real WebGL canvas and checks:

- **Parcel matching**: the parcel picture equals exactly one house sign.
- **Friendly wrong taps**: the resident waves and points to the right house, and nothing is lost.
- **Automatic travel**: the rocket flies by itself on a smooth upward arc, with no jumps, and lands on the matching moon's pad.
- **Delivery rewards**: progress slots fill, and the puppy, flower and hat each appear once per round.
- **Playground**: the trampoline, slide and balloons respond.
- **Extras**: stars plink, and the mute and calm-motion buttons toggle.
- **Replay**: new symbols, new decorations, updated signs, and progress is kept.
- Deliveries also work with calm motion on, and there are no console errors.

It saves screenshots of each stage to `verify-output/`. It uses `playwright-core`. If no matching
browser is installed, run `npx playwright install chromium` or set `CHROME_PATH` to a
Chrome/Chromium executable.

URL flags used for testing: `?speed=3` speeds up game time, and `?autostart` skips the tutorial.

## Project layout

```
index.html          the whole game (HTML + CSS + JS module)
vite.config.js      Vite + vite-plugin-singlefile (build = one HTML file)
scripts/verify.mjs  end-to-end browser check
```

Inside `index.html` the code is grouped into sections: helpers, settings, the Web Audio synth,
canvas-drawn symbols and tutorial pictures, the Three.js builders (rocket, moons, aliens, houses,
surprises, playground, sun, star clusters), particles, layout and camera fitting, game flow,
input, and the frame loop.

The camera is fixed. It is fitted to the screen shape, with a wide layout for landscape and a
stacked layout for portrait phones.
