const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Grovia Automations — Hoe het werkt";

const C = {
  darkGreen: "0A3320",
  midGreen: "1B6B3A",
  green: "2E7D32",
  brightGreen: "43A047",
  lime: "76C442",
  white: "FFFFFF",
  offWhite: "F8F9FA",
  lightGreen: "E8F5E9",
  textDark: "1A1A1A",
  textMid: "424242",
  textLight: "757575",
  blue: "1565C0",
  purple: "6A1B9A",
  orange: "E65100",
};

const mkShadow = () => ({
  type: "outer",
  color: "000000",
  blur: 8,
  offset: 2,
  angle: 135,
  opacity: 0.1,
});

// ─── SLIDE 1: TITEL ──────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.darkGreen };

  // Left accent bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.22, h: 5.625,
    fill: { color: C.lime }, line: { color: C.lime },
  });

  s.addText("Grovia", {
    x: 0.55, y: 1.15, w: 9, h: 1.0,
    fontSize: 54, bold: true, color: C.white, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText("Automations", {
    x: 0.55, y: 2.1, w: 9, h: 1.0,
    fontSize: 54, bold: true, color: C.lime, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText("Hoe het systeem werkt", {
    x: 0.55, y: 3.25, w: 8, h: 0.5,
    fontSize: 20, color: "90C890", fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText("Mei 2026", {
    x: 0.55, y: 5.1, w: 3, h: 0.35,
    fontSize: 12, color: "557755", fontFace: "Calibri",
    align: "left", margin: 0,
  });
}

// ─── SLIDE 2: HET GROTE PLAATJE ───────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };

  s.addText("Het grote plaatje", {
    x: 0.5, y: 0.28, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  const cards = [
    {
      x: 0.5,
      color: C.brightGreen,
      icon: "✉️",
      title: "E-mailautomatisering",
      body: "FunnelKit verstuurt automatisch de juiste e-mail op het juiste moment — welkomstmails, betaallinks en assessment-uitnodigingen.",
      status: "Actief",
      statusColor: C.brightGreen,
      statusText: "1A1A1A",
    },
    {
      x: 3.6,
      color: C.blue,
      icon: "🎮",
      title: "Assessment aanmeldingen",
      body: "Azure Functions registreren kinderen automatisch bij Ixly en sturen een persoonlijke e-mail met gamelinks.",
      status: "Actief",
      statusColor: C.brightGreen,
      statusText: "1A1A1A",
    },
    {
      x: 6.7,
      color: "9E9E9E",
      icon: "📊",
      title: "Data warehouse",
      body: "WooCommerce-data wordt later ingeladen in Azure SQL, zichtbaar via PowerBI-dashboards.",
      status: "Toekomst",
      statusColor: "BDBDBD",
      statusText: "FFFFFF",
    },
  ];

  cards.forEach((card) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: card.x, y: 1.1, w: 2.9, h: 3.9,
      fill: { color: C.white }, line: { color: "E0E0E0", width: 1 },
      shadow: mkShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: card.x, y: 1.1, w: 2.9, h: 0.1,
      fill: { color: card.color }, line: { color: card.color },
    });
    s.addText(card.icon, {
      x: card.x, y: 1.3, w: 2.9, h: 0.6,
      fontSize: 26, align: "center", margin: 0,
    });
    s.addText(card.title, {
      x: card.x + 0.15, y: 2.0, w: 2.6, h: 0.55,
      fontSize: 14, bold: true, color: C.textDark, fontFace: "Calibri",
      align: "center", wrap: true, margin: 0,
    });
    s.addText(card.body, {
      x: card.x + 0.15, y: 2.65, w: 2.6, h: 2.0,
      fontSize: 12, color: C.textMid, fontFace: "Calibri",
      align: "left", wrap: true, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: card.x + 0.15, y: 4.55, w: 1.1, h: 0.28,
      fill: { color: card.statusColor }, line: { color: card.statusColor },
    });
    s.addText(card.status, {
      x: card.x + 0.15, y: 4.55, w: 1.1, h: 0.28,
      fontSize: 10, bold: true, color: card.statusText, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });
  });
}

// ─── SLIDE 3: DE FLOWS ────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };

  s.addText("De automatiseringsflows", {
    x: 0.5, y: 0.28, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  const flows = [
    {
      y: 1.1,
      color: C.blue,
      title: "1. Welkomstmail",
      steps: "Klant maakt account of doet aankoop  →  FunnelKit herkent het event  →  Welkomstmail verstuurd",
    },
    {
      y: 2.6,
      color: C.green,
      title: "2. Betaallink",
      steps: "Klant koopt training  →  PHP-plugin pikt tag op  →  Azure maakt Mollie-betaallink  →  Klant ontvangt e-mail met betaalknop",
    },
    {
      y: 4.1,
      color: C.purple,
      title: "3. Assessment uitnodiging",
      steps: "Betaling geslaagd (Mollie)  →  Mollie stuurt webhook naar Azure  →  Kind aangemeld bij Ixly  →  E-mail met persoonlijke gamelinks",
    },
  ];

  flows.forEach((flow) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: flow.y, w: 0.07, h: 1.2,
      fill: { color: flow.color }, line: { color: flow.color },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.65, y: flow.y, w: 9.1, h: 1.2,
      fill: { color: C.white }, line: { color: "E8E8E8", width: 1 },
      shadow: mkShadow(),
    });
    s.addText(flow.title, {
      x: 0.85, y: flow.y + 0.12, w: 8.7, h: 0.38,
      fontSize: 14, bold: true, color: flow.color, fontFace: "Calibri",
      align: "left", margin: 0,
    });
    s.addText(flow.steps, {
      x: 0.85, y: flow.y + 0.55, w: 8.7, h: 0.5,
      fontSize: 12, color: C.textMid, fontFace: "Calibri",
      align: "left", wrap: true, margin: 0,
    });
  });
}

// ─── SLIDE 4: PHP ROUTER ──────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };

  s.addText("De PHP Router", {
    x: 0.5, y: 0.28, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText("Een kleine plugin die onzichtbaar meeloopt op de Grovia WordPress-website.", {
    x: 0.5, y: 0.98, w: 9, h: 0.4,
    fontSize: 14, color: C.textMid, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  const items = [
    {
      icon: "👀",
      title: "Luistert naar tags",
      body: "Zodra FunnelKit een label (tag) toewijst aan een contact — bijv. bij een aankoop — pikt de plugin dit direct op.",
    },
    {
      icon: "🔍",
      title: "Leest orderinformatie",
      body: "De plugin haalt automatisch de naam van het kind, het bedrag en andere gegevens op uit WooCommerce.",
    },
    {
      icon: "📡",
      title: "Stuurt door naar Azure",
      body: "Afhankelijk van de tag roept de plugin de juiste Azure Function aan: betaallink aanmaken of assessment registreren.",
    },
  ];

  items.forEach((item, i) => {
    const x = 0.5 + i * 3.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.55, w: 2.95, h: 3.6,
      fill: { color: C.white }, line: { color: "E0E0E0", width: 1 },
      shadow: mkShadow(),
    });
    s.addText(item.icon, {
      x, y: 1.7, w: 2.95, h: 0.65,
      fontSize: 30, align: "center", margin: 0,
    });
    s.addText(item.title, {
      x: x + 0.15, y: 2.45, w: 2.65, h: 0.5,
      fontSize: 14, bold: true, color: C.textDark, fontFace: "Calibri",
      align: "center", margin: 0,
    });
    s.addText(item.body, {
      x: x + 0.15, y: 3.05, w: 2.65, h: 1.9,
      fontSize: 12, color: C.textMid, fontFace: "Calibri",
      align: "left", wrap: true, margin: 0,
    });
  });
}

// ─── SLIDE 5: AZURE FUNCTIONS ─────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };

  s.addText("Azure Functions", {
    x: 0.5, y: 0.28, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText("Twee cloudservices die automatisch worden gestart zodra ze nodig zijn.", {
    x: 0.5, y: 0.98, w: 9, h: 0.4,
    fontSize: 14, color: C.textMid, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  // Card 1
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.55, w: 4.3, h: 3.65,
    fill: { color: C.white }, line: { color: "E0E0E0", width: 1 }, shadow: mkShadow(),
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.55, w: 4.3, h: 0.1,
    fill: { color: "0070BA" }, line: { color: "0070BA" },
  });
  s.addText("💳  mollie-betaallink", {
    x: 0.65, y: 1.72, w: 4.0, h: 0.5,
    fontSize: 16, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText([
    { text: "Wat doet het?\n", options: { bold: true } },
    { text: "Maakt een unieke betaallink aan via Mollie.\n\n", options: {} },
    { text: "Triggert bij:\n", options: { bold: true } },
    { text: "Tag na aankoop in WooCommerce\n\n", options: {} },
    { text: "Resultaat:\n", options: { bold: true } },
    { text: "E-mail met persoonlijke betaalknop", options: {} },
  ], {
    x: 0.65, y: 2.35, w: 4.0, h: 2.65,
    fontSize: 12, color: C.textMid, fontFace: "Calibri",
    align: "left", margin: 0, wrap: true,
  });

  // Card 2
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.55, w: 4.3, h: 3.65,
    fill: { color: C.white }, line: { color: "E0E0E0", width: 1 }, shadow: mkShadow(),
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.55, w: 4.3, h: 0.1,
    fill: { color: C.green }, line: { color: C.green },
  });
  s.addText("🎮  ixly-aanmelding", {
    x: 5.35, y: 1.72, w: 4.0, h: 0.5,
    fontSize: 16, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText([
    { text: "Wat doet het?\n", options: { bold: true } },
    { text: "Meldt het kind automatisch aan bij Ixly Assessments.\n\n", options: {} },
    { text: "Triggert bij:\n", options: { bold: true } },
    { text: "Succesvolle betaling via Mollie webhook\n\n", options: {} },
    { text: "Resultaat:\n", options: { bold: true } },
    { text: "E-mail met twee persoonlijke gamelinks (Blocks + Rally)", options: {} },
  ], {
    x: 5.35, y: 2.35, w: 4.0, h: 2.65,
    fontSize: 12, color: C.textMid, fontFace: "Calibri",
    align: "left", margin: 0, wrap: true,
  });
}

// ─── SLIDE 6: IXLY API ────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };

  s.addText("Ixly Assessments", {
    x: 0.5, y: 0.28, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText("Het externe platform waar kinderen de Blocks en Rally games spelen.", {
    x: 0.5, y: 0.98, w: 9, h: 0.4,
    fontSize: 14, color: C.textMid, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  const steps = [
    {
      n: "1",
      title: "Profiel aanmaken",
      body: "Elk kind krijgt een eigen profiel in Ixly, gekoppeld aan het ordernummer. Bestaat het profiel al? Dan wordt het hergebruikt.",
    },
    {
      n: "2",
      title: "Spellen klaarzetten",
      body: "Voor elk spel (Blocks + Rally) wordt een persoonlijke spelomgeving aangemaakt. Elk kind heeft zijn eigen account.",
    },
    {
      n: "3",
      title: "Inloglinks genereren",
      body: "Ixly genereert unieke inloglinks per spel. Het kind klikt op de link en start direct — geen wachtwoord nodig.",
    },
    {
      n: "4",
      title: "E-mail versturen",
      body: "Azure verstuurt een e-mail met beide gamelinks naar de ouder, inclusief tips voor een eerlijk resultaat.",
    },
  ];

  steps.forEach((step, i) => {
    const x = 0.5 + i * 2.35;

    s.addShape(pres.shapes.OVAL, {
      x: x + 0.85, y: 1.6, w: 0.55, h: 0.55,
      fill: { color: C.green }, line: { color: C.green },
    });
    s.addText(step.n, {
      x: x + 0.85, y: 1.6, w: 0.55, h: 0.55,
      fontSize: 16, bold: true, color: C.white, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });

    s.addText(step.title, {
      x, y: 2.32, w: 2.2, h: 0.5,
      fontSize: 13, bold: true, color: C.textDark, fontFace: "Calibri",
      align: "center", wrap: true, margin: 0,
    });
    s.addText(step.body, {
      x: x + 0.05, y: 2.9, w: 2.1, h: 2.35,
      fontSize: 11, color: C.textMid, fontFace: "Calibri",
      align: "left", wrap: true, margin: 0,
    });
  });
}

// ─── SLIDE 7: BETAALLINK METHODE ──────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offWhite };

  s.addText("De betaallink methode", {
    x: 0.5, y: 0.28, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  // Card Waarom
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.1, w: 4.3, h: 4.1,
    fill: { color: C.white }, line: { color: "E0E0E0", width: 1 }, shadow: mkShadow(),
  });
  s.addText("Waarom een betaallink?", {
    x: 0.65, y: 1.25, w: 4.0, h: 0.45,
    fontSize: 15, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });
  s.addText(
    "Grovia werkt met twee aparte betalingen:\n\n" +
    "Stap 1: Klant betaalt de cursus in de webshop (WooCommerce)\n\n" +
    "Stap 2: Klant ontvangt een aparte betaallink voor de assessmentkosten\n\n" +
    "Dit geeft Grovia flexibiliteit om de assessmentprijs los te beheren, zonder de webshop aan te passen.",
    {
      x: 0.65, y: 1.82, w: 4.0, h: 3.2,
      fontSize: 12, color: C.textMid, fontFace: "Calibri",
      align: "left", wrap: true, margin: 0,
    }
  );

  // Card Hoe
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.1, w: 4.3, h: 4.1,
    fill: { color: C.white }, line: { color: "E0E0E0", width: 1 }, shadow: mkShadow(),
  });
  s.addText("Hoe werkt het?", {
    x: 5.35, y: 1.25, w: 4.0, h: 0.45,
    fontSize: 15, bold: true, color: C.textDark, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  const howSteps = [
    "① Azure maakt een Mollie betaallink aan",
    "② Klant ontvangt e-mail met betaalknop",
    "③ Klant betaalt via iDEAL of creditcard",
    "④ Mollie bevestigt via webhook naar Azure",
    "⑤ Azure start automatisch de Ixly-aanmelding",
  ];
  howSteps.forEach((step, i) => {
    s.addText(step, {
      x: 5.35, y: 1.82 + i * 0.59, w: 4.0, h: 0.52,
      fontSize: 12, color: C.textMid, fontFace: "Calibri",
      align: "left", margin: 0, wrap: true,
    });
  });
}

// ─── SLIDE 8: VOLGENDE STAPPEN ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.darkGreen };

  s.addText("Volgende stappen", {
    x: 0.5, y: 0.3, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: C.white, fontFace: "Calibri",
    align: "left", margin: 0,
  });

  const phases = [
    {
      phase: "Nu",
      color: C.lime,
      textColor: "0A3320",
      items: [
        "Keten end-to-end testen: testkoop → betaling → gamelinks e-mail",
        "Oude FunnelKit-workflows deactiveren",
        "Server-level cron instellen voor betrouwbare automatisering",
      ],
    },
    {
      phase: "Binnenkort",
      color: "64B5F6",
      textColor: "0A3320",
      items: [
        "Overleg Berry: kindnaam verplicht maken bij checkout",
        "Antwoord Jan-Willem (Ixly) verwerken over e-mailveld candidates",
        "Token caching verbeteren in Azure (kortere token-lifetime Ixly)",
      ],
    },
    {
      phase: "Later",
      color: "FFB74D",
      textColor: "0A3320",
      items: [
        "Data warehouse: WooCommerce → Azure SQL Database",
        "PowerBI-dashboard voor bestellingen en assessments",
        "Eenvoudig nieuwe scholen toevoegen aan het systeem",
      ],
    },
  ];

  phases.forEach((phase, i) => {
    const x = 0.5 + i * 3.15;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.15, w: 2.95, h: 0.38,
      fill: { color: phase.color }, line: { color: phase.color },
    });
    s.addText(phase.phase, {
      x, y: 1.15, w: 2.95, h: 0.38,
      fontSize: 14, bold: true, color: phase.textColor, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.53, w: 2.95, h: 3.7,
      fill: { color: "0D3B22" }, line: { color: "1C5C35", width: 1 },
    });

    phase.items.forEach((item, j) => {
      s.addText("→  " + item, {
        x: x + 0.15, y: 1.65 + j * 1.15, w: 2.65, h: 1.05,
        fontSize: 12, color: "BBEEBB", fontFace: "Calibri",
        align: "left", wrap: true, margin: 0,
      });
    });
  });
}

pres
  .writeFile({
    fileName:
      "/Users/maxrood/werk/greit/klanten/grovia/Grovia_Automations_Uitleg.pptx",
  })
  .then(() => console.log("Presentatie aangemaakt!"))
  .catch((err) => console.error(err));
