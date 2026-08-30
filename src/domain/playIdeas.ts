// Play & development — everyday activities matched to the baby's age.
//
// Asked for from the feedback box by a parent in the Facebook group that
// found this app: "exercises that would help them sa development nila".
// Same discipline as careGuidance.ts: every card traces to a real page that
// was fetched and read (by the drafting agents AND re-fetched by independent
// verifiers), the wording stays inside what that page actually says, and
// nothing here grades the baby or promises outcomes. These are ordinary play
// ideas — tummy time, looking, reaching, talking — not therapy; anything
// concerning belongs with the paediatrician.

import { FactSource } from "./babyFacts";

export type PlayArea = "motor" | "vision" | "language" | "social";

export const PLAY_AREA_LABEL: Record<PlayArea, string> = {
  motor: "Movement",
  vision: "Seeing",
  language: "Talking",
  social: "Together",
};

export type PlayIdea = {
  key: string;
  title: string;
  area: PlayArea;
  /** What this builds, in one sentence, within the source. */
  why: string;
  /** Three or four short steps a tired parent can follow. */
  steps: string[];
  /** Duration/frequency only when the source states one. */
  howLong: string;
  /** One safety line when the source gives one. */
  safety?: string;
  source: FactSource;
};

export type PlayBracket = {
  /** Inclusive age bounds in days; the last bracket runs to Infinity. */
  fromDay: number;
  toDay: number;
  /** The stage in a few words, for the section heading. */
  stage: string;
  ideas: PlayIdea[];
};

export const PLAY_BRACKETS: PlayBracket[] = [
  {
    fromDay: 0,
    toDay: 89,
    stage: "birth to 3 months",
    ideas: [
      // Fetched and verified 30 Aug 2026: Tummy time is for babies who are
      // awake and being watched. Play and interact with your baby while they
      // are awake and on their tummy 2 to 3 times each day for a short time
      // (3 to 5 minutes). You can start the day your baby gets home from the
      // hospital.
      {
        key: "tummy-time",
        title: "Tummy time",
        area: "motor",
        why: "Awake time on the tummy builds the muscles your baby will use for lifting their head, sliding on their belly and crawling.",
        steps: [
          "While your baby is awake, lie on your back and place them on your chest \u2014 they'll lift their head and use their arms to try to see your face.",
          "Place yourself or a toy just out of reach so they try to reach for you or the toy.",
          "Or place a few toys in a circle around your baby \u2014 reaching toward different spots builds the muscles they'll use to roll over, scoot on their belly and crawl.",
          "Keep it short at first \u2014 a few minutes is plenty, then try again later in the day.",
        ],
        howLong: "2 to 3 times a day for 3 to 5 minutes to start, working up to 15 to 30 minutes a day by 7 weeks",
        safety: "Tummy time is only for babies who are awake and being watched \u2014 sleep is always on the back.",
        source: {
          name: "AAP \u00b7 Back to Sleep, Tummy to Play",
          url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/back-to-sleep-tummy-to-play.aspx",
        },
      },
      // Fetched and verified 30 Aug 2026: Your newborn can best see things
      // that are about 8 to 12 inches (20 to 30 cm) away. … By 3 months:
      // Babies should be able to focus on faces and close objects. They
      // should also be able to follow a moving object with their eyes.
      {
        key: "face-watching",
        title: "Watch and follow",
        area: "vision",
        why: "In these months your baby is learning to focus on faces and close objects and to follow something moving with their eyes.",
        steps: [
          "Hold your baby so your face is about 8 to 12 inches (20 to 30 cm) from theirs \u2014 that's the distance a newborn sees best.",
          "Let them settle on your face and just look; talk softly while they study you.",
          "Slowly move your face, or a small toy held at that same close distance, and let their eyes follow it.",
          "Pause whenever they need a break and try again another time.",
        ],
        howLong: "A few minutes, as long as it stays fun",
        source: {
          name: "AAP \u00b7 Infant Vision Development: What Can Babies See?",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Babys-Vision-Development.aspx",
        },
      },
      // Fetched and verified 30 Aug 2026: Hold your baby close and look at
      // them as you talk to them. Babies love faces and will watch you and
      // respond as you talk. … Sing to your baby – this helps them tune in to
      // the rhythm of language.
      {
        key: "talk-and-sing",
        title: "Talk and sing",
        area: "language",
        why: "Hearing your voice up close helps your baby tune in to the rhythm of language and learn the back-and-forth of conversation.",
        steps: [
          "Hold your baby close and look at them as you talk \u2014 babies love faces and will watch you and respond.",
          "Chat about whatever you're doing as you feed, change and bathe them.",
          "Sing to them, or talk in a sing-song voice \u2014 it helps keep their attention.",
          "When they make a sound, repeat it back to them; that's their first turn in a conversation.",
        ],
        howLong: "A few minutes, as long as it stays fun \u2014 it fits easily into feeds and nappy changes",
        source: {
          name: "NHS \u00b7 Help your baby learn to talk",
          url: "https://www.nhs.uk/baby/babys-development/play-and-learning/help-your-baby-learn-to-talk/",
        },
      },
    ],
  },
  {
    fromDay: 90,
    toDay: 179,
    stage: "3 to 6 months",
    ideas: [
      // Fetched and verified 30 Aug 2026: You can also put toys near your
      // baby so they can reach for them.
      {
        key: "toys-within-reach",
        title: "Toys within reach",
        area: "motor",
        why: "Putting a toy just within reach invites your baby to stretch out, swipe and grab \u2014 an easy play idea the NHS suggests from 4 months.",
        steps: [
          "Put a toy near your baby, just within reach.",
          "Let them stretch, swipe and grab it in their own time.",
          "Talk and sing to them cheerfully while you play.",
          "Swap in a different toy when they lose interest.",
        ],
        howLong: "A few minutes at a time, as long as it stays fun.",
        source: {
          name: "NHS \u00b7 Baby and toddler play ideas",
          url: "https://www.nhs.uk/baby/babys-development/play-and-learning/baby-and-toddler-play-ideas/",
        },
      },
      // Fetched and verified 30 Aug 2026: By the end of this period, they'll
      // probably be able to roll over in both directions. However, the time
      // frame varies for different babies. Most children roll from stomach to
      // back before the opposite direction, although doing it in reverse is
      // perfectly normal.
      {
        key: "rolling-floor-time",
        title: "Rolling floor time",
        area: "motor",
        why: "Rolling both ways usually develops across this stretch \u2014 and the timing varies from baby to baby. Awake time on the tummy with a toy to look at gives yours room to practise.",
        steps: [
          "During awake time, lay your baby on their tummy on the floor with their arms forward.",
          "Get their attention with a toy they like, held where they can see it.",
          "Use it to encourage them to lift their head and chest.",
          "Whichever way they roll first is fine \u2014 tummy-to-back usually comes first, and the reverse is normal too.",
        ],
        howLong: "As long as it stays fun \u2014 follow your baby's lead.",
        safety: "Awake time only \u2014 and clear away anything small they could choke on.",
        source: {
          name: "AAP \u00b7 Movement Milestones: Babies 4 to 7 Months",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-4-to-7-Months.aspx",
        },
      },
      // Fetched and verified 30 Aug 2026: Babies will love to look at you and
      // smile and eventually learn to laugh with you. ... Closer to 6 months,
      // they will enjoy mirrors and imitating new sounds with you.
      {
        key: "smiles-and-mirrors",
        title: "Smiles and mirrors",
        area: "social",
        why: "Looking at your face, trading smiles and copying sounds is how babies this age love to play \u2014 and closer to 6 months, a mirror joins the game.",
        steps: [
          "Get face to face \u2014 hold your baby or lie beside them so they can study you.",
          "Smile and chat, and copy the new sounds they make back to them.",
          "Give them a pause to answer, then laugh along together.",
          "Closer to 6 months, look into a baby-safe mirror together.",
        ],
        howLong: "A few minutes at a time, as long as it stays fun.",
        safety: "Your face is the show \u2014 babies this age don't need screens or media.",
        source: {
          name: "AAP \u00b7 How Active is Your Baby?",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/how-active-is-your-baby.aspx",
        },
      },
    ],
  },
  {
    fromDay: 180,
    toDay: 269,
    stage: "6 to 9 months",
    ideas: [
      // Fetched and verified 30 Aug 2026: By this age, your baby probably
      // will be sitting without support. Although she may topple from time to
      // time, she'll usually catch herself with her arms.
      {
        key: "sitting-play",
        title: "Sitting play",
        area: "motor",
        why: "As the muscles in their trunk strengthen, babies this age sit more steadily and start leaning over to reach for things \u2014 relaxed floor time gives them room to work on it.",
        steps: [
          "Sit your baby on the floor and stay close \u2014 a topple now and then is normal, and they will usually catch themselves with their arms.",
          "Put a toy just to the side so they can lean over and reach for it.",
          "Give them relaxed floor time to work out rolling onto their tummy and getting back up to sitting on their own.",
        ],
        howLong: "A few minutes at a time, as long as it stays fun.",
        safety: "If they are not sitting by themselves by nine months, ask your paediatrician.",
        source: {
          name: "AAP \u00b7 Movement Milestones in Babies 8 to 12 Months",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-8-to-12-Months.aspx",
        },
      },
      // Fetched and verified 30 Aug 2026: Play games with your baby, such as
      // my turn, your turn. Try this by passing a toy back and forth.
      {
        key: "pass-and-bang",
        title: "Pass and bang",
        area: "motor",
        why: "Passing a toy back and forth and playing with blocks uses the hand skills most babies show by 9 months \u2014 banging two things together and moving things from one hand to the other.",
        steps: [
          "Sit together with a couple of safe blocks or cups.",
          "Pass one toy back and forth \u2014 my turn, your turn.",
          "Let your baby bang two things together; it is part of how they explore at this age.",
          "Dump blocks out of a container and put them back in together.",
        ],
        howLong: "A few minutes, as long as it stays fun.",
        source: {
          name: "CDC \u00b7 Milestones by 9 Months",
          url: "https://www.cdc.gov/act-early/milestones/9-months.html",
        },
      },
      // Fetched and verified 30 Aug 2026: To help your baby learn object
      // permanence, play peekaboo with them. By switching from one variation
      // of this game to another, you'll maintain their interest almost
      // indefinitely.
      {
        key: "peek-a-boo",
        title: "Peek-a-boo",
        area: "social",
        why: "Peekaboo helps your baby learn object permanence \u2014 that people and things still exist when they are out of sight.",
        steps: [
          "Lay a soft cloth over your baby's head and ask, \"Where's the baby?\" \u2014 once they know the game, they will pull it off and pop up grinning.",
          "Hide behind a door or a piece of furniture, leaving a foot or arm showing as a clue for them to find you.",
          "Take turns \"hiding\" your head under a large towel and letting them pull it off.",
          "Switch between variations to keep the game interesting.",
        ],
        howLong: "A few minutes, as long as it stays fun.",
        source: {
          name: "AAP \u00b7 Cognitive Development: 8 to 12 Months",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Cognitive-Development-8-to-12-Months.aspx",
        },
      },
    ],
  },
  {
    fromDay: 270,
    toDay: Infinity,
    stage: "9 to 12 months",
    ideas: [
      // Fetched and verified 30 Aug 2026: Try presenting her with intriguing
      // objects just beyond her reach. As she becomes more agile, create
      // miniature obstacle courses using pillows, boxes, and sofa cushions.
      // Join in the game by hiding behind one of the obstacles and surprising
      // her with a "peekaboo!" Don't ever leave your baby unsupervised,
      // though. If she falls between pillows or under a box, she might not be
      // able to get out.
      {
        key: "cushion-crawl-course",
        title: "Cushion crawl course",
        area: "motor",
        why: "Crawling toward things they want, over and around soft obstacles, gives your baby lots of practice moving on their own.",
        steps: [
          "Sit on the floor and place a toy your baby likes just beyond their reach.",
          "Build a little course from pillows, boxes and sofa cushions for them to crawl over and around.",
          "Hide behind one of the obstacles and pop out with a \"peekaboo!\"",
          "Stay right beside them the whole time.",
        ],
        howLong: "A few minutes, as long as it stays fun.",
        safety: "Never leave your baby unsupervised on the course \u2014 if they slip between pillows or under a box, they might not be able to get out.",
        source: {
          name: "AAP \u00b7 Movement Milestones: Babies 8 to 12 Months",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-8-to-12-Months.aspx",
        },
      },
      // Fetched and verified 30 Aug 2026: In preparation, she'll pull herself
      // to a standing position every chance she gets—although when she first
      // starts, she may not know how to get down. If she cries for help,
      // physically show her how to bend her knees to lower herself without
      // falling. … Once your baby feels secure standing, she'll try tentative
      // steps while holding on for support. When your hands aren't available,
      // she'll cruise alongside furniture. Just make sure whatever she uses
      // for support has no sharp edges and is properly weighted or attached
      // to the floor.
      {
        key: "pull-up-and-cruise",
        title: "Pull up and cruise",
        area: "motor",
        why: "Pulling up to stand and stepping sideways along furniture is how babies build up to walking, one hold at a time.",
        steps: [
          "Let your baby pull up on a sturdy piece of furniture whenever the mood strikes.",
          "If they get stuck standing and cry for help, gently show them how to bend their knees to lower themselves back down.",
          "Once they feel steady, offer your hands so they can try small steps while holding on.",
          "When your hands are busy, let them cruise sideways along the furniture at their own pace.",
        ],
        howLong: "A few minutes, as long as it stays fun.",
        safety: "Make sure whatever your baby uses for support has no sharp edges and is properly weighted or attached to the floor.",
        source: {
          name: "AAP \u00b7 Movement Milestones: Babies 8 to 12 Months",
          url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-8-to-12-Months.aspx",
        },
      },
      // Fetched and verified 30 Aug 2026: Chat to your baby about the things
      // they can see, for example, "Look at the car". Look at very simple
      // picture books with your child together and describe the pictures to
      // your baby. … Read together – try using books with textures that your
      // baby can feel.
      {
        key: "name-it-read-it",
        title: "Name it, read it",
        area: "language",
        why: "Chatting about what your baby can see and looking at simple picture books together helps them connect words to the things around them.",
        steps: [
          "Point out things around you as you go: \"Look at the car.\"",
          "Sit together with a very simple picture book and describe the pictures to your baby.",
          "Try books with textures your baby can feel as you talk about each page.",
          "If your baby starts to copy you, encourage them and repeat what they say.",
        ],
        howLong: "A few minutes, as long as it stays fun.",
        source: {
          name: "NHS \u00b7 Listening and learning: 6 to 12 months",
          url: "https://www.nhs.uk/start-for-life/baby/learning-to-talk/listening-and-learning-6-to-12-months/",
        },
      },
    ],
  },
];

/** The bracket for this age, or null when nothing applies (or no cards). */
export function playForAge(days: number): PlayBracket | null {
  const bracket = PLAY_BRACKETS.find((b) => days >= b.fromDay && days <= b.toDay) ?? null;
  return bracket && bracket.ideas.length > 0 ? bracket : null;
}
