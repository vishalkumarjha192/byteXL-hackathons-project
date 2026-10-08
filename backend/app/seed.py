"""Development seed data. Run: python -m app.seed   (safe to re-run; skips if already seeded)."""
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import (
    AITool, Application, BrandProfile, Contract, ContractStatus, Conversation, CreatorProfile, Deliverable, DeliverableKind,
    Language, MediaType, Message, Niche, Payment, PaymentStatus, Portfolio, Project, ProjectStatus, Report, Review, Role, Skill, User,
)
from app.services.review_service import recompute_creator_rating
from app.seed_lookups import seed_lookups
from app.utils.security import hash_password

PASSWORD = "password123"
random.seed(7)

BRANDS = [
    ("Glowkind Skincare", "Beauty"), ("Northloop Fitness", "Fitness"), ("Tidepool Travel", "Travel"), ("Basil & Brine", "Food"),
    ("Kettle Finance", "Finance"), ("Threadwell Apparel", "Fashion"), ("Pixelbarn Games", "Gaming"), ("Stackly", "SaaS"),
    ("Cartwheel Goods", "E-commerce"), ("Voltmate Devices", "Technology"),
]
FIRST = ["Aisha", "Rohan", "Meera", "Liam", "Sofia", "Arjun", "Nina", "Kabir", "Elena", "Dev", "Zara", "Omar", "Priya", "Lucas", "Anaya",
         "Ethan", "Ishita", "Mateo", "Tara", "Noah", "Kiara", "Vikram", "Leah", "Samir", "Diya", "Jonas", "Riya", "Felix", "Naomi", "Yash"]
LAST = ["Verma", "Khanna", "Iyer", "Carter", "Rossi", "Mehta", "Bose", "Malik", "Petrova", "Nair", "Sheikh", "Haddad", "Sharma", "Silva", "Rao",
        "Brooks", "Kapoor", "Reyes", "Menon", "Larsen", "Gill", "Joshi", "Cohen", "Ali", "Desai", "Weber", "Singh", "Moreau", "Park", "Bhatt"]
CITIES = ["Mumbai", "Bengaluru", "Delhi", "Pune", "Hyderabad", "Chennai", "Lisbon", "Berlin", "Dubai", "Toronto"]
BIOS = [
    "I make scroll-stopping {skill} for {niche} brands using {tool}. Fast turnarounds and clear communication.",
    "{niche} specialist producing {skill} with {tool}. I script, generate and edit everything in-house.",
    "Former agency editor turned AI creator. {skill} for {niche} brands, delivered with two rounds of revisions.",
]
JOBS = [
    ("30-second {niche} Instagram Reel", "Reel", "We need a 30-second Reel introducing our new {niche} product with a strong hook in the first 3 seconds."),
    ("AI avatar explainer for {niche} launch", "Avatar video", "A 60-second presenter-style explainer in a friendly tone. Script help is welcome."),
    ("Product photography set for {niche} range", "Product images", "Ten clean product images on varied backgrounds for our store and ads."),
    ("TikTok UGC series: {niche}", "TikTok video", "Three UGC-style TikToks that feel native and honest, not salesy."),
]


def run() -> None:
    with SessionLocal() as db:
        seed_lookups(db)
        if db.scalar(select(User).where(User.email == "brand1@example.com")):
            print("Already seeded.")
            return
        pw = hash_password(PASSWORD)
        skills, niches = list(db.scalars(select(Skill))), list(db.scalars(select(Niche)))
        langs, tools = list(db.scalars(select(Language))), list(db.scalars(select(AITool)))

        brands = []
        for i, (name, industry) in enumerate(BRANDS, 1):
            u = User(email=f"brand{i}@example.com", password_hash=pw, role=Role.BRAND, is_verified=True)
            db.add(u); db.flush()
            b = BrandProfile(user_id=u.id, company_name=name, industry=industry, location=random.choice(CITIES),
                             description=f"{name} is a growing {industry.lower()} brand.", website=f"https://example.com/{i}")
            db.add(b); brands.append(b)

        creators = []
        for i in range(30):
            u = User(email=f"creator{i + 1}@example.com", password_hash=pw, role=Role.CREATOR, is_verified=True)
            db.add(u); db.flush()
            sk, ni, to = random.sample(skills, 2), random.sample([n for n in niches if n.name != "Other"], 2), random.sample(tools, 2)
            reviews = random.randint(0, 40)
            c = CreatorProfile(
                user_id=u.id, display_name=f"{FIRST[i]} {LAST[i]}", location=random.choice(CITIES),
                bio=random.choice(BIOS).format(skill=sk[0].name, niche=ni[0].name, tool=to[0].name),
                starting_price=random.choice([1500, 2500, 3000, 4000, 6000, 9000, 12000]), hourly_rate=random.choice([500, 800, 1200, 2000]),
                delivery_days=random.choice([2, 3, 5, 7, 10]), review_count=reviews,
                rating=round(random.uniform(4.2, 5.0), 1) if reviews else 0.0,
                completed_projects=reviews + random.randint(0, 5), verified=random.random() < 0.6,
                avatar=f"https://i.pravatar.cc/200?img={i + 1}",
            )
            c.skills, c.niches, c.languages, c.ai_tools = sk, ni, random.sample(langs, random.randint(1, 3)), to
            db.add(c); creators.append(c)
        db.flush()

        for n in range(50):
            c = creators[n % 30]
            kind = random.choice([MediaType.IMAGE, MediaType.IMAGE, MediaType.LINK])
            db.add(Portfolio(creator_id=c.id, title=f"{random.choice(c.niches).name} {random.choice(['Reel', 'Ad', 'Product shot', 'Explainer'])}",
                             description="Sample from a recent client project.", media_type=kind,
                             media_url=f"https://picsum.photos/seed/p{n}/800/450" if kind == MediaType.IMAGE else f"https://example.com/work/{n}"))

        projects = []
        for n in range(20):
            brand = brands[n % 10]
            title, ctype, desc = JOBS[n % 4]
            niche = brand.industry or "Lifestyle"
            projects.append(Project(
                brand_id=brand.id, title=title.format(niche=niche), content_type=ctype, description=desc.format(niche=niche.lower()),
                category=random.choice(skills).name, budget=random.choice([3000, 5000, 8000, 12000, 20000]), currency="INR",
                deadline=date.today() + timedelta(days=random.randint(7, 45)), language=random.choice(["English", "Hindi", "English"]),
                platform=random.choice(["Instagram", "TikTok", "YouTube"]), target_audience="Adults 22-40 who shop online",
            ))
        db.add_all(projects); db.flush()
        db.add(User(email="admin@example.com", password_hash=pw, role=Role.ADMIN, is_verified=True))
        for c in creators[4:7]:
            c.featured = True
        for c in [c for c in creators if not c.verified][:3]:
            c.verification_requested = True

        # The first four projects are already finished, with a contract, chat history and reviews both ways.
        chat = [("brand", "Welcome aboard. The brief has everything, shout if anything is unclear."), ("creator", "Thanks! I will send a first draft in two days."),
                ("brand", "Draft looks great, just a tighter hook please."), ("creator", "Done, final files are in.")]
        for n, p in enumerate(projects[:4]):
            c, brand = creators[n], next(b for b in brands if b.id == p.brand_id)
            p.status = ProjectStatus.COMPLETED
            fee = round(p.budget * settings.PLATFORM_FEE_PERCENT / 100, 2)
            db.add(Contract(project_id=p.id, brand_id=brand.id, creator_id=c.id, agreed_price=p.budget, platform_fee=fee,
                            creator_amount=round(p.budget - fee, 2), status=ContractStatus.COMPLETED))
            db.add(Payment(project_id=p.id, payer_id=brand.user_id, recipient_id=c.user_id, amount=p.budget, platform_fee=fee, currency=p.currency,
                           status=PaymentStatus.RELEASED, provider="mock", provider_payment_id=f"mock_pay_seed{n}", released_at=datetime.now(timezone.utc)))
            db.add(Deliverable(project_id=p.id, creator_id=c.id, file_url=f"https://example.com/final/{n}.mp4", kind=DeliverableKind.FINAL, version=1, status="APPROVED"))
            conv = Conversation(project_id=p.id)
            db.add(conv); db.flush()
            for who, text in chat:
                db.add(Message(conversation_id=conv.id, sender_id=brand.user_id if who == "brand" else c.user_id, message=text, read_at=datetime.now(timezone.utc)))
            db.add(Review(project_id=p.id, reviewer_id=brand.user_id, reviewee_id=c.user_id, rating=random.choice([4, 5]), comment="Fast, creative and easy to work with. Would hire again."))
            db.add(Review(project_id=p.id, reviewer_id=c.user_id, reviewee_id=brand.user_id, rating=5, comment="Clear brief and quick feedback."))
            c.completed_projects += 1
            db.flush()
            recompute_creator_rating(db, c)

        pairs = set()
        while len(pairs) < 40:
            pairs.add((random.choice(projects[4:]).id, random.choice(creators).id))
        for pid, cid in pairs:
            db.add(Application(project_id=pid, creator_id=cid, proposed_price=random.choice([2500, 4500, 7000, 11000]),
                               delivery_days=random.choice([2, 3, 5, 7]),
                               proposal="I have made similar content for brands in this space and can start right away. Happy to share samples and discuss the brief."))
        db.flush()
        first_item = db.scalars(select(Portfolio)).first()
        reporter = db.scalar(select(User).where(User.email == "brand2@example.com"))
        db.add_all([
            Report(reporter_id=reporter.id, target_type="PROJECT", target_id=projects[10].id, reason="SPAM", details="Looks like a duplicate listing."),
            Report(reporter_id=reporter.id, target_type="CREATOR", target_id=creators[8].id, reason="FRAUD", details="Portfolio seems copied from elsewhere."),
            Report(reporter_id=reporter.id, target_type="PORTFOLIO", target_id=first_item.id, reason="INAPPROPRIATE"),
        ])
        db.commit()
        print(f"Seeded 10 brands, 30 creators, 20 projects (4 completed with chat and reviews), 50 portfolio items, 40 applications, 3 reports. Password for all: {PASSWORD}. Admin login: admin@example.com")


if __name__ == "__main__":
    run()
