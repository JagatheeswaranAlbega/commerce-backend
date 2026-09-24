/** Development catalog for Zentrix (Indian baby fashion). */

export type ZentrixAgeSize =
  | "0–6 Months"
  | "6–12 Months"
  | "12–18 Months"
  | "18–24 Months / 2 Years"
  | "3 Years"
  | "4 Years"
  | "5 Years"
  | "6 Years";

export type ZentrixCategorySlug =
  | "baby-boys"
  | "baby-girls"
  | "newborn-clothing"
  | "party-occasion-wear"
  | "baby-costumes";

export type ZentrixCatalogProduct = {
  handle: string;
  title: string;
  shortDescription: string;
  description: string;
  pricePaise: number;
  compareAtPricePaise: number;
  /** Base SKU prefix; size code is appended per variant. */
  skuBase: string;
  sizes: readonly ZentrixAgeSize[];
  initialQuantityPerSize: number;
  gender: "boy" | "girl";
  categorySlug: ZentrixCategorySlug;
  modelAge: string;
  outfit: string;
  backdrop: string;
};

export const ZENTRIX_CATEGORIES = [
  { name: "Baby Boys", slug: "baby-boys" as const },
  { name: "Baby Girls", slug: "baby-girls" as const },
  { name: "Newborn Clothing", slug: "newborn-clothing" as const },
  { name: "Party & Occasion Wear", slug: "party-occasion-wear" as const },
  { name: "Baby Costumes", slug: "baby-costumes" as const },
] as const;

/** @deprecated Prefer ZENTRIX_CATEGORIES — kept for any older imports. */
export const ZENTRIX_BABY_CATEGORY = ZENTRIX_CATEGORIES[0];

const SIZE_CODE: Record<ZentrixAgeSize, string> = {
  "0–6 Months": "06",
  "6–12 Months": "612",
  "12–18 Months": "1218",
  "18–24 Months / 2 Years": "1824",
  "3 Years": "3Y",
  "4 Years": "4Y",
  "5 Years": "5Y",
  "6 Years": "6Y",
};

export function zentrixSku(skuBase: string, size: ZentrixAgeSize): string {
  return `${skuBase}-${SIZE_CODE[size]}`;
}

export const ZENTRIX_BABY_PRODUCTS: readonly ZentrixCatalogProduct[] = [
  {
    handle: "ivory-soft-cotton-romper",
    title: "Ivory Soft Cotton Romper",
    shortDescription: "Breathable ivory jersey romper with mother-of-pearl snaps.",
    description:
      "Everyday soft cotton jersey romper in warm ivory with envelope neckline and mother-of-pearl snap closures. Gentle on newborn skin. Machine wash cold.",
    pricePaise: 89_900,
    compareAtPricePaise: 109_900,
    skuBase: "ZNX-NB-IVR",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months"],
    initialQuantityPerSize: 20,
    gender: "girl",
    categorySlug: "newborn-clothing",
    modelAge: "7 months",
    outfit:
      "ivory soft cotton short-sleeve romper with subtle rib cuffs, mother-of-pearl snaps along the inseam, natural fabric texture and gentle folds",
    backdrop: "clean soft warm-white seamless studio backdrop",
  },
  {
    handle: "mint-organic-onesie",
    title: "Mint Organic Onesie",
    shortDescription: "GOTS-feel mint organic cotton onesie for everyday wear.",
    description:
      "Soft mint organic cotton onesie with nickel-free snaps and reinforced leg openings. Ideal for playdates and naps.",
    pricePaise: 79_900,
    compareAtPricePaise: 99_900,
    skuBase: "ZNX-NB-MNT",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months"],
    initialQuantityPerSize: 25,
    gender: "boy",
    categorySlug: "newborn-clothing",
    modelAge: "8 months",
    outfit:
      "soft mint green organic cotton long-sleeve onesie with nickel-free snap placket, visible cotton weave and natural creases",
    backdrop: "clean soft pale sage seamless studio backdrop",
  },
  {
    handle: "sunny-duck-print-sleepsuit",
    title: "Sunny Duck Print Sleepsuit",
    shortDescription: "Butter-yellow sleepsuit with tiny duck print.",
    description:
      "Butter-yellow cotton sleepsuit with a delicate duck print, zip front with chin guard, and footed legs for cooler nights.",
    pricePaise: 99_900,
    compareAtPricePaise: 119_900,
    skuBase: "ZNX-BC-DUK",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months"],
    initialQuantityPerSize: 20,
    gender: "boy",
    categorySlug: "baby-costumes",
    modelAge: "10 months",
    outfit:
      "butter-yellow cotton footed sleepsuit with tiny duck print, front zipper with fabric chin guard, soft fleece-feel cotton",
    backdrop: "clean soft cream seamless studio backdrop",
  },
  {
    handle: "blush-ruffle-frock",
    title: "Blush Pink Ruffle Frock",
    shortDescription: "Layered blush ruffle frock with soft cotton lining.",
    description:
      "Blush pink cotton frock with three-tier soft ruffles, covered buttons at the back, and breathable lining for festive days out.",
    pricePaise: 129_900,
    compareAtPricePaise: 149_900,
    skuBase: "ZNX-BG-BLR",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months", "18–24 Months / 2 Years"],
    initialQuantityPerSize: 15,
    gender: "girl",
    categorySlug: "baby-girls",
    modelAge: "8 months",
    outfit:
      "blush pink cotton frock with three soft ruffle tiers, short sleeves, covered back buttons, natural cotton sheen and folds",
    backdrop: "clean soft blush-beige seamless studio backdrop",
  },
  {
    handle: "navy-sailor-short-set",
    title: "Navy Sailor Short Set",
    shortDescription: "Classic navy sailor top with matching shorts.",
    description:
      "Navy cotton sailor-collar top with white contrast piping and matching soft shorts. Smart casual set for family gatherings.",
    pricePaise: 119_900,
    compareAtPricePaise: 139_900,
    skuBase: "ZNX-BC-NVY",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years"],
    initialQuantityPerSize: 15,
    gender: "boy",
    categorySlug: "baby-costumes",
    modelAge: "11 months",
    outfit:
      "navy blue cotton sailor-collar top with white piping and matching navy soft shorts, visible stitching and natural fabric drape",
    backdrop: "clean soft light-grey seamless studio backdrop",
  },
  {
    handle: "peach-angarakha-kurta-set",
    title: "Peach Angarakha Kurta Set",
    shortDescription: "Soft peach cotton angarakha with matching pant.",
    description:
      "Peach mulmul cotton angarakha-style kurta with side ties and soft pants. Lightweight ethnic wear for poojas and daytime celebrations.",
    pricePaise: 149_900,
    compareAtPricePaise: 179_900,
    skuBase: "ZNX-PO-PCH",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 12,
    gender: "girl",
    categorySlug: "party-occasion-wear",
    modelAge: "10 months",
    outfit:
      "soft peach mulmul cotton angarakha kurta with side fabric ties and matching soft peach pants, fine cotton texture and natural folds",
    backdrop: "clean soft warm ivory seamless studio backdrop",
  },
  {
    handle: "cream-dhoti-kurta-set",
    title: "Cream Dhoti Kurta with Gold Piping",
    shortDescription: "Festive cream kurta and dhoti with gold piping.",
    description:
      "Cream cotton-silk blend kurta with subtle gold piping, paired with a soft dhoti pant. Classic Indian festive look for babies.",
    pricePaise: 169_900,
    compareAtPricePaise: 199_900,
    skuBase: "ZNX-PO-CRM",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 10,
    gender: "boy",
    categorySlug: "party-occasion-wear",
    modelAge: "14 months",
    outfit:
      "cream cotton-silk baby kurta with thin gold piping and matching soft cream dhoti pant, natural fabric sheen and stitching details",
    backdrop: "clean soft warm cream seamless studio backdrop",
  },
  {
    handle: "maroon-velvet-festive-set",
    title: "Maroon Velvet Festive Jacket Set",
    shortDescription: "Maroon velvet jacket over ivory kurta set.",
    description:
      "Deep maroon soft velvet open jacket with gold-tone buttons over an ivory kurta-pant set. Statement festive wear for weddings.",
    pricePaise: 249_900,
    compareAtPricePaise: 289_900,
    skuBase: "ZNX-PO-MRN",
    sizes: [
      "6–12 Months",
      "12–18 Months",
      "18–24 Months / 2 Years",
      "3 Years",
      "4 Years",
      "5 Years",
    ],
    initialQuantityPerSize: 8,
    gender: "boy",
    categorySlug: "party-occasion-wear",
    modelAge: "15 months",
    outfit:
      "deep maroon soft velvet open jacket with gold-tone buttons over ivory kurta and pant, realistic velvet pile and fabric folds",
    backdrop: "clean soft warm taupe seamless studio backdrop",
  },
  {
    handle: "lilac-knit-cardigan-romper",
    title: "Lilac Knitted Cardigan Romper",
    shortDescription: "Soft lilac knit romper with button cardigan look.",
    description:
      "Lilac cotton-blend knitted romper styled like a cardigan with wooden buttons and ribbed hems. Cozy for cooler evenings.",
    pricePaise: 139_900,
    compareAtPricePaise: 159_900,
    skuBase: "ZNX-NB-LLC",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months"],
    initialQuantityPerSize: 15,
    gender: "girl",
    categorySlug: "newborn-clothing",
    modelAge: "7 months",
    outfit:
      "soft lilac cotton-blend knitted romper with wooden buttons down the front, ribbed cuffs and hem, visible knit texture",
    backdrop: "clean soft pale lilac-grey seamless studio backdrop",
  },
  {
    handle: "sage-linen-shirt-shorts",
    title: "Sage Linen Shirt & Shorts Set",
    shortDescription: "Breathable sage linen shirt with matching shorts.",
    description:
      "Washed sage linen shirt with coconut buttons and matching shorts. Airy set for warm Indian summers.",
    pricePaise: 159_900,
    compareAtPricePaise: 189_900,
    skuBase: "ZNX-BB-SGE",
    sizes: ["12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years", "5 Years"],
    initialQuantityPerSize: 12,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "13 months",
    outfit:
      "washed sage green linen short-sleeve shirt with coconut buttons and matching sage linen shorts, natural linen slub texture and creases",
    backdrop: "clean soft pale sage seamless studio backdrop",
  },
  {
    handle: "coral-floral-cotton-frock",
    title: "Coral Floral Cotton Frock",
    shortDescription: "Coral cotton frock with tiny white floral print.",
    description:
      "Coral cotton frock with a delicate white floral print, gathered waist, and soft petticoat lining for twirl-ready days.",
    pricePaise: 119_900,
    compareAtPricePaise: 139_900,
    skuBase: "ZNX-BG-CRL",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years"],
    initialQuantityPerSize: 15,
    gender: "girl",
    categorySlug: "baby-girls",
    modelAge: "10 months",
    outfit:
      "coral cotton frock with tiny white floral print, short sleeves, gathered waist, soft skirt folds and natural cotton texture",
    backdrop: "clean soft warm coral-cream seamless studio backdrop",
  },
  {
    handle: "sky-cloud-print-jumpsuit",
    title: "Sky Blue Cloud Print Jumpsuit",
    shortDescription: "Sky-blue cotton jumpsuit with soft cloud print.",
    description:
      "Sky-blue cotton jumpsuit with a soft white cloud print, elastic waist, and snap legs for easy changes.",
    pricePaise: 109_900,
    compareAtPricePaise: 129_900,
    skuBase: "ZNX-BG-SKY",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months"],
    initialQuantityPerSize: 20,
    gender: "girl",
    categorySlug: "baby-girls",
    modelAge: "8 months",
    outfit:
      "sky-blue cotton short-sleeve jumpsuit with soft white cloud print, elastic waist, snap leg openings, natural cotton folds",
    backdrop: "clean soft pale sky-blue seamless studio backdrop",
  },
  {
    handle: "beige-muslin-wrap-set",
    title: "Beige Organic Muslin Wrap Set",
    shortDescription: "Beige muslin wrap top with soft pant.",
    description:
      "Beige double-gauze organic muslin wrap top with matching soft pant. Ultra-breathable for newborn comfort.",
    pricePaise: 99_900,
    compareAtPricePaise: 119_900,
    skuBase: "ZNX-NB-BGE",
    sizes: ["0–6 Months", "6–12 Months"],
    initialQuantityPerSize: 30,
    gender: "girl",
    categorySlug: "newborn-clothing",
    modelAge: "2 months",
    outfit:
      "beige double-gauze organic muslin wrap top with side ties and matching soft beige muslin pant, airy gauze texture visible",
    backdrop: "clean soft warm beige seamless studio backdrop",
  },
  {
    handle: "red-bandhani-lehenga-choli",
    title: "Red Bandhani Baby Lehenga Choli",
    shortDescription: "Festive red bandhani lehenga with choli and odhani.",
    description:
      "Vibrant red bandhani printed lehenga with soft choli blouse and matching odhani. Celebratory Gujarati-Rajasthani festive set.",
    pricePaise: 219_900,
    compareAtPricePaise: 259_900,
    skuBase: "ZNX-PO-BND",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 10,
    gender: "girl",
    categorySlug: "party-occasion-wear",
    modelAge: "14 months",
    outfit:
      "vibrant red bandhani printed baby lehenga with matching red choli blouse and soft odhani drape, realistic bandhani dots and fabric folds",
    backdrop: "clean soft warm ivory seamless studio backdrop",
  },
  {
    handle: "teal-embroidered-kurta-set",
    title: "Teal Embroidered Ethnic Kurta Set",
    shortDescription: "Teal kurta with delicate thread embroidery.",
    description:
      "Teal cotton kurta with delicate cream thread embroidery on the yoke, paired with soft pants. Everyday ethnic elegance.",
    pricePaise: 159_900,
    compareAtPricePaise: 189_900,
    skuBase: "ZNX-PO-TEL",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 12,
    gender: "boy",
    categorySlug: "party-occasion-wear",
    modelAge: "11 months",
    outfit:
      "teal cotton baby kurta with delicate cream thread embroidery on the yoke and matching soft teal pants, natural embroidery texture",
    backdrop: "clean soft pale teal-grey seamless studio backdrop",
  },
  {
    handle: "grey-melange-tracksuit",
    title: "Soft Grey Melange Tracksuit",
    shortDescription: "Grey melange cotton fleece zip tracksuit.",
    description:
      "Soft grey melange cotton fleece zip jacket and jogger pant set. Comfortable for travel and cooler mornings.",
    pricePaise: 149_900,
    compareAtPricePaise: 179_900,
    skuBase: "ZNX-BB-GRY",
    sizes: [
      "12–18 Months",
      "18–24 Months / 2 Years",
      "3 Years",
      "4 Years",
      "5 Years",
      "6 Years",
    ],
    initialQuantityPerSize: 12,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "15 months",
    outfit:
      "soft grey melange cotton fleece zip jacket and matching jogger pants, visible fleece texture and realistic ribbed cuffs",
    backdrop: "clean soft light-grey seamless studio backdrop",
  },
  {
    handle: "white-smocked-dress",
    title: "White Smocked Cotton Dress",
    shortDescription: "Ivory-white smocked dress with soft puff sleeves.",
    description:
      "Ivory-white cotton dress with hand-look smocking across the chest, soft puff sleeves, and a gentle hem ruffle.",
    pricePaise: 139_900,
    compareAtPricePaise: 169_900,
    skuBase: "ZNX-BG-WHT",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months", "18–24 Months / 2 Years"],
    initialQuantityPerSize: 15,
    gender: "girl",
    categorySlug: "baby-girls",
    modelAge: "7 months",
    outfit:
      "ivory-white cotton baby dress with smocking across the chest, soft puff sleeves, gentle hem ruffle, natural cotton texture",
    backdrop: "clean soft bright white seamless studio backdrop",
  },
  {
    handle: "butter-denim-overalls",
    title: "Butter Yellow Soft Denim Overalls",
    shortDescription: "Butter-yellow soft denim overalls with adjustable straps.",
    description:
      "Butter-yellow soft denim overalls with adjustable straps, front pocket, and snap legs. Worn over a white tee look.",
    pricePaise: 129_900,
    compareAtPricePaise: 149_900,
    skuBase: "ZNX-BB-DNM",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 12,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "10 months",
    outfit:
      "butter-yellow soft denim overalls with adjustable straps and front pocket over a plain white cotton tee, realistic denim weave and stitching",
    backdrop: "clean soft warm cream seamless studio backdrop",
  },
  {
    handle: "lavender-tutu-party-dress",
    title: "Lavender Tutu Party Dress",
    shortDescription: "Soft lavender tulle tutu dress for parties.",
    description:
      "Lavender cotton bodice with layered soft tulle tutu skirt and satin waist bow. Party-ready without scratchy layers.",
    pricePaise: 179_900,
    compareAtPricePaise: 209_900,
    skuBase: "ZNX-BC-LVT",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years"],
    initialQuantityPerSize: 12,
    gender: "girl",
    categorySlug: "baby-costumes",
    modelAge: "13 months",
    outfit:
      "lavender cotton bodice baby dress with layered soft tulle tutu skirt and satin waist bow, realistic tulle layers and cotton texture",
    backdrop: "clean soft pale lavender seamless studio backdrop",
  },
  {
    handle: "olive-cargo-playsuit",
    title: "Olive Cargo Style Playsuit",
    shortDescription: "Olive cotton playsuit with soft cargo pockets.",
    description:
      "Olive cotton playsuit with soft cargo-style pockets, roll-up cuffs, and snap closures. Adventurous everyday wear.",
    pricePaise: 119_900,
    compareAtPricePaise: 139_900,
    skuBase: "ZNX-BB-OLV",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 15,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "11 months",
    outfit:
      "olive green cotton short-sleeve playsuit with soft cargo-style pockets and roll-up cuffs, natural cotton texture and stitching",
    backdrop: "clean soft pale olive-cream seamless studio backdrop",
  },
  {
    handle: "rose-baby-anarkali",
    title: "Rose Embroidered Baby Anarkali",
    shortDescription: "Soft rose Anarkali with delicate embroidery.",
    description:
      "Soft rose georgette-feel Anarkali with delicate cream embroidery on the yoke and soft cotton lining. Festive silhouette for little ones.",
    pricePaise: 199_900,
    compareAtPricePaise: 239_900,
    skuBase: "ZNX-PO-RSE",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 10,
    gender: "girl",
    categorySlug: "party-occasion-wear",
    modelAge: "14 months",
    outfit:
      "soft rose baby Anarkali with delicate cream embroidery on the yoke, flared skirt, soft cotton lining peeking at hem, natural fabric drape",
    backdrop: "clean soft warm rose-cream seamless studio backdrop",
  },
  {
    handle: "indigo-dabu-print-set",
    title: "Indigo Dabu Print Cotton Set",
    shortDescription: "Indigo dabu-print kurta with soft pant.",
    description:
      "Indigo hand-block dabu-inspired print cotton kurta with soft pant. Artisanal everyday ethnic wear.",
    pricePaise: 149_900,
    compareAtPricePaise: 179_900,
    skuBase: "ZNX-BB-IND",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years"],
    initialQuantityPerSize: 12,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "10 months",
    outfit:
      "indigo dabu-inspired hand-block print cotton baby kurta with matching soft pant, realistic block-print pattern and cotton texture",
    backdrop: "clean soft pale indigo-grey seamless studio backdrop",
  },
  {
    handle: "mustard-hooded-sweat-romper",
    title: "Mustard Hooded Sweat Romper",
    shortDescription: "Mustard cotton fleece hooded romper.",
    description:
      "Mustard cotton fleece hooded romper with kangaroo pocket and snap legs. Cozy weekend essential.",
    pricePaise: 129_900,
    compareAtPricePaise: 149_900,
    skuBase: "ZNX-BG-MST",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months"],
    initialQuantityPerSize: 18,
    gender: "girl",
    categorySlug: "baby-girls",
    modelAge: "8 months",
    outfit:
      "mustard yellow cotton fleece hooded romper with kangaroo pocket and snap legs, realistic fleece texture and soft folds",
    backdrop: "clean soft warm mustard-cream seamless studio backdrop",
  },
  {
    handle: "pearl-lace-frock",
    title: "Pearl White Lace Overlay Frock",
    shortDescription: "Pearl-white frock with soft lace overlay.",
    description:
      "Pearl-white cotton frock with a soft lace overlay bodice and satin ribbon bow. Elegant for naming ceremonies and family photos.",
    pricePaise: 169_900,
    compareAtPricePaise: 199_900,
    skuBase: "ZNX-PO-LCE",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months", "18–24 Months / 2 Years"],
    initialQuantityPerSize: 12,
    gender: "girl",
    categorySlug: "party-occasion-wear",
    modelAge: "7 months",
    outfit:
      "pearl-white cotton frock with soft lace overlay on the bodice and satin ribbon bow, realistic lace detail and cotton skirt folds",
    backdrop: "clean soft bright ivory seamless studio backdrop",
  },
  {
    handle: "chocolate-corduroy-overall",
    title: "Chocolate Corduroy Overall",
    shortDescription: "Chocolate brown soft corduroy overall.",
    description:
      "Chocolate brown soft corduroy overall with adjustable straps and front pocket. Layer over a cream tee for autumn days.",
    pricePaise: 139_900,
    compareAtPricePaise: 159_900,
    skuBase: "ZNX-BB-CHC",
    sizes: ["12–18 Months", "18–24 Months / 2 Years", "3 Years", "4 Years", "5 Years"],
    initialQuantityPerSize: 12,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "13 months",
    outfit:
      "chocolate brown soft corduroy overall with adjustable straps and front pocket over a cream cotton tee, visible corduroy wales and stitching",
    backdrop: "clean soft warm taupe seamless studio backdrop",
  },
  {
    handle: "aqua-cotton-romper",
    title: "Aqua Soft Cotton Romper",
    shortDescription: "Fresh aqua cotton romper with wooden buttons.",
    description:
      "Fresh aqua soft cotton romper with wooden button placket and rolled cuffs. Bright everyday essential.",
    pricePaise: 99_900,
    compareAtPricePaise: 119_900,
    skuBase: "ZNX-BG-AQA",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months", "18–24 Months / 2 Years"],
    initialQuantityPerSize: 18,
    gender: "girl",
    categorySlug: "baby-girls",
    modelAge: "10 months",
    outfit:
      "fresh aqua soft cotton short-sleeve romper with wooden button placket and rolled cuffs, natural cotton texture and folds",
    backdrop: "clean soft pale aqua seamless studio backdrop",
  },
  {
    handle: "berry-polka-dot-dress",
    title: "Berry Pink Polka Dot Dress",
    shortDescription: "Berry pink dress with soft white polka dots.",
    description:
      "Berry pink cotton dress with soft white polka dots, peter-pan collar, and covered back buttons.",
    pricePaise: 119_900,
    compareAtPricePaise: 139_900,
    skuBase: "ZNX-BC-BRY",
    sizes: ["6–12 Months", "12–18 Months", "18–24 Months / 2 Years", "3 Years"],
    initialQuantityPerSize: 15,
    gender: "girl",
    categorySlug: "baby-costumes",
    modelAge: "11 months",
    outfit:
      "berry pink cotton baby dress with soft white polka dots, peter-pan collar, covered back buttons, natural fabric folds",
    backdrop: "clean soft warm berry-cream seamless studio backdrop",
  },
  {
    handle: "charcoal-quilted-jacket-set",
    title: "Charcoal Quilted Jacket Set",
    shortDescription: "Charcoal quilted jacket with soft knit set underneath.",
    description:
      "Charcoal lightweight quilted jacket over a soft cream knit top and pant. Winter-ready layered look.",
    pricePaise: 229_900,
    compareAtPricePaise: 269_900,
    skuBase: "ZNX-BB-CHR",
    sizes: [
      "12–18 Months",
      "18–24 Months / 2 Years",
      "3 Years",
      "4 Years",
      "5 Years",
      "6 Years",
    ],
    initialQuantityPerSize: 8,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "15 months",
    outfit:
      "charcoal lightweight quilted baby jacket over cream knit top and pant, realistic quilted diamond stitching and fabric bulk",
    backdrop: "clean soft cool grey seamless studio backdrop",
  },
  {
    handle: "pistachio-stripe-tee-shorts",
    title: "Pistachio Stripe Tee & Shorts",
    shortDescription: "Pistachio striped tee with matching shorts.",
    description:
      "Pistachio and white fine-stripe cotton tee with matching soft shorts. Playful everyday set.",
    pricePaise: 89_900,
    compareAtPricePaise: 109_900,
    skuBase: "ZNX-BB-PST",
    sizes: ["0–6 Months", "6–12 Months", "12–18 Months", "18–24 Months / 2 Years"],
    initialQuantityPerSize: 20,
    gender: "boy",
    categorySlug: "baby-boys",
    modelAge: "8 months",
    outfit:
      "pistachio and white fine-stripe cotton short-sleeve tee with matching soft pistachio shorts, natural cotton texture",
    backdrop: "clean soft pale pistachio seamless studio backdrop",
  },
  {
    handle: "gold-festive-party-suit",
    title: "Soft Gold Festive Party Suit",
    shortDescription: "Soft gold shimmer jacket with ivory kurta set.",
    description:
      "Soft gold shimmer open jacket over an ivory kurta-pant set with subtle embroidery. Premium festive party suit for celebrations.",
    pricePaise: 279_900,
    compareAtPricePaise: 319_900,
    skuBase: "ZNX-PO-GLD",
    sizes: [
      "12–18 Months",
      "18–24 Months / 2 Years",
      "3 Years",
      "4 Years",
      "5 Years",
      "6 Years",
    ],
    initialQuantityPerSize: 8,
    gender: "boy",
    categorySlug: "party-occasion-wear",
    modelAge: "16 months",
    outfit:
      "soft gold shimmer open jacket over ivory kurta and pant with subtle embroidery, realistic soft metallic fabric texture without plastic shine",
    backdrop: "clean soft warm champagne seamless studio backdrop",
  },
];
