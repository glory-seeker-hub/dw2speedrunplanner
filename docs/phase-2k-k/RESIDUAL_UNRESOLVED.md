# Residual unresolved mechanics

Used deferred occurrences: **0**. Canonical source and raw 68-byte context remain preserved in source-audit-before.json. Unused, ignored and compatibility behavior is listed separately below.

| Technique | Full ID | Byte/mask | Source label | Remaining uncertainty | Ranking |
| --- | --- | --- | --- | --- | --- |

## Confirmed project rules

- Motivation Down: user confirmed **100% on Hit**. Native application consumes no probability draw; universal Enemy immunity still applies. TAS cannot prevent a guaranteed application; it retains favorable recovery and prevention of any genuinely probabilistic application.
- Trick Or Treat 0x0015: user explicitly confirmed **DEF=1**, overriding the preserved byte17/0x40 half-DEF source description. It shares the post-use mechanic with Black Pearl Shot.
- MP damage: confirmed floor(final HP damage / 2), including odd values. Source random-range labels are retained as provenance only.
- HP Zapper: floor(pre-impact current HP / 2). Critical Blow: execute when pre-impact current HP × 10 <= Max HP, otherwise ordinary damage. Musical Fist: ordinary damage becomes healing on species-type disadvantage.
- Banana Slip: prevents only waiting unactivated Counters for the round; source turn-wide Interrupt prevention is broken and ignored. Its separate skill-scoped Interrupt protection remains valid.

## Unused dictionary rows

- Byte 17, mask 0x3: Can't be either of the above — zero decoded occurrences, data-only.
- Byte 21, mask 0x10: Eliminates target if hit by this 3 times — zero decoded occurrences, data-only.
- Byte 25, mask 0x80: Stun w/ Interrupt — zero decoded occurrences, data-only.
- Byte 26, mask 0x40: Unknown Status Effect Flag — zero decoded occurrences, data-only.
- Byte 29, mask 0x7: Cure Poison, Confusion & Stun — zero decoded occurrences, data-only.

## Other data-only and ignored occurrences

- 0x00ea Alias Fake (?): byte17/0x4, Can't Miss (could be defunct, it's always set for Assists?); ignored-by-project.
- 0x0001 Poison Ivy: byte21/0x1, Deprecated; data-only.
- 0x0002 Rain of Pollen: byte21/0x1, Deprecated; data-only.
- 0x0003 Boom Bubble: byte21/0x1, Deprecated; data-only.
- 0x0004 Flame Bomber: byte21/0x1, Deprecated; data-only.
- 0x0005 Scissor Magic: byte21/0x1, Deprecated; data-only.
- 0x0006 Rock Fist: byte21/0x1, Deprecated; data-only.
- 0x0007 S-Thunder Smack: byte21/0x1, Deprecated; data-only.
- 0x0008 Blue Blaster: byte21/0x1, Deprecated; data-only.
- 0x0009 Pummel Peck: byte21/0x1, Deprecated; data-only.
- 0x000a Fireball: byte21/0x1, Deprecated; data-only.
- 0x000b Fossil Bite: byte21/0x1, Deprecated; data-only.
- 0x000c Hydro Blaster: byte21/0x1, Deprecated; data-only.
- 0x000d Volcanic Strike: byte21/0x1, Deprecated; data-only.
- 0x000e Blaze Blast: byte21/0x1, Deprecated; data-only.
- 0x000f Stun Flame Shot: byte21/0x1, Deprecated; data-only.
- 0x0010 Iron Drill Spin: byte21/0x1, Deprecated; data-only.
- 0x0011 Solar Ray: byte21/0x1, Deprecated; data-only.
- 0x0012 Flower Cannon: byte21/0x1, Deprecated; data-only.
- 0x0013 Royal Smasher: byte21/0x1, Deprecated; data-only.
- 0x0014 Ninja Flower: byte21/0x1, Deprecated; data-only.
- 0x0015 Trick Or Treat: byte21/0x1, Deprecated; data-only.
- 0x0016 Metal Fireball: byte21/0x1, Deprecated; data-only.
- 0x0017 Lightning Spear: byte21/0x1, Deprecated; data-only.
- 0x0018 Tri-Horn Attack: byte21/0x1, Deprecated; data-only.
- 0x0019 Magical Tail: byte21/0x1, Deprecated; data-only.
- 0x001a Tomahawk Crunch: byte21/0x1, Deprecated; data-only.
- 0x001b Energy Blast: byte21/0x1, Deprecated; data-only.
- 0x001c Howling Crusher: byte21/0x1, Deprecated; data-only.
- 0x001d Legendary Blade: byte21/0x1, Deprecated; data-only.
- 0x001e Freeze Breath: byte21/0x1, Deprecated; data-only.
- 0x001f Pepper Breath: byte21/0x1, Deprecated; data-only.
- 0x0020 Spiral Twister: byte21/0x1, Deprecated; data-only.
- 0x0021 Super Shocker: byte21/0x1, Deprecated; data-only.
- 0x0022 Waking Dream: byte21/0x1, Deprecated; data-only.
- 0x0023 Marching Fishes: byte21/0x1, Deprecated; data-only.
- 0x0024 Nova Blast: byte21/0x1, Deprecated; data-only.
- 0x0025 V-Nova Blast: byte21/0x1, Deprecated; data-only.
- 0x0026 Spinning Needle: byte21/0x1, Deprecated; data-only.
- 0x0027 Meteor Wing: byte21/0x1, Deprecated; data-only.
- 0x0028 Fist Of Fate: byte21/0x1, Deprecated; data-only.
- 0x0029 Air Attack: byte21/0x1, Deprecated; data-only.
- 0x002a Howling Blaster: byte21/0x1, Deprecated; data-only.
- 0x002b Wolf Claw: byte21/0x1, Deprecated; data-only.
- 0x002c Icicle Shot: byte21/0x1, Deprecated; data-only.
- 0x002d Strong Carapace: byte21/0x1, Deprecated; data-only.
- 0x002e Harpoon Torpedo: byte21/0x1, Deprecated; data-only.
- 0x002f Pulse Blast: byte21/0x1, Deprecated; data-only.
- 0x0030 Giga Blaster: byte21/0x1, Deprecated; data-only.
- 0x0031 V-Wing Blade: byte21/0x1, Deprecated; data-only.
- 0x0032 Lightning Blade: byte21/0x1, Deprecated; data-only.
- 0x0033 Mega Bone Stick: byte21/0x1, Deprecated; data-only.
- 0x0034 Tusk Crusher: byte21/0x1, Deprecated; data-only.
- 0x0035 Vulcan's Hammer: byte21/0x1, Deprecated; data-only.
- 0x0036 Tidal Wave: byte21/0x1, Deprecated; data-only.
- 0x0037 Big Bang Boom: byte21/0x1, Deprecated; data-only.
- 0x0038 Terra Force: byte21/0x1, Deprecated; data-only.
- 0x0039 S-bone Crusher: byte21/0x1, Deprecated; data-only.
- 0x003b Electric Shock: byte21/0x1, Deprecated; data-only.
- 0x003c Demi Dart: byte21/0x1, Deprecated; data-only.
- 0x003d Black Pearl Shot: byte21/0x1, Deprecated; data-only.
- 0x003e Stun Bubble: byte21/0x1, Deprecated; data-only.
- 0x003f Electro Thread: byte21/0x1, Deprecated; data-only.
- 0x0040 Party Time: byte21/0x1, Deprecated; data-only.
- 0x0041 Evil Touch: byte21/0x1, Deprecated; data-only.
- 0x0042 Evil Charm: byte21/0x1, Deprecated; data-only.
- 0x0043 Coral Crusher: byte21/0x1, Deprecated; data-only.
- 0x0044 Spurting Ink: byte21/0x1, Deprecated; data-only.
- 0x0045 Sonic Crusher: byte21/0x1, Deprecated; data-only.
- 0x0046 Scissor Claw: byte21/0x1, Deprecated; data-only.
- 0x0047 Twig Tap: byte21/0x1, Deprecated; data-only.
- 0x0048 Alien Ray: byte21/0x1, Deprecated; data-only.
- 0x004a Dark Shot: byte21/0x1, Deprecated; data-only.
- 0x004b Darkside Attack: byte21/0x1, Deprecated; data-only.
- 0x004c Grisly Wing: byte21/0x1, Deprecated; data-only.
- 0x004d Shadow Scythe: byte21/0x1, Deprecated; data-only.
- 0x004e Evil Wind: byte21/0x1, Deprecated; data-only.
- 0x004f Tentacle Claw: byte21/0x1, Deprecated; data-only.
- 0x0050 Musical Fist: byte21/0x1, Deprecated; data-only.
- 0x0051 Duo Scissor Claw: byte21/0x1, Deprecated; data-only.
- 0x0052 Pit Pelter: byte21/0x1, Deprecated; data-only.
- 0x0053 Junk Chunker: byte21/0x1, Deprecated; data-only.
- 0x0054 Trump Sword: byte21/0x1, Deprecated; data-only.
- 0x0055 Needle Squall: byte21/0x1, Deprecated; data-only.
- 0x0056 X-Scissor Claw: byte21/0x1, Deprecated; data-only.
- 0x0057 Puppet Pummel: byte21/0x1, Deprecated; data-only.
- 0x0058 Toy Flame: byte21/0x1, Deprecated; data-only.
- 0x0059 Super Slap: byte21/0x1, Deprecated; data-only.
- 0x005a Hail Storm: byte21/0x1, Deprecated; data-only.
- 0x005b Ice Blast: byte21/0x1, Deprecated; data-only.
- 0x005c Hyper Cannon: byte21/0x1, Deprecated; data-only.
- 0x005d Thunder Ray: byte21/0x1, Deprecated; data-only.
- 0x005e Sad Water Blast: byte21/0x1, Deprecated; data-only.
- 0x005f Rose Spear: byte21/0x1, Deprecated; data-only.
- 0x0060 SubZero Ice Punch: byte21/0x1, Deprecated; data-only.
- 0x0061 Lightning Paw: byte21/0x1, Deprecated; data-only.
- 0x0062 Heaven's Arrow: byte21/0x1, Deprecated; data-only.
- 0x0063 Fire Tornado: byte21/0x1, Deprecated; data-only.
- 0x0064 Darkness Gear: byte21/0x1, Deprecated; data-only.
- 0x0065 Bolt Strike: byte21/0x1, Deprecated; data-only.
- 0x0066 Protect Grenade: byte21/0x1, Deprecated; data-only.
- 0x0067 GigaByte Wing: byte21/0x1, Deprecated; data-only.
- 0x0068 Giga Cannon: byte21/0x1, Deprecated; data-only.
- 0x0069 E-Stun Blast: byte21/0x1, Deprecated; data-only.
- 0x006a Spiral Saw: byte21/0x1, Deprecated; data-only.
- 0x006b Brown Stinger: byte21/0x1, Deprecated; data-only.
- 0x006c Hyper Heat: byte21/0x1, Deprecated; data-only.
- 0x006d Triple Forces: byte21/0x1, Deprecated; data-only.
- 0x006e Slamming Tusk: byte21/0x1, Deprecated; data-only.
- 0x006f Fire Blast: byte21/0x1, Deprecated; data-only.
- 0x0070 Crimson Claw: byte21/0x1, Deprecated; data-only.
- 0x0071 Digital Bomb: byte21/0x1, Deprecated; data-only.
- 0x0072 Fire Blast II: byte21/0x1, Deprecated; data-only.
- 0x0073 Pretty Attack: byte21/0x1, Deprecated; data-only.
- 0x0082 Needle Spray: byte21/0x1, Deprecated; data-only.
- 0x0083 Meteor Stream: byte21/0x1, Deprecated; data-only.
- 0x0084 Thunder Ball: byte21/0x1, Deprecated; data-only.
- 0x0086 Smiley Bomb: byte21/0x1, Deprecated; data-only.
- 0x0087 Energetic Bomb: byte21/0x1, Deprecated; data-only.
- 0x0088 Smiley Warhead: byte21/0x1, Deprecated; data-only.
- 0x0089 Pummel Whack: byte21/0x1, Deprecated; data-only.
- 0x008a Ninja Knife Throw: byte21/0x1, Deprecated; data-only.
- 0x008b Beast King Fist: byte21/0x1, Deprecated; data-only.
- 0x008c Buffalo Breath: byte21/0x1, Deprecated; data-only.
- 0x00a0 Electro Shocker: byte21/0x1, Deprecated; data-only.
- 0x00a1 Wing Blade: byte21/0x1, Deprecated; data-only.
- 0x00a2 Horn Buster: byte21/0x1, Deprecated; data-only.
- 0x00a3 Giga Scissor Claw: byte21/0x1, Deprecated; data-only.
- 0x00a5 Chrono Breaker: byte21/0x1, Deprecated; data-only.
- 0x00b5 HP Recovery: byte21/0x1, Deprecated; data-only.
- 0x00bc Small HP Cure: byte21/0x1, Deprecated; data-only.
- 0x00cb Mega Heal: byte21/0x1, Deprecated; data-only.
- 0x00ce Hung on Death: byte21/0x1, Deprecated; data-only.
- 0x00cf Friendly Fire: byte21/0x1, Deprecated; data-only.
- 0x00d8 Vee Head Butt: byte21/0x1, Deprecated; data-only.
- 0x00d9 Flaming Rocket: byte21/0x1, Deprecated; data-only.
- 0x00da Lightning Blast: byte21/0x1, Deprecated; data-only.
- 0x00db Mega Fire: byte21/0x1, Deprecated; data-only.
- 0x00dc Chaos Cannon: byte21/0x1, Deprecated; data-only.
- 0x00dd Blind Attack: byte21/0x1, Deprecated; data-only.
- 0x00e4 Transcend Sword: byte21/0x1, Deprecated; data-only.
- 0x00e5 Garuru Cannon: byte21/0x1, Deprecated; data-only.
- 0x00e8 Karate Sweep: byte21/0x1, Deprecated; data-only.
- 0x00eb Inferno Missile: byte21/0x1, Deprecated; data-only.
- 0x00ed Stun Punch: byte21/0x1, Deprecated; data-only.
- 0x00ee Rail Cannon: byte21/0x1, Deprecated; data-only.
- 0x00f0 Titan Laser: byte21/0x1, Deprecated; data-only.
- 0x00f1 Fantasmic Bomb: byte21/0x1, Deprecated; data-only.
- 0x00f2 GAIA Gear: byte21/0x1, Deprecated; data-only.
- 0x00f3 Light Gun: byte21/0x1, Deprecated; data-only.
- 0x00f4 Fantasmic Ray: byte21/0x1, Deprecated; data-only.
- 0x00f5 Tubular Attack: byte21/0x1, Deprecated; data-only.
- 0x00f6 Left Hand: byte21/0x1, Deprecated; data-only.
- 0x00f8 Right Hand: byte21/0x1, Deprecated; data-only.
- 0x00fb Shadow Scythe (0MP): byte21/0x1, Deprecated; data-only.
- 0x00d2 Necro Magic: byte21/0x80, (Deprecated); data-only.
- 0x00ef Armor Aid: byte23/0x1, (Deprecated) (Armor Aid); data-only.
- 0x00e7 Safety Sphere: byte23/0x2, (Deprecated) (Safety Sphere); data-only.
- 0x00d7 Poison Wave: byte25/0x2, 66% Poison; ignored-by-project.
- 0x00ce Hung on Death: byte28/0x1, Apply Zombie Status; ignored-by-project.
- 0x00ea Alias Fake (?): byte28/0x2, Apply Invisibility Status; ignored-by-project.
- 0x00bb Banana Slip: byte31/0x20, Prevent counters & Interrupts this turn (Interrupt prevention is broken); ignored-by-project.
- 0x00a1 Wing Blade: byte32/0x1, Deprecated (Wing Blade, MP Destroyer have this on); data-only.
- 0x00a8 MP Destroyer: byte32/0x1, Deprecated (Wing Blade, MP Destroyer have this on); data-only.
- 0x00a4 Venom Infusion: byte32/0x10, Deprecated (It was enabled for Venom Infusion but is not used); data-only.
- 0x00a7 Life Shield: byte32/0x40, Deprecated (Life Shield); data-only.
- 0x00ea Alias Fake (?): byte33/0x1, Hit target(s); ignored-by-project.

## Compatibility limits outside deferred groups

Twig Tap 0x0047 is the only used byte19/0x08 HP-drain occurrence and now heals actual HP removed, excluding overkill. Unidentified custom techniques (canonicalSkillId=null) carrying legacy healOnDamage retain their explicitly custom calculated-damage compatibility behavior. Consecutive-use AP alone retains the pre-existing compatibility cap; it is not newly claimed authoritative. Alias Fake 0x00EA is ignored by project rule, including encounter import and combatant selection.

## Initial-state search convention

Injected initial Motivation Down resolves blocked-slot ties using the first paired rollout's seeded battle RNG for the representative root state, matching the existing representative-state treatment of later stochastic decision boundaries. Search enumerates only unblocked techniques in that observed state. Other sampled tie outcomes can diverge from that prefix under existing search semantics; the optimizer never enumerates the RNG outcome as a Player decision.
