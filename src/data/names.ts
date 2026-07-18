/** Names sourced from the user's Pleb Generator vowel-name pool. */

import type { Dice } from "../engine";

const PLEB_NAMES = `
Abel Abraham Achilleus Adalbert Adela Adelheid Adrian Aegidius Agatha Agnes Agrippa Alaric Albert Alcuin Aldous Aleida Alessio Alexios Alfonso Alistair Alphonse Amalric Ambrose Amina Ammon Amos Anselm Anshel Anton Antonia Anubis Apollonia Aramis Arbogast Arend Ariadne Arminius Arnulf Arsenius Arthur Ascanio Ashur Aspasia Astolfo Athanasius Atreus Attila Aubert Augustine Aurelian
Ebba Ebenezer Eberhard Eckhart Edgar Edmund Edric Edward Egbert Ehrenfried Elanor Elias Elijah Elinor Elisabeth Eliza Elleonor Eloi Eloise Elvira Emeric Emilian Emma Erasmus Erhard Eric Erland Ernest Erwin Esau Esmeralda Esther Etienne Eudo Eugenia Eulalia Euphemia Euripides Eusebius Eva Evangeline Everard Ewald Ewan Exuperius Eystein Ezio Ezra Ezron Ezzelin
Iacobus Iago Ianus Iason Ignatius Igor Ilaria Ildefonso Ilias Ilse Immanuel Imogen Ingmar Ingo Inocencio Ioan Ioanna Ioannes Ioel Ion Ippolito Irene Irina Irnerius Isaak Isabel Isabella Isabeau Isadora Isambard Isandro Isarn Ishmael Isidore Iskander Isolde Itherius Ithiel Ivan Ivane Ivanna Ivar Ivo Ivonette Ivonne Iwein Izsak Izydor Izyaslav Izolda
Obadiah Octavia Octavian Oda Oddmund Odette Odile Odilo Odo Odovacar Oengus Olaf Olav Oleksiy Oliver Olivier Olwen Omar Omer Onesimus Onfroi Onuphrius Ophelia Origen Orin Orlando Orm Ormond Orpheus Orsola Osbert Osborn Oscar Oskar Osmaer Osmund Osric Oswald Oswin Ottilia Otto Ovid Owein Owyn Ozias Oziel Oznat Ozymandias Ozyas Ozer
Ubaldo Ubertino Udo Ugo Uhtred Ulbrecht Ulfric Ulf Ulfhild Uliana Ulises Ulman Ulmo Ulrich Ultan Ulyana Umar Umberto Umi Unai Uncas Undine Unger Unni Urbain Urban Urbanus Uriah Urias Urien Ursella Ursula Urszula Ursus Urte Urzica Usama Usher Uskald Ustinya Uta Utku Uther Uto Utta Uvaldo Uzair Uzi Uziel Uzziah
`.trim().split(/\s+/);

function firstUnused(start: number, excluded: ReadonlySet<string>): string {
  for (let offset = 0; offset < PLEB_NAMES.length; offset++) {
    const name = PLEB_NAMES[(start + offset) % PLEB_NAMES.length]!;
    if (!excluded.has(name)) return name;
  }
  throw new Error("Pleb name pool exhausted");
}

/** Random selection for newly rolled characters, without party duplicates. */
export function randomPlebName(dice: Dice, excluded: ReadonlySet<string> = new Set()): string {
  return firstUnused(dice.die(PLEB_NAMES.length) - 1, excluded);
}

/** Stable selection for deterministic dungeon rewards. */
export function plebNameForSeed(seed: number, excluded: ReadonlySet<string> = new Set()): string {
  let value = (seed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  const index = (value ^ (value >>> 15)) >>> 0;
  return firstUnused(index % PLEB_NAMES.length, excluded);
}

export function isPlebName(name: string): boolean {
  return PLEB_NAMES.includes(name);
}
