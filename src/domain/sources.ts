// Every source the app cites, in one place, so a URL is never written twice
// and a re-verification pass has one file to edit. Each was fetched and the
// quoted wording read off the live page — most recently 22 Aug 2026.
//
// NHS in particular rewrites and renames pages: two of these moved between
// August 10 and August 22. Re-check before any release.

export type { FactSource } from "./babyFacts";
import type { FactSource } from "./babyFacts";

export const AAP_BURPING: FactSource = {
  name: "AAP · Baby Burping, Hiccups & Spit-Up",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/baby-burping-hiccups-and-spit-up.aspx",
};

export const AAP_DEHYDRATION: FactSource = {
  name: "AAP · Signs of Dehydration in Infants & Children",
  url: "https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/dehydration.aspx",
};

export const AAP_ENOUGH_MILK: FactSource = {
  name: "AAP · Warning Signs of Breastfeeding Problems",
  url: "https://www.healthychildren.org/English/ages-stages/baby/breastfeeding/Pages/Warning-Signs-of-Breastfeeding-Problems.aspx",
};

export const AAP_FEVER: FactSource = {
  name: "AAP · Fever and Your Baby",
  url: "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/Fever-and-Your-Baby.aspx",
};

export const AAP_FIRST_DAYS: FactSource = {
  name: "AAP · Baby's First Days: Bowel Movements & Urination",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Babys-First-Days-Bowel-Movements-and-Urination.aspx",
};

export const AAP_FIRST_MONTH: FactSource = {
  name: "AAP · Your Baby's First Month",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/First-Month-Physical-Appearance-and-Growth.aspx",
};

export const AAP_FORMULA_AMOUNT: FactSource = {
  name: "AAP · Amount and Schedule of Baby Formula Feedings",
  url: "https://www.healthychildren.org/English/ages-stages/baby/formula-feeding/Pages/Amount-and-Schedule-of-Formula-Feedings.aspx",
};

export const AAP_HOW_OFTEN: FactSource = {
  name: "AAP · How Often and How Much Should Your Baby Eat?",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/How-Often-and-How-Much-Should-Your-Baby-Eat.aspx",
};

export const AAP_MIND_8_12: FactSource = {
  name: "AAP · Cognitive Development: 8 to 12 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Cognitive-Development-8-to-12-Months.aspx",
};

export const AAP_MOVEMENT_4_7: FactSource = {
  name: "AAP · Movement: 4 to 7 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-4-to-7-Months.aspx",
};

export const AAP_POOPING: FactSource = {
  name: "AAP · Pooping By the Numbers",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Pooping-By-the-Numbers.aspx",
};

export const AAP_SPIT_UP: FactSource = {
  name: "AAP · Why Babies Spit Up",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Why-Babies-Spit-Up.aspx",
};

export const AAP_TUMMY_TIME: FactSource = {
  name: "AAP · Back to Sleep, Tummy to Play",
  url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/back-to-sleep-tummy-to-play.aspx",
};

export const NHS_BOTTLE: FactSource = {
  name: "NHS · Bottle feeding advice",
  url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/bottle-feeding/advice/",
};

export const NHS_CLUSTER: FactSource = {
  name: "NHS · Cluster feeding",
  url: "https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/bottle-feeding/bottle-feeding-your-baby/cluster-feeding/",
};

export const NHS_ENOUGH_MILK: FactSource = {
  name: "NHS · Is my baby getting enough milk?",
  url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/",
};

export const NHS_JAUNDICE: FactSource = {
  name: "NHS · Jaundice in babies",
  url: "https://www.nhs.uk/conditions/jaundice-in-babies/",
};

export const NHS_NAPPY: FactSource = {
  name: "NHS · How to change your baby's nappy",
  url: "https://www.nhs.uk/baby/caring-for-a-newborn/how-to-change-your-babys-nappy/",
};

export const NHS_REFLUX: FactSource = {
  name: "NHS · Reflux in babies",
  url: "https://www.nhs.uk/conditions/reflux-in-babies/",
};

export const NHS_URGENT_HELP: FactSource = {
  name: "NHS · When to get urgent medical help",
  url: "https://www.nhs.uk/baby/health/when-to-get-urgent-medical-help-for-babies-and-children-under-5/",
};

export const NHS_WEIGHT: FactSource = {
  name: "NHS · Your baby's weight and height",
  url: "https://www.nhs.uk/baby/babys-development/height-weight-and-reviews/baby-height-and-weight/",
};

export const WHO_FEEDING: FactSource = {
  name: "WHO · Infant and young child feeding",
  url: "https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding",
};
