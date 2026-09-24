/** Development catalog for Alora Fashion (Indian women's ethnic wear). */

export type AloraCatalogProduct = {
  handle: string;
  title: string;
  shortDescription: string;
  description: string;
  pricePaise: number;
  compareAtPricePaise: number;
  sku: string;
  variantTitle: string;
  initialQuantity: number;
};

export const ALORA_WOMEN_CATEGORY = {
  name: "Women's Ethnic Wear",
  slug: "womens-ethnic-wear",
} as const;

export const ALORA_WOMEN_PRODUCTS: readonly AloraCatalogProduct[] = [
  {
    handle: "emerald-kanjeevaram-saree",
    title: "Emerald Kanjeevaram Silk Saree",
    shortDescription: "Handloom Kanjeevaram silk in deep emerald with gold temple border.",
    description:
      "A classic South Indian Kanjeevaram woven in rich emerald silk with a broad gold zari temple border and soft contrast pallu. Includes an unstitched matching blouse piece. Ideal for weddings and festive gatherings. Dry clean only.",
    pricePaise: 1_899_900,
    compareAtPricePaise: 2_199_900,
    sku: "ALORA-W-KJV-EMR-OS",
    variantTitle: "One Size",
    initialQuantity: 25,
  },
  {
    handle: "ivory-chanderi-suit-set",
    title: "Ivory Chanderi Silk Suit Set",
    shortDescription: "Lightweight ivory Chanderi kurta, pant, and dupatta set.",
    description:
      "Airy ivory Chanderi silk suit with subtle gold butis, straight pants, and a sheer embroidered dupatta. Soft lining for comfort. Perfect for daytime celebrations and poojas.",
    pricePaise: 649_900,
    compareAtPricePaise: 749_900,
    sku: "ALORA-W-CHN-IVY-M",
    variantTitle: "Medium",
    initialQuantity: 40,
  },
  {
    handle: "rose-chikankari-kurta-set",
    title: "Rose Pink Chikankari Kurta Set",
    shortDescription: "Lucknowi chikankari on soft rose mulmul cotton.",
    description:
      "Hand-inspired white chikankari embroidery on rose-pink mulmul cotton. Comes with matching cotton pants and a lightweight chiffon dupatta. Breathable everyday-festive wear.",
    pricePaise: 429_900,
    compareAtPricePaise: 499_900,
    sku: "ALORA-W-CHK-RSE-M",
    variantTitle: "Medium",
    initialQuantity: 50,
  },
  {
    handle: "midnight-anarkali-dupatta",
    title: "Midnight Blue Anarkali with Dupatta",
    shortDescription: "Flared georgette Anarkali in midnight blue with silver work.",
    description:
      "Floor-grazing midnight blue georgette Anarkali with silver sequin and thread work on the yoke, flared kalidar skirt, lined pants, and matching net dupatta. Statement festive silhouette.",
    pricePaise: 899_900,
    compareAtPricePaise: 1_099_900,
    sku: "ALORA-W-ANR-MID-M",
    variantTitle: "Medium",
    initialQuantity: 30,
  },
  {
    handle: "mustard-bandhani-lehenga",
    title: "Mustard Bandhani Lehenga Set",
    shortDescription: "Rajasthani mustard bandhani lehenga with mirror work.",
    description:
      "Vibrant mustard bandhani printed lehenga with mirror and gota accents, matching choli blouse, and odhani. Celebratory Gujarati-Rajasthani festive set for sangeet and day functions.",
    pricePaise: 1_299_900,
    compareAtPricePaise: 1_499_900,
    sku: "ALORA-W-BND-MST-M",
    variantTitle: "Medium",
    initialQuantity: 20,
  },
  {
    handle: "teal-organza-sharara",
    title: "Teal Organza Sharara Set",
    shortDescription: "Sheer teal organza kurta with flared sharara pants.",
    description:
      "Contemporary teal organza kurta with delicate floral embroidery, wide sharara pants, and a soft tissue dupatta. Lined for opacity. Modern wedding-guest look.",
    pricePaise: 799_900,
    compareAtPricePaise: 949_900,
    sku: "ALORA-W-SHR-TEA-M",
    variantTitle: "Medium",
    initialQuantity: 28,
  },
  {
    handle: "coral-cotton-kurti",
    title: "Coral Floral Cotton Kurti",
    shortDescription: "Everyday coral printed cotton A-line kurti.",
    description:
      "Soft coral cotton A-line kurti with small floral print, three-quarter sleeves, and side slits. Easy to pair with jeans or leggings for office and errands.",
    pricePaise: 149_900,
    compareAtPricePaise: 189_900,
    sku: "ALORA-W-KRT-CRL-M",
    variantTitle: "Medium",
    initialQuantity: 80,
  },
  {
    handle: "black-embroidered-coord",
    title: "Black Embroidered Palazzo Co-ord",
    shortDescription: "Black cotton co-ord with tonal thread embroidery.",
    description:
      "Sleek black cotton short kurti and wide palazzo with tonal thread embroidery on the neckline and hem. Comfortable all-day ethnic co-ord for dinners and travel.",
    pricePaise: 349_900,
    compareAtPricePaise: 399_900,
    sku: "ALORA-W-CRD-BLK-M",
    variantTitle: "Medium",
    initialQuantity: 45,
  },
  {
    handle: "gold-tissue-silk-saree",
    title: "Gold Tissue Silk Saree",
    shortDescription: "Shimmering gold tissue silk with fine zari border.",
    description:
      "Lightweight gold tissue silk saree with a fine zari border and soft sheen. Includes a contrast blouse piece. Evening and wedding-guest favourite.",
    pricePaise: 999_900,
    compareAtPricePaise: 1_199_900,
    sku: "ALORA-W-TIS-GLD-OS",
    variantTitle: "One Size",
    initialQuantity: 22,
  },
  {
    handle: "mint-linen-kurta",
    title: "Mint Handloom Linen Kurta",
    shortDescription: "Breathable mint linen kurta with mandarin collar.",
    description:
      "Handloom linen kurta in fresh mint with mandarin collar, wooden buttons, and side slits. Relaxed fit for humid Indian summers. Pair with white pants.",
    pricePaise: 279_900,
    compareAtPricePaise: 329_900,
    sku: "ALORA-W-LIN-MNT-M",
    variantTitle: "Medium",
    initialQuantity: 55,
  },
  {
    handle: "wine-velvet-festive-suit",
    title: "Wine Velvet Festive Suit",
    shortDescription: "Winter festive wine velvet kurta with zari motifs.",
    description:
      "Luxe wine velvet straight kurta with gold zari motifs, silk pants, and a soft velvet-trimmed dupatta. Designed for winter weddings and evening functions.",
    pricePaise: 1_199_900,
    compareAtPricePaise: 1_399_900,
    sku: "ALORA-W-VLV-WNE-M",
    variantTitle: "Medium",
    initialQuantity: 18,
  },
  {
    handle: "indigo-dabu-print-dress",
    title: "Indigo Dabu Print Maxi Dress",
    shortDescription: "Rajasthani indigo dabu block-print cotton maxi.",
    description:
      "Natural indigo dabu block-printed cotton maxi dress with gathered waist and flutter sleeves. Artisan print from Rajasthan. Casual ethnic daywear.",
    pricePaise: 249_900,
    compareAtPricePaise: 299_900,
    sku: "ALORA-W-DAB-IND-M",
    variantTitle: "Medium",
    initialQuantity: 60,
  },
  {
    handle: "peach-georgette-salwar",
    title: "Peach Georgette Salwar Suit",
    shortDescription: "Soft peach georgette suit with sequin spray.",
    description:
      "Peach georgette salwar suit with light sequin spray on the kurta, matching salwar, and chiffon dupatta. Flowy silhouette for mehendi and brunch events.",
    pricePaise: 549_900,
    compareAtPricePaise: 649_900,
    sku: "ALORA-W-SLW-PCH-M",
    variantTitle: "Medium",
    initialQuantity: 35,
  },
  {
    handle: "ivory-pearl-lehenga",
    title: "Ivory Pearl Embellished Lehenga",
    shortDescription: "Ivory net lehenga with pearl and crystal work.",
    description:
      "Reception-ready ivory net lehenga with pearl and crystal embellishment on the blouse and lehenga panels, plus a soft tulle dupatta. Soft pastel bridal alternative.",
    pricePaise: 2_499_900,
    compareAtPricePaise: 2_899_900,
    sku: "ALORA-W-LHN-IVY-M",
    variantTitle: "Medium",
    initialQuantity: 12,
  },
  {
    handle: "rust-handloom-saree",
    title: "Rust Orange Handloom Cotton Saree",
    shortDescription: "Everyday handloom cotton saree in rust orange.",
    description:
      "Handloom cotton saree in rust orange with thin contrast borders and soft body. Easy to drape for work and daily wear. Machine wash gentle.",
    pricePaise: 219_900,
    compareAtPricePaise: 259_900,
    sku: "ALORA-W-HLM-RST-OS",
    variantTitle: "One Size",
    initialQuantity: 70,
  },
  {
    handle: "lavender-sequin-gown",
    title: "Lavender Sequin Party Gown",
    shortDescription: "Floor-length lavender sequin gown for cocktail nights.",
    description:
      "Floor-length lavender gown with all-over micro sequins, fitted bodice, and soft flare from the knee. Indo-western evening option for cocktail parties.",
    pricePaise: 1_099_900,
    compareAtPricePaise: 1_299_900,
    sku: "ALORA-W-GWN-LAV-M",
    variantTitle: "Medium",
    initialQuantity: 16,
  },
  {
    handle: "cream-kasavu-saree",
    title: "Cream Kerala Kasavu Saree",
    shortDescription: "Traditional Onam kasavu with golden border.",
    description:
      "Cream Kerala kasavu cotton-silk saree with the classic golden kasavu border. Includes a matching blouse piece. Essential for Onam and temple festivals.",
    pricePaise: 399_900,
    compareAtPricePaise: 449_900,
    sku: "ALORA-W-KSV-CRM-OS",
    variantTitle: "One Size",
    initialQuantity: 40,
  },
  {
    handle: "red-bridal-banarasi-lehenga",
    title: "Red Bridal Banarasi Lehenga",
    shortDescription: "Bridal red Banarasi silk lehenga with heavy zari.",
    description:
      "Bridal red Banarasi silk lehenga with dense gold zari motifs, structured blouse, and heavily woven dupatta. Statement wedding wear from Varanasi-inspired craft.",
    pricePaise: 3_499_900,
    compareAtPricePaise: 3_999_900,
    sku: "ALORA-W-BRD-RED-M",
    variantTitle: "Medium",
    initialQuantity: 8,
  },
  {
    handle: "olive-straight-kurta-set",
    title: "Olive Cotton Straight Kurta Set",
    shortDescription: "Olive cotton straight kurta with pants and stole.",
    description:
      "Olive cotton straight kurta with subtle pintucks, matching pants, and a printed stole. Office-friendly ethnic set that layers well under jackets.",
    pricePaise: 299_900,
    compareAtPricePaise: 349_900,
    sku: "ALORA-W-STR-OLV-M",
    variantTitle: "Medium",
    initialQuantity: 48,
  },
  {
    handle: "fuchsia-pre-draped-saree",
    title: "Fuchsia Pre-Draped Georgette Saree",
    shortDescription: "Ready-to-wear fuchsia georgette saree with belt.",
    description:
      "Pre-draped fuchsia georgette saree with attached petticoat, stretch blouse, and removable belt for a modern silhouette. No pins needed—ideal for parties.",
    pricePaise: 459_900,
    compareAtPricePaise: 549_900,
    sku: "ALORA-W-PDS-FCH-M",
    variantTitle: "Medium",
    initialQuantity: 32,
  },
];
