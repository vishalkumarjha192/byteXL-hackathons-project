"""Rule-based creator/project matching behind a swappable strategy interface.

An LLM-based strategy can be added later: subclass MatchingStrategy, register it in STRATEGIES and set
MATCHING_STRATEGY in .env. Callers only use get_strategy().score(...).
"""
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date

from app.config import settings
from app.models import CreatorProfile, Project

# content-type keywords -> skills that suggest the creator can deliver it (ordered by priority)
TYPE_RULES = [
    (r"avatar|presenter|talking head", ["AI Avatar"]),
    (r"image|photo|picture|shoot|packshot", ["AI Image"]),
    (r"voice|narrat|podcast|audio", ["Voiceover"]),
    (r"ugc|testimonial|review|unbox", ["AI UGC"]),
    (r"\bads?\b|advert|commercial|promo", ["Product Ads"]),
    (r"reel|tiktok|short|video|social|post|story", ["Social Media Content", "AI Video"]),
]
STOP = set("the and for with that this your our from have will into about their they them more than just who what when where which".split())


def type_skills(text: str) -> list[str]:
    out: list[str] = []
    for pattern, skills in TYPE_RULES:
        if re.search(pattern, text.lower()):
            out += [s for s in skills if s not in out]
    return out


def _tokens(text: str | None) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", (text or "").lower()) if w not in STOP}


@dataclass
class Match:
    score: int
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class MatchingStrategy(ABC):
    @abstractmethod
    def score(self, creator: CreatorProfile, project: Project, brand_industry: str | None) -> Match: ...


class RuleBasedMatching(MatchingStrategy):
    """Weights add up to 100: skill 30, language 15, niche 15, budget 15, content type 10, quality 10, keywords 5."""

    def score(self, creator, project, brand_industry):
        skills = {s.name for s in creator.skills}
        niches = {n.name for n in creator.niches}
        langs = {l.name for l in creator.languages}
        pts, reasons, warnings = 0.0, [], []

        if project.category in skills:
            pts += 30
            reasons.append(f"Offers {project.category}")
        if not project.language:
            pts += 15
        elif project.language in langs:
            pts += 15
            reasons.append(f"Speaks {project.language}")
        if not brand_industry:
            pts += 7.5
        elif brand_industry in niches:
            pts += 15
            reasons.append(f"Works with {brand_industry} brands")
        wanted = type_skills(project.content_type or "")
        if not wanted:
            pts += 5
        elif set(wanted) & skills:
            pts += 10
            reasons.append(f"Experienced with {project.content_type}")
        price = creator.starting_price
        if project.currency != "INR" or price is None:
            pts += 7  # creator prices are in INR, so other currencies cannot be compared
        elif price <= project.budget:
            pts += 15
            reasons.append("Starting price fits the budget")
        elif price <= project.budget * 1.5:
            pts += 7
        else:
            warnings.append("Starting price is above the budget")
        overlap = len(_tokens(creator.bio) & _tokens(f"{project.title} {project.description} {project.target_audience}"))
        pts += min(overlap, 5)

        rating = creator.rating if creator.review_count else 3.5  # newcomers get a neutral rating, not zero
        pts += rating / 5 * 6 + (2 if creator.verified else 0) + min(creator.completed_projects, 10) / 10 * 2
        if creator.review_count and creator.rating >= 4.5:
            reasons.append(f"Rated {creator.rating:.1f}")
        if creator.verified:
            reasons.append("Verified creator")

        if project.deadline and creator.delivery_days and (project.deadline - date.today()).days < creator.delivery_days:
            pts -= 10
            warnings.append(f"Usually delivers in {creator.delivery_days} days, which may miss the deadline")
        return Match(score=int(round(max(0, min(100, pts)))), reasons=reasons, warnings=warnings)


STRATEGIES: dict[str, type[MatchingStrategy]] = {"rules": RuleBasedMatching}


def get_strategy() -> MatchingStrategy:
    try:
        return STRATEGIES[settings.MATCHING_STRATEGY]()
    except KeyError:
        raise RuntimeError(f"Unknown MATCHING_STRATEGY '{settings.MATCHING_STRATEGY}'. Available: {', '.join(STRATEGIES)}")
