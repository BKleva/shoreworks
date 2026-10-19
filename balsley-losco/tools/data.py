# -*- coding: utf-8 -*-
"""Content for the Balsley Losco site. Edit here, then run: python tools/build.py"""

SITE_URL = "https://www.blhomes.com"
BRAND = "Balsley Losco Real Estate"
SHORT = "Balsley Losco"
PHONE = "(609) 646-3207"
PHONE_TEL = "+16096463207"
FOUNDED = 1954

OFFICES = [
    dict(slug="northfield", name="Balsley Losco – Northfield", street="1630 New Road", city="Northfield", state="NJ",
         zip="08225", phone="(609) 646-3207", tel="+16096463207", lat=39.3768, lng=-74.5522,
         blurb="Our headquarters on New Road, minutes from the Garden State Parkway and the Atlantic County mainland towns."),
    dict(slug="somers-point", name="Balsley Losco – Somers Point", street="644 Bay Avenue", city="Somers Point", state="NJ",
         zip="08244", phone="(609) 927-0333", tel="+16099270333", lat=39.3178, lng=-74.5946,
         blurb="Our bayfront office on Bay Avenue, steps from the Great Egg Harbor Bay and the Ocean City causeway."),
]

# slug, name, zip, county, lat, lng, hue, tagline, intro[], highlights[], best_for[], nearby[]
TOWNS = [
    dict(slug="northfield", name="Northfield", zip="08225", county="Atlantic", lat=39.3770, lng=-74.5510, hue=205,
         tagline="Quiet streets, quick access, and the home of our main office.",
         intro=["Northfield is a mainland Atlantic County city known for tree-lined residential streets, strong neighborhood feel and convenient access to the Garden State Parkway and Atlantic City Expressway. It sits between Linwood, Pleasantville and Absecon Island, which makes both the shore and the region's employers an easy trip.",
                "Housing ranges from classic mid-century ranches and colonials to newer builds and townhomes. Because our headquarters is on New Road, Balsley Losco agents work these blocks every day and know which pockets move fast."],
         highlights=["Birch Grove Park and neighborhood playgrounds", "Short drive to the beaches of Ventnor and Margate", "Garden State Parkway and Expressway access", "Our Northfield office at 1630 New Road"],
         best_for=["First-time buyers", "Move-up families", "Commuters"], nearby=["linwood", "absecon", "ventnor"]),
    dict(slug="linwood", name="Linwood", zip="08221", county="Atlantic", lat=39.3398, lng=-74.5738, hue=140,
         tagline="Established neighborhoods between the bay and the Parkway.",
         intro=["Linwood is one of Atlantic County's most sought-after mainland communities, with established neighborhoods, mature trees and a mix of renovated classics, custom homes and bayside properties. It borders Somers Point and Northfield, so shopping, dining and the shore are all close.",
                "Buyers often compare Linwood with nearby Margate and Northfield when they want a mainland address with a strong sense of community and quick access to the island beaches."],
         highlights=["Linwood Country Club and nearby golf", "Walkable pockets near Shore Road", "Close to Somers Point's bay and restaurants", "Mix of custom builds and renovated classics"],
         best_for=["Move-up families", "Luxury buyers", "Downsizers"], nearby=["northfield", "somers-point", "egg-harbor-township"]),
    dict(slug="egg-harbor-township", name="Egg Harbor Township", zip="08234", county="Atlantic", lat=39.3850, lng=-74.6140, hue=170,
         tagline="Room to grow, newer construction and the region's airport and tech hub.",
         intro=["Egg Harbor Township (EHT) is Atlantic County's largest municipality by area and a popular choice for buyers who want space, newer construction and a range of price points. It includes communities such as Cardiff and Scullville and is home to Atlantic City International Airport and the FAA William J. Hughes Technical Center.",
                "From established subdivisions to new developments and townhomes, EHT offers some of the widest selection on the mainland, with straightforward access to the Parkway and Expressway."],
         highlights=["Atlantic City International Airport", "FAA William J. Hughes Technical Center", "Large selection of newer subdivisions", "Quick access to the Garden State Parkway"],
         best_for=["Growing families", "Newer construction", "Aviation and tech commuters"], nearby=["linwood", "galloway", "hamilton-township"]),
    dict(slug="hamilton-township", name="Hamilton Township", zip="08330", county="Atlantic", lat=39.4520, lng=-74.7270, hue=95,
         tagline="Mays Landing, the Great Egg Harbor River and more land for the money.",
         intro=["Hamilton Township includes Mays Landing, the county seat of Atlantic County, and stretches along the Great Egg Harbor River. Buyers find a mix of established neighborhoods, newer communities and homes with larger lots, plus a quieter, more rural feel than the island towns.",
                "It is a strong option for buyers who want more space and value while staying within reach of the shore, shopping at Hamilton Mall and the major highways."],
         highlights=["Mays Landing and the Great Egg Harbor River", "County seat of Atlantic County", "Larger lots and more home for the money", "Hamilton Mall shopping nearby"],
         best_for=["Space seekers", "Outdoor enthusiasts", "Value-focused buyers"], nearby=["egg-harbor-township", "galloway", "hammonton"]),
    dict(slug="galloway", name="Galloway", zip="08205", county="Atlantic", lat=39.4890, lng=-74.4770, hue=190,
         tagline="Stockton University, Historic Smithville and protected wetlands.",
         intro=["Galloway Township covers a large stretch of Atlantic County between the bay and the Pine Barrens. It is home to Stockton University, the Historic Village at Smithville and parts of the Edwin B. Forsythe National Wildlife Refuge, so buyers get open space alongside shopping and commuter access.",
                "Housing includes everything from established neighborhoods to new construction, waterfront-adjacent properties near Oceanville and larger parcels."],
         highlights=["Stockton University campus", "Historic Village at Smithville", "Edwin B. Forsythe National Wildlife Refuge", "Wide range of home styles and lot sizes"],
         best_for=["Families", "University-affiliated buyers", "Nature lovers"], nearby=["absecon", "egg-harbor-township", "brigantine"]),
    dict(slug="ventnor", name="Ventnor City", zip="08406", county="Atlantic", lat=39.3401, lng=-74.4777, hue=200,
         tagline="Boardwalk, beaches and walkable island living on Absecon Island.",
         intro=["Ventnor City sits on Absecon Island between Atlantic City and Margate, with a boardwalk, a public fishing pier and a mix of single-family homes, duplexes and condominiums. Buyers choose Ventnor for beach lifestyle, walkability and a range of price points on the island.",
                "Because most of Ventnor is in a mapped flood zone, buyers should review flood insurance and elevation details early. Our agents can walk you through that before you make an offer."],
         highlights=["Ventnor Boardwalk and fishing pier", "Ocean and bay-side properties", "Walkable to cafes, shops and beach", "Mix of homes and condos"],
         best_for=["Beach lovers", "Second-home buyers", "Investors"], nearby=["margate", "absecon", "northfield"]),
    dict(slug="hammonton", name="Hammonton", zip="08037", county="Atlantic", lat=39.6365, lng=-74.8021, hue=60,
         tagline="The Blueberry Capital of the World, with a walkable downtown.",
         intro=["Hammonton is a small-town community in western Atlantic County that calls itself the Blueberry Capital of the World. It offers a walkable downtown, local farms and wineries, an NJ Transit Atlantic City Line station and generally larger lots than the shore towns.",
                "Buyers who want a slower pace, farmland views and more space often look here, while still being a reasonable drive from both Philadelphia and the Jersey Shore."],
         highlights=["Walkable downtown and local restaurants", "NJ Transit Atlantic City Line station", "Farms, blueberries and wineries", "More land and space per dollar"],
         best_for=["Space seekers", "Hobby farmers", "Philadelphia commuters"], nearby=["hamilton-township", "galloway", "egg-harbor-township"]),
    dict(slug="somers-point", name="Somers Point", zip="08244", county="Atlantic", lat=39.3176, lng=-74.5949, hue=215,
         tagline="Bayfront living, marinas and our Bay Avenue office.",
         intro=["Somers Point is a bayfront Atlantic County city on the Great Egg Harbor Bay, with marinas, waterfront restaurants and the causeway to Ocean City. Housing runs from bayfront homes and condos to affordable starter homes a few blocks inland.",
                "It is a favorite for boaters and for buyers who want water access without island prices. Our Somers Point office at 644 Bay Avenue is right in the heart of it."],
         highlights=["Great Egg Harbor Bay and marinas", "Somers Mansion, one of the county's oldest buildings", "Bay Avenue dining and nightlife", "Route 52 causeway to Ocean City"],
         best_for=["Boaters", "Second-home buyers", "First-time buyers"], nearby=["linwood", "northfield", "ocean-city"]),
    dict(slug="margate", name="Margate City", zip="08402", county="Atlantic", lat=39.3273, lng=-74.5121, hue=185,
         tagline="Home of Lucy the Elephant and some of the shore's best-loved beaches.",
         intro=["Margate City is a quiet, residential barrier-island town best known for its wide beaches and Lucy the Elephant, a six-story landmark built in 1881. Homes range from classic shore cottages and duplexes to newly built custom residences.",
                "Because Margate sits at the water's edge, flood zone and elevation questions matter. Our agents help buyers understand insurance and construction details before they commit."],
         highlights=["Lucy the Elephant landmark", "Wide, guarded beaches", "Mix of cottages and custom new builds", "Quiet residential feel on Absecon Island"],
         best_for=["Second-home buyers", "Luxury buyers", "Retirees"], nearby=["ventnor", "linwood", "northfield"]),
    dict(slug="absecon", name="Absecon", zip="08201", county="Atlantic", lat=39.4284, lng=-74.4968, hue=120,
         tagline="Mainland value just minutes from the shore and Brigantine.",
         intro=["Absecon is a compact Atlantic County city on the mainland that sits between Galloway, Northfield and Brigantine. Buyers find a variety of home styles, including ranches, colonials and some newer construction, often at friendlier prices than the island.",
                "With quick access to Route 30, Route 9 and the Expressway, Absecon works well for commuters who still want the shore close by."],
         highlights=["Central mainland location", "Quick access to Route 30 and the Expressway", "Close to Brigantine and Atlantic City", "Variety of price points"],
         best_for=["First-time buyers", "Commuters", "Value-focused buyers"], nearby=["galloway", "northfield", "brigantine"]),
    dict(slug="brigantine", name="Brigantine", zip="08203", county="Atlantic", lat=39.4101, lng=-74.3641, hue=195,
         tagline="A laid-back barrier island with beaches, bay views and a refuge next door.",
         intro=["Brigantine is a residential barrier island north of Atlantic City, with wide beaches, bay-side neighborhoods and a relaxed pace. The Edwin B. Forsythe National Wildlife Refuge sits at its northern end and draws birders and nature lovers year-round.",
                "Homes range from cottages and ranches to elevated and bayfront properties. As on any barrier island, buyers should review flood insurance and elevation details early in the process."],
         highlights=["Wide beaches and bay views", "Forsythe Refuge wildlife drive", "Residential island feel", "Close to Atlantic City"],
         best_for=["Beach lovers", "Second-home buyers", "Nature lovers"], nearby=["absecon", "galloway", "ventnor"]),
    dict(slug="ocean-city", name="Ocean City", zip="08226", county="Cape May", lat=39.2776, lng=-74.5746, hue=210,
         tagline="A family-friendly island city with a famous boardwalk.",
         intro=["Ocean City, in Cape May County, is a family-oriented barrier island known for its boardwalk, wide beaches and its alcohol-free tradition. It is a top destination for second homes and vacation rentals, with housing ranging from condos to large oceanfront residences.",
                "Because Ocean City sits in a different county from our Atlantic County towns, buyers can use our Somers Point office, just across the Route 52 causeway, as a convenient base."],
         highlights=["Boardwalk, beaches and family attractions", "Alcohol-free community", "Strong second-home and rental market", "Route 52 causeway to Somers Point"],
         best_for=["Second-home buyers", "Investors", "Families"], nearby=["somers-point", "margate", "linwood"]),
]

# sample listings -- replace with the live IDX/MLS feed in production
LISTINGS = [
    dict(slug="bayfront-contemporary-somers-point", addr="418 Bay Shore Drive", town="somers-point", price=1895000, beds=5, baths=4.5, sqft=4100, lot=0.31, year=2019, type="Single Family", status="New", wf=True, hue=210, open="Sun 1–3 PM",
         title="Bayfront contemporary with private dock",
         desc="Wake up to open bay views in this elevated bayfront contemporary. A wall of glass opens the main living area to a wraparound deck, and the private dock is steps from the water. The chef's kitchen, primary suite with bay-view balcony and finished lower level make this an easy retreat or year-round home.",
         feats=["Private dock and boat lift", "Elevated construction", "Primary suite with balcony", "Chef's kitchen with quartz island", "Two-car garage"]),
    dict(slug="coastal-colonial-linwood", addr="26 Oak Hollow Road", town="linwood", price=849900, beds=4, baths=3, sqft=2850, lot=0.28, year=1996, type="Single Family", status="Active", wf=False, hue=140, open="",
         title="Updated colonial on a quiet Linwood street",
         desc="This light-filled colonial sits on a quiet street close to Shore Road. Hardwood floors, a renovated kitchen and a first-floor office make everyday living easy, and the fenced backyard is ready for summer evenings. Move-in condition with room to grow.",
         feats=["Renovated kitchen", "First-floor office", "Fenced backyard", "Central air", "Walk to local shops"]),
    dict(slug="starter-ranch-northfield", addr="1204 Burton Avenue", town="northfield", price=359000, beds=3, baths=1.5, sqft=1280, lot=0.17, year=1962, type="Single Family", status="New", wf=False, hue=205, open="Sat 11 AM–1 PM",
         title="Move-in ready ranch near Birch Grove Park",
         desc="A well-kept three-bedroom ranch on a friendly Northfield block. Refinished floors, an updated bath and a bright eat-in kitchen mean there is nothing to do but unpack. Minutes to the Parkway, Expressway and island beaches.",
         feats=["Refinished hardwood floors", "Eat-in kitchen", "Updated bath", "Detached garage", "Near parks and schools"]),
    dict(slug="oceanside-condo-margate", addr="9400 Atlantic Avenue, Unit 3B", town="margate", price=699000, beds=2, baths=2, sqft=1350, lot=0, year=2008, type="Condo", status="Active", wf=True, hue=185, open="",
         title="Oceanside condo, two blocks to the beach",
         desc="A bright two-bedroom, two-bath condominium two blocks from the Margate beach. Open living area, a private balcony and a deeded parking space make this an easy-care shore escape.",
         feats=["Private balcony", "Deeded parking space", "In-unit laundry", "Elevator building", "Two blocks to the beach"]),
    dict(slug="new-construction-egg-harbor-township", addr="112 Harvest Lane", town="egg-harbor-township", price=525000, beds=4, baths=2.5, sqft=2400, lot=0.22, year=2024, type="Single Family", status="New", wf=False, hue=170, open="",
         title="New construction with open floor plan",
         desc="Brand-new four-bedroom home in a growing Egg Harbor Township neighborhood. Open living and dining, a modern kitchen, a first-floor flex room and a spacious primary suite. Built to current energy standards.",
         feats=["Open floor plan", "First-floor flex room", "Primary suite with walk-in closet", "Energy-efficient construction", "Two-car garage"]),
    dict(slug="river-view-ranch-mays-landing", addr="75 River Bend Road", town="hamilton-township", price=439000, beds=3, baths=2, sqft=1850, lot=0.9, year=1988, type="Single Family", status="Active", wf=False, hue=95, open="Sun 12–2 PM",
         title="Ranch on nearly an acre near the Great Egg Harbor River",
         desc="Spread out on almost an acre with room for a workshop, garden and plenty of parking. This one-level ranch features a vaulted living room, a sunroom and a spacious primary suite, minutes from the river and Mays Landing.",
         feats=["Almost one acre", "Vaulted living room", "Sunroom", "Detached workshop", "Near the river"]),
    dict(slug="townhome-galloway", addr="31 Smithville Commons", town="galloway", price=315000, beds=3, baths=2.5, sqft=1650, lot=0, year=2012, type="Townhouse", status="Active", wf=False, hue=190, open="",
         title="Three-bedroom townhome near Stockton",
         desc="Low-maintenance townhome living near Stockton University and Historic Smithville. Three bedrooms, two and a half baths, a one-car garage and a private patio, with lawn care and exterior maintenance handled by the association.",
         feats=["One-car garage", "Private patio", "Association handles lawn care", "Near Stockton University", "Central air"]),
    dict(slug="duplex-investment-ventnor", addr="5106 Ventnor Avenue", town="ventnor", price=589000, beds=5, baths=3, sqft=2400, lot=0.1, year=1951, type="Multi-Family", status="Active", wf=False, hue=200, open="",
         title="Two-unit investment property blocks from the beach",
         desc="Two spacious units on Ventnor Avenue, a short walk from the boardwalk. Great for an owner-occupant or an investor looking for steady seasonal and year-round rental demand.",
         feats=["Two separate units", "Separate utilities", "Walk to the boardwalk", "Off-street parking", "Strong rental history"]),
    dict(slug="farmhouse-hammonton", addr="640 Bellevue Avenue", town="hammonton", price=479000, beds=4, baths=2, sqft=2300, lot=2.4, year=1925, type="Single Family", status="Active", wf=False, hue=60, open="",
         title="Restored farmhouse on 2.4 acres",
         desc="A beautifully restored 1925 farmhouse on 2.4 acres, just outside downtown Hammonton. Original woodwork, a wraparound porch and a modern kitchen blend character with comfort, and the barn is ready for hobbies or storage.",
         feats=["2.4 acres", "Wraparound porch", "Original woodwork", "Barn and outbuildings", "Minutes to downtown Hammonton"]),
    dict(slug="beach-block-cottage-brigantine", addr="14 Seaview Court", town="brigantine", price=779000, beds=3, baths=2, sqft=1700, lot=0.12, year=2015, type="Single Family", status="New", wf=True, hue=195, open="Sat 1–3 PM",
         title="Elevated cottage a short walk to the beach",
         desc="A sunny elevated cottage with a covered deck and outdoor shower, only steps from the beach. Open living space, a bright kitchen and ample storage under the home.",
         feats=["Elevated construction", "Covered deck and outdoor shower", "Under-house parking", "Walk to the beach", "Turn-key furnishings available"]),
    dict(slug="vacation-home-ocean-city", addr="826 Wesley Avenue", town="ocean-city", price=1250000, beds=4, baths=3, sqft=2200, lot=0.08, year=2017, type="Single Family", status="Active", wf=True, hue=210, open="",
         title="Vacation home between the boardwalk and the bay",
         desc="Ideal as a family getaway or rental, this four-bedroom Ocean City home puts the boardwalk and the bay within an easy walk. Open living, rooftop deck and an outdoor shower.",
         feats=["Rooftop deck", "Outdoor shower", "Strong rental potential", "Walk to the boardwalk", "Off-street parking"]),
    dict(slug="rental-apartment-somers-point", addr="320 Maryland Avenue, Apt 2", town="somers-point", price=2100, beds=2, baths=1, sqft=950, lot=0, year=1985, type="Rental", status="Active", wf=False, hue=215, open="",
         title="Two-bedroom apartment near the bay (rental)",
         desc="A cheerful two-bedroom apartment in Somers Point, close to Bay Avenue and the causeway. Off-street parking and in-unit laundry hookups. Monthly rent shown.",
         feats=["Off-street parking", "Laundry hookups", "Near Bay Avenue", "Pet policy: ask agent", "Available now"]),
]

ARTICLES = [
    dict(slug="how-to-buy-a-home-in-atlantic-county-nj", title="How to Buy a Home in Atlantic County, NJ: A 9-Step Guide", date="2026-09-02", read=7,
         desc="A step-by-step guide to buying a home in Atlantic County, NJ — from budgeting and pre-approval to attorney review, inspections and closing.", hue=205,
         body="""<p>Buying a home in Atlantic County is a big decision, and the process has a few New Jersey–specific steps. Here is how a typical purchase unfolds, from the first budget conversation to the day you get your keys.</p>
<h2>1. Set a realistic budget</h2><p>Start with your monthly comfort zone, not the maximum a lender will approve. Include principal and interest, property taxes, homeowners insurance, flood insurance if required, and any association fees. Our <a href="/buy/mortgage-calculator/">mortgage calculator</a> helps you test different prices and down payments.</p>
<h2>2. Get pre-approved</h2><p>A pre-approval letter shows sellers you are serious and tells you exactly what you can afford. You will typically provide pay stubs, tax returns, bank statements and permission to check your credit. <a href="/buy/pre-approval/">Learn how pre-approval works</a>.</p>
<h2>3. Choose a buyer's agent</h2><p>Pick someone who knows the towns you are considering and the local rules that affect your purchase. See <a href="/guides/how-to-choose-a-buyers-agent/">how to choose a buyer's agent</a> or <a href="/agents/">browse our agents</a>.</p>
<h2>4. Search and tour homes</h2><p>Set up <a href="/account/">listing alerts</a> so you hear about new homes the moment they hit the market, and tour the ones that fit. Compare neighborhoods using our <a href="/homes-for-sale/">town guides</a>.</p>
<h2>5. Make an offer</h2><p>Your agent will help you review recent comparable sales, decide on a price and negotiate terms such as closing date, repairs and contingencies.</p>
<h2>6. Attorney review</h2><p>In New Jersey, once the contract is signed by both parties, attorneys typically have a short review period — commonly three business days — to review it and propose changes or cancel. Hire a real estate attorney before you make an offer.</p>
<h2>7. Inspections and due diligence</h2><p>Schedule a home inspection right away. Depending on the property, you may also want a septic or well inspection, a wood-destroying insect inspection, a radon test and a review of the flood zone. See our guide to <a href="/guides/flood-zones-and-flood-insurance-jersey-shore/">flood zones and flood insurance</a>.</p>
<h2>8. Mortgage commitment and appraisal</h2><p>Your lender orders an appraisal and finishes underwriting. Avoid new debt or large purchases until after closing.</p>
<h2>9. Final walk-through and closing</h2><p>Just before closing you will walk through the home to confirm its condition, review your closing figures and sign the paperwork. Read <a href="/guides/new-jersey-closing-costs-and-transfer-fees/">our closing cost guide</a> so there are no surprises.</p>
<div class="callout"><b>Ready to start?</b> <a href="/contact/">Talk to a Balsley Losco agent</a> or <a href="/search/">start your home search</a>.</div>"""),
    dict(slug="first-time-home-buyer-programs-new-jersey", title="First-Time Home Buyer Programs in New Jersey", date="2026-09-09", read=6,
         desc="An overview of first-time homebuyer programs in New Jersey, including NJHMFA, FHA, VA, USDA and low-down-payment conventional loans.", hue=140,
         body="""<p>If you are buying your first home in New Jersey, there are several programs designed to lower the cost of getting started. Program details, income limits and purchase price limits change, so always confirm current terms with a lender or the program administrator before you make decisions.</p>
<h2>NJHMFA programs</h2><p>The New Jersey Housing and Mortgage Finance Agency (NJHMFA) offers first-time homebuyer mortgage products and down payment assistance for eligible buyers. Eligibility typically depends on income, purchase price and the property's location. Check <a href="https://www.njhousing.gov" rel="noopener">njhousing.gov</a> for the latest requirements.</p>
<h2>FHA loans</h2><p>FHA-insured loans allow lower down payments (as low as 3.5% with qualifying credit) and more flexible credit guidelines. They also carry mortgage insurance premiums.</p>
<h2>VA loans</h2><p>Eligible veterans, service members and surviving spouses may qualify for VA loans with no required down payment and no monthly mortgage insurance.</p>
<h2>USDA loans</h2><p>Some properties outside the denser parts of the county may qualify for USDA loans, which offer zero down payment for eligible borrowers and locations.</p>
<h2>Conventional low-down-payment loans</h2><p>Several lenders offer conventional programs with as little as 3% down for first-time buyers. These can be a good fit when you have strong credit.</p>
<h2>Questions to ask your lender</h2><ul><li>What are the current income and price limits for the programs I qualify for?</li><li>How do these programs affect my interest rate and mortgage insurance?</li><li>Are there homebuyer education requirements?</li><li>Can down payment assistance be combined with other programs?</li></ul>
<div class="callout">Our partner lenders can walk you through your options. <a href="/buy/pre-approval/">Get started with pre-approval</a>.</div>"""),
    dict(slug="flood-zones-and-flood-insurance-jersey-shore", title="Flood Zones and Flood Insurance: What Jersey Shore Buyers Need to Know", date="2026-09-16", read=6,
         desc="How FEMA flood zones, elevation certificates and flood insurance affect buying a home at the Jersey Shore.", hue=200,
         body="""<p>If you are shopping for a home on Absecon Island, Brigantine, Ocean City or along the bay, flood zones matter. Understanding them early will protect your budget and your offer.</p>
<h2>What is a flood zone?</h2><p>FEMA publishes flood maps that divide areas by flood risk. Properties in Special Flood Hazard Areas — zones that begin with A or V — have the highest risk. Zone X areas have lower risk, though flooding can still happen.</p>
<h2>Is flood insurance required?</h2><p>If your home is in a Special Flood Hazard Area and you finance it with a federally backed or regulated lender, flood insurance is required. Many buyers carry it even when it is not required.</p>
<h2>Get an elevation certificate</h2><p>An elevation certificate documents a building's elevation relative to the base flood elevation. Insurers use it to price a policy, so ask for an existing one before you make an offer. Lower premiums often go with higher elevation.</p>
<h2>Ask the right questions</h2><ul><li>What flood zone is the property in, and when was the last map update?</li><li>Is there an elevation certificate on file?</li><li>Has the home had flood claims or damage?</li><li>What would an insurance quote look like for this specific address?</li></ul>
<h2>Include insurance in your budget</h2><p>Request quotes before you finalize your offer so your monthly payment estimate includes flood insurance. Our <a href="/buy/mortgage-calculator/">mortgage calculator</a> has a field for insurance and other monthly costs.</p>
<div class="callout">Considering an island or bayfront home? <a href="/contact/">Our agents can walk you through it</a>.</div>"""),
    dict(slug="new-jersey-closing-costs-and-transfer-fees", title="New Jersey Closing Costs and Transfer Fees Explained", date="2026-09-23", read=6,
         desc="A plain-English guide to buyer closing costs in New Jersey, including lender fees, title insurance, attorney fees and the 1% 'mansion tax'.", hue=45,
         body="""<p>Closing costs are the fees and prepaid expenses due when your purchase is finalized. Buyers commonly budget in the range of 2% to 5% of the purchase price, but the exact amount depends on your loan, your title company and the property.</p>
<h2>Common buyer closing costs</h2><ul><li><b>Lender fees:</b> origination, underwriting, appraisal and credit report charges.</li><li><b>Title insurance and search:</b> protects you and your lender against ownership defects.</li><li><b>Attorney fees:</b> in New Jersey, most buyers hire a real estate attorney.</li><li><b>Recording fees:</b> county charges to record the deed and mortgage.</li><li><b>Prepaid items and escrows:</b> homeowners insurance, flood insurance if required, and a portion of property taxes.</li><li><b>Inspection costs:</b> typically paid when the inspections are done, before closing.</li></ul>
<h2>The 1% fee on homes over $1 million</h2><p>New Jersey charges a one percent fee on residential purchases above $1,000,000. This fee is typically paid by the buyer. If you are shopping near that price point, ask your attorney exactly how it applies.</p>
<h2>Seller costs</h2><p>Sellers usually pay the real estate commission, the realty transfer fee, any remaining mortgage payoff and any agreed-upon repairs or credits.</p>
<h2>How to reduce surprises</h2><ul><li>Request a loan estimate from at least two lenders.</li><li>Ask your attorney for an estimate of title and recording costs.</li><li>Get insurance quotes early.</li><li>Ask whether the seller can contribute toward closing costs.</li></ul>
<p class="muted">Tax and fee rules change. This guide is general information, not legal or tax advice — confirm current figures with your attorney.</p>"""),
    dict(slug="island-vs-mainland-where-to-buy-in-atlantic-county", title="Island vs. Mainland: Where Should You Buy in Atlantic County?", date="2026-09-30", read=5,
         desc="Compare barrier-island and mainland towns in Atlantic County, NJ, including lifestyle, flood considerations, space and commute.", hue=185,
         body="""<p>Atlantic County gives buyers two very different options: barrier-island towns with beach access, and mainland communities with more space and convenience. Here is how they compare.</p>
<h2>Island towns</h2><p>Absecon Island (Ventnor, Margate, Atlantic City and Longport), Brigantine and nearby Ocean City offer beach access, boardwalks and a true shore lifestyle. Trade-offs include higher flood risk and insurance costs, smaller lots, summer traffic and seasonal crowds.</p>
<h2>Mainland towns</h2><p>Northfield, Linwood, Somers Point, Egg Harbor Township, Galloway, Absecon, Hamilton Township and Hammonton generally offer larger lots, newer construction and easier highway access. Several are just minutes from the beach.</p>
<h2>Questions to help you decide</h2><ul><li>Will this be a year-round home, a second home or a rental?</li><li>How often will you use the beach — daily or occasionally?</li><li>How much yard and living space do you need?</li><li>What commute do you have?</li><li>What is your tolerance for flood insurance costs?</li></ul>
<h2>Explore the towns</h2><p>Browse our guides: <a href="/homes-for-sale/ventnor/">Ventnor</a>, <a href="/homes-for-sale/margate/">Margate</a>, <a href="/homes-for-sale/brigantine/">Brigantine</a>, <a href="/homes-for-sale/linwood/">Linwood</a>, <a href="/homes-for-sale/northfield/">Northfield</a> and <a href="/homes-for-sale/">all the areas we serve</a>.</p>"""),
    dict(slug="how-to-choose-a-buyers-agent", title="How to Choose a Buyer's Agent You Can Trust", date="2026-10-07", read=4,
         desc="What to look for in a buyer's agent, and the questions to ask before you hire one, from local knowledge to negotiation skills.", hue=120,
         body="""<p>Of all the decisions you will make when buying a home, there is none more important than the person you choose to represent you. Your agent explains the process, helps you find the right home and guides you through every step.</p>
<h2>What to look for</h2><ul class="checks"><li>Deep knowledge of the communities you are interested in</li><li>Awareness of local and state requirements that affect your transaction</li><li>Strong, effective negotiation skills</li><li>Ongoing training and professional designations</li><li>Modern technology and responsive communication</li><li>Backing from a brokerage with experienced professional support</li></ul>
<h2>Questions to ask</h2><ul><li>How many buyers have you helped in the towns I am considering?</li><li>How will you keep me updated on new listings?</li><li>What is your approach to negotiating?</li><li>Can you walk me through the typical timeline?</li><li>What services does your brokerage offer?</li></ul>
<div class="callout">Balsley Losco has served Atlantic County since 1954. <a href="/agents/">Meet our agents</a>.</div>"""),
    dict(slug="what-is-my-home-worth", title="What's My Home Worth? How Pricing Really Works", date="2026-10-14", read=5,
         desc="How agents estimate home value, the difference between a CMA and an online estimate, and how to prepare your home for the best price.", hue=30,
         body="""<p>Online estimates are a good starting point, but they cannot see your kitchen, your updates or your block. Here is how a local agent actually arrives at a number.</p>
<h2>Comparable sales</h2><p>Agents study recent sales of similar homes nearby — same neighborhood, size, age and condition — and adjust for differences. This is the heart of a comparative market analysis (CMA).</p>
<h2>Condition and updates</h2><p>Kitchens, baths, roofs, windows and systems all influence value. A walk-through lets your agent account for details an algorithm cannot see.</p>
<h2>Market conditions</h2><p>How many homes are for sale, how fast they sell and how much buyers are negotiating all shape the best list price and strategy.</p>
<h2>CMA vs. online estimate</h2><p>An automated estimate relies on public records and statistical models. A CMA relies on a professional's knowledge of the street, the buyers and what actually sells.</p>
<h2>Preparing to sell in New Jersey</h2><ul><li>Ask your town what certificates or inspections are needed before closing, such as a certificate of occupancy or smoke and carbon monoxide detector certification.</li><li>Declutter, deep clean and complete small repairs.</li><li>Gather records for upgrades, warranties and utility bills.</li></ul>
<div class="callout"><b>Find out what your home is worth.</b> <a href="/sell/home-value/">Request a free, no-obligation home valuation</a>.</div>"""),
]

FAQ_HOME = [
    ("How do I search for homes for sale in Atlantic County, NJ?", "Use the search on this page to filter by town, price, bedrooms and property type, or browse our guides to Northfield, Linwood, Somers Point, Margate, Ventnor and more. Create a free account to save favorites and get instant email alerts."),
    ("How much do I need to buy a home in New Jersey?", "It depends on the price and the loan program. Many buyers put down between 3% and 20%, plus closing costs that are commonly estimated at 2%–5% of the price. Use our mortgage calculator and speak to a lender about the programs you qualify for."),
    ("Do I need a real estate attorney in New Jersey?", "Most New Jersey transactions involve attorneys for both sides, and contracts typically include a short attorney review period after signing. Your agent can recommend local attorneys you can interview."),
    ("Does Balsley Losco help with rentals and commercial properties?", "Yes. We list rentals through our rental search and application portal, and our commercial and investment division handles commercial properties."),
    ("How long has Balsley Losco been in business?", "Balsley Losco Real Estate has served Atlantic County since 1954 and is owned and operated by local families who have lived in the area for generations."),
]

FAQ_BUY = [
    ("How much house can I afford?", "Lenders look at your income, debts, credit score, down payment and the property's taxes and insurance. A pre-approval gives you an exact number, and our mortgage calculator gives you a quick estimate."),
    ("Should I get pre-approved before I start looking?", "Yes. Pre-approval shows sellers you are serious, speeds up your offer and helps you shop within your budget."),
    ("What is attorney review in New Jersey?", "After both parties sign the contract, attorneys typically have a short window — commonly three business days — to review it and propose changes or cancel. It is a normal part of New Jersey transactions."),
    ("Do I need flood insurance?", "If the home is in a FEMA Special Flood Hazard Area and has a federally backed loan, yes. Many buyers carry it even when it is not required. Ask for an elevation certificate and an insurance quote before you make an offer."),
    ("How long does it take to buy a home?", "Searching can take weeks or months. From signed contract to closing, most transactions take about 30 to 60 days, depending on financing and inspections."),
]

TESTIMONIAL_NOTE = "Client reviews coming soon."
