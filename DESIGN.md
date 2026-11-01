# Three Blind Mice: design

## The pitch

**You can't see. Squeak to see. Steal the cheese without waking the farmer's wife.**

**The goal in one line:** a squeak ring sweeps out of the dark and draws a kitchen in amber lines; a cheese wedge pings
yellow; the mousehole glows. Get the cheese into the hole.

One rule explains the whole game, and the screen shows it every second: **every sound is a ring of light.** Your squeak
draws the room, and the farmer's wife hears any ring that reaches her. The clock's tick, her footsteps, the cat's purr and
a creaking board all paint the room the same way. Sound is how you see, and it's how you get caught.

## The first minute

A first-time player, alone (the usual case: this is a friends game, so a new player starts in their own server).

| Time | What happens | On screen |
|---|---|---|
| 0 s | The title. Black, then a squeak ring sweeps out from a mouse in the middle of a kitchen and draws it in amber lines: table legs, a stove, jars, floorboards. Three mice in round sunglasses sneak about (the autopilot). A warm lantern pool drifts across the floor at the edge. | **Three Blind Mice** in huge slab letters, drawn as outlines that light up as each ring passes. One **Play** button. Total stars beside it once there are any. |
| 2 s | Tap Play (or Space or Enter). The music box starts. A player alone with no stars goes **straight into Night 1**: the host's own tap is the Start. Everyone else goes to the lobby (the night strip). A friend who arrives by invite during that solo night watches it with **Join in** and is admitted at the hole at once; the host is never stuck alone while friends wait. | A ring wipe from the button fills the screen (the screen transition everywhere). |
| 3 s | The intro (2.5 s): the camera drops from above onto the mousehole. The kitchen clock strikes midnight. DONG: one huge free ring reveals the whole room, the cheese pings yellow under the table, then the dark comes back. | **Night 1 · The Kitchen**, painted big, then gone. |
| 6 s | Your mouse peeks out of the glowing hole. The dark is not empty: faint blue floor seams in the moonlight, your own whisker glow around you, the warm hole behind you, the cheese faintly glowing where the chime showed it. | Hint: **Squeak to see** (with the Space key or an arrow to the Squeak button). |
| 8 s | You squeak: a chirp, a ring 6 u wide, the nearby table legs and jars light up in amber and fade over 2 s. Echo pings come back off each object, higher for the nearer ones. | Hint gone. After two small squeaks: **Hold for a big one**. |
| 15 s | A big squeak reaches the cheese: a bright two-note chime and the wedge's outline flares yellow. | **Grab the cheese** (once). |
| 25 s | You walk over the wedge and pick it up by touching it. You slow down, crumbs patter behind you, the hole pulses. | **Take it home**, and an amber arrow at the screen's edge points to the hole while it's off screen. |
| 30 s | The gasp: the kitchen door creaks open and a giant lantern swings in, lighting the floor in full warm colour. Her huge slippers shuffle in, humming. The music box drops into a minor key. | **Stay out of her light** (once). |
| 40 s | You skirt the dark edge of her pool and reach the hole. The wedge drops in, a warm music-box run, the wedge in the tally fills yellow. All the cheese is home, so the night ends. | **Morning**. The sunrise floods the room, the camera pulls into the hole: three stars ping in one by one. **Next night** is the big button. |

A returning player taps Play and lands on the map with the next night already picked: one more tap (Start) and the intro
plays. Every later night opens the same way: the midnight chime shows the whole room once, so the goal is always seen
before it has to be found.

## Controls

| | Keyboard | Phone |
|---|---|---|
| Move | WASD or the arrows | The platform's stick (`stick: 'analog'`, `zone: 'wide'`) |
| Small squeak | Tap Space (let go within 0.3 s) | Tap **Squeak** (the big button) |
| Big squeak | Hold Space: a ring preview grows around your mouse; let go once it's full (0.7 s) | Hold **Squeak** |
| Pick up cheese | Automatic: touch it | Automatic |
| Drop cheese | E | **Drop** (the second button, only shown while carrying) |
| Menus | Click, Enter, Space; R again, M map, N next night on results | Tap |
| Glasses (lobby) | G, or click your mouse | Tap your mouse |
| Pause (alone only) | P or Esc | The platform's menu pauses |

The stick's tilt sets the speed (0.3 to 1 of full, full past 80%), so a phone player can creep; the keyboard is always full
speed. Nothing else: one action button and one that only exists while it's needed.

## The core loop and where mastery comes from

**The loop (each night, 1-5 minutes):** squeak, look, remember, move in the dark, find the cheese, carry it home, avoid the
light and the noise, repeat for every wedge before dawn.

### The rules

- **Rings.** Every sound is a ring that expands from where it was made. Where it passes, edges light up amber and fade.
  **Any ring that reaches a hunter is heard by it** (rings go through walls: nobody has to guess about walls). The size of
  the ring is the whole story: what you see is exactly what can hear you.
- **Light is seen.** The wife's lantern throws a pool of warm, full-colour light. A mouse standing in it, not under
  furniture and not in the shadow of something tall, is spotted. Dark is safe; shadows (real shadows, cast by her lantern) are
  safe; under a table, chair, bed or shelf is safe even in the light.
- **Noise brings her.** A ring that reaches her makes her turn ("Hm?" and a lifted lantern), walk to where it came from and
  search there for 5 s, then go back to her rounds.
- **The knife.** If she spots a mouse and gets within reach, she stops and raises the carving knife. Its shadow appears on
  the floor where she expects you to be (your position plus 0.45 s of your movement), darkening and sharpening for 0.8 s,
  with a red outline in the knife's own shape. Then THWACK: the knife bites the floorboard and wobbles there. Keep moving,
  and turn: a mouse that freezes, or a carrier running straight, is hit.
- **Hit once:** your tail pops off (comic: a boing, the tail flies, a stub with a white bandage stays for the night), you're
  stunned for 0.8 s, you drop what you carry, and you can't be hit for 2 s. **Hit again:** you're knocked flat with
  cartoon stars and scurry back to the hole, out for 8 s (a counter on the hole). Nothing gory, ever.
- **Cheese.** A wedge is picked up by touching it and carried by one mouse (slower). Drop it with E/Drop to run. A dropped
  wedge stays where it fell. Home means the carrier reaches the hole's mouth.
- **The night ends** when all the cheese is home, at dawn, or when every mouse still playing has been in the hole for 4 s
  with at least one wedge home (a ring of light fills the hole's arch while they wait; stepping out cancels it; hint the
  first time: **Wait in the hole**). Nobody is ever "game over" mid-night: a hit costs time, cheese and a star.

### Stars (per night)

1. **Cheese home**: at least one piece home by the end (this clears the night and opens the next one).
2. **All the cheese**: every piece home.
3. **Every tail**: no mouse lost its tail.

### Beginner vs. expert

| A beginner | An expert |
|---|---|
| Squeaks often and small, waits for each reveal | One big squeak from a safe spot, remembers the room, crosses it in the dark |
| Walks straight at the cheese | Reads her route from her light and her footstep rings, moves while her back is turned |
| Runs when she sees them, carrying the wedge | Drops the wedge, breaks her line of sight behind a sack, comes back for it |
| Freezes under the knife | Turns away under the knife shadow, earns Close Shave |
| Squeaks near the cat | Crosses the cat's room from memory, silent |
| Waits for her to leave | Squeaks far from the cheese to pull her away, then circles round (a decoy) |
| Steps on every creaky board | Knows the quiet routes, moves on the clock's chime and the farmer's snore |
| In co-op: everyone does everything | Splits roles: a scout who squeaks, a decoy, a carrier; three on the wheel |

The best time per night (all the cheese) and fewest squeaks keep an expert improving for 50 nights.

## Solo: The Farmhouse

Twelve hand-built nights, each teaching one new thing, in a tour of a farm at night. A player alone is one mouse and the
hunters move 10% slower (and the knife's telegraph is 0.9 s).

| # | Night | Teaches | Cheese | Hunters | Dawn | Par |
|---|---|---|---|---|---|---|
| 1 | The Kitchen | Squeak to see, carry it home | 1 wedge | The wife walks in after the pick-up, slow | 3:00 | 0:40 |
| 2 | The Pantry | Her light; hide under shelves and in shadows | 2 | Wife on a loop | 3:00 | 1:10 |
| 3 | The Hallway | Creaky boards (noisy floor) | 2 | Wife | 3:00 | 1:10 |
| 4 | The Cellar | Mousetraps: a square ping, not a wedge | 2 | Wife | 3:30 | 1:20 |
| 5 | The Dining Room | Butter the cat, asleep under the table | 2 | Cat asleep, wife | 3:30 | 1:30 |
| 6 | The Larder | The whole wheel | 1 + wheel | Wife | 4:00 | 1:50 |
| 7 | The Parlour | Decoys: she guards the cheese | 2 | Wife standing guard | 4:00 | 1:40 |
| 8 | The Study | The grandfather clock's chime hides you | 3 | Wife | 4:00 | 2:00 |
| 9 | The Bedroom | The cat awake; the farmer's snores | 3 | Cat roaming, wife | 4:30 | 2:10 |
| 10 | The Barn | The farmer's torch: a long narrow beam | 3 | The farmer | 4:30 | 2:20 |
| 11 | The Dairy | Two lights at once, long hauls | 2 + wheel | Wife, farmer | 5:00 | 2:40 |
| 12 | The Cheese Shop | Everything, in town | 3 + wheel | Wife, cat, traps | 5:00 | 3:00 |

Night N+1 opens when night N has a star. Clearing all twelve takes 30-45 minutes; all 36 stars and good times take hours.
Retrying is one tap from the results.

## Multiplayer

**A friends game, co-op, up to three mice** (the rhyme): `rooms.join({ private: true, maxPlayers: 3, minPlayers: 1,
lobby: 'game', countdown: 0 })`. Stealth with strangers and no voice doesn't work, and a run belongs to its friends; the
platform's invite, Join and party bring friends in. No bots in empty seats: alone you're one mouse, which the spec asks for
and the nights are built for.

- **Lobby (the farmhouse map):** who's here (up to three mice, each with the player's avatar head, name, their scarf colour
  and symbol, a check when ready, a host marker), empty seats with **Invite** (`ow.ui.showInvite()`). The host picks the
  night on the map from their own unlocked nights; everyone sees the pick change, and a change clears ready flags
  (`room.clearReady()`). Others tap **Ready**; the host's **Start** lights when `room.canStart`, otherwise it reads
  "Waiting for Ann". Joining never starts anything.
- **A match is one night:** intro 2.5 s, the night, 2 s of morning, the results. The results stay until the host picks
  **Next night**, **Again** or **Map** (all three end the match and set the next pick; alone, Next and Again also start it
  at once). Friends ready again for the next one.
- **Latecomers** arriving mid-night watch it (the camera follows the host's mouse) under a clear **Watching** label with a
  **Join in** button. Tapping it sets a flag in their presence; the host admits them (`room.admit`) and they come out of the
  hole with their tail. Not during the intro or the results (they play the next night then).
- **Leavers and drops:** a mouse that is away is ignored by the hunters and drawn as a faint ghost; if it carried cheese, the
  host drops it where the mouse was after 4 s away. Back (or reloaded), the page rebuilds from the night record and its own
  presence. A player who leaves keeps their row in the results.
- **Host change:** the next host carries on from the room state (the night record and the hunters' record), with no reset;
  the hunters stand still for the moment it takes.
- **Pause:** alone, the platform menu, a hidden page, P or Esc pause the night (`room.pauseMatch()`, so the match clock
  stops) with a Resume / Restart night / Map card. With friends nothing pauses.
- **Room closed:** one message and one button each: removed → "You were removed" + Play; disconnected → "Connection lost" +
  Rejoin; replaced → "Playing in another tab" + Play here; each calls `rooms.join` again with the same options.

### Netcode (who decides what)

Built on the SDK helpers: `createMatch` (rounds: 1, introSeconds 2.5, roundEndSeconds 2, resultsSeconds 0), `createHost`
(host state and rpcs). No `createBots`.

- **Each page** moves its own mouse (fixed 60 Hz step, collisions against the night's static shapes), makes its own squeaks
  and noises, and judges its own hits: when a knife or a pounce lands (`landAt` on the match clock), the victim's page checks
  its own mouse at that moment and reports it. What you saw is what happened, whatever the latency. A trap the page's own
  mouse touches is reported the same way.
- **The host page** runs the hunters (wife, cat, farmer) at 30 Hz from the match clock: hearing (rings from messages and its
  own page), sight (every participant's newest presence against the light pools, shadows and cover), paths, the knife. It
  keeps the night record and decides pick-ups, homes and the end.
- **Presence (20 Hz, ~80 bytes):** `{ x, z, a, st, c, tl, g }`: position, heading, state (`play`, `hole`, `out`, `watch`,
  `join`), carried item id, tail, glasses; plus `wx, wz` (the wheel, from its lead) and `in: [x, z]` (stick input, while on the
  wheel). Others are drawn with `presenceAt` (100 ms behind).
- **State:** `host:ow.match` (the match helper's record; `data` is the night: level, dawn deadline, every item with carrier,
  helpers, position and home flag, each mouse's tail, out-until and wedges home, traps sprung, how it ended). `host:hunt`
  (10 Hz, ~250 bytes): each hunter's position, heading, mode, target, patrol index, timers and its knife/pounce
  `[x, z, landAt]`, so a new host carries on exactly; pages draw hunters 120 ms behind, between snapshots. `host:pick` (the
  lobby's night).
- **Messages:** a squeak `{k:'s', x, z, b}` and a noise `{k:'n', x, z, r}` go to everyone (every page draws every ring in
  that mouse's colour; the host's hunters hear them). Paced to 5 a second.
- **Rpcs** (checked shapes, ranges and rates; distances checked against the caller's presence): `grab {item}`, `drop {item,
  x, z}`, `home {item}`, `hit {from, id}`, `snap {trap}`, `wheel {item}` (join the wheel). The match clock (`matchNow`)
  is the only clock while playing; dawn is a match-time deadline in the record.
- **The wheel:** the first mouse to touch it is its lead and its page moves it, along the sum of all carriers' stick inputs
  (helpers put theirs in presence; helpers' mice are drawn in slots round the wheel). If the lead lets go or leaves, the
  wheel stops where it is.

## Progression and reasons to come back

- **Stars** per night (36 in all), shown on the map and the title.
- **Best times** per night (all the cheese) and fewest squeaks, on the map's night card and the results.
- **Glasses** for your mouse, unlocked by total stars, worn in co-op for everyone to see: Round (0), Cat-eye (6),
  Aviators (12), Stars (18), Monocle (24), Hearts (30), Gold Rounds (36). Picked in the lobby by tapping your mouse.
- **Leaderboards:** `night-1` … `night-12` (fastest full clear, seconds, lower is better) and `stars` (total). 13 boards.
- **Saves** (`ow.save`): `progress` = `{ v, stars[12], best[12], fewest[12], glasses, hints{} }`, written at each night's end
  and on a glasses change. In co-op every mouse earns the night's stars and times in its own save.

### Badges

| id | Name | Earned |
|---|---|---|
| `first-squeak` | First Squeak | Squeak for the first time |
| `cheese-thief` | Cheese Thief | Bring a wedge home |
| `still-got-it` | Still Got It | Finish a night with your tail |
| `close-shave` | Close Shave | The knife lands within a whisker of you and misses |
| `decoy` | Decoy | Bring cheese home while she searches where you squeaked |
| `silent-run` | Silent Run | All the cheese home with 5 squeaks or fewer |
| `let-sleeping-cats-lie` | Let Sleeping Cats Lie | Clear the Dining Room without waking Butter |
| `whole-wheel` | The Whole Wheel | Roll a whole wheel home |
| `see-how-they-run` | See How They Run | Three mice home together with all the cheese |
| `farmhouse` | Farmhouse | Clear all twelve nights |

## Balance and timing

All distances in u (1 u is about 15 cm at mouse scale: a mouse is 0.55 u long, her slipper 1.7 u).

| | Number |
|---|---|
| Mouse speed / accel / radius | 3.0 u/s, 30 u/s², 0.24 u against walls |
| Carrying a wedge | 2.0 u/s |
| The wheel (1 / 2 / 3 pushing one way) | 1.5 / 2.3 / 2.8 u/s; opposite inputs cancel |
| Whisker glow | 1.6 u round your mouse |
| Small squeak | ring 6 u in 0.5 s; 0.35 s cooldown |
| Big squeak | hold 0.3-0.7 s to charge; ring 13 u in 0.9 s; 1.2 s cooldown |
| Reveal | full for 0.4 s after the front passes, a tenth by 2 s, then held at a fifth (the remembered outline) for the rest of the night wherever a ring has finished |
| Cheese | glows faintly within 3.5 u; a ring that touches it pings it bright for 4 s |
| Creaky board / crumbs / pan | a 3 u ring each 0.4 s you move on it |
| Trap snap | hit, and a 12 u ring |
| Wheel rolling | a 2.5 u ring every 0.5 s |
| Wife: walk / search / chase | 1.6 / 2.2 / 2.7 u/s (solo ×0.9; Night 1 slower still) |
| Lantern pool | 3.8 u radius, centred 1.2 u ahead of her; spots a mouse after 0.3 s |
| Knife | starts within 2.4 u; 0.8 s telegraph (solo 0.9); lead 0.45 s (kept if it lands within reach + 1.5 u, else aimed where you are); hits within 0.85 u; recover 0.8 s |
| Search | 5 s at the noise, sweeping the lantern, then back to her rounds |
| Cat (asleep) | a ring that reaches her wakes her (1 s yawn); purr ring 1.5 u every 2 s |
| Cat (awake) | walks to noises at 1.8 u/s; a ring that reaches her: crouch 0.4 s, leap at 12 u/s to its origin, hits within 0.8 u; back to sleep after 10 s of quiet (night 9: roams at 1.2 u/s) |
| Farmer | walk 1.8, chase 2.6; torch beam 9 u long, 32° wide; stomp like the knife (within 2.0 u, radius 1.0) |
| Clock chime (night 8) | every 20 s: a free 30 u ring, and 2.5 s in which no hunter hears anything |
| The farmer's snore (night 9) | every 4.5 s: a 10 u ring, and 1.5 s in which no hunter hears anything |
| Hits | 1st: tail, 0.8 s stun, 2 s safe; 2nd and after: out 8 s |
| Ending in the hole | 4 s with everyone in |
| Night length | 1-5 minutes; dawn 3:00-5:00; par about 40% of dawn |

**Checked by simulations in node tests** (the rules, hunters and an autopilot mouse are pure modules):
- Every night is solvable: the autopilot clears all the cheese before dawn on every night for 50 seeds, and under par
  at its best skill. Every item and the hole are reachable for a mouse; her patrol is walkable.
- The knife: a mouse that keeps running and turns is never hit; a frozen mouse always is; a carrier running straight is.
- Noise matters: an autopilot that squeaks big every second is caught on nights 2-12 far more often than a careful one.
- The cat never catches a mouse that moves after squeaking, and always catches one that sits still within 3 u.
- Nights end: whole nights played through the pure modules for many seeds end by dawn at the latest, with no NaN and no
  exceptions; solo is slower hunters but the same outcome logic.
- Co-op: three autopilots clear nights faster than one (the wheel especially), and never run out of things to do.

## Every screen

Layout respects `ow.ui.reserved` (the platform's menu at top left by default; the stick and buttons at the bottom
corners) and keeps the top centre clear for the platform's notes.

- **Title.** The attract world full screen (the Kitchen, autopilot mice, the wife's lantern, rings every few seconds). The
  name in the middle-top third, three lines on a phone held upright, one line on a wide screen; under it the **Play**
  button (an amber outlined slab label, 64 px tall, a ring pulses from it every 2 s), and **★ 14** beside it once earned.
  No tagline.
- **Lobby.** Behind it, the picked night's room in 3D, slowly orbiting, with a ring sweeping it every 3 s (the first one
  the midnight chime from the hole). **The night strip** along the top: twelve numbered tiles with their stars, locked ones
  dim with a padlock; the host taps one to pick it (others see the pick). **The night card** (bottom right on wide screens,
  bottom on a phone): "Night 4", "The Cellar", what the night teaches in one line ("Traps go snap"), three stars, "Best
  1:12", and the big **Start** (host) or **Ready** (others) button, or "Waiting for Ann". **The party** (left on wide
  screens, a row above the card on a phone): three seats, each with the player's avatar head (or their seat's shape), name, the
  seat's shape in its colour, a check when ready and a host marker; empty seats are dashed with **Invite**. Tapping your
  own seat (or G) cycles your glasses.
- **Intro.** "Night 4 · The Cellar" in big outlined slab letters lit by the midnight ring, over the reveal. 2.5 s.
- **Play HUD.** Top right: the **night clock**, a crescent moon sinking along an amber arc toward a sunrise line, with the
  minutes left in big numerals beside it ("2:41"); under it the **tally**: an outlined wedge per wedge (and a round outline
  for the wheel) that fills yellow as each gets home. Everything else is in the world: your tail (on your mouse), the squeak
  charge (a ring preview around your mouse), names above friends' mice (white with a dark outline), friends off screen as
  small arrows at the edge in their colour and shape. **The goal is always pointed to** when it's off screen: a yellow
  wedge arrow to the nearest loose cheese, and an amber arch arrow to the hole while you carry. Hints:
  bottom centre, above the thumbs, 2-5 words in the slab face, gone after use. When she's chasing you, a warm-red edge
  creeps in from the sides (no flashing).
- **Hints** (each once per player, saved, again only to a player who seems stuck): Squeak to see · Hold for a big one ·
  Grab the cheese · Take it home · Stay out of her light · Hide under things · Drop it and run (the first chase while
  carrying) · Creaky boards · Square ping: trap · Don't wake the cat · Push it home · Lure her away · Move on the chime ·
  Wait in the hole.
- **Out.** Your view stays; your mouse is in the hole with stars circling its head and a big "8" counting down on the arch.
- **Watching.** The night as the host sees it; "Watching" painted top left under the menu; **Join in** bottom centre.
- **Morning (2 s).** The sky outside the windows turns pink, the room fills with soft dawn light, the hunters stop, the
  camera dives into the hole.
- **Results.** Inside the mousehole: a warm earthen burrow (a cotton-reel table, a thimble, a matchbox bed) with the mice,
  in their glasses and tails or bandages, on the cheese that got home. **Morning** big. Three stars, each pinging in as a ring with its label (Cheese home, All the cheese, Every
  tail). The night's time and best; for co-op, one row per mouse: name, wedges home, tail or bandage. Buttons: **Next night**
  (big, N or Enter), **Again** (R), **Map** (M); for non-hosts "Waiting for Ann". A dawn with nothing home says **Dawn** and
  "No cheese", with **Again** big.
- **Pause (alone).** The night dims behind one solid midnight band across the middle: **Paused**, Resume (big), Restart
  night, Map.
- **Room closed.** The same band: the message and its one button.

## Art direction

**The world:** a farmhouse at night seen from the floor, as if built for a museum diorama: wide pine floorboards, plaster
walls with skirting, a cast-iron stove, a dresser, flour sacks, enamel jugs, milk churns, a rag rug; the barn's hay and
tin; a cheese shop's wheels on racks. Chunky low-poly with bevels and real materials that only show their colour in the
lantern's light. Walls facing the camera are cut down to 1 u like a dollhouse so they never hide the floor; the wife, a giant, is seen only from the knees down: felt
slippers, striped stockings, a plum pleated skirt with a cream scalloped hem fading out above the knee, and the brass lantern swinging low in her hand. Her knife hand comes down from
above the frame only to chop.

**Palette (world and UI):**

| | Hex | Use |
|---|---|---|
| Midnight | `#0C0D18` | The dark, the ground, panels |
| Echo amber | `#F4A835` | Revealed outlines, the accent, buttons |
| Cream | `#FFF1D6` | Text, ring fronts, highlights |
| Lantern | `#FF7B22` | Her light, the only full colour |
| Cheese | `#FFD23F` | The goal: wedges, the wheel, the tally |
| Knife red | `#E23D2E` | Danger: the knife's outline, the chase edge |
| Moon blue | `#7EA2FF` | Moonlight, masking sounds (chime, snore) |

Player colours (scarves and their rings): blue `#7EA2FF` with a circle, rose `#FF7FA8` with a triangle, mint `#6FE0B0`
with a square (drawn as SVG, so they look the same on every device). Rings also
differ by pattern (solid, dashed, dotted), so colour is never the only cue. Everything that matters has a shape: the
cheese is a wedge, a trap is a square, the hole is an arch, the knife is its own silhouette.

**Fonts** (self-hosted with `@fontsource`): **Alfa Slab One** for every big word and numeral (feed-sack and crate stencil
weight, drawn as amber outlines lit by rings), **Barlow** 600/700 for names and labels.

**The signature element: the squeak ring.** A ring of amber light that sweeps outward and draws edges as it passes. It
reveals the title's letters, the map, the stars on the results, every button press (a small ring from the tap), and wipes
between screens. It is the screenshot people remember.

**Lighting and camera:** perspective camera (FOV 34°) pitched 62° down, following your mouse with a soft look-ahead, the
shorter side of the screen showing about 13 u (wide enough for a big squeak). A dim blue hemisphere and moon (directional,
soft shadows on high) so the floor seams always faintly show; the lantern is a spot light from her hand, warm, flickering,
with shadows (map 1024 on medium, 2048 on high, none on low) that are also the game's hiding places. ACES tone mapping,
sRGB, exponential fog into midnight. Bloom on the rings, the lantern flame and the cheese on medium and high only.

**The reveal shader:** surfaces and edge lines read up to 12 live rings (centre, start time, size, speed), up to 10 glow
sources (mice, hole, cheese) and the memory of finished rings; edges come from the night's static shapes merged into one
fat-line mesh of screen-facing quads. Surfaces get a faint fill as the ring passes; edges flare cream at the front, settle to amber and fade.

**Mice:** small grey-mauve velvet bodies, big round ears, round black sunglasses with a cream glint that sparkles when a ring
passes, a knitted scarf in the player's colour, a long pink tail that sways (until it doesn't). Squash on start and stop,
a little hop on pick-up. Rim-lit by their own whisker glow. **Butter the cat:** a ginger cat in the dark, only her
green-gold eyes and her purr rings showing until a ring draws her. **The farmer:** big muddy boots and a torch beam.

**HUD language:** amber lines and slab numerals painted straight onto the night, no boxes; the moon and the tally are drawn
like the world's own outlines.

## Sound

Synthesized Web Audio; sound is the game.

- **Squeaks:** small, a 70 ms chirp up from 2.4 to 3.4 kHz; big, a double chirp with a soft sonar whoosh. The charge has a
  rising whistle.
- **Echo pings:** as the ring reaches objects, short wooden blips come back, delayed by the ring's travel, higher for nearer
  ones (up to 8 per squeak). Cheese answers with a bright two-note music-box chime; a trap with a dull square tick.
- **Steps and moves:** soft patter while moving, a whisker tick on bumping a wall, crumbs crunch, boards creak (a swept
  resonant noise), pans clang.
- **The wife:** slipper thumps with each step (each one a small ring), a low hummed version of the rhyme, a "Hm?" when she
  hears, a sharp intake when she spots you. The knife: a rising whoosh through the telegraph, then a thunk and a
  floorboard twang. Tail: boing and a slide whistle down. Out: bonk and twinkling stars.
- **The cat:** purr, a yawn-meow when she wakes, a hiss and a thump on the pounce. **The farmer:** heavy boots, torch click.
- **The house:** the clock's tick, its midnight DONG and hourly chimes (bells), the farmer's snore, wind at the windows,
  the barn's cow breathing.
- **Cheese:** a nibble pop on pick-up; home, a warm music-box run and the tally's chime; the wheel's rumble.
- **Music:** a music box playing *Three Blind Mice* (public domain) from a small step sequencer at 84 bpm. Menus: the
  whole tune, soft, with a plucked bass. Playing: sparse fragments over the clock's tick. Danger (a hunter within 6 u, or a
  chase): the tune turns minor and slows, a low cello drone and a heartbeat that quickens. Morning: a fast bright run.
  Quieter in menus.

## Store art and the trailer

All store art is rendered by the game itself (`?poster=<name>`, hand-staged scenes through the real view and shader, at
high quality) and saved into `store/` by the posters tool.

- **Cover** (`thumb-1`): the kitchen mid-squeak, a huge amber ring sweeping across table legs and jars, three mice in
  sunglasses (one carrying a glowing wedge) and the wife's lantern pool coming in. **Three Blind Mice** once, big.
- **Action** (`thumb-2`): a mouse in her light, the knife's shadow and red outline right over it, the blade coming down.
  No text.
- **Win** (`thumb-3`): the burrow, three mice on the cheese, one with a bandaged stub, **Morning** and three stars.
- **Multi** (`thumb-4`): three mice, three rings (solid, dashed, dotted) overlapping in their colours, the wheel between
  them, names in their seat shapes.
- **Icon:** a mouse face with round sunglasses on midnight, an amber ring behind.
- **Badges:** each a bold symbol (a ring, a wedge, a tail, a knife, a moon, a wheel, a sleeping cat, three mice, the
  farmhouse) on a coloured disc from the palette.
- **Trailer (`store/trailer.mp4`, 21.7 s):** real gameplay from the in-page autopilot night (no staging), cut from five
  takes: frame 0 is the midnight ring mid-sweep drawing the Kitchen from the hole; three mice squeak the Dining Room into
  view in their colours; her lantern finds a mouse in the Pantry; in the Larder the knife comes down, a tail pops and the
  blade sticks in the floor; three mice roll the wheel home; the last wedge goes home, Morning, the burrow; the name over the
  title's attract play for the last 2.8 s.

## Originality check

It resembles echolocation games (sound drawing a dark world in lines, as in Dark Echo) and comic stealth games (sneak,
get spotted, run). What a player notices in the first minute that is different: a warm, full-colour farmhouse that only
your squeaks draw, in amber, from a mouse's height; a giant lantern you can always see coming; a ring that is at once your
eyes and her ears, so every squeak is a choice; a comic carving knife whose shadow you dodge; and up to three friends whose
squeaks light the room for each other while one of them plays decoy.

## Tech

Vite + three.js (the bloom pass and `mergeGeometries` from its addons; the fat edge lines are the game's own quad mesh),
`@fontsource/alfa-slab-one` and `@fontsource/barlow`, `@onceworlds/sdk/match` (`createMatch`, `createHost`). No GSAP:
screen moves are CSS transitions. `"dir": "dist"`, `base: './'`.

- **Pure modules** (`src/core`, no `window`, three.js or SDK at import; the node tests run them): `levels.js` (the twelve
  nights as text maps plus data), `world.js` (cells, colliders, the nav grids, light and cover tests), `mouse.js`,
  `rings.js`, `hunters.js`, `night.js` (the night record: items, hits, stars, the end), `autopilot.js`, `rng.js`,
  `sim.js` (a whole night with autopilot mice: the title, the trailer and the balance tests), `session.js` (the live
  night split across pages over a room), `localroom.js` (an in-memory room with the SDK's shape, for the tests and for
  playing outside the platform).
- **Around them:** `render/` (the view and camera, the echo shader and memory, the level, actors, burrow, canvas
  textures), `ui.js` (plain DOM), `audio.js` (Web Audio, all synthesized), `hints.js`, `progress.js`, `poster.js`,
  `main.js`.
- **Shaders:** the echo patch is one program per base material (fill, front and rim are per-material uniforms), about 15
  programs in all. A new room compiles with `compileAsync` (off the main thread where the browser can) and draws once
  ready; hunters' lights go dark rather than hidden, since a light that comes and goes recompiles every shader. A GPU drawn
  in software (SwiftShader, llvmpipe) always plays on low: no bloom, no shadows.
- **Local-only switches** (ignored on onceworlds.com): `?autoplay=1` (the autopilot plays your mouse); with `mice=1-3`,
  `night`, `seed`, `careless=1`, `focus=<n>`, `zoom=<x>`, `skipintro=1`, `cam=wide`, `wait=1` and `ring0=<s>` it runs a
  whole night in the page with every mouse on autopilot (the trailer); `?poster=<name>` renders store art. Build-time `VITE_NIGHT`,
  `VITE_LOBBY` and `VITE_AUTOPLAY` exist only for local screenshots.

## Risks

- **Dark reads as empty** (thumbnails, the first seconds). The midnight chime reveals every room at the start, the floor's
  moonlit seams, the hole's beacon, the cheese glow, the lantern always lit; the title keeps rings going.
- **The shader on phones.** Rings capped at 12, bloom and shadows only above low quality, pixel ratio from
  `ow.settings.pixelRatio`, quality changes followed live; few shader programs, compiled ahead of the first frame that
  needs them.
- **Rules nobody can see** (what hears what). One visible rule, rings, and the hunters react to rings only; every
  reaction shows ("Hm?", the lifted lantern, the cat's crouch, the knife's shadow).
- **Co-op netcode** (the knife, the wheel). Victim-judged hits; the wheel has one owner at a time; everything the host
  decides is in `host:` state; tests run the room flow through a fake room (host reload, a leaver, a latecomer).
- **Twelve nights of content.** A compact level format with prefab furniture and room shells, checked by tests (reachable
  cheese, walkable routes, the autopilot clears each one).
- **Too hard or too easy.** Simulated balance tests per night; the first nights are gentle; solo hunters are slower.

## Changes from the spec, and why

- **Ring size is the hearing range** (small 6 u, big 13 u), instead of separate hearing distances (7 and 16 u): players
  see exactly what she hears. Floor noise and the rest follow the same rule.
- **Her light also sees** (and shadows and furniture hide), not hearing alone: it makes her lantern meaningful, gives
  stealth a second readable rule and makes cover a skill.
- **The victim's page judges a hit** instead of the host: fair at any latency, and the 0.8 s telegraph stays honest.
- **Pick-up is automatic; Drop is a button that appears only while carrying.** One action button the rest of the time.
- **The crumb trail is decoration;** carrying only slows you. One fewer hidden rule.
- **Out means back at the hole after 8 s, solo too;** no game over mid-night. Dawn ends a night; stars carry the stakes.
- **Added:** the midnight chime that shows each room once at the start (the goal in one look), traps, the clock's chime and
  the farmer's snore (sounds that hide yours), the farmer and his torch, glasses unlocks, and ending a night early from the
  hole. The town's cheese shop is the finale.
- **The wheel is moved by one lead page** with helpers steering through their stick input in presence: simple and solid
  over the network.
