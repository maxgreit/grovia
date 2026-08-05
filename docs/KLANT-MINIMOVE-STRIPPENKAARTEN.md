# MiniMove: van vaste cyclusprijs naar strippenkaarten

**Voor:** Grovia (Berry) · **Van:** Max Rood · **Datum:** 2026-08-05

> **Verstuurbare versie:** `docs/Grovia-MiniMove-strippenkaarten.pdf` (3 pagina's A4). De opmaak
> daarvan staat in [klant-minimove-strippenkaarten.html](klant-minimove-strippenkaarten.html), met
> het rendercommando in een comment bovenaan. De PDF zelf staat niet in git — hij is uit die HTML te
> regenereren. Let op: de tekst staat nu in **twee** bestanden (dit bestand en die HTML); pas je hier
> iets aan, werk dan de HTML mee bij.

Jullie wens: MiniMove goedkoper en flexibeler maken met drie strippenkaarten — **4, 6 of 8 keer**,
op te maken binnen een cyclus van 8 trainingen. Ik heb uitgezocht wat dat betekent voor de
automatisering die er nu staat.

---

## Kort antwoord: dit kan, en het is klein werk

De automatisering rond MiniMove is beperkt van opzet — MiniMove doet niet mee aan de
testen (Ixly-games en de Action Type-test), staat niet in de deelnemersadministratie en niet in het
financiële rapport. Dat is bewust zo gebouwd. Het gevolg is gunstig: **de drie strippenkaarten zijn
in WooCommerce aan te maken zonder dat er iets in de automatisering hoeft te veranderen.**

Wat blijft werken zoals nu:

| Onderdeel | Na de wijziging |
|---|---|
| WhatsApp-groepsuitnodiging na aankoop | werkt ongewijzigd |
| Geen testuitnodiging voor MiniMove | blijft zo |
| Deelnemersadministratie en reminders (Kolping / Schagen) | onaangeroerd |
| Financieel rapport en de afdracht per vereniging | onaangeroerd |

Eén ding om te weten: **de productcategorieën `MiniMove` en `Voetbaltraining` moeten op het product
blijven staan.** Daar hangt de WhatsApp-uitnodiging aan. Verdwijnt een van die twee bij het
herinrichten van de producten, dan stopt die uitnodiging stil — zonder foutmelding. Dat is het enige
punt waarop hier iets kan breken.

---

## Wat ik van jullie nodig heb

Drie beslissingen. De eerste twee wil ik graag vóór ik de producten inricht, want ze veranderen de
opzet zelf.

### 1. De prijzen

Het uitgangspunt: de **8-keer-kaart is de hele cyclus** en hoort dus op of onder de huidige
MiniMove-prijs te liggen — dat is de "prijs te hoog"-klacht die jullie oplossen.

Belangrijker is de verhouding. Als de prijs per keer gelijk is voor alle drie de kaarten, is er geen
enkele reden om de 8-kaart te kiezen boven twee keer een 4-kaart, en verliezen jullie de
voorspelbaarheid van een volle groep. **Maak de grote kaart per keer goedkoper.** Ter illustratie van
dat principe, uitgaande van een 8-kaart van € 144:

| Kaart | Prijs | Per keer |
|---|---|---|
| 4 keer | € 88 | € 22,00 |
| 6 keer | € 120 | € 20,00 |
| 8 keer | € 144 | € 18,00 |

Die bedragen zijn **een voorbeeld om het idee te laten zien, geen voorstel** — de echte prijzen
bepalen jullie. Geef me per kaart één bedrag door en ik zet ze erin.

### 2. Vervallen ongebruikte strippen aan het einde van de cyclus?

Mijn advies: **ja, en zet het letterlijk in de productbeschrijving.** Dat is de plek waar de ouder
het vóór de aankoop leest, en het houdt de administratie simpel: aan het einde van een cyclus is een
kaart klaar en begint de volgende schoon.

Blijven strippen wel staan, dan moeten restanten tussen cycli overgedragen worden. Dat kan, maar het
maakt het bijhouden merkbaar bewerkelijker — en een kaart die onbeperkt geldig blijft, is
boekhoudkundig een openstaande verplichting.

### 3. Wie streept af, en hoe?

Er is nu **nergens** presentieregistratie. Dat is het enige echt nieuwe stuk werk in dit plan. Drie
routes, van licht naar zwaar:

| | Hoe | Wat het kost |
|---|---|---|
| **A** | De trainer houdt zelf een lijst bij (papier of een simpele lijst) | Niets. Wel: geen koppeling met de aankoop, dus "ik heb nog twee keer over" is niet hard te maken |
| **B** ⭐ | Een tabblad in het bestaande Grovia-werkboek: per kind de gekochte keren, acht kolommen om af te vinken, en een teller die automatisch terugrekent | Halve dag werk. De trainer vinkt af in een sheet; het aantal gekochte keren vult zichzelf uit de webshop |
| **C** | Een strippenkaart-plugin in de webshop, waarbij de ouder zijn saldo in "Mijn account" ziet | Extra plugin met licentiekosten op een checkout die al drie eigen uitbreidingen draagt. Meer risico dan het oplevert, zou ik nu niet doen |

**Mijn advies: begin met A, bouw B zodra de eerste kaarten verkocht zijn.** Dan weten we hoe de
trainer er in de praktijk mee werkt, in plaats van dat we dat vooraf gokken. B is technisch al
uitgewerkt en getest aan mijn kant, dus het is later een korte klus — geen maandenproject.

### Nog aan te leveren

- De drie prijzen (punt 1)
- Antwoord op de geldigheidsvraag (punt 2) en welke route bij punt 3
- **De start- en einddatum van de MiniMove-cycli dit seizoen.** Nodig om te kunnen zien in welke
  cyclus een aankoop valt.

---

## Hoe we het in de webshop zetten

Vijf stappen. Bij elkaar ongeveer een uur, en tot stap 4 is er niets voor klanten te zien.

**Stap 1 — Inventariseren.** Ik loop de huidige MiniMove-producten na: welke categorieën eraan
hangen, hoe ze nu geprijsd zijn en of ze al met varianten werken. Dit is puur kijken, ik verander
niets.

**Stap 2 — Het product op varianten zetten.** MiniMove wordt één product waarbij de ouder kiest
tussen "Strippenkaart 4 keer", "6 keer" of "8 keer" — hetzelfde principe als de keuze tussen
Cyclus 1/2/3 bij Kolping en Schagen. Eén productpagina, één keuzemenu, drie prijzen. Ik gebruik
daarvoor bewust het bestaande keuzeveld en geen nieuw veld: dat is de reden dat de rest van de
automatisering ongemoeid blijft.

**Stap 3 — Prijzen en teksten invullen.** De drie prijzen uit punt 1, en per variant de tekst over
het aantal trainingen en de geldigheid uit punt 2. Ook de algemene productbeschrijving bijwerken:
dat de cyclus 8 trainingen is en dat een kaart daar een deel van afdekt.

**Stap 4 — Testen met een gratis proefaankoop.** Ik maak een tijdelijke 100%-kortingscode en plaats
per variant één order. Daarmee controleer ik dat de gekozen kaart goed in de order terechtkomt, dat
de WhatsApp-uitnodiging verstuurd wordt, en dat er géén testuitnodiging uitgaat. Daarna verwijder ik
de proeforders en de kortingscode weer.

**Stap 5 — Live en één cyclus meekijken.** De varianten gaan aan. In de eerste weken houd ik in de
gaten of de aankopen goed doorkomen. Verkopen jullie in die periode ook een kaart aan een broertje of
zusje, of twee kaarten voor hetzelfde kind, laat het me weten — dat zijn de gevallen waarvan ik zeker
wil weten dat ze goed geregistreerd worden.

Ik kan dit ook aan jullie kant laten en alleen meekijken, als je het zelf wil doen. Zeg wat je
prettiger vindt.

---

## Wat dit niet oplost

Even eerlijk over de grens van deze wijziging: strippenkaarten maken de **aankoop** flexibel, niet de
**planning**. Een ouder koopt vier keer en beslist zelf op welke vier trainingen het kind komt — maar
er is geen inschrijving per training, dus jullie weten van tevoren niet wie er komt en kunnen niet op
groepsgrootte sturen.

Voor MiniMove is dat vermoedelijk precies goed: laagdrempelig, kom wanneer het past. Wil je wél
vooraf weten wie er komt, dan is dat een aparte stap (inschrijven per training) en een ander gesprek.
Ik zou dat pas overwegen als de groepen echt te vol of te leeg blijken te lopen.

---

## Samengevat

- Kan met een aanpassing in de webshop; de automatisering hoeft niet mee te veranderen.
- Ik heb van jullie drie prijzen, een geldigheidsregel en de cyclusdata nodig.
- Inrichten en testen kost ongeveer een uur, plus een halve dag als jullie het afstrepen
  geautomatiseerd willen (route B) — mijn advies is daarmee te wachten tot na de eerste cyclus.
- Enige echte risico: de categorieën `MiniMove` en `Voetbaltraining` moeten op het product blijven,
  anders stopt de WhatsApp-uitnodiging.

Geef de drie beslissingen door, dan zet ik het klaar.
