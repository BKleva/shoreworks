"""Starter sources: official government pages only, verified via web search 2026-09-28.

Scope is a county name (Monmouth, Ocean, Bergen, Morris), or "County:Municipality".
County-level only for now; no statewide sources.
Towns whose codes live on eCode360 / Municode (which block bots) need the Import tab.
Add more in the Sources tab; the scheduler re-crawls everything on a timer.
"""

SEEDS = [
    # --- Monmouth County Planning Board ---
    ("Monmouth", "Monmouth County Master Plan (planning board page)",
     "https://www.visitmonmouth.com/Page.aspx?Id=4197", "master_plan", 40),
    ("Monmouth", "Monmouth County Scenic Roadway Plan (PDF)",
     "https://www.visitmonmouth.com/documents/24/Monmouth%20County%20Scenic%20Roadway%20Plan.pdf", "master_plan", 1),
    ("Monmouth", "Monmouth County Master Plan Overview (PDF)",
     "https://www.co.monmouth.nj.us/documents/24/Master%20Plan%20Overview.pdf", "master_plan", 1),
    ("Monmouth", "Route 9 / Western Monmouth Development Plan corridor profile (PDF)",
     "https://www.co.monmouth.nj.us/documents/24/Western%20Monmouth%20Development%20Plan%20Corridor%20Profile.pdf", "master_plan", 1),
    ("Monmouth", "Monmouth County Scenic Byways brochure (PDF)",
     "https://www.co.monmouth.nj.us/documents/24%5CScenic%20Byways%20Brochure%20-%20Introduction.pdf", "master_plan", 1),
    ("Monmouth", "Monmouth County Planning Board reports & data",
     "https://www.co.monmouth.nj.us/FormsA.aspx?AgencyID=24&MenuID=140", "master_plan", 40),

    # --- Morris County Office of Planning & Preservation ---
    ("Morris", "Morris County: municipal master plans & ordinances index",
     "https://www.morriscountynj.gov/Departments/Planning-and-Preservation/Ordinances", "auto", 60),
    ("Morris", "Morris County Planning & Preservation: publications",
     "https://www.morriscountynj.gov/Departments/Planning-and-Preservation/Publications-Documents", "master_plan", 40),

    # --- Ocean County Planning Board ---
    ("Ocean", "Ocean County Comprehensive Master Plan (planning dept. page)",
     "https://planning.co.ocean.nj.us/frmSROceanCountyComprehensiveMasterPlan", "master_plan", 40),
    ("Ocean", "Ocean County Comprehensive Master Plan (PDF)",
     "https://www.co.ocean.nj.us/WebContentFiles/fedb8826-cb81-4b9f-be8d-e71e4fcd1fa4.pdf", "master_plan", 1),
    ("Ocean", "Ocean County Department of Planning",
     "https://planning.co.ocean.nj.us/", "master_plan", 30),

    # --- Bergen County Department of Planning & Engineering ---
    ("Bergen", "Bergen County Master Plan",
     "https://bergencountynj.gov/bergen-county-department-of-planning-engineering/bergen-county-master-plan/", "master_plan", 40),
    ("Bergen", "Bergen County: municipal master plans index",
     "https://bchapeweb.co.bergen.nj.us/planning/masterplan.asp", "master_plan", 60),
    ("Bergen", "Bergen County: municipal ordinances index",
     "https://bchapeweb.co.bergen.nj.us/planning/ordinance.asp", "ordinance", 60),
]
