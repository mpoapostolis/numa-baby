// Ελληνικά.
//
// The keys are the exact English sentences the components use — see
// src/i18n/index.ts for why. Written to sound like a Greek said them, not
// like an English sentence wearing Greek words: word order moves, articles
// appear, and where English leans on "log" and "track" the Greek says what a
// parent would actually say. Sentences with {name}-style holes are translated
// whole, never assembled.
//
// Anything not in here shows in English — visible, harmless, and the test in
// tests/unit/i18n.test.ts keeps entries from going stale when the English
// changes.

const el: Record<string, string> = {
  // --- Navigation ---
  "Today": "Σήμερα",
  "Timeline": "Ιστορικό",
  "Insights": "Εικόνα",
  "Guide": "Οδηγός",
  "Settings": "Ρυθμίσεις",

  // --- Common ---
  "Cancel": "Άκυρο",
  "Save": "Αποθήκευση",
  "Undo": "Αναίρεση",
  "Not now": "Όχι τώρα",
  "Close": "Κλείσιμο",
  "Add": "Προσθήκη",
  "Start": "Έναρξη",
  "Stop": "Στοπ",
  "Done": "Τέλος",
  "Edit": "Επεξεργασία",
  "Delete": "Διαγραφή",
  "Loading": "Φορτώνει",

  // --- Settings: appearance & language ---
  "Appearance": "Εμφάνιση",
  "Choose the theme that is easiest on your eyes.": "Διάλεξε το θέμα που ξεκουράζει τα μάτια σου.",
  "Phone": "Κινητό",
  "Follows your phone": "Ακολουθεί το κινητό",
  "Light": "Φωτεινό",
  "Bright and clear": "Φωτεινό και καθαρό",
  "Night": "Νύχτα",
  "Warm and dim for 3am": "Ζεστό και χαμηλό για τις 3 τα ξημερώματα",
  "Language": "Γλώσσα",
  "The whole app, including reminders and the pictures you share.":
    "Όλη η εφαρμογή, μαζί με τις υπενθυμίσεις και τις εικόνες που μοιράζεσαι.",

  // --- Time & durations ---
  "Yesterday": "Χθες",
  "You’re up late": "Ξενύχτι, ε;",
  "Good morning": "Καλημέρα",
  "Good afternoon": "Καλό απόγευμα",
  "Good evening": "Καλησπέρα",
  "just now": "μόλις τώρα",
  "{m}m ago": "πριν {m}λ",
  "{h}h {m}m ago": "πριν {h}ω {m}λ",
  "{d}d ago": "πριν {d} μέρες",
  "No entries yet": "Καμία καταχώριση ακόμα",
  "{m}m": "{m}λ",
  "{h}h": "{h}ω",
  "{h}h {m}m": "{h}ω {m}λ",
  "m": "λ",
  "h": "ω",
  "d": "ημ",
  "Likely in {duration}": "Μάλλον σε {duration}",
  "Past the usual window": "Πέρασε το συνηθισμένο",
  "Check cues now": "Δες τα σημάδια τώρα",

  // --- Today: hero ---
  "Welcome, {name}": "Καλώς ήρθες, {name}",
  "{name} — welcome to the world": "{name} — καλώς όρισες στον κόσμο",
  "{name} is {age} old": "{name} είναι {age}",
  "Day {n}": "Ημέρα {n}",

  // --- Today: tiles & quick logging ---
  "Bottle": "Μπιμπερό",
  "Nursing": "Θηλασμός",
  "Diaper": "Πάνα",
  "Sleep": "Ύπνος",
  "Burp": "Ρέψιμο",
  "Growth": "Ανάπτυξη",
  "Solids": "Στερεές τροφές",
  "Sounds": "Ήχοι",
  "Medicine": "Φάρμακο",
  "Health note": "Σημείωση υγείας",
  "Feed": "Τάισμα",
  "Log": "Καταχώριση",
  "Wet": "Τσίσα",
  "Dirty": "Κακά",
  "Both": "Και τα δύο",
  "Left": "Αριστερά",
  "Right": "Δεξιά",
  "left": "αριστερά",
  "right": "δεξιά",
  "Wake up": "Ξύπνησε",
  "Sleeping": "Κοιμάται",
  "Sleeping now": "Κοιμάται τώρα",
  "Burping": "Ρέψιμο",
  "Start the timer": "Ξεκίνα το χρονόμετρο",
  "Started {time}": "Ξεκίνησε {time}",
  "Nursing · {side}": "Θηλασμός · {side}",
  "Nursing · {side} side": "Θηλασμός · {side}",
  "Nursing · {side} · {duration}": "Θηλασμός · {side} · {duration}",
  "Bottle · {amount}": "Μπιμπερό · {amount}",
  "Log a bottle": "Κατάγραψε μπιμπερό",
  "Log the first feed": "Κατάγραψε το πρώτο τάισμα",
  "Log {amount} millilitres of {milk} now": "Κατάγραψε {amount} ml {milk} τώρα",
  "breast milk": "μητρικό γάλα",
  "formula": "φόρμουλα",
  "Change bottle amount": "Άλλαξε την ποσότητα",
  "Start nursing timer on the left side": "Ξεκίνα θηλασμό από τα αριστερά",
  "Start nursing timer on the right side": "Ξεκίνα θηλασμό από τα δεξιά",
  "Start nursing timer on the left side — usually next": "Ξεκίνα θηλασμό από τα αριστερά — συνήθως η επόμενη πλευρά",
  "Start nursing timer on the right side — usually next": "Ξεκίνα θηλασμό από τα δεξιά — συνήθως η επόμενη πλευρά",
  "Add a completed nursing session manually": "Πρόσθεσε θηλασμό που έχει ήδη τελειώσει",
  "Log wet diaper": "Κατάγραψε τσίσα",
  "Log dirty diaper": "Κατάγραψε κακά",
  "Log wet and dirty diaper": "Κατάγραψε τσίσα και κακά",
  "Log a diaper change at a different time": "Κατάγραψε αλλαγή πάνας άλλη ώρα",
  "Start sleep timer": "Ξεκίνα χρονόμετρο ύπνου",
  "Add a sleep that has already finished": "Πρόσθεσε ύπνο που έχει ήδη τελειώσει",
  "Start burping timer": "Ξεκίνα χρονόμετρο ρεψίματος",
  "Weight, length, head": "Βάρος, μήκος, κεφάλι",
  "Expressed milk or formula": "Αντλημένο γάλα ή φόρμουλα",
  "First tastes, purées, finger food": "Πρώτες γεύσεις, πουρέδες, finger food",
  "White noise and lullabies — back, and working": "Λευκός θόρυβος και νανουρίσματα",
  "Vitamin D, paracetamol, drops": "Βιταμίνη D, παρακεταμόλη, σταγόνες",
  "Temperature or note": "Θερμοκρασία ή σημείωση",
  "Tell another parent": "Πες το σε άλλον γονιό",
  "Numalog is free — pass it on": "Το Numalog είναι δωρεάν — δώσ’ το παρακάτω",
  "Last food": "Τελευταίο φαγητό",
  "Last dose": "Τελευταία δόση",
  "{what} · {duration} ago": "{what} · πριν {duration}",

  // --- Today: sections & hints ---
  "Today so far": "Η μέρα μέχρι τώρα",
  "Ready when you are": "Έτοιμο όποτε είστε",
  "Since last feed": "Από το τελευταίο τάισμα",
  "Recent": "Πρόσφατα",
  "See all": "Όλα",
  "Your day will appear here as you log it.": "Η μέρα σας θα εμφανίζεται εδώ όσο την καταγράφετε.",
  "Log the first feed when it happens — one tap on Bottle.": "Κατάγραψε το πρώτο τάισμα όταν γίνει — ένα άγγιγμα στο Μπιμπερό.",
  "Log the first feed when it happens — tap Left or Right under Nursing.": "Κατάγραψε το πρώτο τάισμα όταν γίνει — Αριστερά ή Δεξιά στον Θηλασμό.",
  "Log the first feed when it happens — one tap on Bottle or Nursing.": "Κατάγραψε το πρώτο τάισμα όταν γίνει — ένα άγγιγμα στο Μπιμπερό ή στον Θηλασμό.",
  "Still learning the rhythm": "Μαθαίνει ακόμα τον ρυθμό",
  "No steady pattern": "Χωρίς σταθερό μοτίβο",
  "Follow the cues — whenever works": "Ακολούθησε τα σημάδια — όποτε ταιριάζει",
  "Diapers come when they come — check whenever something seems off.": "Οι πάνες έρχονται όποτε έρθουν — έλεγξε όποτε κάτι δεν σου κάθεται καλά.",
  "Worth a check.": "Αξίζει ένα τσεκάρισμα.",
  "{over} past the usual {gap} gap — follow the cues": "{over} πάνω από το συνηθισμένο κενό των {gap} — ακολούθησε τα σημάδια",
  "Log a feed": "Κατάγραψε τάισμα",

  // --- Toasts ---
  "Sleep timer started": "Ξεκίνησε το χρονόμετρο ύπνου",
  "Burping timer started": "Ξεκίνησε το χρονόμετρο ρεψίματος",
  "Nursing started · {side} side": "Ξεκίνησε θηλασμός · {side}",
  "{amount} bottle saved": "Αποθηκεύτηκε μπιμπερό {amount}",
  "Wet diaper saved": "Αποθηκεύτηκε πάνα με τσίσα",
  "Dirty diaper saved": "Αποθηκεύτηκε πάνα με κακά",
  "Wet + dirty diaper saved": "Αποθηκεύτηκε πάνα — τσίσα και κακά",
  "{name} done": "{name} — έγινε",

  // --- Last night ---
  "Baby": "Το μωρό",
  "Last night": "Χθες το βράδυ",
  "{duration} asleep": "{duration} ύπνου",
  "1 waking": "1 ξύπνημα",
  "{n} wakings": "{n} ξυπνήματα",
  "1 night feed logged": "1 νυχτερινό τάισμα",
  "{n} night feeds logged": "{n} νυχτερινά ταΐσματα",
  "Share last night as a picture": "Μοιράσου τη νύχτα σαν εικόνα",
  "longest stretch": "μεγαλύτερο διάστημα",
  "feed": "τάισμα",
  "feeds": "ταΐσματα",
  "change": "αλλαγή",
  "changes": "αλλαγές",
  "first feed": "πρώτο τάισμα",
  "{name} · last night · {link}": "{name} · χθες το βράδυ · {link}",

  // --- Day recap ---
  "1 stretch": "1 διάστημα",
  "{n} stretches": "{n} διαστήματα",
  "longest {duration}": "μεγαλύτερο {duration}",
  "of 1 change": "από 1 αλλαγή",
  "of {n} changes": "από {n} αλλαγές",
  "1 bottle": "1 μπιμπερό",
  "{n} bottles": "{n} μπιμπερό",
  "{n} nursing": "{n} θηλασμοί",
  "bottles only": "μόνο μπιμπερό",
  "bottles only · {duration} nursing": "μόνο μπιμπερό · {duration} θηλασμός",
  "1 session": "1 συνεδρία",
  "{n} sessions": "{n} συνεδρίες",
  "{sessions} · one still going": "{sessions} · μία σε εξέλιξη",
  "Previous day": "Προηγούμενη μέρα",
  "Next day": "Επόμενη μέρα",
  "Share {what} as a picture": "Μοιράσου το «{what}» σαν εικόνα",
  "Nothing logged yet today.": "Τίποτα καταγεγραμμένο ακόμα σήμερα.",
  "Nothing logged on this day.": "Τίποτα καταγεγραμμένο αυτή τη μέρα.",
  "Feeds": "Ταΐσματα",
  "Nursed": "Θήλασε",
  "Milk": "Γάλα",
  "Nothing logged yet": "Τίποτα ακόμα",

  // --- Is this normal? ---
  "your baby": "το μωρό σας",
  "Yesterday looks ordinary for {name}": "Η χθεσινή μέρα δείχνει συνηθισμένη για {name}",
  "Yesterday: {what} sat outside the usual range": "Χθες: {what} εκτός του συνηθισμένου εύρους",
  "Yesterday: {n} figures sat outside the usual range": "Χθες: {n} νούμερα εκτός του συνηθισμένου εύρους",
  "usual {range}": "συνήθως {range}",
  "any": "όσα να ’ναι",
  "Wet nappies": "Πάνες με τσίσα",
  "Dirty nappies": "Πάνες με κακά",
  "AAP puts 8 to 12 feeds in 24 hours as usual in the first weeks.":
    "Η AAP δίνει 8 έως 12 ταΐσματα το 24ωρο ως συνηθισμένα τις πρώτες εβδομάδες.",
  "AAP puts 8 to 12 feeds in 24 hours as usual in the first weeks — babies feed to appetite, and a busy day or a quiet one is not a verdict.":
    "Η AAP δίνει 8 έως 12 ταΐσματα το 24ωρο ως συνηθισμένα τις πρώτες εβδομάδες — τα μωρά τρώνε με την όρεξή τους, και μια γεμάτη ή μια ήσυχη μέρα δεν είναι ετυμηγορία.",
  "Feeds usually space out to five to ten a day by this age.":
    "Σε αυτή την ηλικία τα ταΐσματα συνήθως αραιώνουν στα πέντε έως δέκα τη μέρα.",
  "Feeds usually space out to five to ten a day by this age — every baby settles somewhere of their own.":
    "Σε αυτή την ηλικία τα ταΐσματα συνήθως αραιώνουν στα πέντε έως δέκα τη μέρα — κάθε μωρό βρίσκει τον δικό του ρυθμό.",
  "Four to eight milk feeds a day is usual once solids have started.":
    "Τέσσερα έως οκτώ γάλατα τη μέρα είναι τα συνηθισμένα όταν έχουν ξεκινήσει οι στερεές τροφές.",
  "Four to eight milk feeds a day is usual once solids have started, alongside meals.":
    "Τέσσερα έως οκτώ γάλατα τη μέρα είναι τα συνηθισμένα όταν έχουν ξεκινήσει οι στερεές τροφές, μαζί με τα γεύματα.",
  "In the first 48 hours two or three wet nappies is the whole of it.":
    "Στις πρώτες 48 ώρες δύο ή τρεις πάνες με τσίσα είναι όλο κι όλο.",
  "In the first 48 hours two or three wet nappies is what to expect.":
    "Στις πρώτες 48 ώρες δύο ή τρεις πάνες με τσίσα είναι το αναμενόμενο.",
  "The count climbs with your milk over the first days.":
    "Ο αριθμός ανεβαίνει μαζί με το γάλα σας τις πρώτες μέρες.",
  "The count climbs with your milk over the first days, reaching six or more by day five.":
    "Ο αριθμός ανεβαίνει μαζί με το γάλα σας τις πρώτες μέρες και φτάνει τις έξι ή περισσότερες ως την πέμπτη μέρα.",
  "AAP and NHS both put six or more heavy wet nappies a day as the mark of a baby getting enough.":
    "AAP και NHS δίνουν έξι ή περισσότερες βαριές πάνες με τσίσα τη μέρα ως το σημάδι ότι το μωρό παίρνει αρκετό γάλα.",
  "From about day four, at least two soft yellow poos a day is usual for the first weeks.":
    "Από την τέταρτη μέρα περίπου, τουλάχιστον δύο μαλακά κίτρινα κακά τη μέρα είναι τα συνηθισμένα για τις πρώτες εβδομάδες.",
  "After about six weeks a gap of days between poos is ordinary, as long as feeding and weight are fine.":
    "Μετά τις έξι εβδομάδες περίπου, κενό ημερών ανάμεσα στα κακά είναι συνηθισμένο, αρκεί το τάισμα και το βάρος να πηγαίνουν καλά.",
  "Fourteen to seventeen hours a day, in stretches of every length, is usual under three months.":
    "Δεκατέσσερις έως δεκαεπτά ώρες τη μέρα, σε διαστήματα κάθε μεγέθους, είναι τα συνηθισμένα κάτω από τους τρεις μήνες.",
  "Fourteen to seventeen hours a day is the usual span under three months — and a day logged in pieces rarely adds up to all of it.":
    "Δεκατέσσερις έως δεκαεπτά ώρες τη μέρα είναι το συνηθισμένο εύρος κάτω από τους τρεις μήνες — και μια μέρα καταγεγραμμένη κομματιαστά σπάνια τις πιάνει όλες.",
  "Twelve to sixteen hours a day, naps included, is usual at this age.":
    "Δώδεκα έως δεκαέξι ώρες τη μέρα, μαζί με τους μεσημεριανούς, είναι τα συνηθισμένα σε αυτή την ηλικία.",
  "Twelve to sixteen hours a day, naps included, is the usual span at this age.":
    "Δώδεκα έως δεκαέξι ώρες τη μέρα, μαζί με τους μεσημεριανούς, είναι το συνηθισμένο εύρος σε αυτή την ηλικία.",

  // --- Rhythm ---
  "Rhythm": "Ρυθμός",
  "{name}’s rhythm": "Ο ρυθμός: {name}",
  "Right every one of the last {n} times.": "Σωστό και τις {n} τελευταίες φορές.",
  "Right {hits} of the last {n} — {name} is changing rhythm.": "Σωστό {hits} στις {n} τελευταίες — {name} αλλάζει ρυθμό.",
  "Right {hits} of the last {n} times, on the minute.": "Σωστό {hits} στις {n} τελευταίες φορές, στο λεπτό.",
  "Right {hits} of the last {n} times, within {miss} minutes.": "Σωστό {hits} στις {n} τελευταίες φορές, με απόκλιση {miss} λεπτά.",
  "Share this run as a picture": "Μοιράσου το σερί σαν εικόνα",

  // --- Daily routines ---
  "Still to do today": "Μένουν για σήμερα",
  "{done} of {total} done": "{done} από {total} έγιναν",
  "Mark {name} as done": "Σημείωσε το «{name}» ως έγινε",
  "Today’s routine": "Η ρουτίνα της ημέρας",

  // --- Day band ---
  "Last 24 hours": "Τελευταίο 24ωρο",
  "24-hour overview": "Εικόνα 24ώρου",
  "Health": "Υγεία",

  // --- Today: leftovers the screenshot caught ---
  "Change": "Αλλαγή",
  "Past": "Πριν",
  "{duration} ago": "πριν {duration}",
  "On this phone only": "Μόνο σε αυτό το κινητό",
  "Synced to the cloud": "Συγχρονισμένο στο cloud",
  "Syncing…": "Συγχρονίζεται…",
  "Offline — will catch up": "Εκτός σύνδεσης — θα προλάβει μετά",
  "Sync disconnected — tap to fix": "Ο συγχρονισμός κόπηκε — πάτησε για διόρθωση",
  "A few more feeds and the pattern appears.": "Λίγα ταΐσματα ακόμα και φαίνεται το μοτίβο.",
  "A few more sleeps and the pattern appears.": "Λίγοι ύπνοι ακόμα και φαίνεται το μοτίβο.",

  // --- Consent ---
  "Numalog would like to count anonymous page views to see which parts get used. Nothing about your baby is ever sent — those entries stay on this device unless you turn on Family Sync.":
    "Το Numalog θα ήθελε να μετράει ανώνυμες προβολές σελίδων, για να βλέπουμε ποια κομμάτια χρησιμοποιούνται. Τίποτα για το μωρό σας δεν αποστέλλεται ποτέ — οι καταχωρίσεις μένουν σε αυτή τη συσκευή, εκτός αν ενεργοποιήσετε το Family Sync.",
  "No thanks": "Όχι, ευχαριστώ",
  "Allow": "Επιτρέπεται",
  "Cookie choice": "Επιλογή cookies",
};

export default el;
