/** Platform global catalog: Jewellery parent + leaf categories, 16 products, 2 name-matched images each. */

export const JEWELLERY_PARENT = { name: "Jewellery", slug: "jewellery" } as const;

export const JEWELLERY_CHILD_CATEGORIES = [
  { name: "Rings", slug: "rings" as const },
  { name: "Chains", slug: "chains" as const },
  { name: "Earrings", slug: "earrings" as const },
  { name: "Necklaces", slug: "necklaces" as const },
  { name: "Bracelets", slug: "bracelets" as const },
  { name: "Bangles", slug: "bangles" as const },
  { name: "Pendants", slug: "pendants" as const },
  { name: "Anklets", slug: "anklets" as const },
] as const;

export type JewelleryCategorySlug = (typeof JEWELLERY_CHILD_CATEGORIES)[number]["slug"];

export type JewelleryCatalogProduct = {
  title: string;
  handle: string;
  shortDescription: string;
  description: string;
  sku: string;
  variantTitle: string;
  pricePaise: number;
  categorySlug: JewelleryCategorySlug;
  imageFiles: readonly [string, string];
  imagePrompts: readonly [string, string];
};

const STUDIO =
  "isolated on a pure white seamless studio background, soft professional lighting, sharp focus, high detail, no people, no hands, no text overlay, no watermark, commercial catalog style";

function frontPrompt(exactProduct: string): string {
  return `Photorealistic ecommerce product photography of ${exactProduct}, front three-quarter view, ${STUDIO}`;
}

function anglePrompt(exactProduct: string): string {
  return `Photorealistic ecommerce product photography of the exact same ${exactProduct} from a different camera angle, side three-quarter view, ${STUDIO}`;
}

function imagesFor(handle: string, exactProduct: string): Pick<JewelleryCatalogProduct, "imageFiles" | "imagePrompts"> {
  return {
    imageFiles: [`${handle}-front.png`, `${handle}-angle.png`],
    imagePrompts: [frontPrompt(exactProduct), anglePrompt(exactProduct)],
  };
}

export const JEWELLERY_PRODUCTS: readonly JewelleryCatalogProduct[] = [
  {
    title: "Gold Solitaire Ring",
    handle: "gold-solitaire-ring",
    categorySlug: "rings",
    shortDescription: "22K yellow gold solitaire ring with a round brilliant diamond.",
    description:
      "Classic 22K yellow gold solitaire ring with a round brilliant-cut diamond in a four-prong setting. Comfort-fit band for daily and bridal wear. Hallmarked gold.",
    sku: "GC-JEWL-RNG-001",
    variantTitle: "Size 12 / 14mm",
    pricePaise: 4_599_900,
    ...imagesFor(
      "gold-solitaire-ring",
      "a 22K yellow gold solitaire ring named Gold Solitaire Ring with a single round brilliant diamond in a four-prong setting and a polished gold band",
    ),
  },
  {
    title: "Oxidized Silver Statement Ring",
    handle: "oxidized-silver-statement-ring",
    categorySlug: "rings",
    shortDescription: "Bold oxidized sterling silver statement ring with tribal texture.",
    description:
      "Hand-finished oxidized sterling silver statement ring with raised tribal texture and an antique blackened finish. Wide cocktail silhouette. Nickel-free.",
    sku: "GC-JEWL-RNG-002",
    variantTitle: "Size 14 / adjustable",
    pricePaise: 249_900,
    ...imagesFor(
      "oxidized-silver-statement-ring",
      "an oxidized sterling silver statement ring named Oxidized Silver Statement Ring with a wide tribal-textured blackened silver band and no gemstones",
    ),
  },
  {
    title: "18K Gold Box Chain",
    handle: "18k-gold-box-chain",
    categorySlug: "chains",
    shortDescription: "Solid 18K yellow gold square box-link chain.",
    description:
      "Solid 18K yellow gold box chain with tightly interlocked square links and a lobster clasp. Medium weight for daily wear over kurtas or shirts. Hallmarked.",
    sku: "GC-JEWL-CHN-001",
    variantTitle: "20 inch",
    pricePaise: 3_299_900,
    ...imagesFor(
      "18k-gold-box-chain",
      "an 18K yellow gold square box-link chain named 18K Gold Box Chain coiled to show the geometric box links and lobster clasp",
    ),
  },
  {
    title: "Sterling Silver Figaro Chain",
    handle: "sterling-silver-figaro-chain",
    categorySlug: "chains",
    shortDescription: "925 sterling silver Figaro chain with polished links.",
    description:
      "Classic 925 sterling silver Figaro chain with the 3+1 flattened-link pattern and a secure lobster clasp. Anti-tarnish finish. Unisex everyday chain.",
    sku: "GC-JEWL-CHN-002",
    variantTitle: "22 inch",
    pricePaise: 449_900,
    ...imagesFor(
      "sterling-silver-figaro-chain",
      "a 925 sterling silver Figaro chain named Sterling Silver Figaro Chain showing the classic 3-plus-1 flattened silver links and lobster clasp",
    ),
  },
  {
    title: "Pearl Drop Jhumkas",
    handle: "pearl-drop-jhumkas",
    categorySlug: "earrings",
    shortDescription: "Traditional gold-tone jhumkas with hanging pearl drops.",
    description:
      "Bell-shaped gold-tone jhumkas with pearl bead drops and a textured dome. Lightweight for festive and wedding wear. Push-back closure.",
    sku: "GC-JEWL-EAR-001",
    variantTitle: "Pair",
    pricePaise: 329_900,
    ...imagesFor(
      "pearl-drop-jhumkas",
      "a pair of traditional gold-tone bell-shaped jhumka earrings named Pearl Drop Jhumkas with hanging white pearl drops at the bottom",
    ),
  },
  {
    title: "Gold Hoop Earrings",
    handle: "gold-hoop-earrings",
    categorySlug: "earrings",
    shortDescription: "Polished 22K yellow gold medium hoop earrings.",
    description:
      "Medium circular 22K yellow gold hoop earrings with a high-polish finish and snap-hinge closure. Everyday ethnic and western pairing. Hallmarked gold.",
    sku: "GC-JEWL-EAR-002",
    variantTitle: "Pair / 30mm",
    pricePaise: 1_899_900,
    ...imagesFor(
      "gold-hoop-earrings",
      "a pair of polished 22K yellow gold medium circular hoop earrings named Gold Hoop Earrings standing upright with a high-shine gold finish and no stones",
    ),
  },
  {
    title: "Kundan Bridal Necklace",
    handle: "kundan-bridal-necklace",
    categorySlug: "necklaces",
    shortDescription: "Heavy kundan bridal necklace with uncut stones and pearls.",
    description:
      "Traditional kundan bridal necklace in gold-tone setting with uncut polki-style stones, ruby accents, and a pearl hangings fringe. Occasion wear for weddings.",
    sku: "GC-JEWL-NCK-001",
    variantTitle: "One size",
    pricePaise: 2_499_900,
    ...imagesFor(
      "kundan-bridal-necklace",
      "a heavy traditional kundan bridal necklace named Kundan Bridal Necklace with uncut polki stones, ruby accents, and hanging pearls in a gold-tone setting",
    ),
  },
  {
    title: "Layered Gold Necklace",
    handle: "layered-gold-necklace",
    categorySlug: "necklaces",
    shortDescription: "Three-strand layered 22K gold necklace.",
    description:
      "Contemporary three-layer 22K yellow gold necklace with graduated chain lengths and a single clasp. Light enough for office and evening wear.",
    sku: "GC-JEWL-NCK-002",
    variantTitle: "16–18 inch layers",
    pricePaise: 1_249_900,
    ...imagesFor(
      "layered-gold-necklace",
      "a three-strand layered 22K yellow gold necklace named Layered Gold Necklace showing three graduated gold chains joined at one clasp and no pendants",
    ),
  },
  {
    title: "Diamond Tennis Bracelet",
    handle: "diamond-tennis-bracelet",
    categorySlug: "bracelets",
    shortDescription: "Line bracelet of matched round diamonds in white gold.",
    description:
      "Classic tennis bracelet with a continuous line of matched round diamonds set in 18K white gold. Box clasp with safety latch. Evening and bridal wear.",
    sku: "GC-JEWL-BRC-001",
    variantTitle: "7 inch",
    pricePaise: 3_999_900,
    ...imagesFor(
      "diamond-tennis-bracelet",
      "an 18K white gold diamond tennis bracelet named Diamond Tennis Bracelet with a continuous line of matched round diamonds and a box clasp",
    ),
  },
  {
    title: "Gold Cuff Bracelet",
    handle: "gold-cuff-bracelet",
    categorySlug: "bracelets",
    shortDescription: "Open 22K yellow gold cuff bracelet with hammered texture.",
    description:
      "Open-ended 22K yellow gold cuff bracelet with a hammered texture and smooth inner surface. Slip-on fit. Statement festive bracelet.",
    sku: "GC-JEWL-BRC-002",
    variantTitle: "Medium cuff",
    pricePaise: 1_599_900,
    ...imagesFor(
      "gold-cuff-bracelet",
      "an open 22K yellow gold cuff bracelet named Gold Cuff Bracelet with a hammered gold texture, open ends, and no gemstones",
    ),
  },
  {
    title: "Traditional Gold Bangles",
    handle: "traditional-gold-bangles",
    categorySlug: "bangles",
    shortDescription: "Pair of 22K yellow gold traditional round bangles.",
    description:
      "Matched pair of 22K yellow gold traditional round bangles with a plain high-polish surface and slightly rounded profile. Stackable wedding essential. Hallmarked.",
    sku: "GC-JEWL-BNG-001",
    variantTitle: "Pair / 2.6 size",
    pricePaise: 8_999_900,
    ...imagesFor(
      "traditional-gold-bangles",
      "a pair of 22K yellow gold traditional round bangles named Traditional Gold Bangles stacked together with a plain high-polish gold surface and no stones",
    ),
  },
  {
    title: "Meenakari Enamel Bangles",
    handle: "meenakari-enamel-bangles",
    categorySlug: "bangles",
    shortDescription: "Colourful Rajasthani meenakari enamel bangle pair.",
    description:
      "Pair of gold-tone meenakari enamel bangles with red, green, and peacock-blue floral enamel on the outer surface. Festive Rajasthani craft style.",
    sku: "GC-JEWL-BNG-002",
    variantTitle: "Pair / 2.6 size",
    pricePaise: 549_900,
    ...imagesFor(
      "meenakari-enamel-bangles",
      "a pair of gold-tone Rajasthani meenakari enamel bangles named Meenakari Enamel Bangles with red green and peacock-blue floral enamel on the outer surface",
    ),
  },
  {
    title: "Om Gold Pendant",
    handle: "om-gold-pendant",
    categorySlug: "pendants",
    shortDescription: "22K yellow gold Om symbol pendant.",
    description:
      "Solid 22K yellow gold pendant shaped as the Om (Aum) symbol with a polished finish and a small bail for a chain. Daily spiritual wear. Pendant only.",
    sku: "GC-JEWL-PND-001",
    variantTitle: "Pendant only",
    pricePaise: 899_900,
    ...imagesFor(
      "om-gold-pendant",
      "a 22K yellow gold Om Aum symbol pendant named Om Gold Pendant with a polished gold Om glyph and a small bail, pendant only without a chain",
    ),
  },
  {
    title: "Pearl Gold Pendant",
    handle: "pearl-gold-pendant",
    categorySlug: "pendants",
    shortDescription: "Single cultured pearl drop on a 22K gold bail.",
    description:
      "Solitaire cultured white pearl pendant suspended from a 22K yellow gold bail and small gold cap. Minimal everyday pendant. Pendant only.",
    sku: "GC-JEWL-PND-002",
    variantTitle: "Pendant only",
    pricePaise: 649_900,
    ...imagesFor(
      "pearl-gold-pendant",
      "a single cultured white pearl drop pendant named Pearl Gold Pendant with a 22K yellow gold cap and bail, pendant only without a chain",
    ),
  },
  {
    title: "Silver Payal Anklet",
    handle: "silver-payal-anklet",
    categorySlug: "anklets",
    shortDescription: "Traditional 925 silver payal anklet with ghungroo bells.",
    description:
      "Traditional 925 sterling silver payal anklet with tiny ghungroo bells along the chain and a hook clasp. Sold as a single anklet. Oxidized silver finish.",
    sku: "GC-JEWL-ANK-001",
    variantTitle: "Single / 10 inch",
    pricePaise: 179_900,
    ...imagesFor(
      "silver-payal-anklet",
      "a traditional 925 sterling silver payal anklet named Silver Payal Anklet with tiny ghungroo bells along the silver chain and a hook clasp",
    ),
  },
  {
    title: "Gold Beaded Anklet",
    handle: "gold-beaded-anklet",
    categorySlug: "anklets",
    shortDescription: "22K gold anklet with spaced gold beads.",
    description:
      "Delicate 22K yellow gold anklet with evenly spaced gold beads on a fine chain and a lobster clasp. Lightweight daily ethnic anklet. Sold as a single piece.",
    sku: "GC-JEWL-ANK-002",
    variantTitle: "Single / 10 inch",
    pricePaise: 749_900,
    ...imagesFor(
      "gold-beaded-anklet",
      "a delicate 22K yellow gold beaded anklet named Gold Beaded Anklet with evenly spaced gold beads on a fine gold chain and a lobster clasp",
    ),
  },
];

export const JEWELLERY_MEDIA_DIR = "global-catalog-media";

export function assertJewelleryImageContract(): void {
  const seenFiles = new Set<string>();
  const seenPrompts = new Set<string>();
  for (const product of JEWELLERY_PRODUCTS) {
    const expectedFront = `${product.handle}-front.png`;
    const expectedAngle = `${product.handle}-angle.png`;
    if (product.imageFiles[0] !== expectedFront || product.imageFiles[1] !== expectedAngle) {
      throw new Error(
        `Jewellery images must match handle ${product.handle}: expected ${expectedFront} and ${expectedAngle}.`,
      );
    }
    if (product.imageFiles[0] === product.imageFiles[1]) {
      throw new Error(`Jewellery product ${product.handle} cannot reuse the same image file twice.`);
    }
    for (const file of product.imageFiles) {
      if (seenFiles.has(file)) {
        throw new Error(`Jewellery image file reused across products: ${file}`);
      }
      seenFiles.add(file);
    }
    for (const prompt of product.imagePrompts) {
      if (seenPrompts.has(prompt)) {
        throw new Error(`Jewellery image prompt reused for ${product.handle}.`);
      }
      if (!prompt.includes(product.title)) {
        throw new Error(`Jewellery image prompt for ${product.handle} must include the product title.`);
      }
      seenPrompts.add(prompt);
    }
  }
}
