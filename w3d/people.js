/* The people who matter, each recognisable at a glance: a look in the world (outfit, build, what they carry), a hand on
   the page and a seal on the letter. Everyone else is drawn from the general outfits. Hands are macOS script faces with
   cursive fallbacks; the letter can always be read in the secretary's fair copy instead. */
export const PEOPLE = {
  maria_theresa: { hand: '"Snell Roundhand","Apple Chancery",cursive', seal: ['#1c1b1f', '#d9b25a', 'M'] },
  bartenstein: { look: { kind: 'clerk', props: ['spectacles', 'papers'] }, hand: '"Apple Chancery","Snell Roundhand",cursive', seal: ['#5a2a3a', '#e8d6b0', 'B'] },
  sinzendorf: { look: { kind: 'minister', scale: [1.14, 1, 1.12], props: ['star'] }, hand: '"Snell Roundhand",cursive', seal: ['#2c3a5a', '#e8d6b0', 'S'] },
  starhemberg: { look: { kind: 'courtier', scale: [1, .95, 1], props: ['cane'] }, hand: '"Savoye LET","Apple Chancery",cursive', seal: ['#3a3a2a', '#e8d6b0', 'S'] },
  neipperg: { look: { kind: 'general', props: ['cane'] }, hand: '"Bradley Hand","Chalkboard",cursive', seal: ['#6a1e1a', '#f0e2c0', 'N'] },
  wallis: { hand: '"Bradley Hand",cursive', seal: ['#3a4a2a', '#e8d6b0', 'W'] },
  frederick: { hand: '"Snell Roundhand",cursive', seal: ['#1a2a4a', '#e8e0d0', 'F'] },
  countess_khevenhuller: { hand: '"Savoye LET","Snell Roundhand",cursive', seal: ['#7a3a5a', '#f2e6d8', 'K'] },
};
export const personOf = id => PEOPLE[id] || {};
