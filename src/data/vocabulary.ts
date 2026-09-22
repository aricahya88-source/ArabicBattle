export type Difficulty = 'easy' | 'medium' | 'hard';
export type Relation = 'on' | 'under' | 'beside' | 'inside' | 'near' | 'none';
export interface VocabularyItem {
  id: string; arabic: string; latin: string; idn: string; en: string;
  category: string; difficulty: Difficulty; points: number; color?: string;
}

export const VOCAB: Record<string, VocabularyItem> = {
  book: { id:'book', arabic:'كِتَابٌ', latin:'kitābun', idn:'Buku', en:'Book', category:'study', difficulty:'easy', points:50 },
  redBook: { id:'redBook', arabic:'كِتَابٌ أَحْمَرُ', latin:'kitābun aḥmaru', idn:'Buku merah', en:'Red book', category:'study', difficulty:'medium', points:80, color:'red' },
  blueBook: { id:'blueBook', arabic:'كِتَابٌ أَزْرَقُ', latin:'kitābun azraqu', idn:'Buku biru', en:'Blue book', category:'study', difficulty:'medium', points:80, color:'blue' },
  chair: { id:'chair', arabic:'كُرْسِيٌّ', latin:'kursiyyun', idn:'Kursi', en:'Chair', category:'furniture', difficulty:'easy', points:50 },
  desk: { id:'desk', arabic:'مَكْتَبٌ', latin:'maktabun', idn:'Meja belajar', en:'Desk', category:'furniture', difficulty:'easy', points:50 },
  lamp: { id:'lamp', arabic:'مِصْبَاحٌ', latin:'miṣbāḥun', idn:'Lampu', en:'Lamp', category:'room', difficulty:'easy', points:50 },
  bag: { id:'bag', arabic:'حَقِيبَةٌ', latin:'ḥaqībatun', idn:'Tas', en:'Bag', category:'school', difficulty:'easy', points:50 },
  key: { id:'key', arabic:'مِفْتَاحٌ', latin:'miftāḥun', idn:'Kunci', en:'Key', category:'object', difficulty:'medium', points:80 },
  ball: { id:'ball', arabic:'كُرَةٌ', latin:'kuratun', idn:'Bola', en:'Ball', category:'object', difficulty:'easy', points:50 },
  ballUnderBed: { id:'ballUnderBed', arabic:'كُرَةٌ تَحْتَ السَّرِيرِ', latin:'kuratun taḥta as-sarīri', idn:'Bola di bawah tempat tidur', en:'Ball under the bed', category:'spatial', difficulty:'hard', points:120 },
  bed: { id:'bed', arabic:'سَرِيرٌ', latin:'sarīrun', idn:'Tempat tidur', en:'Bed', category:'furniture', difficulty:'easy', points:50 },
  pillow: { id:'pillow', arabic:'وِسَادَةٌ', latin:'wisādatun', idn:'Bantal', en:'Pillow', category:'room', difficulty:'easy', points:50 },
  wardrobe: { id:'wardrobe', arabic:'خِزَانَةٌ', latin:'khizānatun', idn:'Lemari', en:'Wardrobe', category:'furniture', difficulty:'medium', points:80 },
  window: { id:'window', arabic:'نَافِذَةٌ', latin:'nāfidhatun', idn:'Jendela', en:'Window', category:'room', difficulty:'easy', points:50 },
  door: { id:'door', arabic:'بَابٌ', latin:'bābun', idn:'Pintu', en:'Door', category:'room', difficulty:'easy', points:50 },
  clock: { id:'clock', arabic:'سَاعَةٌ', latin:'sāʿatun', idn:'Jam', en:'Clock', category:'room', difficulty:'easy', points:50 },
  plant: { id:'plant', arabic:'نَبَاتٌ', latin:'nabātun', idn:'Tanaman', en:'Plant', category:'decor', difficulty:'easy', points:50 },
  computer: { id:'computer', arabic:'حَاسُوبٌ', latin:'ḥāsūbun', idn:'Komputer', en:'Computer', category:'study', difficulty:'medium', points:80 },
  keyboard: { id:'keyboard', arabic:'لَوْحَةُ الْمَفَاتِيحِ', latin:'lawḥatu al-mafātīḥ', idn:'Papan ketik', en:'Keyboard', category:'study', difficulty:'hard', points:120 },
  mouse: { id:'mouse', arabic:'فَأْرَةُ الْحَاسُوبِ', latin:'faʾratu al-ḥāsūb', idn:'Mouse komputer', en:'Computer mouse', category:'study', difficulty:'hard', points:120 },
  notebook: { id:'notebook', arabic:'دَفْتَرٌ', latin:'daftarun', idn:'Buku tulis', en:'Notebook', category:'study', difficulty:'easy', points:50 },
  pen: { id:'pen', arabic:'قَلَمٌ', latin:'qalamun', idn:'Pena', en:'Pen', category:'study', difficulty:'easy', points:50 },
  bottle: { id:'bottle', arabic:'زُجَاجَةٌ', latin:'zujājatun', idn:'Botol', en:'Bottle', category:'object', difficulty:'medium', points:80 },
  cup: { id:'cup', arabic:'كُوبٌ', latin:'kūbun', idn:'Cangkir', en:'Cup', category:'object', difficulty:'easy', points:50 },
  rug: { id:'rug', arabic:'سَجَّادَةٌ', latin:'sajjādatun', idn:'Karpet', en:'Rug', category:'room', difficulty:'medium', points:80 },
  shelf: { id:'shelf', arabic:'رَفٌّ', latin:'raffun', idn:'Rak', en:'Shelf', category:'furniture', difficulty:'medium', points:80 }
};
