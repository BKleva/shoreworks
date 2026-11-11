# Launching Shore Match: a practical playbook

Two-sided marketplaces fail from an empty room, not from bad code. The software is the easy part.

## 1. Before you open the doors

| Item | Why it matters |
|---|---|
| **Securities-law review (do this first)** | Publicly advertising investment opportunities can be treated as "general solicitation" in the US. This app keeps proposals behind login and an investor acknowledgement, and the Terms say the platform doesn't broker or recommend securities, but **have a securities attorney review the model, Terms and Privacy Policy** before charging fees or taking success-based compensation (that can require broker-dealer registration). The legal pages here are a plain-language starting draft, not legal advice. |
| Set `SESSION_SECRET` and `ADMIN_EMAILS` | Required for deploy (see README). |
| Custom domain + email sender | Trust: `match.yourdomain.com`, replies from a real address. |
| Pick the unit of "local" | Edit `config.js` (towns/industries). A tighter region feels busier and more valuable. |

## 2. Solve the cold start: supply first, then demand

1. **Recruit 8-10 investors by hand** (angels, local business owners with capital, bank/credit-union contacts, SCORE mentors, chamber of commerce members). Offer to build their profile for them in a 15-minute call, and seed the `verified` badge via the Admin tab.
2. **Then recruit 15-20 founders** through incubators, SBDCs, the chamber, local accelerators and college entrepreneurship programs. Founders come where investors already are.
3. Hold a **live "pitch night"** to launch: founders pitch in person, the app is where follow-ups happen. It gives you a deadline, press, and a reason to sign up *now*.
4. Measure the only metric that matters early: **accepted connections per week**. Not signups.

## 3. Weekly operating loop (first 90 days)

- Read every new proposal; nudge weak ones (the clearer the ask, the better the matches).
- Personally introduce strong matches that haven't connected within 3 days. Manual matchmaking teaches you what to automate.
- Check Admin → verify new members, hide anything misleading.
- Ask each connected pair after 2 weeks what happened. Those stories are your marketing.

## 4. Monetization options (after traction, and after legal review)

Founder listing fee or premium placement · investor-network membership · sponsor/partner slots (banks, law firms, accountants) · white-label for other regions or chambers of commerce. Avoid fees contingent on a deal closing without counsel.

## 5. Selling this as a product to clients

The same codebase can be resold: a **chamber of commerce**, **economic development office**, **university** or **angel network** each wants their own branded instance. Change `config.js`, swap the name/colors, deploy a new Netlify site, and charge setup + monthly. Use the seeded demo (`npm run seed`) to show them a populated platform in a sales call.

## 6. Next features, by likely value

1. Email notifications (new interest, accepted, new message). Biggest engagement lift.
2. Weekly digest: "3 new proposals match your thesis".
3. Document sharing and NDA acknowledgement in the thread.
4. Postgres/Supabase backend once you pass a few thousand records.
5. Analytics (accepted connections, time-to-first-reply) in the Admin view.
