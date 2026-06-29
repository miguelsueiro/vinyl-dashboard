import styles from "./loader.module.css";

const QUOTES = [
  { text: "Without deviation from the norm, progress is not possible.", author: "Frank Zappa" },
  { text: "Tomorrow belongs to those who can hear it coming.", author: "David Bowie" },
  { text: "Stop thinking about art works as objects, and start thinking about them as triggers for experiences.", author: "Brian Eno" },
  { text: "Build your name. Keep your name clean.", author: "Patti Smith" },
  { text: "I think the only way to be rebellious is by making something beautiful.", author: "Thom Yorke" },
  { text: "Hopefulness is not a neutral position.", author: "Nick Cave" },
  { text: "Music should be dangerous.", author: "Trent Reznor" },
  { text: "You should create what you want to create.", author: "Björk" },
  { text: "I never wanted to fit in.", author: "Siouxsie Sioux" },
  { text: "Punk rock means exemplary manners to your fellow human being.", author: "Joe Strummer" },
  { text: "DIY is not just a phrase.", author: "Ian MacKaye" },
  { text: "The duty of youth is to challenge corruption.", author: "Kurt Cobain" },
  { text: "You can't be afraid of getting weird.", author: "Jack White" },
  { text: "I am constantly trying to escape from myself.", author: "Lou Reed" },
  { text: "There are no rules.", author: "Prince" },
  { text: "I'm attracted to the unknown.", author: "Grace Jones" },
  { text: "You don't get what you dream of. You get what you work for.", author: "Shirley Manson" },
  { text: "You have to trust your instincts.", author: "Kate Bush" },
  { text: "Music is enough for a lifetime, but a lifetime is not enough for music.", author: "Sergei Rachmaninoff" },
  { text: "You have to burn to shine.", author: "John Frusciante" },
  { text: "The future is unwritten.", author: "Joe Strummer" },
  { text: "The strongest thing in the world is vulnerability.", author: "Fiona Apple" },
  { text: "I don't believe in guilty pleasures.", author: "St. Vincent" },
  { text: "Art is what people call something when they don't understand it.", author: "Laurie Anderson" },
  { text: "Silence is part of music.", author: "Ryuichi Sakamoto" },
  { text: "Everything popular is wrong.", author: "Morrissey" },
  { text: "People underestimate weirdness.", author: "Tom Waits" },
  { text: "I just wanted to make music that sounded like the future.", author: "Aphex Twin" },
  { text: "Mistakes are where the interesting stuff happens.", author: "Arca" },
  { text: "If you're too comfortable, you're doing it wrong.", author: "SOPHIE" },
  { text: "Curiosity is more important than talent.", author: "David Byrne" },
  { text: "The groove is truth.", author: "Questlove" },
  { text: "Listen more than you speak.", author: "Questlove" },
  { text: "You don't need a million dollars to do something cool.", author: "Tyler, The Creator" },
  { text: "Don't make music to fit in.", author: "Tyler, The Creator" },
  { text: "Everything starts with obsession.", author: "PJ Harvey" },
  { text: "Make room for weirdness.", author: "Janelle Monáe" },
  { text: "Culture should be inclusive.", author: "Janelle Monáe" },
  { text: "The stage is a laboratory.", author: "David Byrne" },
  { text: "I wanted to disappear into music.", author: "Trent Reznor" },
  { text: "Music is my religion.", author: "Jimi Hendrix" },
  { text: "One good thing about music, when it hits you, you feel no pain.", author: "Bob Marley" },
  { text: "Music is a weapon.", author: "Fela Kuti" },
  { text: "Don't compromise yourself. You're all you've got.", author: "Janis Joplin" },
  { text: "I'm not interested in perfection.", author: "PJ Harvey" },
  { text: "I don't want to entertain. I want to provoke.", author: "Peaches" },
  { text: "Everything can become sound.", author: "Holly Herndon" },
  { text: "No sound is innocent.", author: "Kim Gordon" },
  { text: "Authenticity is more punk than punk.", author: "Kim Gordon" },
  { text: "Do things that scare you a little.", author: "FKA twigs" },
  { text: "Creativity needs discipline.", author: "FKA twigs" },
  { text: "Vulnerability is strength.", author: "Sufjan Stevens" },
  { text: "Songs are conversations.", author: "Phoebe Bridgers" },
  { text: "Imperfection is human.", author: "Kurt Cobain" },
  { text: "Emotion always wins.", author: "Robert Smith" },
  { text: "Do something that only you can do.", author: "James Murphy" },
  { text: "Art has to move.", author: "James Murphy" },
  { text: "The error is the doorway.", author: "Arca" },
  { text: "Noise can be beautiful.", author: "Lee Ranaldo" },
  { text: "Alternative means making your own rules.", author: "Kim Deal" },
  { text: "The imagination is survival.", author: "Kate Bush" },
  { text: "Don't chase trends.", author: "Grace Jones" },
  { text: "There's beauty in accidents.", author: "John Frusciante" },
  { text: "Everything is experimentation.", author: "John Cale" },
  { text: "Don't seek validation.", author: "Grimes" },
  { text: "Identity is fluid.", author: "Anohni" },
  { text: "Art and life are not separate.", author: "Yoko Ono" },
  { text: "The strange has more future than the normal.", author: "Genesis P-Orridge" },
  { text: "Be intense, not perfect.", author: "Fiona Apple" },
  { text: "Make your own mythology.", author: "Jarvis Cocker" },
  { text: "Success is freedom.", author: "Iggy Pop" },
  { text: "Boredom is counter-revolutionary.", author: "Iggy Pop" },
  { text: "Music freezes time.", author: "Nick Cave" },
  { text: "I always trusted intuition over technique.", author: "PJ Harvey" },
  { text: "Everything has rhythm.", author: "Sun Ra" },
  { text: "Space is the place.", author: "Sun Ra" },
  { text: "Style comes after vision.", author: "Flying Lotus" },
  { text: "Be impossible to categorize.", author: "Flying Lotus" },
  { text: "Sound is physical.", author: "Autechre" },
  { text: "Limitations create freedom.", author: "Burial" },
  { text: "Emotion is a universal language.", author: "Bono" },
  { text: "I wanted to create a world.", author: "Kate Bush" },
  { text: "Art should challenge certainty.", author: "Scott Walker" },
  { text: "I prefer mystery.", author: "Scott Walker" },
  { text: "There's no perfect sound.", author: "Steve Albini" },
  { text: "Honesty sounds better.", author: "Steve Albini" },
  { text: "Everything starts from curiosity.", author: "Four Tet" },
  { text: "Genre boundaries are imaginary.", author: "Kieran Hebden" },
  { text: "Music should surprise you.", author: "Nils Frahm" },
  { text: "Silence matters.", author: "Nils Frahm" },
  { text: "Feel first, think later.", author: "Portishead" },
  { text: "Atmosphere tells stories.", author: "Beth Gibbons" },
  { text: "Risk is necessary.", author: "LCD Soundsystem" },
  { text: "There's value in discomfort.", author: "St. Vincent" },
  { text: "Pop can be serious art.", author: "Janelle Monáe" },
  { text: "Don't wait for permission.", author: "Amanda Palmer" },
  { text: "Make work that feels alive.", author: "Perfume Genius" },
  { text: "Music creates impossible spaces.", author: "Tim Hecker" },
  { text: "Everything starts with listening.", author: "Ryuichi Sakamoto" },
  { text: "Remain vulnerable.", author: "Leonard Cohen" },
];

export default function LoadingVinyl() {
  // Pick random quote during server render
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return (
    <div className={styles.loaderOverlay}>
      <div className={styles.vinylContainer}>
        <svg viewBox="0 0 100 100" className={styles.vinylSvg}>
          <circle cx="50" cy="50" r="45" fill="#111" stroke="#333" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="#222" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#222" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="15" fill="#1ED760" />
          <circle cx="50" cy="50" r="2" fill="#090909" />
        </svg>
      </div>
      <div className={styles.quoteBlock}>
        <p className={styles.quoteText}>"{quote.text}"</p>
        <p className={styles.quoteAuthor}>— {quote.author}</p>
      </div>
    </div>
  );
}

