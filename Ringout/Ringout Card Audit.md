# Ringout card audit

Rounds and Rounds Quick use the new 30-card deck. Classic Rounds, Draft Battle, and card-enabled co-op and Custom use the existing deck with their usual eligibility rules. Runtime card picks are held in memory. Saved appearances, preferences, story progress, and co-op records do not store card IDs.

## Previously active cards

| Classic card | Runtime stat key(s) | Default Rounds disposition |
|---|---|---|
| Afterimage | `afterimage` | Classic and legacy modes only |
| Aftershock | `echo` | Classic and legacy modes only |
| Backbeat | `backbeat` | Classic and legacy modes only |
| Backbeat Mine | `backbeat-mine` | Classic and legacy modes only |
| Backstage Pass | `backstage` | Classic and legacy modes only |
| Bank Shot | `bankShot` | Classic and legacy modes only |
| Blink Step | `blink` | Classic and legacy modes only |
| Borrowed Momentum | `borrowed` | Classic and legacy modes only |
| Brake Lights | `brakeLights` | Classic and legacy modes only |
| Breathing Room | `breather` | Classic and legacy modes only |
| Carom | `carom` | Revised as Carom; original remains in Classic |
| Catapult Club | `catapult` | Classic and legacy modes only |
| Catch and Throw | `catchThrow` | Design carried into Wrong Number; original remains in Classic |
| Center Stage | `centerStage` | Classic and legacy modes only |
| Chain Reaction | `chain` | Classic and legacy modes only |
| Clean Shoes | `cleanShoes` | Classic and legacy modes only |
| Clean Sweep | `clean-sweep` | Classic and legacy modes only |
| Combo Engine | `comboEngine` | Classic and legacy modes only |
| Corner Store | `cornerStore` | Classic and legacy modes only |
| Counter Grip | `counter-grip` | Classic and legacy modes only |
| Domino Link | `domino-link` | Classic and legacy modes only |
| Driftwood | `driftwood` | Classic and legacy modes only |
| Emergency Brake | `anchor` | Classic and legacy modes only |
| Extension Cord | `cord` | Classic and legacy modes only |
| Fast Delivery | `delivery` | Classic and legacy modes only |
| Fault Beacon | `fault-beacon` | Classic and legacy modes only |
| Field Kit | `field-kit` | Classic and legacy modes only |
| Foot Brake | `foot-brake` | Classic and legacy modes only |
| Fracture Line | `fracture-line` | Classic and legacy modes only |
| Gale Anchor | `windGuard` | Classic and legacy modes only |
| Gravity Well | `gravity` | Classic and legacy modes only |
| Grin and Bear It | `grin` | Classic and legacy modes only |
| Group Hug | `groupHug` | Classic and legacy modes only |
| Guard Breaker | `guardBurst` | Classic and legacy modes only |
| Hands Free | `hands-free` | Classic and legacy modes only |
| Hollow Double | `hollow-double` | Classic and legacy modes only |
| Hot Mic | `hot-mic` | Classic and legacy modes only |
| Hot Start | `hot-start` | Classic and legacy modes only |
| House Lights | `houseLights` | Classic and legacy modes only |
| Ice Treads | `treads` | Classic and legacy modes only |
| Icebreaker | `freeze` | Classic and legacy modes only |
| Kickstand | `kickstand` | Design carried into Cornering; original remains in Classic |
| Lantern Step | `lantern-step` | Classic and legacy modes only |
| Last Word | `lastWord` | Classic and legacy modes only |
| Mine Cart | `mineCart` | Classic and legacy modes only |
| Mirrored Step | `mirrored-step` | Classic and legacy modes only |
| Needlepoint | `focusCone` | Revised as Needlepoint; original remains in Classic |
| Orbit Step | `orbit-step` | Classic and legacy modes only |
| Parting Gift | `parting-gift` | Classic and legacy modes only |
| Parting Shot | `partingShot` | Classic and legacy modes only |
| Pep Talk | `pep-talk` | Classic and legacy modes only |
| Pinball Shoes | `pinball` | Classic and legacy modes only |
| Pocket Ledge | `pocketLedge` | Classic and legacy modes only |
| Pocket Sand | `pocket-sand` | Classic and legacy modes only |
| Pocket Shield | `chargeShield` | Classic and legacy modes only |
| Pop Circuit | `popCircuit` | Classic and legacy modes only |
| Power Slide | `powerSlide` | Classic and legacy modes only |
| Pulse Train | `pulseTrain` | Classic and legacy modes only |
| Push Off | `push-off` | Classic and legacy modes only |
| Quick Set | `quickSet` | Design carried into Quick Draw; original remains in Classic |
| Rally Flag | `rally-flag` | Classic and legacy modes only |
| Rattle Can | `rattle-can` | Classic and legacy modes only |
| Recall Ticket | `recall-ticket` | Classic and legacy modes only |
| Recoil Drive | `force, recoil` | Revised as Recoil Drive; original remains in Classic |
| Return to Sender | `sender` | Design carried into Wrong Number; original remains in Classic |
| Ricochet Boots | `ricochet-boots` | Classic and legacy modes only |
| Riverbend | `riverbend` | Classic and legacy modes only |
| Rolling Thunder | `rolling-thunder` | Classic and legacy modes only |
| Rubber Soles | `soles` | Classic and legacy modes only |
| Safety Valve | `safetyValve` | Classic and legacy modes only |
| Second Chance | `guard, save` | Classic and legacy modes only |
| Second Stride | `secondStride` | Classic and legacy modes only |
| Second Verse | `second-verse` | Revised as Second Verse; original remains in Classic |
| Shock Ring | `range, ring` | Classic and legacy modes only |
| Signal Jammer | `jammer` | Classic and legacy modes only |
| Slip Charge | `slipCharge` | Classic and legacy modes only |
| Smoke Screen | `smoke` | Classic and legacy modes only |
| Snapback | `snapback` | Classic and legacy modes only |
| Split Second | `split-second` | Classic and legacy modes only |
| Spring Stance | `springStance` | Classic and legacy modes only |
| Stand-In | `standIn` | Classic and legacy modes only |
| Stepping Stone | `stepping` | Classic and legacy modes only |
| Stunt Double | `stunt` | Revised as Stunt Double; original remains in Classic |
| Tailwind | `tailwind` | Classic and legacy modes only |
| The Floor Is Yours | `floorYours` | Classic and legacy modes only |
| Thunder Tread | `dashBurst` | Classic and legacy modes only |
| Trade Places | `trade-places` | Classic and legacy modes only |
| Trident | `trident` | Classic and legacy modes only |
| Turntable | `turntable` | Classic and legacy modes only |
| Wide Sweep | `sweepCone` | Revised as Wide Sweep; original remains in Classic |
| Wrong Floor | `wrongFloor` | Classic and legacy modes only |

## Previously retired cards

These remain outside all offer pools.

Backblast Kit, Breaker Shield, Brick Break, Bumper Pass, Clean Counter, Cold Shoulder, Comeback Trail, Dash Current, Encore, Encore Bow, Escape Velocity, Exit Music, Fast Hands, Fault Tap, Feedback Loop, Final Lap, Flash Charge, Golden Riposte, Half Measure, Heel Turn, Hitch Kick, Hush Money, Late Checkout, Loaded Step, Orbit Breaker, Paperweight, Parry Shell, Phoenix Engine, Power Broker, Quick Cover, Rally Point, Relay Baton, Reload Relay, Rubber Band, Running Start, Second Wind, Short Circuit, Slip Jack, Slipstream Relay, Soft Landing, Spare Battery, Springline, Stage Dive, Star Catcher, Storm Pass, Switch Hitter, Zip Fuse.

## Implementation choices

- Losers draft first. Every player receives the same number of picks. With fewer than three unclaimed starters, remaining undrafted starters are shown before mirrors become available.
- The closing ring starts after 34 seconds. If multiple players remain at 59 seconds, the closest real fighter to the marked center takes the point.
- Bank Hall uses angled projectile reflections on rectangular fighter collision, and Switchyard Routes uses a center hole and short routes around interior walls.
- Body Double recalls to the decoy’s last safe position; the real fighter stays vulnerable until the rescue is triggered. The try button runs a short visual demonstration.
