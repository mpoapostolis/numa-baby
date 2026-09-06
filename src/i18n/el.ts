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
  "Tell another parent": "Πείτε το σε άλλον γονιό",
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
  "Diapers come when they come — check whenever something seems off.": "Οι πάνες έρχονται όποτε έρθουν — ελέγξτε όποτε κάτι δεν σας κάθεται καλά.",
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
  "Share last night as a picture": "Μοιραστείτε τη νύχτα σαν εικόνα",
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
  "Share {what} as a picture": "Μοιραστείτε το «{what}» σαν εικόνα",
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
  "Share this run as a picture": "Μοιραστείτε το σερί σαν εικόνα",

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

  // --- Entry titles & details ---
  "Growth check": "Μέτρηση ανάπτυξης",
  "Temperature": "Θερμοκρασία",
  "Solid food": "Στερεά τροφή",
  "Daily routine": "Καθημερινή ρουτίνα",
  "Wet diaper": "Πάνα με τσίσα",
  "Dirty diaper": "Πάνα με κακά",
  "Wet + dirty diaper": "Πάνα — τσίσα και κακά",
  "Wet + dirty": "Τσίσα + κακά",
  "Entry": "Καταχώριση",
  "Both sides": "Και οι δύο πλευρές",
  "Left side": "Αριστερή πλευρά",
  "Right side": "Δεξιά πλευρά",
  "Note": "Σημείωση",
  "{value} long": "μήκος {value}",
  "{value} head": "κεφάλι {value}",

  // --- Store toasts ---
  "Could not save on this device. Nothing was changed.": "Δεν έγινε αποθήκευση σε αυτή τη συσκευή. Τίποτα δεν άλλαξε.",
  "Storage was full — an older recovery copy was removed to make room.": "Ο χώρος γέμισε — αφαιρέθηκε ένα παλιότερο αντίγραφο ανάκτησης για να χωρέσει.",
  "Last change undone": "Η τελευταία αλλαγή αναιρέθηκε",
  "Entry removed": "Η καταχώριση αφαιρέθηκε",
  "Entry restored": "Η καταχώριση επανήλθε",
  "Timer discarded — nothing was added to the log": "Το χρονόμετρο απορρίφθηκε — δεν προστέθηκε τίποτα",
  "{what} saved — {duration}": "{what}: αποθηκεύτηκε — {duration}",
  "Another {what} is already running — stop that one first.": "Τρέχει ήδη άλλο {what} — σταμάτησε πρώτα εκείνο.",
  "Timer resumed": "Το χρονόμετρο συνεχίζει",
  "Nursing session": "Συνεδρία θηλασμού",
  "Session": "Συνεδρία",
  "nursing timer": "χρονόμετρο θηλασμού",
  "sleep timer": "χρονόμετρο ύπνου",
  "burping timer": "χρονόμετρο ρεψίματος",
  "timer": "χρονόμετρο",
  "This {what} has been running for {duration}. That is usually a timer left on by mistake.":
    "Αυτό το {what} τρέχει εδώ και {duration}. Συνήθως είναι χρονόμετρο που ξεχάστηκε ανοιχτό.",
  "OK saves it as a {duration} session. Cancel discards it.":
    "Το ΟΚ το αποθηκεύει ως συνεδρία {duration}. Το Άκυρο το πετάει.",
  "{what} reminders off": "Υπενθυμίσεις: {what} — κλειστές",
  "{what} reminders on": "Υπενθυμίσεις: {what} — ανοιχτές",
  "Nappy": "Πάνα",
  "Notifications are not supported in this browser": "Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις",
  "Notifications were not enabled. You can allow them in browser settings.": "Οι ειδοποιήσεις δεν ενεργοποιήθηκαν. Μπορείς να τις επιτρέψεις από τις ρυθμίσεις του browser.",
  "Recovery data is unavailable in this browser": "Τα δεδομένα ανάκτησης δεν είναι διαθέσιμα σε αυτόν τον browser",
  "Local copy reset. Start with a clean tracker.": "Το τοπικό αντίγραφο μηδενίστηκε. Καθαρή αρχή.",
  "This browser is still blocking local storage": "Ο browser εξακολουθεί να μπλοκάρει την τοπική αποθήκευση",
  "That backup could not be read": "Αυτό το αντίγραφο δεν διαβάζεται",
  "That backup is too large to import safely": "Αυτό το αντίγραφο είναι πολύ μεγάλο για ασφαλή εισαγωγή",
  "That backup could not be opened": "Αυτό το αντίγραφο δεν άνοιξε",
  "Everything erased. Starting fresh.": "Όλα σβήστηκαν. Ξεκινάμε από την αρχή.",
  "This browser blocked the erase. Nothing was changed.": "Ο browser μπλόκαρε το σβήσιμο. Τίποτα δεν άλλαξε.",

  // --- Forms (LogSheet & fields) ---
  "Quick log": "Γρήγορη καταχώριση",
  "Record the amount now; adjust details only if needed.": "Γράψε την ποσότητα τώρα· λεπτομέρειες μόνο αν χρειάζεται.",
  "Log a nursing session": "Κατάγραψε θηλασμό",
  "Start a live timer or add a completed session.": "Ξεκίνα χρονόμετρο ή πρόσθεσε συνεδρία που τελείωσε.",
  "Log a dose": "Κατάγραψε δόση",
  "So the next person knows it has already been given.": "Για να ξέρει ο επόμενος ότι έχει ήδη δοθεί.",
  "Past sleep": "Ύπνος που πέρασε",
  "Add a sleep": "Πρόσθεσε ύπνο",
  "Log a food": "Κατάγραψε φαγητό",
  "What went in, and roughly when — tastes count.": "Τι μπήκε, και περίπου πότε — και οι γεύσεις μετράνε.",
  "Choose the closest match and save.": "Διάλεξε το κοντινότερο και αποθήκευσε.",
  "Weight now, length and head if you have them.": "Βάρος τώρα· μήκος και κεφάλι αν τα έχεις.",
  "Health log": "Καταγραφή υγείας",
  "Keep a time-stamped note you can refer back to.": "Κράτα σημείωση με ώρα, να τη βρίσκεις μετά.",
  "Edit log": "Επεξεργασία",
  "Keep it personal": "Κάντε το δικό σας",
  "Baby profile": "Προφίλ μωρού",
  "Personalises your tracker — shared only with the phones in your Family Sync.": "Προσωποποιεί την εφαρμογή — μοιράζεται μόνο με τα κινητά του Family Sync σας.",
  "Amount": "Ποσότητα",
  "Entry method": "Τρόπος καταχώρισης",
  "Side": "Πλευρά",
  "Diaper type": "Τύπος πάνας",
  "Fell asleep": "Κοιμήθηκε",
  "Woke up": "Ξύπνησε",
  "Or type a new one": "Ή γράψε καινούργιο",
  "What was given": "Τι δόθηκε",
  "What did they eat?": "Τι έφαγε;",
  "Which medicine was it?": "Ποιο φάρμακο ήταν;",
  "Name": "Όνομα",
  "Date of birth": "Ημερομηνία γέννησης",
  "Girl or boy": "Κορίτσι ή αγόρι",
  "How are you feeding?": "Πώς ταΐζετε;",
  "Used only for the growth guide’s reference ranges.": "Χρησιμοποιείται μόνο για τα εύρη αναφοράς του οδηγού ανάπτυξης.",
  "This changes which quick actions are shown.": "Αλλάζει ποιες γρήγορες ενέργειες εμφανίζονται.",
  "Vitamin D drops, paracetamol…": "Σταγόνες βιταμίνης D, παρακεταμόλη…",
  "Banana, carrot purée, rice cereal…": "Μπανάνα, πουρές καρότο, κρέμα ρυζιού…",
  "How it went — loved it, spat it out, small rash…": "Πώς πήγε — το λάτρεψε, το έφτυσε, μικρό εξανθηματάκι…",
  "Clinic, home scale, or anything useful": "Ιατρείο, ζυγαριά σπιτιού, ή ό,τι φανεί χρήσιμο",
  "Medicine, spit-up, rash, question for the doctor…": "Φάρμακο, ξέρασμα, εξάνθημα, ερώτηση για τον γιατρό…",
  "Baby’s name": "Το όνομα του μωρού",
  "Formula": "Φόρμουλα",
  "Breast milk": "Μητρικό γάλα",
  "Girl": "Κορίτσι",
  "Boy": "Αγόρι",
  "Skip": "Παράλειψη",
  "Save {amount} {unit}": "Αποθήκευση {amount} {unit}",
  "Save session": "Αποθήκευση συνεδρίας",
  "Save sleep": "Αποθήκευση ύπνου",
  "Save dose": "Αποθήκευση δόσης",
  "Save food": "Αποθήκευση φαγητού",
  "Save wet diaper": "Αποθήκευση — τσίσα",
  "Save dirty diaper": "Αποθήκευση — κακά",
  "Save wet + dirty diaper": "Αποθήκευση — τσίσα και κακά",
  "Save growth check": "Αποθήκευση μέτρησης",
  "Save health log": "Αποθήκευση σημείωσης",
  "Save changes": "Αποθήκευση αλλαγών",
  "Save profile": "Αποθήκευση προφίλ",
  "Sleep saved": "Ο ύπνος αποθηκεύτηκε",
  "{what} logged": "Καταχωρήθηκε: {what}",
  "Health note saved": "Η σημείωση αποθηκεύτηκε",
  "Temperature saved": "Η θερμοκρασία αποθηκεύτηκε",
  "When": "Πότε",
  "How long ago": "Πριν πόση ώρα",
  "Now": "Τώρα",
  "15m ago": "πριν 15λ",
  "30m ago": "πριν 30λ",
  "1h ago": "πριν 1ω",
  "15 minutes ago": "πριν 15 λεπτά",
  "30 minutes ago": "πριν 30 λεπτά",
  "1 hour ago": "πριν 1 ώρα",
  "Anything worth remembering": "Ό,τι αξίζει να θυμάστε",
  // ——— Settings screen ———
  "Device & data": "Συσκευή και δεδομένα",
  "Profile, privacy and backups in one place.": "Προφίλ, απόρρητο και αντίγραφα ασφαλείας σε ένα μέρος.",
  "Choose the theme that is easiest on your eyes.": "Διαλέξτε το θέμα που ξεκουράζει τα μάτια σας.",
  "Application appearance": "Εμφάνιση εφαρμογής",
  "Measurement units": "Μονάδες μέτρησης",
  "Metric": "Μετρικές",
  "US": "ΗΠΑ",
  "The details used to personalise your tracker.": "Τα στοιχεία που κάνουν την εφαρμογή δική σας.",
  "Baby profile settings": "Ρυθμίσεις προφίλ μωρού",
  "Breastfeeding": "Θηλασμός",
  "Bottle feeding": "Μπιμπερό",
  "Mixed feeding": "Μικτή διατροφή",
  "Every day": "Κάθε μέρα",
  "Vitamin drops, a medicine — the things whose difficulty is remembering whether they were done. They wait on Today until every one is ticked, then the card is gone until tomorrow. Ticks reach the other parent, so nobody has to guess whether it was already given.":
    "Σταγόνες βιταμίνης, ένα φάρμακο — αυτά που το δύσκολο είναι να θυμάστε αν έγιναν. Περιμένουν στο Σήμερα μέχρι να τσεκαριστούν όλα, και μετά η κάρτα φεύγει μέχρι αύριο. Τα τικ φτάνουν και στον άλλο γονιό, ώστε κανείς να μη μαντεύει αν δόθηκε ήδη.",
  "{label} is already on the list.": "{label} υπάρχει ήδη στη λίστα.",
  "That needs some words.": "Γράψτε κάτι πρώτα.",
  "Remove {label}": "Αφαίρεση: {label}",
  "That is as many as fit": "Τόσα χωράνε",
  "Vitamin D": "Βιταμίνη D",
  "Add something to do every day": "Προσθήκη σε ό,τι γίνεται κάθε μέρα",
  "Nothing yet, so nothing appears on Today.": "Τίποτα ακόμη, οπότε τίποτα δεν εμφανίζεται στο Σήμερα.",
  "Six is the limit — a list nobody finishes is a card that never goes away.": "Έξι είναι το όριο — μια λίστα που δεν τελειώνει ποτέ είναι μια κάρτα που δεν φεύγει ποτέ.",
  "Care reminders": "Υπενθυμίσεις φροντίδας",
  "These now arrive with the app closed. Still a nudge and not an alarm — follow your baby’s cues and your clinician’s care plan.":
    "Έρχονται πλέον και με την εφαρμογή κλειστή. Παραμένουν υπενθύμιση, όχι ξυπνητήρι — ακολουθήστε τα σημάδια του μωρού σας και τις οδηγίες του γιατρού σας.",
  "Care reminder settings": "Ρυθμίσεις υπενθυμίσεων φροντίδας",
  "Feed reminder": "Υπενθύμιση ταΐσματος",
  "Diaper reminder": "Υπενθύμιση πάνας",
  "This browser can’t show notifications": "Αυτό το πρόγραμμα δεν εμφανίζει ειδοποιήσεις",
  "Blocked in browser settings": "Αποκλεισμένο στις ρυθμίσεις του προγράμματος",
  "Around {time}, if this app is still open": "Γύρω στις {time}, αν η εφαρμογή είναι ακόμη ανοιχτή",
  "Prompt after the next feed you log": "Ξεκινά μετά το επόμενο τάισμα που θα καταχωρίσετε",
  "Prompt after the next change you log": "Ξεκινά μετά την επόμενη αλλαγή που θα καταχωρίσετε",
  "Use feed reminders": "Χρήση υπενθυμίσεων ταΐσματος",
  "Use diaper reminders": "Χρήση υπενθυμίσεων πάνας",
  "Remind after": "Υπενθύμιση μετά από",
  "Feed reminder interval": "Διάστημα υπενθύμισης ταΐσματος",
  "Diaper reminder interval": "Διάστημα υπενθύμισης πάνας",
  "90 min": "90 λεπτά",
  "2 hours": "2 ώρες",
  "3 hours": "3 ώρες",
  "4 hours": "4 ώρες",
  "Follow your baby’s cues and clinician’s care plan.": "Ακολουθήστε τα σημάδια του μωρού σας και τις οδηγίες του γιατρού σας.",
  "A nudge, not a schedule — check whenever your baby seems uncomfortable.": "Υπενθύμιση, όχι πρόγραμμα — ελέγξτε όποτε το μωρό δείχνει ενοχλημένο.",
  "Your data": "Τα δεδομένα σας",
  "Portable backups you own and control.": "Αντίγραφα ασφαλείας που σας ανήκουν και ελέγχετε εσείς.",
  "Backup actions": "Ενέργειες αντιγράφων ασφαλείας",
  "Share with partner": "Μοιραστείτε με τον σύντροφό σας",
  "Sends your whole log as a file — their app merges it, nothing gets replaced": "Στέλνει όλο το ημερολόγιο ως αρχείο — η εφαρμογή του το συγχωνεύει, τίποτα δεν αντικαθίσταται",
  "Download backup": "Λήψη αντιγράφου ασφαλείας",
  "Saves a file with all your entries — keep it in a synced folder to be safe": "Αποθηκεύει ένα αρχείο με όλες τις καταχωρίσεις — φυλάξτε το σε συγχρονισμένο φάκελο για σιγουριά",
  "Restore a backup": "Επαναφορά αντιγράφου",
  "Merges a backup file from any device": "Συγχωνεύει ένα αρχείο αντιγράφου από οποιαδήποτε συσκευή",
  "Share Numalog — free, no sign-up, works on any phone": "Μοιραστείτε το Numalog — δωρεάν, χωρίς εγγραφή, παίζει σε κάθε κινητό",
  "Bring a log from {origin}": "Μεταφορά ημερολογίου από {origin}",
  "Copies your entries across from the app's other web address — nothing is uploaded": "Αντιγράφει τις καταχωρίσεις από την άλλη διεύθυνση της εφαρμογής — τίποτα δεν ανεβαίνει",
  "Erase everything and start over": "Διαγραφή όλων και νέα αρχή",
  "Deletes every entry on this device — download a backup first": "Διαγράφει κάθε καταχώριση σε αυτή τη συσκευή — κατεβάστε πρώτα αντίγραφο ασφαλείας",
  "Usage statistics": "Στατιστικά χρήσης",
  "Anonymous page counts, so I can see which parts of the app get used. Never your baby’s entries. You can change this whenever you like.":
    "Ανώνυμες μετρήσεις σελίδων, για να βλέπω ποια μέρη της εφαρμογής χρησιμοποιούνται. Ποτέ οι καταχωρίσεις του μωρού σας. Το αλλάζετε όποτε θέλετε.",
  "Allowed": "Επιτρέπεται",
  "Off": "Όχι",
  "Shared with your family": "Κοινό με την οικογένειά σας",
  "Entries are stored in your family’s space in the cloud so both phones stay in step. Anonymous usage statistics help improve the app.":
    "Οι καταχωρίσεις φυλάσσονται στον χώρο της οικογένειάς σας στο cloud ώστε τα δύο κινητά να μένουν συγχρονισμένα. Ανώνυμα στατιστικά χρήσης βοηθούν στη βελτίωση της εφαρμογής.",
  "On this device": "Σε αυτή τη συσκευή",
  "Your baby’s entries stay in this browser until you turn on Family Sync. Anonymous usage statistics help improve the app.":
    "Οι καταχωρίσεις του μωρού σας μένουν σε αυτό το πρόγραμμα μέχρι να ενεργοποιήσετε το Family Sync. Ανώνυμα στατιστικά χρήσης βοηθούν στη βελτίωση της εφαρμογής.",
  "Numalog is a tracking tool and general information — not a medical device, and nothing in it is medical advice. For anything about your baby, your paediatrician, midwife or health visitor comes first.":
    "Το Numalog είναι εργαλείο καταγραφής και γενικές πληροφορίες — όχι ιατρική συσκευή, και τίποτα μέσα του δεν αποτελεί ιατρική συμβουλή. Για οτιδήποτε αφορά το μωρό σας, προηγείται ο παιδίατρος ή η μαία σας.",
  // ——— Banners: reminders, backup, night help, news ———
  "Reminders now ring with the app closed": "Οι υπενθυμίσεις πλέον χτυπούν και με την εφαρμογή κλειστή",
  "They used to be a timer inside this page, so closing the app silenced them. Now they arrive whether or not it is open. Your phone will ask you to allow notifications.":
    "Παλιά ήταν ένα χρονόμετρο μέσα στη σελίδα, οπότε κλείνοντας την εφαρμογή σώπαιναν. Τώρα φτάνουν είτε είναι ανοιχτή είτε όχι. Το κινητό σας θα ζητήσει να επιτρέψετε τις ειδοποιήσεις.",
  "Reminders can ring with the app closed": "Οι υπενθυμίσεις μπορούν να χτυπούν και με την εφαρμογή κλειστή",
  "You have already allowed notifications. Switching the feed reminder on is the only step left.":
    "Έχετε ήδη επιτρέψει τις ειδοποιήσεις. Το μόνο βήμα που απομένει είναι να ανάψετε την υπενθύμιση ταΐσματος.",
  "Turn on reminders": "Ενεργοποίηση υπενθυμίσεων",
  "This browser may delete your log": "Αυτό το πρόγραμμα μπορεί να διαγράψει το ημερολόγιό σας",
  "It has not promised to keep it. Clearing site data, or the phone running low on space, would take every entry with it. A backup file or Family Sync fixes that for good.":
    "Δεν έχει υποσχεθεί ότι θα το κρατήσει. Ένα καθάρισμα των δεδομένων του ιστότοπου, ή ένα κινητό που ξεμένει από χώρο, θα έπαιρνε μαζί του κάθε καταχώριση. Ένα αρχείο αντιγράφου ή το Family Sync το λύνει οριστικά.",
  "{n} entries, on this phone only": "{n} καταχωρίσεις, μόνο σε αυτό το κινητό",
  "There is no copy of them anywhere else. If this phone breaks or the browser is cleared, they go with it.":
    "Δεν υπάρχει αντίγραφό τους πουθενά αλλού. Αν το κινητό χαλάσει ή καθαριστούν τα δεδομένα, χάνονται μαζί του.",
  "Your last backup is over a month old. Everything since then exists only here.":
    "Το τελευταίο σας αντίγραφο είναι πάνω από μήνα παλιό. Ό,τι έγινε από τότε υπάρχει μόνο εδώ.",
  "Download a backup": "Λήψη αντιγράφου ασφαλείας",
  "You have done a few of these alone": "Έχετε βγάλει μερικά από αυτά μόνοι σας",
  "The other parent’s phone can hold the same log — so whoever wakes up next already knows when {who} last fed, without asking you.":
    "Το κινητό του άλλου γονιού μπορεί να έχει το ίδιο ημερολόγιο — ώστε όποιος ξυπνήσει μετά να ξέρει ήδη πότε έφαγε τελευταία φορά {who}, χωρίς να σας ρωτήσει.",
  "Add their phone": "Προσθήκη του άλλου κινητού",
  "What’s new": "Τι νέο υπάρχει",
  "Every update and announcement, from the dad who builds this": "Κάθε ενημέρωση και ανακοίνωση, από τον μπαμπά που το φτιάχνει",
  // ——— Family Sync card ———
  "Offline — will catch up on its own when you're back": "Εκτός σύνδεσης — θα συνεχίσει μόνο του όταν επιστρέψετε",
  "Reconnect needed — ask the other phone for a fresh code": "Χρειάζεται επανασύνδεση — ζητήστε νέο κωδικό από το άλλο κινητό",
  "Backing up 1 entry to the cloud · synced {time}": "1 καταχώριση στο cloud · συγχρονίστηκε {time}",
  "Backing up {n} entries to the cloud · synced {time}": "{n} καταχωρίσεις στο cloud · συγχρονίστηκε {time}",
  "Waiting for the first sync": "Αναμονή για τον πρώτο συγχρονισμό",
  "{name}’s tracker": "Ημερολόγιο: {name}",
  "This phone": "Αυτό το κινητό",
  "Sign out every other phone? They will each need a fresh invite code to come back.":
    "Αποσύνδεση όλων των άλλων κινητών; Καθένα θα χρειαστεί νέο κωδικό πρόσκλησης για να επιστρέψει.",
  "Remove this phone from the family? It keeps its own data but stops syncing.":
    "Αφαίρεση αυτού του κινητού από την οικογένεια; Κρατά τα δεδομένα του αλλά σταματά να συγχρονίζεται.",
  "Leave Family Sync? This phone keeps its data but stops syncing.":
    "Έξοδος από το Family Sync; Αυτό το κινητό κρατά τα δεδομένα του αλλά σταματά να συγχρονίζεται.",
  "Both phones see the same log, automatically.": "Και τα δύο κινητά βλέπουν το ίδιο ημερολόγιο, αυτόματα.",
  "Right now your log lives on this phone only. Sync it to keep it safe in the cloud and share it with a partner.":
    "Αυτή τη στιγμή το ημερολόγιό σας ζει μόνο σε αυτό το κινητό. Συγχρονίστε το για να είναι ασφαλές στο cloud και να το μοιράζεστε με τον σύντροφό σας.",
  "This phone is already in a family, so the scanned code was not used. To join the other family instead, leave this one below first, then scan the code again.":
    "Αυτό το κινητό είναι ήδη σε οικογένεια, οπότε ο κωδικός που σαρώθηκε δεν χρησιμοποιήθηκε. Για να μπείτε στην άλλη οικογένεια, βγείτε πρώτα από αυτήν παρακάτω και σαρώστε ξανά τον κωδικό.",
  "Create family": "Δημιουργία οικογένειας",
  "Join with a code": "Είσοδος με κωδικό",
  "Code from the other phone": "Ο κωδικός από το άλλο κινητό",
  "Join": "Είσοδος",
  "Back": "Πίσω",
  "Scan this with the other phone": "Σαρώστε το με το άλλο κινητό",
  "QR code containing the invite code {code}": "Κωδικός QR με τον κωδικό πρόσκλησης {code}",
  "Open the camera on the other phone and point it here. No app to install.":
    "Ανοίξτε την κάμερα στο άλλο κινητό και στρέψτε την εδώ. Καμία εφαρμογή για εγκατάσταση.",
  "Or type this code": "Ή πληκτρολογήστε αυτόν τον κωδικό",
  "Valid for 15 minutes · single use": "Ισχύει για 15 λεπτά · μίας χρήσης",
  "Paired! Both phones are syncing.": "Συνδέθηκαν! Και τα δύο κινητά συγχρονίζονται.",
  "Waiting for the other phone…": "Αναμονή για το άλλο κινητό…",
  "Join {name}’s log in Numalog — open this on your phone, it works for 15 minutes: {link}":
    "Μπείτε στο ημερολόγιο του μωρού {name} στο Numalog — ανοίξτε το στο κινητό σας, ισχύει για 15 λεπτά: {link}",
  "Join our baby’s log in Numalog — open this on your phone, it works for 15 minutes: {link}":
    "Μπείτε στο ημερολόγιο του μωρού μας στο Numalog — ανοίξτε το στο κινητό σας, ισχύει για 15 λεπτά: {link}",
  "Join our baby’s log": "Το ημερολόγιο του μωρού μας",
  "Invite copied — send it to the other phone.": "Η πρόσκληση αντιγράφηκε — στείλτε την στο άλλο κινητό.",
  "Send the other phone this code: {code}": "Στείλτε στο άλλο κινητό αυτόν τον κωδικό: {code}",
  "Send the link": "Αποστολή συνδέσμου",
  "New code": "Νέος κωδικός",
  "Family Sync on": "Family Sync ενεργό",
  "just this phone": "μόνο αυτό το κινητό",
  "{n} phones": "{n} κινητά",
  "In step with the cloud — everything sent and received.": "Σε βήμα με το cloud — όλα στάλθηκαν και παραλήφθηκαν.",
  "Could not finish a full sync — check the connection and try again.": "Ο συγχρονισμός δεν ολοκληρώθηκε — ελέγξτε τη σύνδεση και δοκιμάστε ξανά.",
  "Sync now": "Συγχρονισμός τώρα",
  "Show invite code": "Εμφάνιση κωδικού πρόσκλησης",
  "Leave family": "Έξοδος από την οικογένεια",
  "Phones in this family": "Κινητά σε αυτή την οικογένεια",
  "A phone": "Ένα κινητό",
  "this one": "αυτό εδώ",
  "last synced {when}": "τελευταίος συγχρονισμός {when}",
  "joined {when}": "μπήκε {when}",
  "Remove": "Αφαίρεση",
  "Lost a phone? Sign out all the others": "Χάσατε κινητό; Αποσυνδέστε όλα τα άλλα",
  // ——— Install guide ———
  "Install the app": "Εγκατάσταση της εφαρμογής",
  "Install on this phone": "Εγκατάσταση σε αυτό το κινητό",
  "Home-screen icon, full screen, works offline — and your log is safest there":
    "Εικονίδιο στην αρχική οθόνη, πλήρης οθόνη, λειτουργεί εκτός σύνδεσης — και το ημερολόγιό σας είναι πιο ασφαλές εκεί",
  "First, leave the {name} browser": "Πρώτα, βγείτε από το πρόγραμμα του {name}",
  "Two taps away": "Δύο πατήματα δρόμος",
  "You’re inside {name}’s built-in browser, which can’t install apps — and worse, it keeps your entries inside its own storage. Tap the":
    "Είστε μέσα στο ενσωματωμένο πρόγραμμα περιήγησης του {name}, που δεν μπορεί να εγκαταστήσει εφαρμογές — και το χειρότερο, κρατά τις καταχωρίσεις σας στον δικό του χώρο. Πατήστε το μενού",
  "menu in the corner and choose": "στη γωνία και επιλέξτε",
  "Open in browser": "Άνοιγμα σε πρόγραμμα περιήγησης",
  "(or copy the link below and paste it into Safari or Chrome), then install from there.":
    "(ή αντιγράψτε τον σύνδεσμο παρακάτω και επικολλήστε τον στο Safari ή στο Chrome), και εγκαταστήστε από εκεί.",
  "Below, tap the Share button": "Κάτω, πατήστε το κουμπί Κοινοποίηση",
  ", then choose": ", και μετά επιλέξτε",
  "Add to Home Screen": "Προσθήκη στην αρχική οθόνη",
  "That’s the whole install — full screen, offline, and your log is safest there.":
    "Αυτή είναι όλη η εγκατάσταση — πλήρης οθόνη, εκτός σύνδεσης, και το ημερολόγιό σας πιο ασφαλές εκεί.",
  "On an iPhone or iPad the install lives in Safari: open numalog.app there and tap the Share button":
    "Σε iPhone ή iPad η εγκατάσταση γίνεται από το Safari: ανοίξτε εκεί το numalog.app και πατήστε το κουμπί Κοινοποίηση",
  ", then": ", και μετά",
  "Open your browser’s menu and look for": "Ανοίξτε το μενού του προγράμματος περιήγησης και ψάξτε για",
  "Install app": "Εγκατάσταση εφαρμογής",
  "or": "ή",
  "Once installed it opens full screen, works offline, and your log is safest there.":
    "Μετά την εγκατάσταση ανοίγει σε πλήρη οθόνη, λειτουργεί εκτός σύνδεσης, και το ημερολόγιό σας είναι πιο ασφαλές εκεί.",
  "Link copied — paste it in Safari or Chrome": "Ο σύνδεσμος αντιγράφηκε — επικολλήστε τον στο Safari ή στο Chrome",
  "Copy the app’s link": "Αντιγραφή του συνδέσμου της εφαρμογής",

  // ——— Feedback ———
  "Need anything?": "Χρειάζεστε κάτι;",
  "Something broken, missing, or just annoying? It goes straight to the person who built this — two tired parents, evenings, between feeds.":
    "Κάτι χαλασμένο, κάτι που λείπει, ή απλώς κάτι ενοχλητικό; Πάει κατευθείαν στον άνθρωπο που το έφτιαξε — δύο κουρασμένοι γονείς, τα βράδια, ανάμεσα στα ταΐσματα.",
  "Sent — thank you. Genuinely. Most messages arrive without a way to reply, so the answer comes as an update: keep an eye on News (the 📰 up top) to see what happened with yours.":
    "Στάλθηκε — ευχαριστώ. Ειλικρινά. Τα περισσότερα μηνύματα φτάνουν χωρίς τρόπο απάντησης, οπότε η απάντηση έρχεται ως ενημέρωση: ρίχνετε μια ματιά στα Νέα (το 📰 πάνω) για να δείτε τι έγινε με το δικό σας.",
  "Your message": "Το μήνυμά σας",
  "What would make this better?": "Τι θα το έκανε καλύτερο;",
  "only if you want a reply": "μόνο αν θέλετε απάντηση",
  "optional": "προαιρετικό",
  "That did not send — you may be offline. Your text is still here, try again.":
    "Δεν στάλθηκε — ίσως είστε εκτός σύνδεσης. Το κείμενό σας είναι ακόμη εδώ, δοκιμάστε ξανά.",
  "Sending…": "Αποστολή…",
  "Send": "Αποστολή",
  "Send feedback to the developer": "Στείλτε σχόλια στον δημιουργό",

  // ——— Tell another parent ———
  "A calm, free baby tracker — no account, no ads, works offline.":
    "Ένα ήρεμο, δωρεάν ημερολόγιο μωρού — χωρίς λογαριασμό, χωρίς διαφημίσεις, λειτουργεί εκτός σύνδεσης.",
  "A baby tracker you might like": "Ένα ημερολόγιο μωρού που ίσως σας αρέσει",
  "Numalog is free, needs no account and works on any phone — send it to someone in the thick of it.":
    "Το Numalog είναι δωρεάν, δεν χρειάζεται λογαριασμό και παίζει σε κάθε κινητό — στείλτε το σε κάποιον που είναι στα βαθιά.",
  "Link copied — send it however you like.": "Ο σύνδεσμος αντιγράφηκε — στείλτε τον όπως θέλετε.",
  "numalog.app — that's the whole link.": "numalog.app — αυτός είναι όλος ο σύνδεσμος.",
  "Copy link": "Αντιγραφή συνδέσμου",
  "More apps…": "Περισσότερες εφαρμογές…",
  // ——— Protect & restore (Google / email) ———
  "You’re offline — {what} needs the internet. Your entries are safe on this phone meanwhile; this will wake up by itself when you’re back.":
    "Είστε εκτός σύνδεσης — {what} χρειάζεται ίντερνετ. Οι καταχωρίσεις σας είναι ασφαλείς σε αυτό το κινητό στο μεταξύ· θα ξυπνήσει μόνο του όταν επιστρέψετε.",
  "protecting your log": "η προστασία του ημερολογίου σας",
  "restoring": "η επαναφορά",
  "Google’s sign-in could not load — an ad blocker or offline moment, probably. The email link below works regardless, and so does a backup file.":
    "Η σύνδεση της Google δεν φόρτωσε — μάλλον ad blocker ή στιγμή εκτός σύνδεσης. Ο σύνδεσμος μέσω email παρακάτω δουλεύει έτσι κι αλλιώς, όπως και ένα αρχείο αντιγράφου.",
  "Check your inbox — the link works once and expires in 15 minutes.":
    "Δείτε τα εισερχόμενά σας — ο σύνδεσμος δουλεύει μία φορά και λήγει σε 15 λεπτά.",
  "Email address": "Διεύθυνση email",
  "Protected — a lost phone can be recovered with": "Προστατευμένο — ένα χαμένο κινητό μπορεί να ανακτηθεί με το",
  "Last time you used": "Την τελευταία φορά χρησιμοποιήσατε το",
  "…or with any email address:": "…ή με οποιαδήποτε διεύθυνση email:",
  "Send link": "Αποστολή συνδέσμου",
  "Protect my log": "Προστασία του ημερολογίου μου",
  "One tap guards your whole log: a lost or wiped phone can get everything back. Works with Google or any email address — and nothing from your log is ever shared with anyone. The guard is optional and removable.":
    "Ένα πάτημα προστατεύει όλο το ημερολόγιο: ένα χαμένο ή σβησμένο κινητό μπορεί να τα πάρει όλα πίσω. Δουλεύει με Google ή με οποιοδήποτε email — και τίποτα από το ημερολόγιό σας δεν κοινοποιείται ποτέ σε κανέναν. Η προστασία είναι προαιρετική και αφαιρείται.",
  "This phone has 1 entry of its own": "Αυτό το κινητό έχει 1 δική του καταχώριση",
  "This phone has {n} entries of its own": "Αυτό το κινητό έχει {n} δικές του καταχωρίσεις",
  "Your account’s log lives in the cloud. Choose what happens to the entries on this phone — nothing in the cloud is deleted either way.":
    "Το ημερολόγιο του λογαριασμού σας ζει στο cloud. Διαλέξτε τι θα γίνει με τις καταχωρίσεις αυτού του κινητού — τίποτα στο cloud δεν διαγράφεται έτσι κι αλλιώς.",
  "Merge them into my cloud log": "Συγχώνευση με το ημερολόγιο στο cloud",
  "Take the cloud log only — discard these": "Μόνο το ημερολόγιο του cloud — απόρριψη αυτών",
  "No log is protected by that Google account — check which address you used, or restore a backup file instead.":
    "Κανένα ημερολόγιο δεν προστατεύεται από αυτόν τον λογαριασμό Google — ελέγξτε ποια διεύθυνση χρησιμοποιήσατε, ή επαναφέρετε ένα αρχείο αντιγράφου.",
  "Restore with Google or email": "Επαναφορά με Google ή email",
  "Email me a link": "Στείλτε μου σύνδεσμο",
  "If this address protects a log, the link is on its way — check your inbox. It works once and expires in 15 minutes.":
    "Αν αυτή η διεύθυνση προστατεύει ένα ημερολόγιο, ο σύνδεσμος είναι καθ’ οδόν — δείτε τα εισερχόμενα. Δουλεύει μία φορά και λήγει σε 15 λεπτά.",
  "Could not reach the server — check your connection and try again.":
    "Δεν ήταν δυνατή η επικοινωνία με τον διακομιστή — ελέγξτε τη σύνδεση και δοκιμάστε ξανά.",
  // ——— Protect intro, recovery link, join screen ———
  "Keep the log safe from day one": "Κρατήστε το ημερολόγιο ασφαλές από την πρώτη μέρα",
  "Your log can live in the cloud now": "Το ημερολόγιό σας μπορεί πλέον να ζει στο cloud",
  "Everything you log stays on this phone. If you like, sign in once with Google or any email and a new phone can get it all back — optional, free, removable, and nothing from your log is ever shared with anyone.":
    "Ό,τι καταγράφετε μένει σε αυτό το κινητό. Αν θέλετε, συνδεθείτε μία φορά με Google ή με οποιοδήποτε email και ένα νέο κινητό μπορεί να τα πάρει όλα πίσω — προαιρετικό, δωρεάν, αφαιρείται, και τίποτα από το ημερολόγιό σας δεν κοινοποιείται ποτέ σε κανέναν.",
  "Until today, everything lived only on this phone — a lost or wiped phone meant a lost history. Now, if you want, your log can also be protected in the cloud: sign in once with Google or any email, and any future phone can get everything back. Optional, free, removable — and nothing from your log is ever shared with anyone.":
    "Μέχρι σήμερα, όλα ζούσαν μόνο σε αυτό το κινητό — ένα χαμένο ή σβησμένο κινητό σήμαινε χαμένη ιστορία. Τώρα, αν θέλετε, το ημερολόγιό σας μπορεί να προστατεύεται και στο cloud: συνδεθείτε μία φορά με Google ή με οποιοδήποτε email, και κάθε μελλοντικό κινητό μπορεί να τα πάρει όλα πίσω. Προαιρετικό, δωρεάν, αφαιρείται — και τίποτα από το ημερολόγιό σας δεν κοινοποιείται ποτέ σε κανέναν.",
  "Two phones, one log: add the other parent and neither of you has to ask when the last feed was.":
    "Δύο κινητά, ένα ημερολόγιο: προσθέστε τον άλλο γονιό και κανείς σας δεν χρειάζεται να ρωτά πότε ήταν το τελευταίο τάισμα.",
  "Add the other parent’s phone": "Προσθήκη του κινητού του άλλου γονιού",
  "Maybe later — it lives in Settings": "Ίσως αργότερα — υπάρχει στις Ρυθμίσεις",
  "Restore your log on this phone?": "Επαναφορά του ημερολογίου σας σε αυτό το κινητό;",
  "Your recovery link brings your cloud log onto this phone. Nothing happens until you tap Restore — if this isn’t your phone, just close this.":
    "Ο σύνδεσμος ανάκτησης φέρνει το ημερολόγιό σας από το cloud σε αυτό το κινητό. Τίποτα δεν γίνεται μέχρι να πατήσετε Επαναφορά — αν αυτό δεν είναι το κινητό σας, απλώς κλείστε το.",
  "Restore my log here": "Επαναφορά του ημερολογίου μου εδώ",
  "Cancel — the link stays unused": "Άκυρο — ο σύνδεσμος μένει αχρησιμοποίητος",
  "Restore here? This phone has 1 entry of its own": "Επαναφορά εδώ; Αυτό το κινητό έχει 1 δική του καταχώριση",
  "Restore here? This phone has {n} entries of its own": "Επαναφορά εδώ; Αυτό το κινητό έχει {n} δικές του καταχωρίσεις",
  "Your recovery link brings your cloud log onto this phone. Choose what happens to the entries already here — nothing in the cloud is deleted either way.":
    "Ο σύνδεσμος ανάκτησης φέρνει το ημερολόγιό σας από το cloud σε αυτό το κινητό. Διαλέξτε τι θα γίνει με τις καταχωρίσεις που είναι ήδη εδώ — τίποτα στο cloud δεν διαγράφεται έτσι κι αλλιώς.",
  "Invite scanned": "Η πρόσκληση σαρώθηκε",
  "Join your family log": "Μπείτε στο οικογενειακό σας ημερολόγιο",
  "This phone will share one log with the phone that showed you the code — every feed, diaper and note, on both.":
    "Αυτό το κινητό θα μοιράζεται ένα ημερολόγιο με το κινητό που σας έδειξε τον κωδικό — κάθε τάισμα, πάνα και σημείωση, και στα δύο.",
  "The 1 entry already on this phone will be merged into the family log — nothing is deleted.":
    "Η 1 καταχώριση που είναι ήδη σε αυτό το κινητό θα συγχωνευτεί στο οικογενειακό ημερολόγιο — τίποτα δεν διαγράφεται.",
  "The {n} entries already on this phone will be merged into the family log — nothing is deleted.":
    "Οι {n} καταχωρίσεις που είναι ήδη σε αυτό το κινητό θα συγχωνευτούν στο οικογενειακό ημερολόγιο — τίποτα δεν διαγράφεται.",
  "The join did not go through — the code may have expired (codes from a partner’s phone last 15 minutes and work once), or this phone may be offline. Nothing changed; try again or ask for a fresh code.":
    "Η είσοδος δεν ολοκληρώθηκε — ο κωδικός μπορεί να έληξε (οι κωδικοί από το κινητό του συντρόφου ισχύουν 15 λεπτά και δουλεύουν μία φορά), ή αυτό το κινητό μπορεί να είναι εκτός σύνδεσης. Τίποτα δεν άλλαξε· δοκιμάστε ξανά ή ζητήστε νέο κωδικό.",
  "Joining…": "Είσοδος…",
  "Join the family": "Είσοδος στην οικογένεια",
  "Set this phone up on its own": "Ρύθμιση αυτού του κινητού μόνου του",
  // ——— In-app browser escape & news ———
  "You’re in {name}’s built-in browser.": "Είστε στο ενσωματωμένο πρόγραμμα περιήγησης του {name}.",
  "It can’t install the app, and it keeps your entries inside {name} — open this in Safari or Chrome so your baby’s log is safe. Tap":
    "Δεν μπορεί να εγκαταστήσει την εφαρμογή, και κρατά τις καταχωρίσεις σας μέσα στο {name} — ανοίξτε το στο Safari ή στο Chrome για να είναι ασφαλές το ημερολόγιο του μωρού σας. Πατήστε",
  ", or copy the link:": ", ή αντιγράψτε τον σύνδεσμο:",
  "Continue here anyway": "Συνέχεια εδώ ούτως ή άλλως",
  "News & updates": "Νέα και ενημερώσεις",
  "Built by two parents, evenings, between feeds — here is everything that has changed and why.":
    "Φτιαγμένο από δύο γονείς, τα βράδια, ανάμεσα στα ταΐσματα — εδώ είναι όλα όσα άλλαξαν και γιατί.",
  "A thank-you, before the list": "Ένα ευχαριστώ, πριν από τη λίστα",
  "I made this app for my own daughter. I never expected that something I built for us would end up in so many families’ hands — and I want to thank every one of you who wrote to me. I read everything you send. Your messages are literally the list below: almost every fix and feature started as someone’s feedback.":
    "Έφτιαξα αυτή την εφαρμογή για τη δική μου κόρη. Δεν περίμενα ποτέ ότι κάτι που έφτιαξα για εμάς θα κατέληγε στα χέρια τόσων οικογενειών — και θέλω να ευχαριστήσω τον καθένα σας που μου έγραψε. Διαβάζω ό,τι στέλνετε. Τα μηνύματά σας είναι κυριολεκτικά η λίστα από κάτω: σχεδόν κάθε διόρθωση και λειτουργία ξεκίνησε από το σχόλιο κάποιου.",
  "I write the code alone, mostly while the baby sleeps, so some things take an evening or two — but nothing you report is ignored. If something is broken, missing, or just annoying, tap the little message bubble and tell me. It comes straight to me.":
    "Γράφω τον κώδικα μόνος, κυρίως όσο κοιμάται το μωρό, οπότε κάποια πράγματα παίρνουν ένα δυο βράδια — αλλά τίποτα από όσα αναφέρετε δεν αγνοείται. Αν κάτι είναι χαλασμένο, λείπει, ή απλώς ενοχλεί, πατήστε το μικρό συννεφάκι μηνύματος και πείτε μου. Έρχεται κατευθείαν σε μένα.",
  "The code may be mine, but nothing else here happens alone — half of every night, and half of our own family’s log, is her mum’s. And one rule above all: an app can help, but your paediatrician always comes first. — Apostolis":
    "Ο κώδικας μπορεί να είναι δικός μου, αλλά τίποτα άλλο εδώ δεν γίνεται μόνο του — η μισή κάθε νύχτα, και το μισό ημερολόγιο της δικής μας οικογένειας, είναι της μαμάς της. Και ένας κανόνας πάνω από όλα: μια εφαρμογή μπορεί να βοηθήσει, αλλά ο παιδίατρός σας έρχεται πάντα πρώτος. — Αποστόλης",
  "Latest": "Νεότερο",
  // ——— Timeline screen ———
  "The full picture": "Η πλήρης εικόνα",
  "1 entry": "1 καταχώριση",
  "{n} entries": "{n} καταχωρίσεις",
  "Filter timeline": "Φιλτράρισμα ιστορικού",
  "All": "Όλα",
  "Show {what} logs": "Εμφάνιση καταχωρίσεων: {what}",
  "Latest first": "Πρώτα τα πιο πρόσφατα",
  "Open any log to correct its details": "Ανοίξτε οποιαδήποτε καταχώριση για να διορθώσετε τα στοιχεία της",
  "Nothing logged yet — your day builds here from the Today screen.":
    "Τίποτα καταγεγραμμένο ακόμη — η μέρα σας χτίζεται εδώ από την οθόνη Σήμερα.",
  "No {what} entries yet.": "Καμία καταχώριση «{what}» ακόμη.",
  "Show all entries": "Εμφάνιση όλων των καταχωρίσεων",
  "Show more entries": "Εμφάνιση περισσότερων",
  // ——— Insights screen ———
  "Worth a phone call": "Αξίζει ένα τηλεφώνημα",
  "Something to try": "Κάτι να δοκιμάσετε",
  "This looks ordinary": "Αυτό δείχνει συνηθισμένο",
  "Last 7 days": "Τελευταίες 7 ημέρες",
  "What the log is telling you": "Τι σας λέει το ημερολόγιο",
  "Summary for the paediatrician": "Σύνοψη για τον παιδίατρο",
  "Share this week": "Μοιραστείτε την εβδομάδα",
  "{name}’s week · {link}": "Η εβδομάδα του μωρού {name} · {link}",
  "Card saved to your device": "Η κάρτα αποθηκεύτηκε στη συσκευή σας",
  "Could not make the card on this phone": "Η κάρτα δεν μπόρεσε να φτιαχτεί σε αυτό το κινητό",
  "Milk against weight": "Γάλα σε σχέση με το βάρος",
  "At {weight}, the usual guide is about {vol} a day at most.": "Στα {weight}, ο συνήθης οδηγός είναι το πολύ περίπου {vol} την ημέρα.",
  "At {weight}, the usual guide is about {range} a day.": "Στα {weight}, ο συνήθης οδηγός είναι περίπου {range} την ημέρα.",
  "{ref}. Your typical day is {vol}, {where} the band.": "{ref}. Η τυπική σας μέρα είναι {vol}, {where} ζώνη.",
  "Reference ceiling {vol} a day": "Οροφή αναφοράς {vol} την ημέρα",
  "Reference band {low} to {high} a day": "Ζώνη αναφοράς {low} έως {high} την ημέρα",
  "which is within": "που είναι μέσα στη",
  "which is below": "που είναι κάτω από τη",
  "which is above": "που είναι πάνω από τη",
  "is your typical day — {where}.": "είναι η τυπική σας μέρα — {where}.",
  "inside that range": "μέσα σε αυτό το εύρος",
  "below it": "κάτω από αυτό",
  "above it": "πάνω από αυτό",
  "Capped at the {vol} a day AAP gives as the usual maximum, whatever the weight suggests.":
    "Περιορισμένο στα {vol} την ημέρα που η AAP δίνει ως συνηθισμένο μέγιστο, ό,τι κι αν δείχνει το βάρος.",
  "This counts bottles only, so any nursing sits outside it. Babies feed to appetite and a range is not a target — bring the number to your paediatrician rather than to a calculator.":
    "Μετράει μόνο μπιμπερό, οπότε ο θηλασμός μένει απ’ έξω. Τα μωρά τρώνε με την όρεξή τους και ένα εύρος δεν είναι στόχος — πηγαίνετε τον αριθμό στον παιδίατρό σας, όχι σε αριθμομηχανή.",
  "What your entries suggest": "Τι δείχνουν οι καταχωρίσεις σας",
  "No data yet": "Χωρίς δεδομένα ακόμη",
  "Typical feed gap": "Τυπικό κενό ταΐσματος",
  "Feeds / day": "Ταΐσματα / ημέρα",
  "Bottle total today": "Σύνολο μπιμπερό σήμερα",
  "Latest weight": "Τελευταίο βάρος",
  "a few more feeds": "μερικά ακόμη ταΐσματα",
  "a day or two": "μια-δυο μέρες",
  "a bottle today": "ένα μπιμπερό σήμερα",
  "a weight": "ένα βάρος",
  "and": "και",
  "The dashes fill in on their own — they are waiting on {list}.": "Οι παύλες γεμίζουν μόνες τους — περιμένουν {list}.",
  "Fig. 1 · Bottle volume": "Σχ. 1 · Ποσότητα μπιμπερό",
  "Most bottle days total about {vol}.": "Οι περισσότερες μέρες με μπιμπερό φτάνουν συνολικά περίπου {vol}.",
  "Bottle volume for the last seven days. Most bottle days total about {vol}. {days}.":
    "Ποσότητα μπιμπερό για τις τελευταίες επτά ημέρες. Οι περισσότερες μέρες φτάνουν περίπου {vol}. {days}.",
  "From 1 logged bottle · on this device": "Από 1 καταγεγραμμένο μπιμπερό · σε αυτή τη συσκευή",
  "From {n} logged bottles · on this device": "Από {n} καταγεγραμμένα μπιμπερό · σε αυτή τη συσκευή",
  "Fig. {n} · Feeding rhythm": "Σχ. {n} · Ρυθμός ταΐσματος",
  "Feeds usually arrive about {gap} apart.": "Τα ταΐσματα έρχονται συνήθως με διαφορά περίπου {gap}.",
  "Each day’s feeds on a 24-hour line.": "Τα ταΐσματα κάθε μέρας σε μια γραμμή 24 ωρών.",
  "No feeds logged yet — the week’s rhythm will draw itself here.":
    "Κανένα τάισμα ακόμη — ο ρυθμός της εβδομάδας θα σχεδιαστεί εδώ μόνος του.",
  "{day}: no feeds logged": "{day}: κανένα καταγεγραμμένο τάισμα",
  "{what} at {time}": "{what} στις {time}",
  "From 1 logged feed · on this device": "Από 1 καταγεγραμμένο τάισμα · σε αυτή τη συσκευή",
  "From {n} logged feeds · on this device": "Από {n} καταγεγραμμένα ταΐσματα · σε αυτή τη συσκευή",
  "Useful, not judgmental.": "Χρήσιμο, όχι επικριτικό.",
  "Numalog summarizes what you logged. It never scores your parenting or replaces medical advice.":
    "Το Numalog συνοψίζει ό,τι καταγράψατε. Δεν βαθμολογεί ποτέ το πώς μεγαλώνετε το παιδί σας και δεν αντικαθιστά ιατρική συμβουλή.",

  // ——— Insight cards (rules engine) ———
  "That temperature is worth a phone call": "Αυτή η θερμοκρασία αξίζει ένα τηλεφώνημα",
  "You logged {temp} °C. AAP's call-the-doctor threshold changes with age and is {threshold} °C for yours.":
    "Καταγράψατε {temp} °C. Το όριο της AAP για «πάρτε τον γιατρό» αλλάζει με την ηλικία και για τη δική σας είναι {threshold} °C.",
  "Call your paediatrician now, even if your baby otherwise seems fine. NHS lists 38 °C or more in a baby under 3 months as a reason to seek urgent help.":
    "Πάρτε τον παιδίατρό σας τώρα, ακόμη κι αν το μωρό δείχνει κατά τα άλλα καλά. Το NHS αναφέρει τους 38 °C ή περισσότερο σε μωρό κάτω των 3 μηνών ως λόγο για επείγουσα βοήθεια.",
  "Call your paediatrician today and describe how your baby is behaving, not just the number.":
    "Πάρτε τον παιδίατρό σας σήμερα και περιγράψτε πώς συμπεριφέρεται το μωρό, όχι μόνο τον αριθμό.",
  "A low temperature matters as much as a fever": "Μια χαμηλή θερμοκρασία μετράει όσο και ο πυρετός",
  "You logged {temp} °C. NHS lists a temperature of 36 °C or below in a young baby alongside 38 °C or above as a reason to get urgent help.":
    "Καταγράψατε {temp} °C. Το NHS αναφέρει θερμοκρασία 36 °C ή κάτω σε μικρό μωρό, μαζί με 38 °C ή πάνω, ως λόγο για επείγουσα βοήθεια.",
  "Get urgent advice now — especially if your baby also feels cold to the touch, is sleepier than usual, or is not feeding.":
    "Ζητήστε επείγουσα συμβουλή τώρα — ειδικά αν το μωρό είναι και κρύο στην αφή, πιο νυσταγμένο από το συνηθισμένο, ή δεν τρώει.",
  "Only 1 wet nappy logged yesterday": "Μόνο 1 βρεγμένη πάνα καταγράφηκε χθες",
  "Only {n} wet nappies logged yesterday": "Μόνο {n} βρεγμένες πάνες καταγράφηκαν χθες",
  "AAP lists weeing only once or twice a day among the signs of serious dehydration. This counts what was logged — if changes went unrecorded, the real number is higher.":
    "Η AAP αναφέρει το τσίσα μόνο μία ή δύο φορές την ημέρα ανάμεσα στα σημάδια σοβαρής αφυδάτωσης. Μετράει ό,τι καταγράφηκε — αν κάποιες αλλαγές δεν σημειώθηκαν, ο πραγματικός αριθμός είναι μεγαλύτερος.",
  "Look at your baby rather than at this screen: dry mouth, no tears when crying, a sunken soft spot, unusual sleepiness. Then call your paediatrician today.":
    "Κοιτάξτε το μωρό σας, όχι αυτή την οθόνη: στεγνό στόμα, κλάμα χωρίς δάκρυα, βαθουλωμένη πηγή, ασυνήθιστη υπνηλία. Και μετά πάρτε τον παιδίατρό σας σήμερα.",
  "{n} wet nappies logged yesterday, against a floor of 6": "{n} βρεγμένες πάνες καταγράφηκαν χθες, με ελάχιστο όριο τις 6",
  "After the first week, both AAP and NHS put at least 6 heavy wet nappies a day as the mark of a baby getting enough milk.":
    "Μετά την πρώτη εβδομάδα, τόσο η AAP όσο και το NHS βάζουν τουλάχιστον 6 βαριές βρεγμένες πάνες την ημέρα ως σημάδι ότι το μωρό παίρνει αρκετό γάλα.",
  "Watch today's nappies as they come. If the count is still under 6, ring your midwife, health visitor or paediatrician today.":
    "Παρακολουθήστε τις σημερινές πάνες όπως έρχονται. Αν ο αριθμός μείνει κάτω από 6, πάρτε τη μαία ή τον παιδίατρό σας σήμερα.",
  "Still under the first weight you logged": "Ακόμη κάτω από το πρώτο βάρος που καταγράψατε",
  "You logged {first} g first and {last} g most recently. NHS: most babies are at, or above, their birthweight by 3 weeks.":
    "Καταγράψατε {first} γρ. στην αρχή και {last} γρ. πιο πρόσφατα. NHS: τα περισσότερα μωρά είναι στο βάρος γέννησης, ή πάνω από αυτό, ως τις 3 εβδομάδες.",
  "Home scales drift. Ask your midwife, health visitor or paediatrician to weigh your baby on theirs — do not change how you feed on the strength of this alone.":
    "Οι ζυγαριές του σπιτιού ξεφεύγουν. Ζητήστε από τη μαία ή τον παιδίατρό σας να ζυγίσει το μωρό στη δική τους — μην αλλάξετε το τάισμα μόνο με βάση αυτό.",
  "Weight gain looks slower than the usual range": "Η αύξηση βάρους δείχνει πιο αργή από το συνηθισμένο εύρος",
  "About {gain} g a week between your last two weights, {span} days apart. AAP treats a baby not gaining steadily as a reason to get weighed properly.":
    "Περίπου {gain} γρ. την εβδομάδα ανάμεσα στα δύο τελευταία βάρη, με διαφορά {span} ημερών. Η AAP θεωρεί ένα μωρό που δεν παίρνει σταθερά βάρος λόγο για σωστό ζύγισμα.",
  "Ask your health visitor or paediatrician for a weigh-in on their scales before you change anything.":
    "Ζητήστε ζύγισμα στη ζυγαριά του παιδιάτρου σας πριν αλλάξετε οτιδήποτε.",
  "Three logged days with no poo": "Τρεις καταγεγραμμένες μέρες χωρίς κακά",
  "NHS: from about the fourth day expect at least 2 soft yellow poos a day for the first few weeks. Long gaps become normal after about 6 weeks — your baby is not there yet.":
    "NHS: από την τέταρτη μέρα περίπου περιμένετε τουλάχιστον 2 μαλακά κίτρινα κακά την ημέρα τις πρώτες εβδομάδες. Τα μεγάλα κενά γίνονται φυσιολογικά μετά τις 6 εβδομάδες περίπου — το μωρό σας δεν είναι ακόμη εκεί.",
  "Ring your midwife, health visitor or GP today and mention the gap, and how feeds are going.":
    "Πάρτε τη μαία ή τον γιατρό σας σήμερα και αναφέρετε το κενό, και πώς πάνε τα ταΐσματα.",
  "{h} hours since the last logged feed": "{h} ώρες από το τελευταίο καταγεγραμμένο τάισμα",
  "AAP: if a newborn sleeps longer than 4 to 5 hours in the first weeks and starts missing feeds, wake them and offer one.":
    "AAP: αν ένα νεογέννητο κοιμάται πάνω από 4 με 5 ώρες τις πρώτες εβδομάδες και αρχίζει να χάνει ταΐσματα, ξυπνήστε το και προσφέρετε ένα.",
  "If you fed and did not log it, add it and this card goes away.":
    "Αν ταΐσατε και δεν το καταγράψατε, προσθέστε το και αυτή η κάρτα φεύγει.",
  "{d} days since the last logged poo": "{d} μέρες από τα τελευταία καταγεγραμμένα κακά",
  "AAP: 5 to 7 days between poos is not necessarily a problem in a baby who has been pooing normally and is feeding and growing well. Past that is worth a mention.":
    "AAP: 5 έως 7 μέρες ανάμεσα στα κακά δεν είναι απαραίτητα πρόβλημα σε μωρό που τα έκανε κανονικά και τρώει και μεγαλώνει καλά. Πέρα από αυτό αξίζει μια αναφορά.",
  "Mention it at your next check, or ring sooner if your baby seems in pain, or the poo when it comes is hard or bloody.":
    "Αναφέρετέ το στο επόμενο ραντεβού, ή τηλεφωνήστε νωρίτερα αν το μωρό δείχνει να πονά, ή τα κακά όταν έρθουν είναι σκληρά ή με αίμα.",
  "Bottle totals are running above the usual daily guide": "Τα σύνολα του μπιμπερό τρέχουν πάνω από τον συνήθη ημερήσιο οδηγό",
  "Your median bottle day is about {vol}. AAP: babies generally do not need more than about {max} of formula in 24 hours.":
    "Η διάμεση μέρα μπιμπερό σας είναι περίπου {vol}. AAP: τα μωρά γενικά δεν χρειάζονται πάνω από περίπου {max} φόρμουλα σε 24 ώρες.",
  "Mention the daily total at your next appointment. Keep following fullness cues — never push the last of a bottle to hit or avoid a number.":
    "Αναφέρετε το ημερήσιο σύνολο στο επόμενο ραντεβού. Συνεχίστε να ακολουθείτε τα σημάδια χορτασμού — μην πιέζετε ποτέ το τέλος του μπιμπερό για να πιάσετε ή να αποφύγετε έναν αριθμό.",
  "Worth a pause halfway through the bottle": "Αξίζει μια παύση στη μέση του μπιμπερό",
  "Your typical bottle is about {vol}. AAP suggests burping about every {low} to {high} rather than once at the end.":
    "Το τυπικό σας μπιμπερό είναι περίπου {vol}. Η AAP προτείνει ρέψιμο περίπου κάθε {low} έως {high} αντί για μία φορά στο τέλος.",
  "Try one pause halfway through the next bottle, and rotate the holds: on your shoulder, sitting on your lap, or face-down across your lap.":
    "Δοκιμάστε μία παύση στη μέση του επόμενου μπιμπερό, και εναλλάξτε τις στάσεις: στον ώμο σας, καθιστό στα πόδια σας, ή μπρούμυτα πάνω στα πόδια σας.",
  "Two or three wet nappies is what today should look like": "Δύο ή τρεις βρεγμένες πάνες είναι το αναμενόμενο για σήμερα",
  "NHS: in the first 48 hours your baby is likely to have only 2 or 3 wet nappies.":
    "NHS: στις πρώτες 48 ώρες το μωρό σας πιθανότατα θα έχει μόνο 2 ή 3 βρεγμένες πάνες.",
  "Keep logging each one. From day 5 the count climbs sharply, and that ramp is what matters.":
    "Συνεχίστε να καταγράφετε καθεμία. Από τη μέρα 5 ο αριθμός ανεβαίνει απότομα, και αυτή η άνοδος είναι που μετράει.",
  "The nappy count climbs from about day 5": "Ο αριθμός στις πάνες ανεβαίνει από τη μέρα 5 περίπου",
  "NHS: from day 5 onwards expect at least 6 heavy wet nappies every 24 hours, with the wee almost colourless or pale yellow.":
    "NHS: από τη μέρα 5 και μετά περιμένετε τουλάχιστον 6 βαριές βρεγμένες πάνες κάθε 24 ώρες, με το τσίσα σχεδόν άχρωμο ή αχνοκίτρινο.",
  "Nothing to change. Keep logging every nappy so the ramp is visible when your midwife asks.":
    "Τίποτα προς αλλαγή. Συνεχίστε να καταγράφετε κάθε πάνα ώστε η άνοδος να φαίνεται όταν ρωτήσει η μαία.",
  "Yesterday looks like a cluster-feeding day": "Η χθεσινή μοιάζει με μέρα πυκνών ταϊσμάτων",
  "{n} feeds, against your usual {usual}. NHS: cluster feeding is very normal in the first 3 to 4 months and often comes with a growth spurt.":
    "{n} ταΐσματα, με συνηθισμένο το {usual}. NHS: τα πυκνά ταΐσματα είναι πολύ φυσιολογικά τους πρώτους 3 με 4 μήνες και συχνά συνοδεύουν ένα άλμα ανάπτυξης.",
  "Nothing to fix. Eat, drink, get comfortable and let the feeds come — it passes.":
    "Τίποτα προς διόρθωση. Φάτε, πιείτε, βολευτείτε και αφήστε τα ταΐσματα να έρθουν — περνάει.",
  "{d} days without a poo — normal at this age": "{d} μέρες χωρίς κακά — φυσιολογικό σε αυτή την ηλικία",
  "NHS: after about 6 weeks a breastfed baby can go several days without one, and AAP agrees 5 to 7 days is not necessarily a problem when feeding and growing are fine.":
    "NHS: μετά τις 6 εβδομάδες περίπου ένα θηλάζον μωρό μπορεί να περάσει αρκετές μέρες χωρίς κακά, και η AAP συμφωνεί ότι 5 έως 7 μέρες δεν είναι απαραίτητα πρόβλημα όταν το τάισμα και η ανάπτυξη πάνε καλά.",
  "Nothing to do. Ring your GP or health visitor if your baby seems in pain, the poo when it comes is very hard or bloody, or the wet nappies drop off.":
    "Τίποτα να κάνετε. Πάρτε τον γιατρό σας αν το μωρό δείχνει να πονά, τα κακά όταν έρθουν είναι πολύ σκληρά ή με αίμα, ή οι βρεγμένες πάνες λιγοστέψουν.",
  "Weight is climbing at the usual rate": "Το βάρος ανεβαίνει με τον συνηθισμένο ρυθμό",
  "About {gain} g a week between your last two weights. The typical band at this age is {min}–{max} g a week.":
    "Περίπου {gain} γρ. την εβδομάδα ανάμεσα στα δύο τελευταία βάρη. Η τυπική ζώνη σε αυτή την ηλικία είναι {min}–{max} γρ. την εβδομάδα.",
  "Nothing to do. Under 6 months, one weight a month is enough for this to stay meaningful.":
    "Τίποτα να κάνετε. Κάτω από τους 6 μήνες, ένα βάρος τον μήνα αρκεί για να μένει αυτό ουσιαστικό.",
  "That is a lot of feeds. It is also the normal number.": "Είναι πολλά ταΐσματα. Είναι επίσης ο φυσιολογικός αριθμός.",
  "Your median is {n} feeds a day. AAP: breastfed newborns usually nurse about every 2 hours, so 10 to 12 in 24 hours is the norm and 8 is the minimum.":
    "Η διάμεσός σας είναι {n} ταΐσματα την ημέρα. AAP: τα θηλάζοντα νεογέννητα τρώνε συνήθως κάθε 2 ώρες περίπου, οπότε 10 με 12 στο 24ωρο είναι ο κανόνας και 8 το ελάχιστο.",
  "Nothing to change. Keep following the early cues — rooting, hands to the mouth, lip smacking. Crying is the late one.":
    "Τίποτα προς αλλαγή. Συνεχίστε να ακολουθείτε τα πρώιμα σημάδια — ψάξιμο, χεράκια στο στόμα, πλατάγισμα χειλιών. Το κλάμα είναι το αργοπορημένο.",
  "Feeds have eased off this week": "Τα ταΐσματα έχουν αραιώσει αυτή την εβδομάδα",
  "About {recent} a day recently, against {earlier} before. Appetite moves around, and a settled week can look like this.":
    "Περίπου {recent} την ημέρα πρόσφατα, έναντι {earlier} πριν. Η όρεξη μετακινείται, και μια ήρεμη εβδομάδα μπορεί να μοιάζει έτσι.",
  "Worth watching alongside nappies and weight rather than on its own. If wet nappies drop too, or your baby seems harder to rouse for a feed, ring your health visitor.":
    "Αξίζει παρακολούθηση μαζί με τις πάνες και το βάρος, όχι μόνο του. Αν πέσουν και οι βρεγμένες πάνες, ή το μωρό ξυπνά πιο δύσκολα για τάισμα, πάρτε τον γιατρό σας.",
  "Fewer wet nappies than last week": "Λιγότερες βρεγμένες πάνες από την περασμένη εβδομάδα",
  "About {recent} a day, from {earlier}. Still inside the usual range, so this is a note rather than a worry.":
    "Περίπου {recent} την ημέρα, από {earlier}. Ακόμη μέσα στο συνηθισμένο εύρος, οπότε είναι σημείωση, όχι ανησυχία.",
  "Keep offering feeds on cue. If it keeps falling and lands below six heavy wet nappies a day, that is the point to call.":
    "Συνεχίστε να προσφέρετε ταΐσματα στα σημάδια. Αν συνεχίσει να πέφτει και φτάσει κάτω από έξι βαριές βρεγμένες πάνες την ημέρα, εκεί είναι το σημείο να τηλεφωνήσετε.",
  "The longest stretch is getting longer": "Το μεγαλύτερο συνεχόμενο διάστημα μεγαλώνει",
  "Best stretch is averaging {recent}, up from {earlier} the week before.":
    "Το καλύτερο διάστημα είναι κατά μέσο όρο {recent}, από {earlier} την προηγούμενη εβδομάδα.",
  "Nothing to do. Nights move backwards as often as forwards at this age, so this is worth noticing rather than counting on.":
    "Τίποτα να κάνετε. Οι νύχτες πάνε πίσω όσο συχνά πάνε και μπροστά σε αυτή την ηλικία, οπότε αξίζει να το προσέξετε, όχι να βασιστείτε πάνω του.",
  // ——— Paediatrician summary (sheet, PDF, picture) ———
  "For the paediatrician": "Για τον παιδίατρο",
  "{name}, {age} old": "{name}, {age}",
  "{n} days": "{n} ημέρες",
  "printed {date}": "εκτυπώθηκε {date}",
  "{logged} of {total} days have entries. 1 day was not logged, so the daily figures are medians over the logged days only.":
    "{logged} από {total} ημέρες έχουν καταχωρίσεις. 1 ημέρα δεν καταγράφηκε, οπότε τα ημερήσια νούμερα είναι διάμεσοι μόνο των καταγεγραμμένων ημερών.",
  "{logged} of {total} days have entries. {blank} days were not logged, so the daily figures are medians over the logged days only.":
    "{logged} από {total} ημέρες έχουν καταχωρίσεις. {blank} ημέρες δεν καταγράφηκαν, οπότε τα ημερήσια νούμερα είναι διάμεσοι μόνο των καταγεγραμμένων ημερών.",
  "{logged} of {total} days have entries — every day logged.": "{logged} από {total} ημέρες έχουν καταχωρίσεις — καταγράφηκε κάθε μέρα.",
  "Feeding": "Τάισμα",
  "feeds a day": "ταΐσματα την ημέρα",
  "milk a day": "γάλα την ημέρα",
  "nursing a day": "θηλασμός την ημέρα",
  "{feeds} feeds and {vol} across the window. Bottle volumes are bottles only.":
    "{feeds} ταΐσματα και {vol} σε όλο το διάστημα. Οι ποσότητες αφορούν μόνο μπιμπερό.",
  "Nappies": "Πάνες",
  "wet a day": "τσίσα την ημέρα",
  "dirty a day": "κακά την ημέρα",
  "{wet} wet and {dirty} dirty across the window. A change recorded as both counts in each.":
    "{wet} τσίσα και {dirty} κακά σε όλο το διάστημα. Μια αλλαγή που καταγράφηκε και ως τα δύο μετράει και στα δύο.",
  "latest weight": "τελευταίο βάρος",
  "gained a week": "αύξηση την εβδομάδα",
  "WHO reference at this age: {low}–{high} (P3–P97), midpoint {mid}.":
    "Αναφορά ΠΟΥ σε αυτή την ηλικία: {low}–{high} (P3–P97), μέσο {mid}.",
  "No age on file, so no WHO reference is shown.": "Δεν υπάρχει ηλικία στο προφίλ, οπότε δεν εμφανίζεται αναφορά ΠΟΥ.",
  "Typical gain {min}–{max} g a week.": "Τυπική αύξηση {min}–{max} γρ. την εβδομάδα.",
  "Recorded at home by a parent, not a clinical measurement. WHO Child Growth Standards; typical weekly gain per AAP.":
    "Καταγράφηκε στο σπίτι από γονιό, δεν είναι κλινική μέτρηση. Πρότυπα ανάπτυξης ΠΟΥ· τυπική εβδομαδιαία αύξηση κατά AAP.",
  "not logged": "δεν καταγράφηκε",
  "Day by day": "Μέρα με τη μέρα",
  "Day": "Ημέρα",
  "{name} · summary for the paediatrician · {link}": "{name} · σύνοψη για τον παιδίατρο · {link}",
  "PDF saved to your device": "Το PDF αποθηκεύτηκε στη συσκευή σας",
  "Could not make the PDF on this phone": "Το PDF δεν μπόρεσε να φτιαχτεί σε αυτό το κινητό",
  "Share PDF": "Κοινοποίηση PDF",
  "Download PDF": "Λήψη PDF",
  "Picture saved to your device": "Η εικόνα αποθηκεύτηκε στη συσκευή σας",
  "Could not make the picture on this phone": "Η εικόνα δεν μπόρεσε να φτιαχτεί σε αυτό το κινητό",
  "Share as a picture": "Κοινοποίηση ως εικόνα",

  // ——— Growth chart ———
  "Measurements over time": "Μετρήσεις στον χρόνο",
  "{weight} at the first check.": "{weight} στην πρώτη μέτρηση.",
  "Up {n} g since the last check.": "Πάνω {n} γρ. από την τελευταία μέτρηση.",
  "Down {n} g since the last check.": "Κάτω {n} γρ. από την τελευταία μέτρηση.",
  "Steady since the last check.": "Σταθερό από την τελευταία μέτρηση.",
  "Fig. {n} · Growth": "Σχ. {n} · Ανάπτυξη",
  "Add measurement": "Προσθήκη μέτρησης",
  "Your baby’s weight trend will appear after the first measurement.":
    "Η πορεία του βάρους θα εμφανιστεί μετά την πρώτη μέτρηση.",
  "Since last check": "Από την τελευταία μέτρηση",
  "First check": "Πρώτη μέτρηση",
  "Length / head": "Μήκος / κεφάλι",
  "Recent weight measurements": "Πρόσφατες μετρήσεις βάρους",
  "A date-proportional line from {low} to {high} {unit}.": "Μια γραμμή ανάλογη των ημερομηνιών από {low} έως {high} {unit}.",
  "Date": "Ημερομηνία",
  "Weight": "Βάρος",
  "Length": "Μήκος",
  "Head": "Κεφάλι",
  "Not logged": "Δεν καταγράφηκε",
  "From 1 logged measurement · on this device": "Από 1 καταγεγραμμένη μέτρηση · σε αυτή τη συσκευή",
  "From {n} logged measurements · on this device": "Από {n} καταγεγραμμένες μετρήσεις · σε αυτή τη συσκευή",
  "Trends are useful context for your paediatrician. A single measurement is not a diagnosis.":
    "Οι τάσεις είναι χρήσιμο πλαίσιο για τον παιδίατρό σας. Μία μέτρηση δεν είναι διάγνωση.",
  "What’s typical at this age?": "Τι είναι τυπικό σε αυτή την ηλικία;",
  // ——— Guide screen (chrome; card libraries follow in a later batch) ———
  "kilograms": "κιλά",
  "pounds": "λίβρες",
  "In the first week": "Την πρώτη εβδομάδα",
  "At 1 week": "Στη 1 εβδομάδα",
  "At {n} weeks": "Στις {n} εβδομάδες",
  "At 1 month": "Στον 1 μήνα",
  "At {n} months": "Στους {n} μήνες",
  "Reference band from {low} to {high} {unit}, middle of the range {mid} {unit}.":
    "Ζώνη αναφοράς από {low} έως {high} {unit}, μέσο του εύρους {mid} {unit}.",
  "Reference band from {low} to {high} {unit}, middle of the range {mid} {unit}. Latest logged weight {latest} {unit}.":
    "Ζώνη αναφοράς από {low} έως {high} {unit}, μέσο του εύρους {mid} {unit}. Τελευταίο καταγεγραμμένο βάρος {latest} {unit}.",
  "Back to Insights": "Πίσω στην Εικόνα",
  "Care guide": "Οδηγός φροντίδας",
  "What to do today": "Τι να κάνετε σήμερα",
  "What is expected for {name} right now, and what to do about it. Every line links to the page it came from.":
    "Τι αναμένεται για {name} αυτή τη στιγμή, και τι να κάνετε γι’ αυτό. Κάθε γραμμή οδηγεί στη σελίδα από όπου προήλθε.",
  "When to call someone": "Πότε να πάρετε κάποιον τηλέφωνο",
  "This app never decides any of these — you do. Trust your instincts and ring your paediatrician, midwife or health visitor.":
    "Η εφαρμογή δεν αποφασίζει ποτέ κανένα από αυτά — εσείς αποφασίζετε. Εμπιστευτείτε το ένστικτό σας και πάρτε τον παιδίατρο ή τη μαία σας.",
  "Context, not a diagnosis": "Πλαίσιο, όχι διάγνωση",
  "Everything in this guide — ranges, care notes and play ideas — is general information from the sources listed below, not medical advice, and this app is not a medical device. Babies grow in their own rhythm; your paediatrician’s assessment always comes first.":
    "Όλα σε αυτόν τον οδηγό — εύρη, σημειώσεις φροντίδας και ιδέες παιχνιδιού — είναι γενικές πληροφορίες από τις πηγές που αναφέρονται παρακάτω, όχι ιατρική συμβουλή, και η εφαρμογή δεν είναι ιατρική συσκευή. Τα μωρά μεγαλώνουν με τον δικό τους ρυθμό· η εκτίμηση του παιδιάτρου σας έρχεται πάντα πρώτη.",
  "Typical weight range at this age (WHO P3–P97)": "Τυπικό εύρος βάρους σε αυτή την ηλικία (ΠΟΥ P3–P97)",
  "The WHO table covers the first 24 months, shown here at 24 months.":
    "Ο πίνακας του ΠΟΥ καλύπτει τους πρώτους 24 μήνες, εδώ εμφανίζεται στους 24 μήνες.",
  "{name}’s latest:": "Η τελευταία μέτρηση για {name}:",
  "Range shown covers girls and boys.": "Το εύρος που φαίνεται καλύπτει κορίτσια και αγόρια.",
  "By age, 0–24 months": "Ανά ηλικία, 0–24 μηνών",
  "Reference weights across the first two years.": "Βάρη αναφοράς στα δύο πρώτα χρόνια.",
  "Age": "Ηλικία",
  "{n} mo": "{n} μ.",
  "Add a birth date in Settings to see the range for {name}’s exact age.":
    "Προσθέστε ημερομηνία γέννησης στις Ρυθμίσεις για να δείτε το εύρος για την ακριβή ηλικία του μωρού {name}.",
  "Typical pattern": "Τυπικό μοτίβο",
  "Many newborns lose some weight in the first days, then regain it — most are back to birth weight by two weeks, nearly all by three.":
    "Πολλά νεογέννητα χάνουν λίγο βάρος τις πρώτες μέρες και μετά το ξαναπαίρνουν — τα περισσότερα είναι πίσω στο βάρος γέννησης ως τις δύο εβδομάδες, σχεδόν όλα ως τις τρεις.",
  "In the first month, roughly {min}–{max} g a week is common.":
    "Τον πρώτο μήνα, περίπου {min}–{max} γρ. την εβδομάδα είναι συνηθισμένο.",
  "From {from} to {to} months, roughly {min}–{max} g a week is common.":
    "Από {from} έως {to} μηνών, περίπου {min}–{max} γρ. την εβδομάδα είναι συνηθισμένο.",
  "Many babies double their birth weight around six months and triple it around one year. After eight months, gains slow — following their own curve matters more than any weekly number.":
    "Πολλά μωρά διπλασιάζουν το βάρος γέννησης γύρω στους έξι μήνες και το τριπλασιάζουν γύρω στον χρόνο. Μετά τους οκτώ μήνες η αύξηση επιβραδύνεται — το να ακολουθούν τη δική τους καμπύλη μετράει πιο πολύ από κάθε εβδομαδιαίο νούμερο.",
  "Growth is usually fastest in the first six months, then gradually slows. A short illness can flatten gain for a couple of weeks — that usually settles on its own.":
    "Η ανάπτυξη είναι συνήθως ταχύτερη τους πρώτους έξι μήνες και μετά σταδιακά επιβραδύνεται. Μια σύντομη αρρώστια μπορεί να «παγώσει» την αύξηση για κάνα δυο εβδομάδες — συνήθως φτιάχνει μόνο του.",
  "These are population averages, not targets. A baby growing along a lower line on the chart gains less than one on a higher line — steadiness is the point.":
    "Αυτοί είναι μέσοι όροι πληθυσμού, όχι στόχοι. Ένα μωρό που μεγαλώνει σε χαμηλότερη γραμμή της καμπύλης παίρνει λιγότερο από ένα σε ψηλότερη — η σταθερότητα είναι το ζητούμενο.",
  "When to ask your paediatrician": "Πότε να ρωτήσετε τον παιδίατρό σας",
  "Trust your instincts — reach out whenever you’re unsure. These are the moments the guidance names for a check-in:":
    "Εμπιστευτείτε το ένστικτό σας — απευθυνθείτε όποτε δεν είστε σίγουροι. Αυτές είναι οι στιγμές που οι οδηγίες ορίζουν για έναν έλεγχο:",
  "At two weeks, still under birth weight or gaining less than about 150 g a week.":
    "Στις δύο εβδομάδες, ακόμη κάτω από το βάρος γέννησης ή με αύξηση κάτω από περίπου 150 γρ. την εβδομάδα.",
  "Not back to birth weight by three weeks of age.": "Δεν έχει επιστρέψει στο βάρος γέννησης ως τις τρεις εβδομάδες.",
  "After the first week, fewer than six wet diapers a day, or urine that is dark or has reddish-orange marks in it.":
    "Μετά την πρώτη εβδομάδα, λιγότερες από έξι βρεγμένες πάνες την ημέρα, ή τσίσα σκούρα ή με κοκκινοπορτοκαλί σημάδια.",
  "Weight drifting across more than one line on their growth chart, in either direction.":
    "Βάρος που διασχίζει πάνω από μία γραμμή στην καμπύλη ανάπτυξης, προς οποιαδήποτε κατεύθυνση.",
  "Noticeably fewer wet diapers alongside irritability, unusual sleepiness or reduced feeding — seek care the same day.":
    "Αισθητά λιγότερες βρεγμένες πάνες μαζί με ευερεθιστότητα, ασυνήθιστη υπνηλία ή μειωμένο τάισμα — ζητήστε φροντίδα την ίδια μέρα.",
  "Sources": "Πηγές",
  "WHO Child Growth Standards · shown for context, not diagnosis · on this device":
    "Πρότυπα ανάπτυξης ΠΟΥ · για πλαίσιο, όχι διάγνωση · σε αυτή τη συσκευή",

  // ——— When to call someone (signs) ———
  "Under 3 months: a rectal temperature of 38.0 °C (100.4 °F) or higher — call the same day, even with no other symptoms.":
    "Κάτω των 3 μηνών: θερμοκρασία 38,0 °C (100,4 °F) ή υψηλότερη από το ορθό — τηλεφωνήστε την ίδια μέρα, ακόμη και χωρίς άλλα συμπτώματα.",
  "Fewer wet nappies than usual, a dry mouth, no tears when crying, or unusual sleepiness.":
    "Λιγότερες βρεγμένες πάνες από το συνηθισμένο, στεγνό στόμα, κλάμα χωρίς δάκρυα, ή ασυνήθιστη υπνηλία.",
  "Yellowing of the skin or eyes that appears in the first 24 hours, is getting worse rather than better, or is still there after two weeks.":
    "Κιτρίνισμα του δέρματος ή των ματιών που εμφανίζεται στις πρώτες 24 ώρες, χειροτερεύει αντί να βελτιώνεται, ή επιμένει μετά από δύο εβδομάδες.",
  "Yellow-green or green vomit, or vomit with blood in it or that looks like ground coffee.":
    "Κιτρινοπράσινος ή πράσινος εμετός, ή εμετός με αίμα ή που μοιάζει με αλεσμένο καφέ.",
  "A baby who is difficult to wake, will not wake up, or has gone floppy.":
    "Μωρό που ξυπνά δύσκολα, δεν ξυπνά καθόλου, ή έχει «μαλακώσει» και δεν κρατιέται.",
  "Not back to birthweight by three weeks, or losing weight after the first week.":
    "Δεν έχει επιστρέψει στο βάρος γέννησης ως τις τρεις εβδομάδες, ή χάνει βάρος μετά την πρώτη εβδομάδα.",

  // ——— Care stages (eyebrows) ———
  "The first days": "Οι πρώτες μέρες",
  "Milk in, weight climbing": "Το γάλα ήρθε, το βάρος ανεβαίνει",
  "Finding the rhythm": "Βρίσκοντας τον ρυθμό",
  "Six weeks to three months": "Έξι εβδομάδες έως τρεις μήνες",
  "Three to six months": "Τρεις έως έξι μήνες",
  "Six to twelve months": "Έξι έως δώδεκα μήνες",
  "After the first year": "Μετά τον πρώτο χρόνο",

  // ——— Going out checklist ———
  "Going out": "Έξοδος",
  "Tick as you pack. Reset before the next outing.": "Τσεκάρετε όσο ετοιμάζετε την τσάντα. Μηδενίστε πριν την επόμενη έξοδο.",
  "Reset": "Μηδενισμός",
  "Diapers — one per hour out, plus one": "Πάνες — μία για κάθε ώρα έξω, συν μία",
  "Wipes and diaper bags": "Μωρομάντηλα και σακουλάκια για πάνες",
  "Changing mat (a muslin works)": "Στρωματάκι αλλαγής (και μια μουσελίνα κάνει)",
  "Full change of clothes — vest AND outfit": "Πλήρης αλλαξιά — ζιπουνάκι ΚΑΙ φορμάκι",
  "A muslin or burp cloth": "Μια μουσελίνα ή πανάκι για ρέψιμο",
  "One more feed than you think you need": "Ένα τάισμα παραπάνω από όσα νομίζετε ότι χρειάζεστε",
  "Hat for the season": "Σκουφάκι ανάλογα με την εποχή",
  "Blanket or extra layer": "Κουβερτούλα ή ένα ρούχο παραπάνω",
  "Pacifier + clip, if used": "Πιπίλα + κλιπ, αν χρησιμοποιείται",
  "Hand sanitiser": "Αντισηπτικό χεριών",
  "Your own phone, keys, water": "Το κινητό σας, κλειδιά, νερό",

  // ——— Play & development (chrome) ———
  "Play & development": "Παιχνίδι και ανάπτυξη",
  "Everyday play for {name} right now — {stage}. No grades, no milestones to pass: stop whenever either of you has had enough. Every card links to the page it came from.":
    "Καθημερινό παιχνίδι για {name} αυτή τη στιγμή — {stage}. Χωρίς βαθμούς, χωρίς ορόσημα για να «περάσετε»: σταματήστε όποτε κάποιος από τους δυο σας κουραστεί. Κάθε κάρτα οδηγεί στη σελίδα από όπου προήλθε.",
  "These are general play ideas, not medical or developmental advice — every baby moves at their own pace. For anything about {name}’s own development, your paediatrician or health visitor is the answer.":
    "Αυτές είναι γενικές ιδέες παιχνιδιού, όχι ιατρική ή αναπτυξιακή συμβουλή — κάθε μωρό προχωρά με τον ρυθμό του. Για οτιδήποτε αφορά την ανάπτυξη του μωρού {name}, ο παιδίατρός σας είναι η απάντηση.",
  "Movement": "Κίνηση",
  "Seeing": "Όραση",
  "Talking": "Ομιλία",
  "Together": "Μαζί",
  "Timer for {what}": "Χρονόμετρο για {what}",
  "{n} min": "{n} λεπτά",
  // ——— Onboarding ———
  "Private family log": "Ιδιωτικό οικογενειακό ημερολόγιο",
  "Night mode": "Νυχτερινή λειτουργία",
  "Use night mode": "Χρήση νυχτερινής λειτουργίας",
  "Your local log needs attention": "Το τοπικό ημερολόγιό σας χρειάζεται προσοχή",
  "The saved copy could not be read, so Numalog left it untouched. Download it before starting over, or restore a valid backup.":
    "Το αποθηκευμένο αντίγραφο δεν διαβάστηκε, οπότε το Numalog το άφησε ανέγγιχτο. Κατεβάστε το πριν ξεκινήσετε από την αρχή, ή επαναφέρετε ένα έγκυρο αντίγραφο.",
  "Download the saved copy": "Λήψη του αποθηκευμένου αντιγράφου",
  "Reset and start clean": "Μηδενισμός και καθαρή αρχή",
  "Protected your log with Google or email? After downloading the saved copy, you can bring everything back from the cloud:":
    "Προστατέψατε το ημερολόγιό σας με Google ή email; Αφού κατεβάσετε το αποθηκευμένο αντίγραφο, μπορείτε να τα φέρετε όλα πίσω από το cloud:",
  "Private by default": "Ιδιωτικό εξ ορισμού",
  "The whole day,": "Όλη η μέρα,",
  "without the mental load.": "χωρίς το βάρος στο μυαλό.",
  "Log feeds, diapers, burping and growth in seconds. No account needed — your entries stay on this device until you choose to share them.":
    "Καταγράψτε ταΐσματα, πάνες, ρεψίματα και ανάπτυξη σε δευτερόλεπτα. Χωρίς λογαριασμό — οι καταχωρίσεις σας μένουν σε αυτή τη συσκευή μέχρι να επιλέξετε να τις μοιραστείτε.",
  "Welcome back": "Καλώς ήρθατε πάλι",
  "This device has used Numalog before — continue, and your log comes straight down from the cloud.":
    "Αυτή η συσκευή έχει ξαναχρησιμοποιήσει το Numalog — συνεχίστε, και το ημερολόγιό σας κατεβαίνει κατευθείαν από το cloud.",
  "Set up a new baby instead": "Ρύθμιση νέου μωρού αντ’ αυτού",
  "Set up your baby": "Ρυθμίστε το μωρό σας",
  "Everything is optional. You can change it later.": "Όλα είναι προαιρετικά. Μπορείτε να τα αλλάξετε αργότερα.",
  "Powers the day counter and matches the guidance to this exact week. You can skip it.":
    "Τροφοδοτεί τον μετρητή ημερών και ταιριάζει τις οδηγίες σε αυτή ακριβώς την εβδομάδα. Μπορείτε να το παραλείψετε.",
  "Optional": "Προαιρετικό",
  "This only changes the quick actions you see.": "Αλλάζει μόνο τις γρήγορες ενέργειες που βλέπετε.",
  "Start tracking": "Ξεκινήστε την καταγραφή",
  "I already have data — bring it back": "Έχω ήδη δεδομένα — φέρτε τα πίσω",
  "One-tap logging": "Καταγραφή με ένα πάτημα",
  "Details only when you need them.": "Λεπτομέρειες μόνο όταν τις χρειάζεστε.",
  "Live timers and patterns": "Ζωντανά χρονόμετρα και μοτίβα",
  "See what happened and what may be next.": "Δείτε τι έγινε και τι μπορεί να ακολουθήσει.",
  "Yours by default": "Δικά σας εξ ορισμού",
  "Entries stay on this device. Family Sync is opt-in.": "Οι καταχωρίσεις μένουν σε αυτή τη συσκευή. Το Family Sync είναι επιλογή σας.",
  "Built by two parents, for our own daughter — we use it every day ourselves. It grows from what parents ask for: if anything is broken, missing or annoying, tap the message bubble inside and tell us. We read everything. And one rule above all: an app can help, but your paediatrician always comes first.":
    "Φτιαγμένο από δύο γονείς, για τη δική μας κόρη — το χρησιμοποιούμε κι εμείς κάθε μέρα. Μεγαλώνει από όσα ζητούν οι γονείς: αν κάτι είναι χαλασμένο, λείπει ή ενοχλεί, πατήστε το συννεφάκι μηνύματος μέσα στην εφαρμογή και πείτε μας. Τα διαβάζουμε όλα. Και ένας κανόνας πάνω από όλα: μια εφαρμογή μπορεί να βοηθήσει, αλλά ο παιδίατρός σας έρχεται πάντα πρώτος.",
  "Know another tired parent? Share Numalog": "Ξέρετε άλλον κουρασμένο γονιό; Μοιραστείτε το Numalog",
  "Bring your log back": "Φέρτε πίσω το ημερολόγιό σας",
  "However you kept it, there is a way home. Nothing here deletes anything, anywhere.":
    "Όπως κι αν το κρατήσατε, υπάρχει δρόμος επιστροφής. Τίποτα εδώ δεν διαγράφει τίποτα, πουθενά.",
  "or from this phone": "ή από αυτό το κινητό",
  "Restore a backup file": "Επαναφορά αρχείου αντιγράφου",
  "Entries inside an installed home-screen app can’t travel by link — for those, use a backup file or the cloud restore.":
    "Οι καταχωρίσεις μέσα σε εγκατεστημένη εφαρμογή της αρχικής οθόνης δεν ταξιδεύουν με σύνδεσμο — γι’ αυτές, χρησιμοποιήστε αρχείο αντιγράφου ή επαναφορά από το cloud.",
  // ——— Small components ———
  "38 °C or higher": "38 °C ή υψηλότερη",
  "(measured rectally) in a baby under 3 months needs urgent medical advice.":
    "(από το ορθό) σε μωρό κάτω των 3 μηνών χρειάζεται επείγουσα ιατρική συμβουλή.",
  "Add a birth date in Settings to tailor this advice.":
    "Προσθέστε ημερομηνία γέννησης στις Ρυθμίσεις για να προσαρμοστεί αυτή η συμβουλή.",
  "Temperature recorded.": "Η θερμοκρασία καταγράφηκε.",
  "If your baby seems unwell or you are concerned, seek medical advice.":
    "Αν το μωρό δείχνει αδιάθετο ή ανησυχείτε, ζητήστε ιατρική συμβουλή.",
  "Below 36 °C": "Κάτω από 36 °C",
  "can matter as much as a fever in a young baby. If it repeats or your baby seems unwell, seek medical advice.":
    "μπορεί να μετράει όσο και ο πυρετός σε μικρό μωρό. Αν επαναληφθεί ή το μωρό δείχνει αδιάθετο, ζητήστε ιατρική συμβουλή.",
  "New": "Νέο",
  "Dismiss what's new": "Απόρριψη των νέων",
  "What your baby is doing at this age": "Τι κάνει το μωρό σας σε αυτή την ηλικία",
  "From day one": "Από την πρώτη μέρα",
  "At {age}": "Στα {age}",
  "Right now, {name} may be:": "Αυτή τη στιγμή, {name} μπορεί να:",
  "Did you know?": "Το ξέρατε;",
  "Every baby has their own pace.": "Κάθε μωρό έχει τον δικό του ρυθμό.",

  // ——— Milestones ———
  "Your baby": "Το μωρό σας",
  "{who} is 1 week old today": "{who} έγινε 1 εβδομάδας σήμερα",
  "Seven days of getting to know each other.": "Επτά μέρες γνωριμίας.",
  "100 days of {who}": "100 μέρες με {who}",
  "A hundred days — that deserves its own little party.": "Εκατό μέρες — αυτό αξίζει το δικό του πάρτι.",
  "{who} is 1 year old today!": "{who} έγινε 1 χρονών σήμερα!",
  "{who} is {years} years old today!": "{who} έγινε {years} χρονών σήμερα!",
  "One whole year. Happy birthday, little one.": "Ένας ολόκληρος χρόνος. Χρόνια πολλά, μικρέ μου.",
  "Happy birthday, little one.": "Χρόνια πολλά, μικρέ μου.",
  "{who} is 1 month old today": "{who} έγινε 1 μηνός σήμερα",
  "{who} is {months} months old today": "{who} έγινε {months} μηνών σήμερα",
  "The first of many month-birthdays.": "Τα πρώτα από πολλά μηνιαία γενέθλια.",
  "Happy month-birthday.": "Χρόνια πολλά για τα μηνιαία γενέθλια.",
  "Share this milestone as a picture": "Κοινοποίηση του ορόσημου ως εικόνα",
  "Dismiss the celebration": "Απόρριψη της γιορτής",

  // ——— Share cards ———
  "nappy": "πάνα",
  "nappies": "πάνες",
  "asleep": "ύπνος",
  "of milk": "γάλα",
  "nursed": "θηλασμός",
  "wet": "τσίσα",
  "dirty": "κακά",
  "longest sleep": "μεγαλύτερος ύπνος",
  "waking": "ξύπνημα",
  "wakings": "ξυπνήματα",
  "night feed": "νυχτερινό τάισμα",
  "night feeds": "νυχτερινά ταΐσματα",
  "All of it since day one, logged by hand — usually at 3am.":
    "Όλα αυτά από την πρώτη μέρα, καταγραμμένα στο χέρι — συνήθως στις 3 τα ξημερώματα.",
  "Feeds from {first} to {last}.": "Ταΐσματα από {first} έως {last}.",
  "Today so far · {date}": "Σήμερα μέχρι τώρα · {date}",
  "{who} {weekday}": "{weekday} — {who}",
  "This week · {from} – {to}": "Αυτή η εβδομάδα · {from} – {to}",
  "This week": "Αυτή η εβδομάδα",
  "{who} week": "Η εβδομάδα — {who}",
  "Every day logged.": "Καταγράφηκε κάθε μέρα.",
  "{logged} of {total} days logged.": "{logged} από {total} ημέρες καταγράφηκαν.",
  "{from} – {to} · {logged} of {total} days logged": "{from} – {to} · {logged} από {total} ημέρες καταγράφηκαν",
  "Recorded at home by a parent, not a clinical measurement.":
    "Καταγράφηκε στο σπίτι από γονιό, δεν είναι κλινική μέτρηση.",
  "Last night · {date}": "Χθες το βράδυ · {date}",
  "{who} night": "Η νύχτα — {who}",
  "First feed at {time}.": "Πρώτο τάισμα στις {time}.",
  "our baby": "το μωρό μας",
  "calls right": "σωστές προβλέψεις",
  "spot on": "ακριβώς",
  "typical miss": "τυπική απόκλιση",
  "It knew when the next sleep was coming": "Ήξερε πότε ερχόταν ο επόμενος ύπνος",
  "It knew when the next feed was coming": "Ήξερε πότε ερχόταν το επόμενο τάισμα",
  "Numalog called {who}’s last {n} sleeps": "Το Numalog βρήκε τους τελευταίους {n} ύπνους — {who}",
  "Numalog called {who}’s last {n} feeds": "Το Numalog βρήκε τα τελευταία {n} ταΐσματα — {who}",
  "Learned from our own log — no account, nothing sent anywhere.":
    "Το έμαθε από το δικό μας ημερολόγιο — χωρίς λογαριασμό, τίποτα δεν στέλνεται πουθενά.",
  "It works out the rhythm from what you have already logged.":
    "Βγάζει τον ρυθμό από όσα έχετε ήδη καταγράψει.",

  // ——— Thank-you card ———
  "Thank you for being here": "Ευχαριστώ που είστε εδώ",
  "Numalog started as two parents’ app for their own daughter, built in the evenings between feeds. I honestly never expected other families to find it — seeing it help with your baby means more than you’d guess. If anything is broken, missing, or just annoying, don’t hesitate to say so. It comes straight to me.":
    "Το Numalog ξεκίνησε ως η εφαρμογή δύο γονιών για τη δική τους κόρη, φτιαγμένη τα βράδια ανάμεσα στα ταΐσματα. Ειλικρινά δεν περίμενα ποτέ ότι θα το έβρισκαν άλλες οικογένειες — το να βλέπω ότι βοηθά με το δικό σας μωρό σημαίνει περισσότερα απ’ όσα φαντάζεστε. Αν κάτι είναι χαλασμένο, λείπει, ή απλώς ενοχλεί, μη διστάσετε να το πείτε. Έρχεται κατευθείαν σε μένα.",
  "Write to me": "Γράψτε μου",
  "Say anything": "Πείτε ό,τι θέλετε",
  "A bug, a wish, a hello — it all lands with the same person.":
    "Ένα σφάλμα, μια ευχή, ένα γεια — όλα φτάνουν στον ίδιο άνθρωπο.",
};

export default el;
