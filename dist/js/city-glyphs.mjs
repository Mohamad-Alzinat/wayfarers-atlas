// Ordered cells in the original transparent ink-and-wash illustration sheet.
const landmarks = [
  ["stormwind", "Bannerman's keep"],
  ["ironforge", "Mountain forge"],
  ["darnassus", "Canopy shrine"],
  ["orgrimmar", "Tusked war gate"],
  ["thunderbluff", "Mesa and sky lodge"],
  ["undercity", "Sunken crypt"],
  ["dalaran", "Arcane spires"],
  ["valanaar", "Sky-isle pavilion"],
];
const cities = new Map(
  landmarks.map(([id, description], i) => {
    const x = (i % 4) * 192,
      y = Math.floor(i / 4) * 192;
    return [
      id,
      {
        description,
        svg: `<svg class="cityArt" x="-30" y="-30" width="60" height="60" viewBox="${x} ${y} 192 192" overflow="hidden" aria-hidden="true"><image href="assets/city-landmarks.webp" width="768" height="384"/></svg>`,
      },
    ];
  }),
);
export const cityArtwork = (id) => cities.get(id);
