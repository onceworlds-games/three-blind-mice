# Three Blind Mice: teardown and rebuild plan

Played the `main` build headless (Night 2, autopilot, 16 s at 1280×720, frames read at full size), plus the title, the
results burrow and the store art. This is what a stranger sees, said plainly.

## What looks cheap

- **The mouse is a 25 px glowing dot.** At the play zoom (13 u across) the hero is a white smear. Its sunglasses and scarf, the
  whole identity of the game, are invisible. Up close it is spheres and cylinders: no paws, no face, no fur.
- **The dark isn't dark.** The midnight chime stamps a permanent memory over the whole room, so every floor seam glows as an
  amber grid for the rest of the night. "Squeak to see" has nothing left to reveal; the room reads as a brown tile game.
- **Primitive furniture.** Un-bevelled boxes in flat brown, flour sacks as spheres, jars as cylinders, no texture except the
  floor, no set dressing. Seen from above a table is a brown rectangle. Nothing says farmhouse, nothing is at mouse scale.
- **The farmer's wife is two cylinders and a cone.** Her lantern light is a flat orange disc with a hard printed ring. The knife
  is a grey extrusion that slides down.
- **Flat lighting.** One brown level of brightness everywhere; no moonlight, no shafts, no contrast between dark and light, no
  visible shadows during play. The one interesting light (the lantern) is a decal.
- **The signature ring is a thin blue circle.** The best idea in the game (sound is light) looks like a debug gizmo.
- **Title:** a small Play box over a distant room. **Results:** brown sphere-mice on cheese blocks.

## What moves stiffly

- The mouse slides with a sine bob; no legs, no gait, no lean into turns, no anticipation, the tail a rigid swaying chain.
- Her legs translate back and forth like pistons; feet never plant, the skirt is a rigid cone.
- The cat is scaled spheres; its pounce is a straight lerp.
- The knife drops linearly; a hit is a camera shake and a pink stick flying off. No hit-stop, no splinters, no slow-mo.
- Picking up cheese: the wedge teleports onto the mouse. Home: it vanishes.

## What feels floaty or unclear

- Camera far away and lazy (plain exponential follow, tiny look-ahead), never leaning into the action or the reveal.
- Movement is instantly full speed; no scurry, no skid, no dust. Nothing answers a squeak at the mouse itself.
- Spotted vs. heard vs. safe has almost no read: no "?" when she hears, no "!" when she sees, the spot timer is invisible.

## What gets boring, and why nobody comes back

- **Nothing to do between cheeses.** 1-3 wedges per night and long empty walks. No pick-ups every few seconds, no combo, no
  risk/reward choice except "go or wait".
- **No skill score.** A night is three stars (home / all / tails) and a time. A great run and a sloppy one look the same.
- **Mastery isn't rewarded.** A near miss earns a badge once and then nothing. There is no technique to learn (no tiptoe, no
  quiet movement), so expert play looks like beginner play done slower.
- **No reason to return:** no daily, no weekly goals, no streak, no levels; seven glasses gated by stars are the only unlocks,
  and once 36 stars are in, the game is over.

## What the best games of the kind do that this doesn't

- **Mark of the Ninja:** sound radii you can read at a glance, light/dark you can feel, and a score per level for stealth style
  (unseen, untouched, collectibles) that turns every level into something to master.
- **Dark Echo:** pure black, and the sound reveal is gorgeous: lines travel and bounce, the moment of seeing is the reward.
- **It Takes Two / Ghost of a Tale:** tiny heroes in a giant, richly detailed, moodily lit house; the world itself is the treat.
- **Monaco:** co-op heists with loot scattered everywhere, so every second has a small goal and a greedy choice.
- **Spelunky / Hitman:** a daily run that's the same for everyone, and challenges per level that keep old levels fresh.

## The rebuild

Keep: the pitch, the twelve nights and their teaching order, the ring rules (a ring is what she hears), the friends-game co-op
and its netcode, the tests. Rebuild everything a player sees, hears and feels, and add the layer that makes runs worth repeating.

### Look: a giant farmhouse at night, cinematic

- **Real darkness**, then real light: moonlight through the windows falls in pane-shaped patches with dust in the beams; the
  lantern is a warm spotlight with soft shadows; embers in the stove; the hole glows. Memory of a ring fades instead of staying
  as a grid. ACES, bloom, a grade and a vignette.
- **The echo, made the hero:** a post pass draws the silhouette of everything a ring touches (depth edges) in amber that flares
  cream at the front and fades, with sparks riding the wavefront. Every prop, slipper and cat gets outlined, not just boxes.
- **Real props** (Poly Haven CC0 models and textures at mouse scale): planked floors, plaster and wainscot, crates, barrels,
  buckets, baskets, jugs, a mousetrap, a grandfather clock, the wife's oil lamp, the farmer's boots; tables dressed with bread,
  boards, bowls and candles. Procedural pieces (tables, shelves, cupboards, racks of any size) rebuilt with bevels and the same
  wood textures.
- **A mouse you can see and love:** about 3× larger on screen (closer camera), a sculpted body with fur shading, big pink ears,
  whiskers that glow, round sunglasses and a knitted scarf; hats and fur colours to earn.
- **The wife as a giant:** felt slippers with pompoms, striped stockings, a swaying skirt hem; feet that plant and roll; the oil
  lamp swinging on its handle; "?" and "!" over her lantern.

### Animation and juice

- Procedural four-legged scurry gait, lean into turns, squash on starts, skid on stops, sniffing idle, ears and whiskers that
  twitch, a verlet tail that trails and whips. Squeak: rear up and puff; big squeak: crouch, charge, burst.
- Knife: a raise with its shadow, a slam with hit-stop, splinters and a directional shake, the blade quivering in the board.
  Tail pop with a short slow-mo. Cat: a curled sleeper that uncoils, a butt-wiggle crouch, a real arcing pounce.
- Pick-up hop with the wedge in the teeth; home: the wedge pops into the hole with a crumb burst and the tally ticks.
- Particles everywhere (pooled): dust at every scurry, crumbs, sparkles on pings, splinters, embers, moon motes, confetti.
- Camera: critically damped follow with look-ahead, zooms out while a big squeak charges and as the reveal sweeps, punches in
  on close shaves and hits, slow-mo on the last wedge home.

### Depth: a reason for every second

- **Crumbs:** 20-40 per night along routes and in risky places, invisible until a ring glints them. Grab crumbs within 2.5 s of
  each other to chain a multiplier (up to ×5). Squeaking shows more crumbs but tells her where you are: the greedy choice.
- **A score per night** with style bonuses: Unseen, Tail intact, Close shaves, Decoy, Speed, Quiet. Personal bests per night,
  a medal (bronze/silver/gold) on the map, score leaderboards.
- **Tiptoe** (Shift, or a light tilt on the stick): slow, and silent on creaky boards, crumbs and pans. The technique experts use.
- **Readable stealth:** "?" when she hears, a filling eye when your whiskers are in her light, "!" when spotted.

### Retention: come back tomorrow

- **Mouse level** from every night's score, with an unlock at every level: hats, fur colours, glasses, ring sparkles.
- **The Daily Raid:** one night remixed by the date (cheese and crumbs moved, a twist such as a prowling cat, extra creaky
  boards, a golden wedge), the same for everyone, today's top scores on a shared board.
- **Three daily goals** (collect 60 crumbs, two close shaves, an unseen night...) worth levels' worth of XP, and a streak.
- More badges with meaning (Ghost, Crumb Hoover, Daily Bread, Mouse level milestones).

### Sound

A richer music box that builds (bass, pad and tick layers by danger), squeaks with formants, a patter under every step, layered
knife and boot impacts, a stinger for every bonus.

### Process

Branch `revamp`. Tests stay green and grow (crumbs, scoring, daily seeds, levels/unlocks). `check` near the end, new store art
and trailer, DESIGN.md / README / onceworlds.json updated.
