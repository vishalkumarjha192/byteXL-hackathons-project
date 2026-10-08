from sqlalchemy.orm import Session

from app.models import AITool, Language, Niche, Skill

DATA = {
    Skill: ["AI UGC", "AI Avatar", "AI Video", "AI Image", "Voiceover", "Product Ads", "Social Media Content"],
    Niche: ["Beauty", "Fashion", "Fitness", "SaaS", "Food", "Travel", "Finance", "E-commerce", "Technology", "Gaming", "Other"],
    Language: ["English", "Hindi", "Spanish", "French", "German", "Arabic", "Tamil", "Bengali"],
    AITool: ["ChatGPT", "Midjourney", "Runway", "Kling", "HeyGen", "ElevenLabs", "Veo", "Other"],
}


def seed_lookups(db: Session) -> None:
    for model, names in DATA.items():
        have = {n for (n,) in db.query(model.name).all()}
        db.add_all(model(name=n) for n in names if n not in have)
    db.commit()
