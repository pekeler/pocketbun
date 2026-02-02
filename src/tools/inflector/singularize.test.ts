// Ported from pocketbase/tools/inflector/singularize_test.go

import { describe, expect, it } from "bun:test";
import { singularize } from "./singularize.ts";

describe("singularize", () => {
  it("converts plural words", () => {
    const scenarios = [
      { word: "abcnese", expected: "abcnese" },
      { word: "deer", expected: "deer" },
      { word: "sheep", expected: "sheep" },
      { word: "measles", expected: "measles" },
      { word: "pox", expected: "pox" },
      { word: "media", expected: "media" },
      { word: "bliss", expected: "bliss" },
      { word: "sea-bass", expected: "sea-bass" },
      { word: "Statuses", expected: "Status" },
      { word: "Feet", expected: "Foot" },
      { word: "Teeth", expected: "Tooth" },
      { word: "abcmenus", expected: "abcmenu" },
      { word: "Quizzes", expected: "Quiz" },
      { word: "Matrices", expected: "Matrix" },
      { word: "Vertices", expected: "Vertex" },
      { word: "Indices", expected: "Index" },
      { word: "Aliases", expected: "Alias" },
      { word: "Alumni", expected: "Alumnus" },
      { word: "Bacilli", expected: "Bacillus" },
      { word: "Cacti", expected: "Cactus" },
      { word: "Fungi", expected: "Fungus" },
      { word: "Nuclei", expected: "Nucleus" },
      { word: "Radii", expected: "Radius" },
      { word: "Stimuli", expected: "Stimulus" },
      { word: "Syllabi", expected: "Syllabus" },
      { word: "Termini", expected: "Terminus" },
      { word: "Viri", expected: "Virus" },
      { word: "Faxes", expected: "Fax" },
      { word: "Crises", expected: "Crisis" },
      { word: "Axes", expected: "Axis" },
      { word: "Shoes", expected: "Shoe" },
      { word: "abcoes", expected: "abco" },
      { word: "Houses", expected: "House" },
      { word: "Mice", expected: "Mouse" },
      { word: "abcxes", expected: "abcx" },
      { word: "Movies", expected: "Movie" },
      { word: "Series", expected: "Series" },
      { word: "abcquies", expected: "abcquy" },
      { word: "Relatives", expected: "Relative" },
      { word: "Drives", expected: "Drive" },
      { word: "aardwolves", expected: "aardwolf" },
      { word: "Analyses", expected: "Analysis" },
      { word: "Diagnoses", expected: "Diagnosis" },
      { word: "People", expected: "Person" },
      { word: "Men", expected: "Man" },
      { word: "Children", expected: "Child" },
      { word: "News", expected: "News" },
      { word: "Netherlands", expected: "Netherlands" },
      { word: "Tableaus", expected: "Tableau" },
      { word: "Currencies", expected: "Currency" },
      { word: "abcs", expected: "abc" },
      { word: "abc", expected: "abc" },
    ];

    for (const scenario of scenarios) {
      expect(singularize(scenario.word)).toBe(scenario.expected);
    }
  });
});
